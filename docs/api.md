# API and lifecycle contracts

## `createTask(operation, options?)`

The operation receives `(input, { signal, id })`. Return a value or a promise. Both thrown errors and rejected promises become explicit error results.

Options:

| Option        | Default     | Meaning                                                                             |
| ------------- | ----------- | ----------------------------------------------------------------------------------- |
| `initialData` | `undefined` | Data available before the first successful request.                                 |
| `concurrency` | `'latest'`  | `'latest'` supersedes older work; `'single'` returns a busy result for overlaps.    |
| `debounceMs`  | `0`         | Wait for an input pause before executing. Acknowledgment is immediate.              |
| `delayMs`     | `150`       | Delay before visual pending feedback. Does not delay the request or acknowledgment. |
| `slowMs`      | `2500`      | Time until more helpful slow-request feedback. Independent of `delayMs`.            |
| `timeoutMs`   | disabled    | Local timeout, reported as `TimeoutError`. Does not undo server work.               |

Timer values must be finite, non-negative numbers no larger than 2,147,483,647. A zero delay enables that feedback immediately. An operation which never settles remains pending until explicitly cancelled, superseded, disposed, or timed out.

With debounce enabled, `input` and `isPending` update synchronously and `isScheduled` is true until the operation starts. Only the latest accepted input executes. Feedback and timeout timers start at execution, excluding the debounce interval. `flush()` starts scheduled work immediately and is a no-op once it has started. Cancellation, reset, and disposal prevent scheduled work from running. Single concurrency blocks overlap during scheduling as well as execution. `retry()` also follows the configured debounce policy.

### Snapshot

`getSnapshot()` returns a referentially stable, shallowly frozen snapshot until the next state change:

```ts
{
  status: 'idle' | 'pending' | 'success' | 'error';
  input: Input | undefined;
  data: Output | undefined;
  error: unknown;
  isPending: boolean;
  isScheduled: boolean;
  showPending: boolean;
  isSlow: boolean;
}
```

Data stays available during pending and error states. Treat data and input as immutable; Steady does not deep-clone application objects.

### Results

`run(input)` and `retry()` resolve to a discriminated result:

```ts
type TaskResult<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown }
  | { status: 'superseded' | 'cancelled' | 'busy' | 'disposed' | 'idle' };
```

Superseded and cancelled promises settle immediately, even when a transport ignores the signal. Late success and error responses cannot change the current snapshot. `retry()` reruns the most recently accepted input; before a run or after a reset, it returns `idle`.

`cancel()` returns to idle while retaining successful data and the last input. `reset()` restores the initial snapshot and forgets retry input. `dispose()` cancels work, clears timers and subscribers, and makes future calls return `disposed`.

`subscribe(listener)` returns an unsubscribe function. Listeners are synchronous and should not throw. `getInitialSnapshot()` returns the stable initial snapshot for server rendering and hydration. Build separate stores per server request; do not share user data in a process-wide singleton.

## `createNavigation(load, { initial, prefetch?, ...feedback })`

`initial` is `{ destination: string, data: T }`. `load(destination, context)` returns the destination's data. The store adds:

- `selected`: requested destination while pending; otherwise the committed destination.
- `current`: the destination whose data has committed.
- `data`: the most recently committed `{ destination, data }` pair; always defined, including in the TypeScript type.

Methods are `navigate`, `retry`, `prefetch`, `invalidatePrefetch`, `cancel`, `reset`, and `dispose`. Navigation always uses latest-intent semantics. Failure and cancellation restore `selected` to `current`; failed destination information remains in `input` for recovery. Navigating to the current destination loads it again, consuming a matching prefetch if available.

This is a content-navigation primitive, not a URL router. An adapter must own browser history, back/forward navigation, scroll, focus, and redirects. See [integrations](integrations.md).

### Prefetch options and results

Prefetch is disabled by default. Set `prefetch: {}` to opt in. Requests begin only when you call `prefetch(destination)`.

| Option          | Default  | Meaning                                                                                                    |
| --------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `ttlMs`         | `10_000` | Lifetime from successful completion. Repeated access does not extend it.                                   |
| `maxEntries`    | `8`      | Maximum speculative entries, including in-flight work. Completed entries use least-recently-used eviction. |
| `maxConcurrent` | `2`      | Maximum simultaneous speculative requests. Excess calls are skipped, not queued.                           |
| `timeoutMs`     | `5_000`  | Speculative timeout. Removed when navigation claims the request.                                           |

Limits must be positive safe integers; timer durations follow the same constraints as task timers. A zero TTL disables retention after completion while preserving in-flight deduplication. Expired entries are pruned on access; settled entries do not keep background timers alive.

```ts
type PrefetchResult<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown }
  | {
      status: 'skipped';
      reason: 'disabled' | 'capacity' | 'concurrency' | 'active';
    }
  | { status: 'cancelled' | 'disposed' };
```

Repeated prefetch calls for an existing destination share the exact same promise. Prefetch never changes the navigation snapshot or surfaces an error there. Failed entries are removed so a later navigation can fetch fresh data. The `active` skip reason means that destination is already being loaded by a foreground navigation.

Navigation consumes a matching entry once. If it is still pending, cancellation ownership transfers to that navigation, its speculative timeout is cleared, and the navigation's own optional timeout starts. Superseding, cancelling, or disposing that navigation requests abort of the original transport. An actual navigation is never blocked by a speculative request budget; foreground requests are outside that budget. Foreground successes do not populate the speculative buffer.

`invalidatePrefetch(destination?)` removes one exact key or all speculative entries and requests abort of their pending work. It does not affect a request already claimed by navigation. `reset()` clears both speculative entries and navigation state; `dispose()` settles and cleans up all owned work. Speculative loader contexts have negative `id` values; foreground task ids are positive. A promoted request keeps its original context and signal.

Keys are exact strings. Invalidate after writes or user-context changes; include relevant filters and identity in keys. Operation callback changes do not invalidate already warmed data. See [prefetching and debounce](performance.md) for integration guidance.

## `createMutation(write, { initialData, optimistic?, ...feedback })`

The write returns authoritative data of the same type as `initialData`. A pure `optimistic(confirmed, input)` callback may project immediate UI state. Return new data; never mutate the confirmed object.

Snapshots include `data` (projected while pending), `confirmed`, `input`, `error`, and the same status/feedback flags as tasks. A failure restores the latest confirmed data. If projection throws, no write starts and the store reports the error.

Only one write may run per controller. Overlapping calls return `busy`; they do not queue or silently share an unrelated result. Independent controllers do not coordinate writes. Use server idempotency keys for protection across reloads, tabs, users, and processes.

`reconcile(data)` installs authoritative external data and reprojects any pending input onto it. If that projection throws, reconciliation throws and the previous snapshot is unchanged. A successful write's response becomes authoritative; applications that accept external updates concurrently must enforce server versions or reconcile again with the newest version.

There is no automatic retry, cancellation UI, or timeout for mutations. A disconnected client cannot know whether a server accepted a write. Local rollback is a display policy, not a server rollback. Offer a server-state check for uncertain outcomes. `dispose()` releases local resources and requests transport cancellation without making claims about server state.

## React

Import from `@oddurs/steady/react` in a client component. `useTask`, `useNavigation`, and `useMutation` take the same arguments as their core counterparts and return snapshot fields plus the relevant action methods. The hooks own their controller and dispose it on unmount. Disposal is deferred one microtask to tolerate StrictMode effect replay.

`useStore(store)` subscribes to an externally owned core store; the caller owns disposal. It uses React's `useSyncExternalStore`. Server and initial client data must match.

`SteadyProvider` supplies optional feedback defaults. Nested providers inherit parent defaults. Local options override provider defaults. Mutation hooks inherit delay and slow timing, never timeout. Timings, initial data, and concurrency policy are captured when a hook mounts. Operation callbacks and optimistic reducers update after each committed render.

`Pending` takes `state={{ showPending, isSlow }}`, children, optional `slow` content, and standard span props. It keeps a polite live region mounted and changes the text when needed. Reserve space with CSS where necessary. Announce errors in a separate local alert; avoid duplicating announcements for the same operation.

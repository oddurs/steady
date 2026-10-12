# Prefetching and debounce

Steady separates responsiveness from request volume. Acknowledgment is immediate; expensive work can start just before it is needed or wait until input settles.

## Warm navigation on intent

```tsx
const nav = useNavigation(loadSection, {
  initial: { destination: 'overview', data: initialData },
  prefetch: {
    ttlMs: 10_000,
    maxEntries: 8,
    maxConcurrent: 2,
    timeoutMs: 5_000,
  },
});

<button
  onPointerEnter={(event) => {
    if (event.pointerType === 'mouse') void nav.prefetch('settings');
  }}
  onFocus={() => void nav.prefetch('settings')}
  onClick={() => void nav.navigate('settings')}
>
  Settings
</button>;
```

The same API works on `createNavigation`. Prefetch never changes selection or visible errors. A speculative failure is an explicit result; an actual navigation can try again.

| At navigation time          | Behavior                                                    |
| --------------------------- | ----------------------------------------------------------- |
| Fresh result ready          | Consume it once, with no new loader call.                   |
| Speculative request running | Reuse it and transfer cancellation ownership to navigation. |
| Result expired or consumed  | Start a fresh foreground request.                           |
| Speculative budget full     | Start the foreground request anyway.                        |
| Earlier speculation failed  | Start fresh; a hover failure does not become a page error.  |

There is no background queue. Completed entries use least-recently-used eviction; active speculation is never evicted just to make space. `maxEntries` bounds entry count, not bytes. Prefetch is intended for reads with modest payloads. It does not detect connection quality or data-saver preferences; decide when to invoke it based on your application's context.

## Keep freshness explicit

Destinations are exact keys. Include relevant filters, locales, and account identity in the key, or clear warmed data when the context changes:

```ts
nav.invalidatePrefetch('settings'); // After changing these settings.
nav.invalidatePrefetch(); // After switching accounts or changing the loader's context.
```

React callbacks update after a committed render; warmed results do not automatically invalidate. TTL limits reuse duration and does not prove data is current.

Invalidation affects speculative entries. After navigation claims a request, use `cancel()` to stop waiting. Its original signal aborts; ignored aborts still cannot commit stale data. A foreground timeout starts at the click, independently of time spent prefetching.

The buffer belongs to one navigation controller. Foreground results do not refill it. It has no persistence, revalidation, cross-controller synchronization, or server consistency policy.

## Debounce work while acknowledging intent

```tsx
const search = useTask(searchProjects, {
  initialData: initialResults,
  debounceMs: 250,
  delayMs: 150,
  slowMs: 2500,
});

<input
  onChange={(event) => void search.run(event.target.value)}
  onKeyDown={(event) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) search.flush();
  }}
/>;
```

Each run synchronously records input and sets `isPending`. `isScheduled` distinguishes waiting for an input pause from waiting for a response. Superseded scheduled calls settle without executing. New intent also aborts any older running request immediately, before the new debounce interval.

`flush()` starts scheduled work once and retains its promise. Feedback and timeout clocks start with execution. `cancel`, `reset`, and `dispose` clear scheduled work too.

Use an uncontrolled input as above, or keep controlled input state in a normal synchronous React state update. Debounce requests, not keystroke rendering. For IME composition, guard Enter as shown and decide whether intermediate composition text should submit.

## Upgrading from 0.1

Defaults are unchanged: zero debounce and disabled prefetch. Tasks add `isScheduled` and `flush()`. Navigation adds `prefetch()` and `invalidatePrefetch()`; its `data` type is always defined. Custom `TaskSnapshot` mocks must include `isScheduled: false` when idle. Retry after disposal now consistently returns `disposed`, even before the first run.

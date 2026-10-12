# Changelog

## 0.2.0

- Opt-in navigation prefetch with exact-key deduplication, TTL, entry and concurrency budgets, least-recently-used eviction, speculative timeout, and explicit invalidation.
- Consume prefetched results once, or promote in-flight speculation into navigation with correct cancellation and timeout ownership.
- Debounced tasks with immediate intent, `isScheduled`, and `flush()`; loading and timeout clocks begin at execution.
- Navigation data is now always defined in TypeScript. Retry after disposal consistently reports `disposed`.
- Expanded playground with request counts, prefetch controls, debounced search, and a working keyboard shortcut.
- Automated tarball verification without React and with React 18/19, SSR, ESM/CommonJS, and strict NodeNext declarations.
- Browser tests always start a fresh production preview to avoid testing stale builds. CI remains manual-only.

Existing defaults are unchanged. Custom task snapshot implementations need the new `isScheduled` field. See [the upgrade notes](docs/performance.md#upgrading-from-01).

## 0.1.0

- Framework-independent task, navigation, and mutation controllers.
- Latest-intent protection, cooperative cancellation, delayed/slow feedback, and opt-in task timeouts.
- Optimistic mutation projections, rollback, rebasing, and concurrent-submit protection.
- Headless React hooks, a feedback provider, and a persistent live region.
- ESM/CommonJS packages with TypeScript declarations.
- An interactive playground with latency, failure, and out-of-order response controls.
- Unit, React integration, and browser tests; a manual-only GitHub check workflow.

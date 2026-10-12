# Design decisions

## Acknowledge intent immediately; claim completion when justified

There are two timelines in an interface: what the user asked for and what the application has confirmed. Steady models both. It can select a destination immediately without pretending that its content has loaded or that a server accepted a write.

## Handle hostile timing

Abort is cooperative. Transports, user code, and servers can ignore it. Every task also checks ownership before committing a result. An old success or failure cannot overwrite a newer intent. Cancellation settles the caller's result promptly, even if the underlying promise never settles.

## Preserve useful context

Loading does not erase the last successful data. A failed navigation returns selection to its committed destination. Failed mutations remove the optimistic projection while retaining the input for recovery.

## Keep feedback distinct from completion

Acknowledgment is synchronous. Delayed feedback avoids unnecessary flashes. Slow feedback gives the application a way to explain an extended wait. Results commit as soon as they're available; a spinner never holds useful data hostage.

## Treat writes differently

Latest-intent semantics are useful for reads. Overlapping writes can change server state even when their client requests are aborted. Mutations therefore accept one write at a time, do not automatically retry, and let the application supply a pure optimistic projection and a recovery UI. Server transactions, idempotency, and conflict resolution remain explicit.

## Own a small, composable boundary

Debounce records intent immediately while coalescing execution; feedback clocks start when work starts. Navigation prefetch gets a bounded head start with exact keys, fixed expiry, no queue, and results consumed once. A click takes ownership of in-flight speculation instead of starting another request. Foreground navigation is never blocked by speculation limits.

The core depends on standard promises, timers, and AbortController. It doesn't know about React, URLs, the DOM, or application caches. Framework adapters are responsible for framework lifecycles; applications remain responsible for data meaning.

## Prove behavior under pressure

Tests exercise externally visible contracts: out-of-order completion, ignored aborts, hanging requests, double submission, rollback, rebasing, timer cleanup, and React lifecycle behavior. The playground exposes latency and errors so these claims can also be inspected interactively.

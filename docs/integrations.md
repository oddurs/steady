# Integrations

## Next.js App Router

Steady's React exports have a `"use client"` boundary. Use them for client interactions inside an App Router application. Keep server fetching and server-rendered layouts in the framework.

`useNavigation` is directly useful for asynchronous sections whose loader you control. For actual Next.js route changes, use the framework's lifecycle: `router.push()` returns `void`, so awaiting it does **not** report route completion. Do not wrap it in a Steady task and treat the result as a successful navigation.

Next.js 15.3+ supplies `useLinkStatus`, and `loading.tsx` supplies route-level feedback. For an immediately responsive route link, use the native pending signal:

```tsx
'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

function LinkLabel({
  current,
  children,
}: {
  current: boolean;
  children: ReactNode;
}) {
  const { pending } = useLinkStatus();
  return (
    <span data-current={current} data-pending={pending}>
      {children}
      {pending && <span className="link-hint" aria-hidden="true" />}
    </span>
  );
}

export function WorkspaceLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const current = usePathname() === href;
  return (
    <Link href={href} aria-current={current ? 'page' : undefined}>
      <LinkLabel current={current}>{children}</LinkLabel>
    </Link>
  );
}
```

Style `data-pending` to acknowledge the click immediately. `aria-current` continues to identify the committed route. This example deliberately exposes current and pending separately; exclusive optimistic selection across an entire navigation group requires a router-aware group adapter. That adapter is not shipped in 0.2.

Keep Next's link behavior for modified clicks, new tabs, downloads, prefetching, external URLs, redirects, and browser history. A global click listener that calls `preventDefault()` would break those contracts.

Use Steady's tasks for searches/filters that call your route handlers, or mutations for optimistic client controls. Fetch is not an error on HTTP 4xx/5xx: explicitly check `response.ok` before returning data. Server Actions can be invoked by an operation, but they do not necessarily honor its `AbortSignal`.

Official references: [Link](https://nextjs.org/docs/app/api-reference/components/link), [useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status), [navigation and loading](https://nextjs.org/docs/app/getting-started/linking-and-navigating).

## Existing query and router libraries

Avoid creating competing owners for cached data or optimistic updates. If your query library already owns request execution, optimistic state, retries, and cache invalidation, keep those there. Use Steady only at a boundary whose lifecycle you own, or adapt an existing core store through `useStore`.

A valid adapter must distinguish intent, completion, error, cancellation, and supersession. A navigation callback that returns `void` cannot, by itself, provide these guarantees. `createNavigation` expects a promise that resolves with the committed content; it does not infer completion from a click or a URL change.

## Other frameworks and vanilla JavaScript

Every core primitive has the same store interface:

```ts
interface ReadableStore<T> {
  getSnapshot(): T;
  getInitialSnapshot(): T;
  subscribe(listener: () => void): () => void;
}
```

Subscribe on mount, read the snapshot on notification, and unsubscribe/dispose on teardown. Translate the snapshot into a Vue shallow ref, Svelte store, Solid signal, or DOM updates. No React import is required. Dedicated framework packages are not included in 0.2.

## Accessibility and motion

- A pending destination is an intent, not necessarily the current page. Keep `aria-current` truthful.
- The playground uses a button group for asynchronously replaced sections. A real tablist also needs the full keyboard/focus behavior of the tabs pattern.
- Keep a live region mounted before changing its text. `Pending` does this for you.
- Keep previous content meaningful and identify loading regions with `aria-busy`.
- Restore focus deliberately after dialogs or route changes; a generic request controller cannot infer the correct target.
- Respect reduced motion in your styling. Steady introduces no animation or global CSS.

# Getting started

Steady adds predictable interaction behavior to the application you already have. Start with one search, one asynchronous panel, or one optimistic control.

## Install the release

Steady is available as an installable GitHub release. It is not on the npm registry yet.

```sh
npm install https://github.com/oddurs/steady/releases/download/v0.2.0/oddurs-steady-0.2.0.tgz
```

The core has no runtime dependencies. React is an optional peer; use React 18.3 or 19 for the hooks. Packages include ESM, CommonJS, source maps, and TypeScript declarations.

## Start with a task

```ts
import { createTask } from '@oddurs/steady';

const search = createTask(
  async (query: string, { signal }) => {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      signal,
    });
    if (!response.ok) throw new Error('Search failed');
    return response.json();
  },
  { debounceMs: 250 },
);

const unsubscribe = search.subscribe(() => {
  const { data, input, isPending, isScheduled, error } = search.getSnapshot();
  // Update your interface with your framework of choice.
});

void search.run('design');
void search.run('design systems');

// When the view is destroyed:
unsubscribe();
search.dispose();
```

Every input is acknowledged immediately. Only the latest scheduled request executes. Old results remain available while loading, and an old response cannot overwrite a newer intent.

## Use React hooks

```tsx
'use client';

import { useTask, Pending } from '@oddurs/steady/react';

export function Search() {
  const search = useTask(
    async (query: string, { signal }) => {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}`,
        { signal },
      );
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    { debounceMs: 250 },
  );

  return (
    <>
      <input
        aria-label="Search"
        onChange={(event) => void search.run(event.target.value)}
      />
      <Pending state={search}>Searching…</Pending>
      {search.status === 'error' && (
        <p role="alert">Search failed. Try again.</p>
      )}
      <pre>{JSON.stringify(search.data, null, 2)}</pre>
    </>
  );
}
```

Hooks own their controllers and clean up after unmount. A `SteadyProvider` can supply shared timing defaults; you can also configure each hook directly.

## Choose the right primitive

| Interaction                            | Use                                   |
| -------------------------------------- | ------------------------------------- |
| Search, filters, asynchronous reads    | `createTask` or `useTask`             |
| Section selection with delayed content | `createNavigation` or `useNavigation` |
| Optimistic save, bookmark, or toggle   | `createMutation` or `useMutation`     |

Your framework router owns URLs and browser history. Your server owns transactions and idempotency. Steady coordinates acknowledgment, feedback, and local recovery around those boundaries.

## Run the playground

```sh
git clone https://github.com/oddurs/steady.git
cd steady
npm ci
npm run dev
```

Adjust latency, inject a failed request, and try changing your mind mid-navigation. The playground demonstrates the same public APIs used in applications.

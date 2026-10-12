# Steady

**Interfaces that hold up.**

Durable interaction primitives for the web. A framework-independent TypeScript core and headless React hooks for immediate intent, honest feedback, and predictable recovery.

Click a section: selection changes immediately. The current content stays useful while its replacement loads. Click something else: the latest intent wins, even if the first request ignores cancellation. Lose the connection: selection recovers and existing content survives.

Steady packages that behavior so every screen doesn't have to reinvent it.

![The Steady interaction playground with latency controls, immediate navigation intent, and committed content](https://raw.githubusercontent.com/oddurs/steady/main/docs/playground.png)

## Try it

```sh
git clone https://github.com/oddurs/steady.git
cd steady
npm ci
npm run dev
```

Open the local URL printed by Vite. The playground includes latency controls, injected failures, an uncooperative transport, navigation, search, optimistic bookmarks, and a deterministic out-of-order race.

**Status:** initial 0.1 release. MIT licensed. Source and installable release tarballs are available on GitHub; the package is **not published to npm** yet. The API can change before 1.0.

## What you get

| Primitive                            | Contract                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `createTask` / `useTask`             | Immediate pending state, previous data retention, latest-result protection, cooperative abort, explicit retry, optional timeout. |
| `createNavigation` / `useNavigation` | Separate selected intent from committed content. Roll selection back on failure or cancellation.                                 |
| `createMutation` / `useMutation`     | One write at a time, explicit optimistic projection, rollback to confirmed data, rebasing on external updates.                   |
| `SteadyProvider`                     | App-level feedback defaults with per-interaction overrides.                                                                      |
| `Pending`                            | A persistent, polite live region for delayed and slow-request feedback.                                                          |
| `useStore`                           | Subscribe React to a core store owned elsewhere.                                                                                 |

Core has **zero runtime dependencies** and no browser globals at import time. React is an optional peer dependency, used only by `@oddurs/steady/react`. ESM, CommonJS, source maps, and TypeScript declarations are included.

## Use it in another project

Build a package from the checkout:

```sh
npm ci
npm pack
# In your application's directory:
npm install /path/to/steady/oddurs-steady-0.1.0.tgz
```

Or download the `.tgz` from [GitHub Releases](https://github.com/oddurs/steady/releases). React users need React 18.3 or 19. Development tooling requires Node 20.19+; Node 22 or 24 is recommended.

## Navigation that acknowledges intent

```tsx
'use client';

import { Pending, useNavigation } from '@oddurs/steady/react';

type Section = { title: string; description: string };

export function Workspace({ initialData }: { initialData: Section }) {
  const nav = useNavigation(
    async (destination, { signal }): Promise<Section> => {
      const response = await fetch(`/api/sections/${destination}`, { signal });
      if (!response.ok) throw new Error('Could not load this section');
      return response.json();
    },
    { initial: { destination: 'overview', data: initialData } },
  );

  return (
    <>
      <div role="group" aria-label="Workspace sections">
        {['overview', 'activity', 'settings'].map((section) => (
          <button
            key={section}
            aria-pressed={nav.selected === section}
            data-active={nav.selected === section}
            onClick={() => void nav.navigate(section)}
          >
            {section}
          </button>
        ))}
      </div>

      <section aria-busy={nav.isPending}>
        <h1>{nav.data!.data.title}</h1>
        <p>{nav.data!.data.description}</p>
      </section>

      <Pending
        state={nav}
        slow="Still loading. You can choose another section."
      >
        Loading…
      </Pending>
      {nav.status === 'error' && (
        <div role="alert">
          Couldn't load that section.
          <button onClick={() => void nav.retry()}>Try again</button>
        </div>
      )}
    </>
  );
}
```

`selected` acknowledges the requested destination. `current` identifies the content actually on screen. Keep those meanings distinct, including in accessibility attributes. This primitive works for asynchronous panels and adapters that can report real completion; it doesn't take over browser history or a framework router.

## Optimism with a way back

```tsx
import { useMutation } from '@oddurs/steady/react';

const bookmark = useMutation(
  async (saved: boolean, { signal }) => {
    const response = await fetch('/api/bookmark', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saved }),
      signal,
    });
    if (!response.ok) throw new Error('Could not save');
    const result: { saved: boolean } = await response.json();
    return result.saved;
  },
  { initialData: false, optimistic: (_, saved) => saved },
);

// bookmark.data changes immediately, then reconciles with the server response.
// A failure restores bookmark.confirmed. Show bookmark.error with a recovery path.
const result = await bookmark.run(true);
if (result.status === 'error') {
  // The UI has rolled back. Offer an explicit retry or check the server's state.
}
```

Duplicate calls return `{ status: 'busy' }` before a second write starts. Steady never automatically retries mutations or claims that aborting a request undoes server work. Server-side idempotency and version checks remain your application's responsibility.

## Any framework, or none

```ts
import { createTask } from '@oddurs/steady';

const search = createTask(async (query: string, { signal }) => {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    signal,
  });
  if (!response.ok) throw new Error('Search failed');
  return response.json();
});

const unsubscribe = search.subscribe(() => {
  const state = search.getSnapshot();
  // Render with your framework or update the DOM.
  // state.data retains the last successful result while state.isPending is true.
});

void search.run('design');
void search.run('design systems'); // The older result can never overwrite this one.

// On teardown:
unsubscribe();
search.dispose();
```

## Opinionated, configurable

```tsx
<SteadyProvider delayMs={150} slowMs={2500}>
  <App />
</SteadyProvider>
```

- Intent and `isPending` update synchronously.
- `showPending` becomes true after 150ms by default, avoiding loading flashes for quick operations.
- `isSlow` becomes true after 2500ms, so you can offer more useful feedback.
- Successful content is never held back to satisfy an artificial minimum spinner duration.
- Read operations use “latest intent wins.” Mutations allow one in-flight write per controller.
- Timeouts are opt-in for tasks/navigation and excluded from mutations.
- Hook configuration and initial data are captured at mount. Operation and optimistic callbacks track the latest committed render. Use `mutation.reconcile(data)` for external authoritative updates.

## Scope

Steady coordinates interaction behavior. Your router still owns URLs, history, redirects, and route errors; your data layer owns caching, invalidation, and server consistency. Use the core directly or connect the hooks to your existing tools.

The initial release covers tasks, asynchronous section navigation, optimistic writes, and feedback. Prefetch budgets, persistent drafts, offline queues, focus restoration, scroll restoration, and additional framework adapters are future work. There is no hidden telemetry or automatic storage.

## More

- [API and lifecycle contracts](docs/api.md)
- [Next.js and existing data layers](docs/integrations.md)
- [Design decisions](docs/design.md)
- [Contributing](CONTRIBUTING.md)

## Development

```sh
npm run check        # Formatting, types, unit tests, library and playground builds
npx playwright install chromium
npm run test:e2e     # Browser interaction tests
npm run dev         # Playground
```

GitHub checks are **manual-only** (`workflow_dispatch`); pushes and pull requests do not automatically run CI.

MIT © Oddur Sigurdsson

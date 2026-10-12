# Svelte

Use the framework-independent core directly. A small subscription bridges a Steady snapshot into Svelte 5 state; no React dependency or separate Svelte package is needed.

## Subscribe to a task

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createTask } from '@oddurs/steady';

  const search = createTask(async (query: string, { signal }) => {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) throw new Error('Search failed');
    return response.json();
  }, { debounceMs: 250 });

  let snapshot = $state.raw(search.getInitialSnapshot());

  onMount(() => {
    const unsubscribe = search.subscribe(() => {
      snapshot = search.getSnapshot();
    });
    return () => {
      unsubscribe();
      search.dispose();
    };
  });
</script>

<input aria-label="Search" oninput={(event) => void search.run(event.currentTarget.value)} />
<span role="status">{snapshot.showPending ? 'Searching…' : ''}</span>
{#if snapshot.status === 'error'}
  <p role="alert">Search failed. <button onclick={() => void search.retry()}>Try again</button></p>
{/if}
<pre>{JSON.stringify(snapshot.data, null, 2)}</pre>
```

Create the controller in the component instance, not at module scope in a server-rendered application. Construction is inert: it starts no work or timers until an action is invoked. Match initial data between server rendering and hydration.

## Navigation and prefetch

`createNavigation` uses the same subscription pattern. Render `snapshot.selected` for immediate visual selection and `snapshot.current` for committed content. Connect `navigation.prefetch(destination)` to hover or focus after opting in with `prefetch: {}`.

The small demo on this site's homepage is built with Svelte and the actual Steady core. It models asynchronous sections. SvelteKit still owns the site's URL routing, browser history, route preloading, and focus management.

## Own cleanup

Call the subscription's unsubscribe function and dispose the controller when its owner is destroyed. Dispose settles local pending work, clears scheduled debounce and feedback timers, and requests abort. It cannot undo server-side writes.

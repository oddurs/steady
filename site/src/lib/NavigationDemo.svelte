<script lang="ts">
  import { onMount } from 'svelte';
  import { createNavigation } from '@oddurs/steady';

  const sections = {
    Overview: { title: 'Overview', description: 'This content stays visible while the next section loads.' },
    Projects: { title: 'Projects', description: 'The request finished, so the new content can take its place.' },
    Notes: { title: 'Notes', description: 'Changed your mind mid-request? Only the latest selection commits.' },
  };
  type Section = keyof typeof sections;
  let failNext = $state(false);
  let ready = $state(false);
  const navigation = createNavigation(async (destination, { signal }) => {
    const fail = failNext;
    failNext = false;
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 900);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    if (fail) throw new Error('This request did not make it. Your last view is still here.');
    return sections[destination as Section];
  }, { initial: { destination: 'Overview', data: sections.Overview }, delayMs: 150 });
  let snapshot = $state.raw(navigation.getInitialSnapshot());
  onMount(() => {
    const unsubscribe = navigation.subscribe(() => { snapshot = navigation.getSnapshot(); });
    ready = true;
    return () => { unsubscribe(); navigation.dispose(); };
  });
</script>

<div class="demo" data-testid="navigation-demo">
  <div class="demo-sections" role="group" aria-label="Workspace sections">
    {#each Object.keys(sections) as section}
      <button disabled={!ready} aria-pressed={snapshot.selected === section} onclick={() => void navigation.navigate(section)}>{section}</button>
    {/each}
  </div>
  <div class="demo-body" aria-busy={snapshot.isPending}>
    <h3>{snapshot.data.data.title}</h3>
    <p>{snapshot.data.data.description}</p>
  </div>
  <div class="demo-feedback">
    <span role="status">{snapshot.showPending ? `Opening ${snapshot.input}…` : snapshot.status === 'success' ? `${snapshot.current} is ready.` : snapshot.status === 'error' ? '' : 'Choose a section. Then change your mind.'}</span>
    {#if snapshot.status === 'error'}
      <div class="demo-error" role="alert"><span>Request failed. Your last view is safe.</span><button onclick={() => void navigation.retry()}>Try again</button></div>
    {/if}
  </div>
  <div class="demo-controls">
    <span>Selected: <strong data-testid="selected">{snapshot.selected}</strong> · Showing: <strong data-testid="current">{snapshot.current}</strong></span>
    <button class="failure-button" disabled={!ready || snapshot.isPending} aria-pressed={failNext} onclick={() => { failNext = !failNext; }}>{failNext ? 'Next request will fail' : 'Make the next request fail'}</button>
  </div>
  <noscript><p class="demo-noscript">Enable JavaScript to try the interactive demo.</p></noscript>
</div>

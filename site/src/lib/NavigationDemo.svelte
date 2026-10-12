<script lang="ts">
  import { onMount } from 'svelte';
  import { createNavigation } from '@oddurs/steady';

  const sections = {
    Overview: { eyebrow: 'Your workspace', title: 'Room to make good things.', description: 'A place for the projects, ideas, and small details that deserve your attention.', rows: ['A fresh perspective', 'The next small improvement', 'Something worth keeping'] },
    Projects: { eyebrow: 'In motion', title: 'Good work takes shape.', description: 'Keep the important things moving, one considered step at a time.', rows: ['A calmer dashboard', 'The field notes website', 'A better first impression'] },
    Notes: { eyebrow: 'Worth remembering', title: 'The details make the difference.', description: 'Little observations that might become something bigger.', rows: ['Make the first click count', 'Leave room for changing minds', 'Always offer a way back'] },
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
  <div class="demo-top"><span class="demo-dot" aria-hidden="true"></span><span>A tiny workspace</span><span class="demo-latency">900 ms latency</span></div>
  <div class="demo-sections" role="group" aria-label="Workspace sections">
    {#each Object.keys(sections) as section}
      <button disabled={!ready} aria-pressed={snapshot.selected === section} onclick={() => void navigation.navigate(section)}>{section}<span aria-hidden="true">{snapshot.selected === section ? '↗' : '·'}</span></button>
    {/each}
  </div>
  <div class="demo-body" aria-busy={snapshot.isPending}>
    <span class="eyebrow">{snapshot.data.data.eyebrow}</span>
    <h3>{snapshot.data.data.title}</h3>
    <p>{snapshot.data.data.description}</p>
    <ul class="demo-rows">
      {#each snapshot.data.data.rows as row, i}
        <li><span class="row-number">0{i + 1}</span>{row}<span aria-hidden="true">↗</span></li>
      {/each}
    </ul>
  </div>
  <div class="demo-feedback">
    <span role="status">{snapshot.showPending ? `Opening ${snapshot.input}…` : snapshot.status === 'success' ? `${snapshot.current} is ready.` : snapshot.status === 'error' ? '' : 'Choose a section. Then change your mind.'}</span>
    {#if snapshot.status === 'error'}
      <div class="demo-error" role="alert"><span>Request failed. Your last view is safe.</span><button onclick={() => void navigation.retry()}>Try again ↗</button></div>
    {/if}
  </div>
  <div class="demo-controls">
    <span>Selected: <strong data-testid="selected">{snapshot.selected}</strong><br />Showing: <strong data-testid="current">{snapshot.current}</strong></span>
    <button class="failure-button" disabled={!ready || snapshot.isPending} aria-pressed={failNext} onclick={() => { failNext = !failNext; }}>{failNext ? 'Next request will fail' : 'Make the next request fail'} <span aria-hidden="true">{failNext ? '✓' : '↗'}</span></button>
  </div>
  <noscript><p class="demo-noscript">Enable JavaScript to try the interactive demo.</p></noscript>
</div>

<script lang="ts">
  import { resolve } from '$app/paths';
  import NavigationDemo from '../lib/NavigationDemo.svelte';
  import CodeBlock from '../lib/CodeBlock.svelte';
  import { version, repository, origin } from '../lib/generated/project';
  const install = `npm install ${repository}/releases/download/v${version}/oddurs-steady-${version}.tgz`;
</script>

<svelte:head>
  <title>Steady — responsive interfaces, less work</title>
  <meta name="description" content="Small TypeScript primitives for immediate selection, better loading states, and predictable recovery. Use with React, Svelte, or plain JavaScript." />
  <meta property="og:title" content="Steady — responsive interfaces, less work" />
  <meta property="og:description" content="Small TypeScript primitives for immediate selection, better loading states, and predictable recovery." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={`${origin}/`} />
  <link rel="canonical" href={`${origin}/`} />
</svelte:head>

<main id="main" class="home wrap">
  <section class="intro">
    <h1>Responsive interfaces,<br />less work.</h1>
    <p>Steady handles the details between a click and a response: immediate selection, useful loading states, and recovery when a request fails.</p>
    <p class="muted">TypeScript. Zero runtime dependencies in core. Works with React, Svelte, or plain JavaScript.</p>
    <a href={resolve('docs/getting-started/')}>Get started →</a>
  </section>

  <section aria-labelledby="demo-title">
    <h2 id="demo-title">Try it</h2>
    <p>Switch sections. Selection changes immediately; content follows after a simulated 900 ms request.</p>
    <NavigationDemo />
  </section>

  <section aria-labelledby="install-title">
    <h2 id="install-title">Install</h2>
    <p>Available through GitHub Releases.</p>
    <CodeBlock code={install} label="Install the release" />
  </section>

  <section aria-labelledby="docs-title">
    <h2 id="docs-title">Three primitives</h2>
    <ul class="primitive-list">
      <li><a href={resolve('docs/tasks/')}><code>createTask</code></a> — debounce inputs, retain data, and ignore stale results.</li>
      <li><a href={resolve('docs/navigation/')}><code>createNavigation</code></a> — acknowledge intent and prefetch upcoming views.</li>
      <li><a href={resolve('docs/mutations/')}><code>createMutation</code></a> — apply optimistic updates and recover from failed writes.</li>
    </ul>
    <p class="guide-links"><a href={resolve('docs/react/')}>React</a><a href={resolve('docs/svelte/')}>Svelte</a><a href={resolve('docs/integrations/')}>Next.js & other stacks</a></p>
  </section>
</main>

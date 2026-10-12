<script lang="ts">
  import NavigationDemo from '../lib/NavigationDemo.svelte';
  import CodeBlock from '../lib/CodeBlock.svelte';
  import { version, repository, origin } from '../lib/generated/project';
  const install = `npm install ${repository}/releases/download/v${version}/oddurs-steady-${version}.tgz`;
  const example = `import { createNavigation } from '@oddurs/steady';

const navigation = createNavigation(loadSection, {
  initial: { destination: 'overview', data },
  prefetch: { maxEntries: 8 },
});

// Acknowledge the click before the request finishes.
navigation.navigate('projects');

// selected → 'projects' immediately
// current  → 'projects' when the data is ready`;
</script>

<svelte:head>
  <title>Steady — interfaces that hold up</title>
  <meta name="description" content="Small, headless primitives for snappy, dependable interfaces. Immediate intent, thoughtful loading, optimistic updates, and predictable recovery. Any stack. MIT licensed." />
  <meta property="og:title" content="Steady — interfaces that hold up" />
  <meta property="og:description" content="Immediate intent. Thoughtful feedback. Predictable recovery. Small interaction primitives for your existing stack." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={origin} />
  <link rel="canonical" href={`${origin}/`} />
</svelte:head>

<main id="main">
  <section class="hero wrap">
    <div class="hero-copy">
      <a class="release-note" href={`${repository}/releases/tag/v${version}`}><span class="live-dot" aria-hidden="true"></span> v{version} · Prefetch & debounce <span aria-hidden="true">↗</span></a>
      <h1>Interfaces<br />that <em>hold up.</em></h1>
      <p class="hero-description">The click should feel instant.<br />The rest should feel taken care of.</p>
      <p class="hero-detail">Steady adds the quiet details that make an interface feel good: immediate selection, thoughtful loading, and a way back when a request fails.</p>
      <div class="hero-actions"><a class="button primary" href="/docs/getting-started/">Get started <span aria-hidden="true">↗</span></a><a class="text-link" href={repository}>Explore the source <span aria-hidden="true">↗</span></a></div>
      <p class="hero-footnote">Headless. TypeScript. Zero runtime dependencies in core.</p>
    </div>
    <div class="hero-demo"><NavigationDemo /><p class="demo-caption"><span aria-hidden="true">↑</span> Real Steady. Simulated network. Try clicking around.</p></div>
  </section>

  <div class="compatibility wrap"><span>Fits the stack you already have</span><p>React <span>·</span> Svelte <span>·</span> Next.js <span>·</span> Plain JavaScript</p></div>

  <section class="principles wrap" aria-labelledby="details-title">
    <div class="section-intro"><span class="eyebrow">The invisible details</span><h2 id="details-title">Small behaviors.<br /><em>A different feeling.</em></h2><p>Three primitives for the moments between a user’s action and your server’s answer.</p></div>
    <div class="principle-list">
      <a href="/docs/navigation/"><span class="principle-number">01</span><div><h3>Acknowledge right away.</h3><p>Selection follows the click. Useful content stays put until the next view is ready. Changing your mind is always allowed.</p><span class="principle-api">createNavigation</span></div><span class="arrow" aria-hidden="true">↗</span></a>
      <a href="/docs/tasks/"><span class="principle-number">02</span><div><h3>Make waiting feel considered.</h3><p>Skip the flickering spinner. Debounce busy inputs. Keep an old response from overwriting a newer intention.</p><span class="principle-api">createTask</span></div><span class="arrow" aria-hidden="true">↗</span></a>
      <a href="/docs/mutations/"><span class="principle-number">03</span><div><h3>Leave room for recovery.</h3><p>Show optimistic updates, prevent overlapping submits, and restore confirmed data when a write fails.</p><span class="principle-api">createMutation</span></div><span class="arrow" aria-hidden="true">↗</span></a>
    </div>
  </section>

  <section class="start-section wrap" aria-labelledby="start-title">
    <div><span class="eyebrow">A little goes a long way</span><h2 id="start-title">Start with<br /><em>one interaction.</em></h2><p>Bring your design, router, and data layer. Steady gives the work in between a predictable shape.</p><a class="text-link" href="/docs/getting-started/">Read the getting-started guide <span aria-hidden="true">↗</span></a></div>
    <CodeBlock code={example} label="TypeScript" />
  </section>

  <section class="install-section wrap" aria-labelledby="install-title"><div><span class="eyebrow">Open source · MIT</span><h2 id="install-title">Make it feel <em>steady.</em></h2><p>Install v{version} from GitHub Releases, or take the playground for a spin.</p></div><CodeBlock code={install} label="Install the release" /><div class="install-links"><a href="/docs/react/">React hooks ↗</a><a href="/docs/svelte/">Svelte guide ↗</a><a href="/docs/performance/">Prefetch & debounce ↗</a></div></section>
</main>

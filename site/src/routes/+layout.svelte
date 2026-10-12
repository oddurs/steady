<script lang="ts">
  import { page } from '$app/state';
  import { version, repository } from '../lib/generated/project';
  import '../app.css';
  let { children } = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header wrap">
  <a class="brand" href="/" aria-label="Steady home">
    <img src="/favicon.svg" alt="" width="32" height="32" />
    <span>steady</span>
  </a>
  <a class="version" href={`${repository}/releases/tag/v${version}`}>v{version}</a>
  <nav aria-label="Main navigation">
    <a href="/docs/getting-started/" class:active={page.url.pathname.startsWith('/docs')}>Docs</a>
    <a href={repository}>GitHub <span aria-hidden="true">↗</span></a>
  </nav>
</header>

{@render children()}

<footer class="site-footer wrap">
  <a class="brand" href="/"><img src="/favicon.svg" alt="" width="24" height="24" />steady</a>
  <p>Small primitives. Better interactions.</p>
  <a href={`${repository}/blob/main/LICENSE`}>Open source · MIT</a>
</footer>

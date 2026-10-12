<script lang="ts">
  import { page } from '$app/state';
  import { asset, resolve } from '$app/paths';
  import { version, repository } from '../lib/generated/project';
  import '../app.css';
  let { children } = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header wrap">
  <a class="brand" href={resolve('/')} aria-label="Steady home">
    <img src={asset('favicon.svg')} alt="" width="24" height="24" />
    <span>steady</span>
  </a>
  <a class="version" href={`${repository}/releases/tag/v${version}`}>v{version}</a>
  <nav aria-label="Main navigation">
    <a href={resolve('docs/getting-started/')} class:active={page.route.id?.startsWith('/docs')}>Docs</a>
    <a href={repository}>GitHub</a>
  </nav>
</header>

{@render children()}

<footer class="site-footer wrap">
  <span>Steady · v{version}</span>
  <a href={`${repository}/blob/main/LICENSE`}>MIT licensed</a>
</footer>

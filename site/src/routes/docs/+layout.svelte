<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { pages } from '../../lib/generated/navigation';
  let { children } = $props();
  const groups = [...new Set(pages.map((entry) => entry.group))];
  let menuOpen = $state(false);
</script>

<div class="docs-shell wrap">
  <aside class="docs-sidebar">
    <button class="docs-menu-button" aria-expanded={menuOpen} aria-controls="docs-nav" onclick={() => { menuOpen = !menuOpen; }}>Documentation <span aria-hidden="true">{menuOpen ? '−' : '+'}</span></button>
    <nav id="docs-nav" class:open={menuOpen} aria-label="Documentation">
      {#each groups as group}
        <div class="docs-nav-group"><span>{group}</span>
          {#each pages.filter((entry) => entry.group === group) as entry}
            <a href={resolve(`docs/${entry.slug}/`)} aria-current={page.params.slug === entry.slug ? 'page' : undefined} onclick={() => { menuOpen = false; }}>{entry.title}</a>
          {/each}
        </div>
      {/each}
    </nav>
  </aside>
  {@render children()}
</div>

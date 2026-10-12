<script lang="ts">
  import { repository, origin } from '../../../lib/generated/project';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.title} — Steady docs</title>
  <meta name="description" content={data.description} />
  <link rel="canonical" href={`${origin}/docs/${data.slug}/`} />
</svelte:head>

<main id="main" class="docs-main">
  <div class="doc-header"><span class="eyebrow">{data.group}</span><h1>{data.title}</h1><p>{data.description}</p></div>
  {#if data.toc.length}<details class="on-this-page"><summary>On this page</summary><nav aria-label="On this page">{#each data.toc as heading}<a href={`#${heading.id}`}>{heading.title}</a>{/each}</nav></details>{/if}
  <article class="prose">{@html data.html}</article>
  <a class="edit-page" href={`${repository}/blob/main/${data.source}`}>View this page on GitHub ↗</a>
  <nav class="doc-pagination" aria-label="Adjacent documentation pages">
    {#if data.previous}<a href={`/docs/${data.previous.slug}/`}><span>← Previous</span>{data.previous.title}</a>{:else}<span></span>{/if}
    {#if data.next}<a href={`/docs/${data.next.slug}/`}><span>Next →</span>{data.next.title}</a>{/if}
  </nav>
</main>

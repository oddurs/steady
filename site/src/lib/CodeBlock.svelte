<script lang="ts">
  import { onDestroy } from 'svelte';
  let { code, label = 'Terminal' }: { code: string; label?: string } = $props();
  let status = $state('Copy');
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      status = 'Copied';
    } catch {
      status = 'Select to copy';
    }
    clearTimeout(timer);
    timer = setTimeout(() => (status = 'Copy'), 2500);
  }
  onDestroy(() => clearTimeout(timer));
</script>

<div class="code-block">
  <div class="code-caption"><span>{label}</span><button onclick={copy} aria-label={`Copy ${label.toLowerCase()}`}><span aria-live="polite">{status}</span></button></div>
  <pre><code>{code}</code></pre>
</div>

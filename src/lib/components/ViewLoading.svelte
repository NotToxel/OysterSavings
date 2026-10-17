<script lang="ts">
  import { onMount } from 'svelte';

  let { page }: { page: 'analysis' | 'planner' | 'compare' | 'faq' } = $props();
  const titles = { analysis: 'Journey Analysis', planner: 'Journey Planner', compare: 'Product Comparison', faq: 'Frequently Asked Questions' };
  let visible = $state(false);

  onMount(() => {
    // Cached views open immediately; only show placeholders for a real wait.
    const timer = window.setTimeout(() => visible = true, 120);
    return () => window.clearTimeout(timer);
  });
</script>

<section class="view-loading" aria-label={`Loading ${titles[page]}`} aria-busy="true">
  <span class="visually-hidden" role="status">Loading {titles[page]}…</span>
  {#if visible}
    <div class="loading-layout" aria-hidden="true">
      <h1>{titles[page]}</h1>
      <div class="loading-summary">
        <div class="loading-copy"><span class="placeholder heading"></span><span class="placeholder line"></span><span class="placeholder short-line"></span></div>
        <span class="placeholder action"></span>
      </div>
      {#if page === 'planner'}
        <div class="loading-calendar">
          <div class="calendar-header"><span class="placeholder heading"></span><span class="placeholder action"></span></div>
          <div class="calendar-grid">{#each Array(28) as _}<span class="placeholder calendar-day"></span>{/each}</div>
        </div>
      {:else}
        <div class="loading-detail">
          {#each Array(page === 'faq' ? 4 : 5) as _}<span class="placeholder detail-row"></span>{/each}
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .view-loading { min-height: 30rem; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .loading-layout { max-width: 100%; }
  h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: 1.5rem; letter-spacing: -0.02em; }
  .loading-summary, .loading-calendar, .loading-detail { padding: 1.5rem; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-bg-card); }
  .loading-summary, .calendar-header { display: flex; justify-content: space-between; align-items: center; gap: 2rem; }
  .loading-summary { margin-bottom: 1.5rem; }
  .loading-copy { flex: 1; display: grid; gap: 0.85rem; }
  .placeholder { display: block; background: var(--color-bg-glass-hover); border-radius: 4px; animation: loading-breathe 1.6s ease-in-out infinite alternate; }
  .heading { width: 45%; height: 1.25rem; }
  .line { width: 85%; height: 0.75rem; }
  .short-line { width: 60%; height: 0.75rem; }
  .action { width: 10rem; height: 44px; flex: 0 0 auto; border-radius: 8px; }
  .calendar-header { margin-bottom: 1.5rem; }
  .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .calendar-day { height: 4.25rem; }
  .loading-detail { display: grid; gap: 1rem; }
  .detail-row { height: 2.5rem; }
  @keyframes loading-breathe { from { opacity: 0.45; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .placeholder { animation: none; } }
  @media (max-width: 640px) {
    .loading-summary { align-items: stretch; flex-direction: column; gap: 1.25rem; }
    .loading-summary .action { width: 100%; }
    .calendar-header .action { width: 5rem; }
    .calendar-day { height: 3rem; }
  }
</style>

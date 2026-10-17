<script lang="ts">
  import { currentPage } from '$lib/stores/stores';
  import HomePage from '$lib/components/HomePage.svelte';
  import ViewLoading from '$lib/components/ViewLoading.svelte';
  import { hasData } from '$lib/stores/stores';
  import { tick } from 'svelte';

  const views = {
    analysis: () => import('$lib/components/AnalysisPage.svelte'),
    planner: () => import('$lib/components/PlannerPage.svelte'),
    compare: () => import('$lib/components/ComparePage.svelte'),
    faq: () => import('$lib/components/FAQPage.svelte'),
  };
  let retry = $state(0);
  let view = $derived.by(() => {
    void retry;
    return $currentPage === 'home' ? null : views[$currentPage]();
  });
  function focusView(node: HTMLElement) {
    void tick().then(() => {
      const title = node.querySelector('h1');
      title?.setAttribute('tabindex', '-1');
      title?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
</script>

{#if $currentPage === 'home'}
  <HomePage />
{:else if ($currentPage === 'analysis' || $currentPage === 'compare') && !$hasData}
  <section class="glass-card" style="padding: 2rem;">
    <h1 class="page-title">Load journeys to see your results</h1>
    <p>Your travel history stays in memory and clears when you refresh. Upload your CSV again or explore a sample analysis.</p>
    <button class="btn-primary" style="margin-top: 1rem;" onclick={() => $currentPage = 'home'}>Upload or try a sample</button>
  </section>
{:else}
  {#await view}
    <ViewLoading page={$currentPage} />
  {:then loaded}
    {#if loaded}
      {@const Page = loaded.default}
      <div use:focusView><Page /></div>
    {/if}
  {:catch}
    <p role="alert">This view could not load. Check your connection and try again.</p>
    <button class="btn-secondary" onclick={() => retry += 1}>Try again</button>
  {/await}
{/if}

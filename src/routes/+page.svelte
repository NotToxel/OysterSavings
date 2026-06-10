<script lang="ts">
  import { currentPage } from '$lib/stores/stores';
  import HomePage from '$lib/components/HomePage.svelte';
  import AnalysisPage from '$lib/components/AnalysisPage.svelte';
  import PlannerPage from '$lib/components/PlannerPage.svelte';
  import ComparePage from '$lib/components/ComparePage.svelte';
  import FAQPage from '$lib/components/FAQPage.svelte';
</script>

{#if $currentPage === 'home'}
  <HomePage />
{:else if $currentPage === 'analysis'}
  <AnalysisPage />
{:else if $currentPage === 'planner'}
  <PlannerPage />
{:else if $currentPage === 'compare'}
  <ComparePage />
{:else if $currentPage === 'faq'}
  <FAQPage />
{/if}

<script lang="ts">
  import { classifiedJourneys, productComparison, selectedFareType, currentPage, weeklyCapResults } from '$lib/stores/stores';
  import { FARE_TYPES } from '$lib/data/fareData';
  import { recommendProduct, type ComparisonSpan } from '$lib/engine/productRecommendation';

  let { span = 'monthly', showCompareAction = false }: { span?: ComparisonSpan; showCompareAction?: boolean } = $props();
  let zone = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const journey of $classifiedJourneys) if (journey.zoneRange) counts.set(journey.zoneRange, (counts.get(journey.zoneRange) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  });
  let comparison = $derived($productComparison.find(item => item.zoneRange === zone) ?? $productComparison[0]);
  let recommendation = $derived(comparison ? recommendProduct(comparison, span, $selectedFareType, FARE_TYPES[$selectedFareType].name) : null);
  let period = $derived(span === 'weekly' ? 'week' : span === 'monthly' ? 'month' : 'year');
</script>

{#if recommendation && $classifiedJourneys.length > 0}
  <section class="recommendation-summary glass-card" aria-label="Your ticket recommendation">
    <div>
      <h2>{recommendation.name === 'PAYG' ? 'Pay as you go is your best fit' : `Best fit: ${recommendation.name}`}</h2>
      <p>Estimated <strong>£{recommendation.cost.toFixed(2)} per {period}</strong>
        {#if recommendation.saving > 0} · £{recommendation.saving.toFixed(2)} less than adult PAYG per {period}{:else} · No cheaper product found for this scenario{/if}.</p>
      <p class="context">Based on {$classifiedJourneys.length} journeys across {$weeklyCapResults.length} recorded weeks, using {comparison.zoneRange} for the Travelcard comparison.</p>
      <p class="context">Scenario: <strong>{FARE_TYPES[$selectedFareType].name}</strong>. {$selectedFareType === 'none' ? 'Concession products are excluded until you select an eligible discount.' : 'Only use this scenario if you qualify for the selected discount; eligibility is not verified by the app.'}</p>
      <details>
        <summary>Assumptions and costs</summary>
        <p>Projected costs apply current modelled fares to your recorded travel pattern; they are estimates, not a TfL quote. Chart visibility does not affect this recommendation. Pass comparisons include journeys outside their coverage as additional PAYG spend.</p>
        {#if $selectedFareType === 'railcard' || $selectedFareType === 'disabled'}<p>Railcard purchase cost is excluded. Check the card cost settings when comparing a new purchase.</p>{/if}
        <p>Use the comparison settings to choose a discount and include available card fees.</p>
      </details>
    </div>
    {#if showCompareAction}<button class="btn-primary" onclick={() => $currentPage = 'compare'}>Compare ticket options →</button>{/if}
  </section>
{/if}

<style>
  .recommendation-summary { padding: clamp(1.25rem, 3vw, 2rem); margin: 1.25rem 0 1.5rem; display: flex; align-items: start; gap: 1.5rem; justify-content: space-between; }
  h2 { font-size: 1.35rem; font-weight: 700; margin: 0 0 0.75rem; }
  p { margin: 0.5rem 0; line-height: 1.6; max-width: 72ch; }
  strong { color: var(--color-text-primary); }
  .context, details { color: var(--color-text-secondary); font-size: 0.875rem; }
  summary { cursor: pointer; padding: 0.65rem 0; color: var(--color-oyster-blue-light); }
  button { flex-shrink: 0; min-height: 44px; }
  @media (max-width: 767px) { .recommendation-summary { flex-direction: column; } button { width: 100%; justify-content: center; } }
</style>

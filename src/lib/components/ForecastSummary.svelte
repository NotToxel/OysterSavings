<script lang="ts">
  import type { FareType } from '$lib/data/fareData';

  let { standardCost, selectedCost, fareType, fareTypeName, period, onchangeFareType }: {
    standardCost: number;
    selectedCost: number;
    fareType: FareType;
    fareTypeName: string;
    period: string;
    onchangeFareType: () => void;
  } = $props();

  const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
  let difference = $derived(Math.round((standardCost - selectedCost) * 100) / 100);
  let hasDiscount = $derived(fareType !== 'none');
</script>

<section class="glass-card forecast-summary" aria-labelledby="forecast-heading">
  <header>
    <div>
      <h3 id="forecast-heading">Your PAYG forecast</h3>
      <p class="period">{period}</p>
    </div>
    <button type="button" onclick={onchangeFareType}>
      Change fare type
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7" /></svg>
    </button>
  </header>

  <dl class="costs" class:comparing={hasDiscount}>
    {#if hasDiscount}
      <div class="baseline">
        <dt>Standard adult PAYG</dt>
        <dd>{currency.format(standardCost)}</dd>
      </div>
    {/if}
    <div class="selected">
      <dt>{hasDiscount ? `${fareTypeName} PAYG` : 'Adult / Contactless'}</dt>
      <dd>{currency.format(selectedCost)}</dd>
      <span class="cost-caption">Total for your planning period</span>
    </div>
  </dl>

  <div class="outcome" class:saving={hasDiscount && difference > 0}>
    {#if hasDiscount && difference > 0}
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6" /></svg>
      <p><strong>You save {currency.format(difference)}</strong>{' '}<span>compared with standard adult PAYG.</span></p>
    {:else if hasDiscount && difference < 0}
      <p><strong>{currency.format(Math.abs(difference))} more than standard adult PAYG.</strong>{' '}<span>Review your fare type for this plan.</span></p>
    {:else if hasDiscount}
      <p><strong>Same price as standard adult PAYG.</strong>{' '}<span>This fare type gives no PAYG saving on your planned journeys.</span></p>
    {:else}
      <p><strong>Standard adult fares.</strong>{' '}<span>No discount applied. Choose a fare type to compare if you’re eligible.</span></p>
    {/if}
  </div>
</section>

<style>
  .forecast-summary { margin-bottom: 1.25rem; overflow: hidden; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.5rem 0; }
  h3 { margin: 0; font-size: 1rem; font-weight: 650; color: var(--color-text-primary); }
  .period { margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--color-text-secondary); }
  button { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; min-height: 44px; margin-top: -0.5rem; padding: 0.5rem 0; border: 0; background: transparent; color: var(--color-oyster-blue-light); font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
  button:hover { color: var(--color-text-primary); text-decoration: underline; text-underline-offset: 4px; }
  .costs { display: grid; gap: 1.5rem; margin: 0; padding: 1.5rem; }
  .costs.comparing { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
  .costs > div { min-width: 0; }
  dt { font-size: 0.85rem; color: var(--color-text-secondary); overflow-wrap: anywhere; }
  dd { margin: 0.25rem 0 0; font-size: clamp(1.75rem, 3vw, 2.25rem); font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; line-height: 1.2; overflow-wrap: anywhere; }
  .baseline dd { color: var(--color-text-secondary); }
  .cost-caption { display: block; margin-top: 0.375rem; font-size: 0.75rem; color: var(--color-text-secondary); }
  .outcome { display: flex; align-items: flex-start; gap: 0.625rem; border-top: 1px solid var(--color-border); padding: 1rem 1.5rem; background: var(--color-bg-glass); }
  .outcome p { margin: 0; font-size: 0.8rem; line-height: 1.6; color: var(--color-text-secondary); }
  .outcome strong { font-weight: 600; color: var(--color-text-primary); }
  .outcome svg { flex-shrink: 0; margin-top: 0.125rem; }
  .outcome.saving { background: color-mix(in srgb, var(--color-success) 8%, transparent); color: var(--color-success); }
  .saving strong { color: #6ee7b7; }
  @media (max-width: 480px) {
    header { flex-wrap: wrap; gap: 0.5rem; padding: 1rem 1rem 0; }
    button { margin: 0; }
    .costs { padding: 1rem; gap: 1rem; }
    .outcome { padding: 0.875rem 1rem; }
  }
</style>

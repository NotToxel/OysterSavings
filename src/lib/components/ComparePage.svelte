<script lang="ts">
  import { onMount } from 'svelte';
  import {
    classifiedJourneys, fareResults, selectedRailcard,
    railcardCost, savingsResult
  } from '$lib/stores/stores';
  import { calculateProductComparison, calculateRailcardSavings } from '$lib/engine/savingsEngine';
  import {
    RAILCARDS, TRAVELCARD_WEEKLY, TRAVELCARD_MONTHLY,
    TRAVELCARD_ANNUAL, STUDENT_TRAVELCARD_ANNUAL,
    type RailcardType
  } from '$lib/data/fareData';
  import { Chart, registerables } from 'chart.js';

  Chart.register(...registerables);

  let activeSpan = $state<'weekly' | 'monthly' | 'annual'>('monthly');
  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  let comparison = $derived.by(() => {
    if ($classifiedJourneys.length > 0) {
      return calculateProductComparison($classifiedJourneys, $selectedRailcard, $railcardCost);
    }
    return [];
  });

  // Recalculate savings
  $effect(() => {
    if ($classifiedJourneys.length > 0) {
      $savingsResult = calculateRailcardSavings(
        $classifiedJourneys, $selectedRailcard, $railcardCost, false
      );
    }
  });

  // Chart data
  let chartData = $derived.by(() => {
    const zoneLabels = ['Z1-2', 'Z1-3', 'Z1-4', 'Z1-5', 'Z1-6'];

    if (comparison.length === 0) return null;

    const getValues = (key: string) => comparison.map((c: any) => c[key]);

    if (activeSpan === 'weekly') {
      return {
        labels: zoneLabels,
        datasets: [
          { label: 'PAYG', data: getValues('weeklyPayg'), backgroundColor: 'rgba(0, 159, 227, 0.7)', borderColor: '#009FE3', borderWidth: 1 },
          { label: 'PAYG + Railcard', data: getValues('weeklyPaygRailcard'), backgroundColor: 'rgba(105, 80, 161, 0.7)', borderColor: '#6950A1', borderWidth: 1 },
          { label: 'Weekly Travelcard', data: getValues('weeklyTravelcard'), backgroundColor: 'rgba(239, 123, 16, 0.7)', borderColor: '#EF7B10', borderWidth: 1 },
        ],
      };
    } else if (activeSpan === 'monthly') {
      return {
        labels: zoneLabels,
        datasets: [
          { label: 'PAYG', data: getValues('monthlyPayg'), backgroundColor: 'rgba(0, 159, 227, 0.7)', borderColor: '#009FE3', borderWidth: 1 },
          { label: 'PAYG + Railcard', data: getValues('monthlyPaygRailcard'), backgroundColor: 'rgba(105, 80, 161, 0.7)', borderColor: '#6950A1', borderWidth: 1 },
          { label: 'Monthly Travelcard', data: getValues('monthlyTravelcard'), backgroundColor: 'rgba(239, 123, 16, 0.7)', borderColor: '#EF7B10', borderWidth: 1 },
        ],
      };
    } else {
      return {
        labels: zoneLabels,
        datasets: [
          { label: 'PAYG', data: getValues('annualPayg'), backgroundColor: 'rgba(0, 159, 227, 0.7)', borderColor: '#009FE3', borderWidth: 1 },
          { label: 'PAYG + Railcard', data: getValues('annualPaygRailcard'), backgroundColor: 'rgba(105, 80, 161, 0.7)', borderColor: '#6950A1', borderWidth: 1 },
          { label: 'Annual Travelcard', data: getValues('annualTravelcard'), backgroundColor: 'rgba(239, 123, 16, 0.7)', borderColor: '#EF7B10', borderWidth: 1 },
          { label: 'Student Travelcard', data: getValues('annualStudentTravelcard'), backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: '#10b981', borderWidth: 1 },
        ],
      };
    }
  });

  $effect(() => {
    if (chartCanvas && chartData) {
      if (chart) chart.destroy();

      chart = new Chart(chartCanvas, {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: '#94a3b8',
                font: { family: 'Inter', size: 12 },
                padding: 16,
                usePointStyle: true,
              },
            },
            tooltip: {
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              titleColor: '#f1f5f9',
              bodyColor: '#94a3b8',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              padding: 12,
              titleFont: { family: 'Inter', weight: 'bold' as const },
              bodyFont: { family: 'Inter' },
              callbacks: {
                label: (ctx: any) => `${ctx.dataset.label}: £${ctx.raw.toFixed(2)}`,
              },
            },
          },
          scales: {
            x: {
              ticks: { color: '#64748b', font: { family: 'Inter', size: 12 } },
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
            },
            y: {
              ticks: {
                color: '#64748b',
                font: { family: 'Inter', size: 11 },
                callback: (val: any) => `£${val}`,
              },
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
            },
          },
        },
      });
    }
  });

  // Product matrix data
  let matrixZones = ['Z1-2', 'Z1-3', 'Z1-4', 'Z1-5', 'Z1-6'];

  function getProductPrice(zone: string, product: string): string {
    const map: Record<string, Record<string, number>> = {
      'Weekly TC': TRAVELCARD_WEEKLY,
      'Monthly TC': TRAVELCARD_MONTHLY,
      'Annual TC': TRAVELCARD_ANNUAL,
      'Student TC': STUDENT_TRAVELCARD_ANNUAL,
    };
    return map[product]?.[zone] ? `£${map[product][zone].toLocaleString()}` : '—';
  }

  function getBestForZone(zone: string): string {
    const comp = comparison.find((c: any) => c.zoneRange === zone);
    return comp ? comp.bestAnnual : 'N/A';
  }
</script>

<div class="compare-page">
  <h1 class="page-title">Product Comparison</h1>
  <p class="page-subtitle">Compare PAYG, Railcard, and Travelcard costs based on your actual travel patterns</p>

  <!-- Time span tabs -->
  <div class="tab-nav" style="margin-bottom: 1.5rem; display: inline-flex;">
    <button class="tab-btn" class:active={activeSpan === 'weekly'} onclick={() => activeSpan = 'weekly'}>
      1 Week
    </button>
    <button class="tab-btn" class:active={activeSpan === 'monthly'} onclick={() => activeSpan = 'monthly'}>
      1 Month
    </button>
    <button class="tab-btn" class:active={activeSpan === 'annual'} onclick={() => activeSpan = 'annual'}>
      1 Year
    </button>
  </div>

  <!-- Chart -->
  <div class="glass-card chart-container">
    <canvas bind:this={chartCanvas}></canvas>
  </div>

  <!-- Comparison table -->
  <div class="glass-card" style="padding: 0; overflow: hidden; margin-top: 1.5rem;">
    <div style="overflow-x: auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            {#each matrixZones as zone}
              <th>{zone}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #009FE3;"></span> Weekly Travelcard</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Weekly TC')}</td>
            {/each}
          </tr>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #EF7B10;"></span> Monthly Travelcard</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Monthly TC')}</td>
            {/each}
          </tr>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #DC241F;"></span> Annual Travelcard</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Annual TC')}</td>
            {/each}
          </tr>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #10b981;"></span> Student Travelcard</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Student TC')}</td>
            {/each}
          </tr>
          <tr class="best-row">
            <td class="product-name"><strong>🏆 Best Annual Option</strong></td>
            {#each matrixZones as zone}
              <td class="price-cell best-cell">{getBestForZone(zone)}</td>
            {/each}
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Key insights -->
  {#if $savingsResult}
    <div class="insights-grid" style="margin-top: 1.5rem;">
      <div class="glass-card insight-card">
        <div class="insight-icon">📊</div>
        <h3>Your Travel Pattern</h3>
        <p>
          {$savingsResult.totalJourneys} journeys over the period.
          {$savingsResult.eligibleJourneys} eligible for railcard discount
          ({Math.round(($savingsResult.eligibleJourneys / Math.max(1, $savingsResult.totalJourneys)) * 100)}% off-peak).
        </p>
      </div>
      <div class="glass-card insight-card">
        <div class="insight-icon">💡</div>
        <h3>Recommendation</h3>
        <p>
          {#if $savingsResult.netSaving > 0}
            A <strong>{$savingsResult.railcardName}</strong> would save you
            <strong style="color: #34d399;">£{$savingsResult.netSaving.toFixed(2)}</strong>
            over this period. It pays for itself after {$savingsResult.breakEvenJourneys} journeys.
          {:else}
            Based on your travel patterns, a railcard would not provide net savings for this period.
            Consider a Travelcard if you travel frequently in specific zones.
          {/if}
        </p>
      </div>
    </div>
  {/if}
</div>

<style>
  .compare-page { max-width: 1100px; margin: 0 auto; }

  .page-title {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .page-subtitle {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .chart-container {
    padding: 1.5rem;
    height: 400px;
    position: relative;
  }

  .product-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .product-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }

  .price-cell {
    text-align: right;
    font-family: monospace;
    font-weight: 500;
  }

  .best-row td {
    background: rgba(0, 159, 227, 0.03);
    border-top: 2px solid rgba(0, 159, 227, 0.15);
  }

  .best-cell {
    color: var(--color-oyster-blue);
    font-weight: 700;
    font-family: var(--font-sans) !important;
    font-size: 0.75rem;
  }

  .insights-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .insight-card {
    padding: 1.5rem;
  }

  .insight-icon {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .insight-card h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .insight-card p {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  @media (max-width: 768px) {
    .chart-container { height: 300px; }
    .insights-grid { grid-template-columns: 1fr; }
  }
</style>

<script lang="ts">
  import {
    productComparison, classifiedJourneys,
    includeStudentPhotocardFee, selectedFareType,
    fareTypeCost, capSummary, weeklyCapResults
  } from '$lib/stores/stores';
  import {
    FARE_TYPES, TRAVELCARD_WEEKLY, TRAVELCARD_MONTHLY,
    TRAVELCARD_ANNUAL, STUDENT_TRAVELCARD_MONTHLY, STUDENT_TRAVELCARD_ANNUAL,
    type FareType
  } from '$lib/data/fareData';
  import { Chart, registerables } from 'chart.js';

  Chart.register(...registerables);

  let activeSpan = $state<'weekly' | 'monthly' | 'annual'>('monthly');
  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  // Build fare type options list
  const fareTypeOptions = Object.entries(FARE_TYPES).map(([key, info]) => ({
    value: key as FareType,
    label: info.name,
  }));

  // Human-readable short name for chart labels
  let fareTypeShortName = $derived.by(() => {
    const rc = FARE_TYPES[$selectedFareType];
    if ($selectedFareType === 'none') return '';
    if ($selectedFareType === 'railcard') return 'National Railcard';
    if ($selectedFareType === 'disabled') return 'Disabled Persons';
    if ($selectedFareType === 'jobcentre') return 'Jobcentre Plus';
    if ($selectedFareType === 'zip_11_15') return '11-15 Zip';
    if ($selectedFareType === 'zip_16_17') return '16+ Zip';
    if ($selectedFareType === 'student') return '18+ Student';
    return rc.name;
  });

  let isNoDiscount = $derived($selectedFareType === 'none' || $selectedFareType === 'student');
  let hasCardCosts = $derived($selectedFareType !== 'none' && $selectedFareType !== 'jobcentre');

  // Derive discount description badge
  let discountBadge = $derived.by(() => {
    const rc = FARE_TYPES[$selectedFareType];
    if ($selectedFareType === 'none') return 'Standard adult fares — no discount applied';
    if ($selectedFareType === 'student') return '30% off Travelcards only — no PAYG discount';
    if (rc.discount === 0.5) return '50% off all fares (peak & off-peak)';
    if (rc.discount === 1/3 && rc.appliesToPeak) return '⅓ off all fares (peak & off-peak)';
    if (rc.discount === 1/3) return '⅓ off off-peak fares only';
    return `${Math.round(rc.discount * 100)}% discount`;
  });

  // Derive card cost label
  let cardCostLabel = $derived.by(() => {
    if ($selectedFareType === 'zip_11_15') return '£16.50 Zip Photocard fee';
    if ($selectedFareType === 'zip_16_17') return '£22.00 Zip Photocard fee';
    if ($selectedFareType === 'student') return '£12.00 Student Photocard fee';
    if ($selectedFareType === 'disabled') return '£7.00 Oyster card cost';
    if ($selectedFareType === 'railcard') return '£7.00 Oyster card cost';
    return '';
  });

  // Travel data summary
  let travelSummary = $derived.by(() => {
    const j = $classifiedJourneys;
    if (j.length === 0) return null;

    const weeks = $weeklyCapResults?.length ?? 0;
    const totalSpend = j.reduce((s, jj) => s + jj.raw.charge, 0);
    const avgWeekly = weeks > 0 ? totalSpend / weeks : totalSpend;

    // Find most common zone range
    const zoneCounts = new Map<string, number>();
    for (const jj of j) {
      if (jj.zoneRange) {
        zoneCounts.set(jj.zoneRange, (zoneCounts.get(jj.zoneRange) ?? 0) + 1);
      }
    }
    let topZone = 'Z1-2';
    let topCount = 0;
    for (const [z, c] of zoneCounts) {
      if (c > topCount) { topZone = z; topCount = c; }
    }

    return {
      journeys: j.length,
      weeks,
      avgWeekly: Math.round(avgWeekly * 100) / 100,
      totalSpend: Math.round(totalSpend * 100) / 100,
      topZone,
    };
  });

  // Best option for current time span
  let bestOption = $derived.by(() => {
    if ($productComparison.length === 0 || !travelSummary) return null;

    // Try to match the user's primary travel zone
    const comp = $productComparison.find(c => c.zoneRange === travelSummary.topZone)
      ?? $productComparison[0];

    const span = activeSpan;
    const best = span === 'weekly' ? comp.bestWeekly
      : span === 'monthly' ? comp.bestMonthly
      : comp.bestAnnual;

    const paygCost = span === 'weekly' ? comp.weeklyPayg
      : span === 'monthly' ? comp.monthlyPayg
      : comp.annualPayg;

    const rcCost = span === 'weekly' ? comp.weeklyPaygFareType
      : span === 'monthly' ? comp.monthlyPaygFareType
      : comp.annualPaygFareType;

    const tcCost = span === 'weekly' ? comp.weeklyTravelcard
      : span === 'monthly' ? comp.monthlyTravelcard
      : comp.annualTravelcard;

    return {
      best,
      zoneRange: comp.zoneRange,
      payg: paygCost,
      fareType: rcCost,
      travelcard: tcCost,
    };
  });

  // Chart data
  let chartData = $derived.by(() => {
    const zoneLabels = ['Z1-2', 'Z1-3', 'Z1-4', 'Z1-5', 'Z1-6'];
    if ($productComparison.length === 0) return null;

    const getValues = (key: string) => $productComparison.map((c: any) => c[key]);

    const paygLabel = 'PAYG (Adult)';
    const rcLabel = isNoDiscount
      ? `PAYG + ${fareTypeShortName || 'No Discount'}`
      : `PAYG + ${fareTypeShortName}`;

    // Build datasets — skip railcard bar when it's identical to PAYG
    const buildDatasets = (
      paygKey: string,
      rcKey: string,
      tcKey: string,
      tcLabel: string,
      studentKey?: string,
      studentLabel?: string,
      busKey?: string,
      busLabel?: string,
      busStudentKey?: string,
      busStudentLabel?: string
    ) => {
      const ds: any[] = [
        { label: paygLabel, data: getValues(paygKey), backgroundColor: 'rgba(0, 159, 227, 0.7)', borderColor: '#009FE3', borderWidth: 1 },
      ];

      if (!isNoDiscount) {
        ds.push({
          label: rcLabel, data: getValues(rcKey),
          backgroundColor: 'rgba(105, 80, 161, 0.7)', borderColor: '#6950A1', borderWidth: 1,
        });
      }

      ds.push({
        label: tcLabel, data: getValues(tcKey),
        backgroundColor: 'rgba(239, 123, 16, 0.7)', borderColor: '#EF7B10', borderWidth: 1,
      });

      if (studentKey && studentLabel) {
        const vals = getValues(studentKey);
        if (vals.some((v: number) => v > 0)) {
          ds.push({
            label: studentLabel, data: vals,
            backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: '#10b981', borderWidth: 1,
          });
        }
      }

      if (busKey && busLabel) {
        const vals = getValues(busKey);
        if (vals.some((v: number) => v > 0)) {
          ds.push({
            label: busLabel, data: vals,
            backgroundColor: 'rgba(220, 36, 31, 0.7)', borderColor: '#DC241F', borderWidth: 1,
          });
        }
      }

      if (busStudentKey && busStudentLabel) {
        const vals = getValues(busStudentKey);
        if (vals.some((v: number) => v > 0)) {
          ds.push({
            label: busStudentLabel, data: vals,
            backgroundColor: 'rgba(220, 36, 31, 0.35)', borderColor: '#DC241F', borderWidth: 1,
          });
        }
      }

      return ds;
    };

    if (activeSpan === 'weekly') {
      return {
        labels: zoneLabels,
        datasets: buildDatasets(
          'weeklyPayg', 'weeklyPaygFareType', 'weeklyTravelcard', 'Weekly Travelcard',
          undefined, undefined,
          'weeklyBusPass', 'Weekly Bus & Tram Pass'
        ),
      };
    } else if (activeSpan === 'monthly') {
      return {
        labels: zoneLabels,
        datasets: buildDatasets(
          'monthlyPayg', 'monthlyPaygFareType', 'monthlyTravelcard', 'Monthly Travelcard',
          'monthlyStudentTravelcard', 'Student Monthly TC',
          'monthlyBusPass', 'Monthly Bus & Tram Pass',
          'monthlyStudentBusPass', 'Student Monthly Bus Pass'
        ),
      };
    } else {
      return {
        labels: zoneLabels,
        datasets: buildDatasets(
          'annualPayg', 'annualPaygFareType', 'annualTravelcard', 'Annual Travelcard',
          'annualStudentTravelcard', 'Student Annual TC',
          'annualBusPass', 'Annual Bus & Tram Pass',
          'annualStudentBusPass', 'Student Annual Bus Pass'
        ),
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
    if (product === 'Weekly Bus Pass') return '£24.70';
    if (product === 'Monthly Bus Pass') return '£94.90';
    if (product === 'Annual Bus Pass') return '£988.00';
    if (product === 'Student Monthly Bus Pass') return '£66.40';
    if (product === 'Student Annual Bus Pass') return '£692.00';

    const map: Record<string, Record<string, number>> = {
      'Weekly TC': TRAVELCARD_WEEKLY,
      'Monthly TC': TRAVELCARD_MONTHLY,
      'Annual TC': TRAVELCARD_ANNUAL,
      'Student Monthly TC': STUDENT_TRAVELCARD_MONTHLY,
      'Student TC': STUDENT_TRAVELCARD_ANNUAL,
    };
    return map[product]?.[zone] ? `£${map[product][zone].toLocaleString()}` : '—';
  }

  function getBestForZone(zone: string): string {
    const comp = $productComparison.find((c: any) => c.zoneRange === zone);
    if (!comp) return 'N/A';
    return activeSpan === 'weekly' ? comp.bestWeekly
      : activeSpan === 'monthly' ? comp.bestMonthly
      : comp.bestAnnual;
  }

  function getCostForZone(zone: string, key: string): string {
    const comp = $productComparison.find((c: any) => c.zoneRange === zone);
    if (!comp) return '—';
    const val = (comp as any)[key];
    return val > 0 ? `£${val.toFixed(2)}` : '—';
  }

  function getSpanLabel(): string {
    return activeSpan === 'weekly' ? 'per week' : activeSpan === 'monthly' ? 'per month' : 'per year';
  }
</script>

<div class="compare-page">
  <h1 class="page-title">Product Comparison</h1>
  <p class="page-subtitle">See how PAYG, Travelcards, and concession discounts compare based on your actual travel patterns</p>

  <!-- Settings bar -->
  <div class="glass-card settings-bar">
    <div class="settings-row">
      <div class="setting-inline">
        <label class="setting-label-inline" for="compare-fare-type">Simulate with</label>
        <select class="input-field compact-select" id="compare-fare-type" bind:value={$selectedFareType}>
          {#each fareTypeOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      {#if hasCardCosts}
        <div class="setting-inline card-cost-toggle">
          <input type="checkbox" id="compare-card-cost" bind:checked={$includeStudentPhotocardFee}
            style="accent-color: var(--color-oyster-blue); width: 1rem; height: 1rem; cursor: pointer;" />
          <label for="compare-card-cost" class="card-cost-label">Include {cardCostLabel}</label>
        </div>
      {/if}
    </div>

    <div class="discount-badge">
      <span class="badge-dot" style="background: {isNoDiscount ? '#64748b' : '#009FE3'};"></span>
      {discountBadge}
    </div>
  </div>

  <!-- Time span tabs -->
  <div class="controls-row">
    <div class="tab-nav" style="display: inline-flex;">
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

    {#if travelSummary}
      <div class="travel-context">
        Based on <strong>{travelSummary.journeys}</strong> journeys over <strong>{travelSummary.weeks}</strong> weeks
        • Avg <strong>£{travelSummary.avgWeekly.toFixed(2)}</strong>/week
      </div>
    {/if}
  </div>

  <!-- Chart -->
  <div class="glass-card chart-container">
    <canvas bind:this={chartCanvas}></canvas>
  </div>

  <!-- Dynamic cost table -->
  <div class="glass-card" style="padding: 0; overflow: hidden; margin-top: 1.5rem;">
    <div style="overflow-x: auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Product ({getSpanLabel()})</th>
            {#each matrixZones as zone}
              <th>{zone}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #009FE3;"></span> PAYG (Adult)</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyPayg' : activeSpan === 'monthly' ? 'monthlyPayg' : 'annualPayg')}</td>
            {/each}
          </tr>
          {#if !isNoDiscount}
            <tr>
              <td class="product-name"><span class="product-dot" style="background: #6950A1;"></span> PAYG + {fareTypeShortName}</td>
              {#each matrixZones as zone}
                <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyPaygFareType' : activeSpan === 'monthly' ? 'monthlyPaygFareType' : 'annualPaygFareType')}</td>
              {/each}
            </tr>
          {/if}
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #EF7B10;"></span> Travelcard</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyTravelcard' : activeSpan === 'monthly' ? 'monthlyTravelcard' : 'annualTravelcard')}</td>
            {/each}
          </tr>
          {#if activeSpan !== 'weekly'}
            <tr>
              <td class="product-name"><span class="product-dot" style="background: #10b981;"></span> Student Travelcard</td>
              {#each matrixZones as zone}
                <td class="price-cell">{getCostForZone(zone, activeSpan === 'monthly' ? 'monthlyStudentTravelcard' : 'annualStudentTravelcard')}</td>
              {/each}
            </tr>
          {/if}
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #DC241F;"></span> Bus & Tram Pass</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyBusPass' : activeSpan === 'monthly' ? 'monthlyBusPass' : 'annualBusPass')}</td>
            {/each}
          </tr>
          {#if activeSpan !== 'weekly'}
            <tr>
              <td class="product-name"><span class="product-dot" style="background: #DC241F; opacity: 0.5;"></span> Student Bus Pass</td>
              {#each matrixZones as zone}
                <td class="price-cell">{getCostForZone(zone, activeSpan === 'monthly' ? 'monthlyStudentBusPass' : 'annualStudentBusPass')}</td>
              {/each}
            </tr>
          {/if}
          <tr class="best-row">
            <td class="product-name"><strong>🏆 Best Option</strong></td>
            {#each matrixZones as zone}
              <td class="price-cell best-cell">{getBestForZone(zone)}</td>
            {/each}
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Contextual insights -->
  {#if travelSummary && bestOption}
    <div class="insights-grid" style="margin-top: 1.5rem;">
      <div class="glass-card insight-card">
        <div class="insight-icon">📊</div>
        <h3>Your Travel Profile</h3>
        <p>
          You averaged <strong>£{travelSummary.avgWeekly.toFixed(2)}</strong> per week across
          <strong>{travelSummary.weeks}</strong> weeks of data.
          Your most common route was <strong>{travelSummary.topZone}</strong>.
          {#if travelSummary.weeks >= 4}
            That projects to roughly <strong>£{(travelSummary.avgWeekly * 4.33).toFixed(2)}</strong> per month
            or <strong>£{(travelSummary.avgWeekly * 52).toFixed(0)}</strong> per year.
          {/if}
        </p>
      </div>
      <div class="glass-card insight-card">
        <div class="insight-icon">🏆</div>
        <h3>Best Option ({activeSpan === 'weekly' ? 'Weekly' : activeSpan === 'monthly' ? 'Monthly' : 'Annual'})</h3>
        <p>
          For <strong>{bestOption.zoneRange}</strong> travel {getSpanLabel()},
          {#if bestOption.best === 'PAYG'}
            <strong style="color: #009FE3;">PAYG</strong> at <strong>£{bestOption.payg.toFixed(2)}</strong> is your cheapest option.
            {#if !isNoDiscount}
              PAYG + {fareTypeShortName} would cost £{bestOption.fareType.toFixed(2)} and a Travelcard £{bestOption.travelcard.toFixed(2)}.
            {:else}
              A Travelcard would cost £{bestOption.travelcard.toFixed(2)} — only worth it if you travel much more frequently.
            {/if}
          {:else if bestOption.best === 'PAYG + Fare Type'}
            <strong style="color: #6950A1;">PAYG + {fareTypeShortName}</strong> at <strong>£{bestOption.fareType.toFixed(2)}</strong> beats
            standard PAYG (£{bestOption.payg.toFixed(2)}) and Travelcard (£{bestOption.travelcard.toFixed(2)}).
          {:else if bestOption.best === 'Travelcard'}
            a <strong style="color: #EF7B10;">Travelcard</strong> at <strong>£{bestOption.travelcard.toFixed(2)}</strong> is cheapest.
            You travel enough that unlimited rides saves over PAYG (£{bestOption.payg.toFixed(2)}).
          {:else if bestOption.best === 'Student Travelcard'}
            a <strong style="color: #10b981;">Student Travelcard</strong> offers the best value with 30% off the standard Travelcard price.
          {:else}
            <strong>{bestOption.best}</strong> is the cheapest option for this combination.
          {/if}
        </p>
      </div>
    </div>
  {/if}

  <!-- Static travelcard price reference -->
  <div class="glass-card" style="padding: 0; overflow: hidden; margin-top: 1.5rem;">
    <div style="padding: 1rem 1.25rem 0.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
      <h3 style="font-size: 0.9rem; font-weight: 600; color: var(--color-text-secondary); margin: 0;">📋 Travelcard Price Reference</h3>
    </div>
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
            <td class="product-name"><span class="product-dot" style="background: #EF7B10;"></span> Weekly Travelcard</td>
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
            <td class="product-name"><span class="product-dot" style="background: #10b981;"></span> Student Monthly TC</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Student Monthly TC')}</td>
            {/each}
          </tr>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #10b981;"></span> Student Annual TC</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Student TC')}</td>
            {/each}
          </tr>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #DC241F;"></span> Weekly Bus Pass</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Weekly Bus Pass')}</td>
            {/each}
          </tr>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #DC241F;"></span> Monthly Bus Pass</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Monthly Bus Pass')}</td>
            {/each}
          </tr>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #DC241F;"></span> Annual Bus Pass</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Annual Bus Pass')}</td>
            {/each}
          </tr>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #10b981;"></span> Student Monthly Bus Pass</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Student Monthly Bus Pass')}</td>
            {/each}
          </tr>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #10b981;"></span> Student Annual Bus Pass</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Student Annual Bus Pass')}</td>
            {/each}
          </tr>
        </tbody>
      </table>
    </div>
  </div>
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

  /* Settings bar */
  .settings-bar {
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
  }

  .settings-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .setting-inline {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .setting-label-inline {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .compact-select {
    min-width: 240px;
    padding: 0.5rem 0.75rem !important;
    font-size: 0.85rem !important;
  }

  .card-cost-toggle {
    padding: 0.375rem 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    gap: 0.5rem;
  }

  .card-cost-label {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    cursor: pointer;
    white-space: nowrap;
  }

  .discount-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    margin-top: 0.625rem;
    padding-top: 0.625rem;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Controls row */
  .controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .travel-context {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.02);
    padding: 0.375rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.04);
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
    .settings-row { flex-direction: column; align-items: flex-start; }
    .compact-select { min-width: 100%; }
  }
</style>

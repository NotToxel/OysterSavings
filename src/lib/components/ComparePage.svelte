<script lang="ts">
  import {
    productComparison, classifiedJourneys,
    includeStudentPhotocardFee, selectedFareType,
    fareTypeCost, capSummary, weeklyCapResults,
    cards
  } from '$lib/stores/stores';
  import RecommendationSummary from './RecommendationSummary.svelte';
  import { recommendProduct } from '$lib/engine/productRecommendation';
  import CardSelector from './CardSelector.svelte';
  import AddCardDialog from './AddCardDialog.svelte';

  let showAddDialog = $state(false);
  import {
    FARE_TYPES, TRAVELCARD_WEEKLY, TRAVELCARD_MONTHLY,
    TRAVELCARD_ANNUAL, STUDENT_TRAVELCARD_WEEKLY, STUDENT_TRAVELCARD_MONTHLY, STUDENT_TRAVELCARD_ANNUAL,
    BUS_PASS_WEEKLY, BUS_PASS_MONTHLY, BUS_PASS_ANNUAL,
    STUDENT_BUS_PASS_WEEKLY, STUDENT_BUS_PASS_MONTHLY, STUDENT_BUS_PASS_ANNUAL,
    type FareType
  } from '$lib/data/fareData';
  import { Chart, registerables } from 'chart.js';
  import { journeyUsesContactlessOnlyStation } from '$lib/data/stationService';

  Chart.register(...registerables);

  let activeSpan = $state<'weekly' | 'monthly' | 'annual'>('monthly');
  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let showPriceReference = $state(false);

  // Visible products checkboxes state
  let visibleProducts = $state({
    paygStandard: true,
    paygRailcard: true,
    paygConcession: true,
    travelcardStandard: true,
    travelcardStudent: true,
    busPassStandard: true,
    busPassStudent: true
  });

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

  let concessionName = $derived(
    ($selectedFareType === 'zip_11_15' || $selectedFareType === 'zip_16_17')
      ? fareTypeShortName
      : 'PAYG + ' + fareTypeShortName
  );

  let isNoDiscount = $derived($selectedFareType === 'none' || $selectedFareType === 'student');
  let hasCardCosts = $derived($selectedFareType !== 'none');
  let hasContactlessOnlyJourneys = $derived(
    $classifiedJourneys.some(journeyUsesContactlessOnlyStation),
  );
  let travelcardEligible = $derived(
    $classifiedJourneys.some((journey) =>
      !journey.isBus
      && journey.mode !== 'tram'
      && !journeyUsesContactlessOnlyStation(journey),
    ),
  );

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
    if ($selectedFareType === 'jobcentre') return '£7.00 Oyster card cost';
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

  // Recommendations use eligibility independently of chart presentation.
  function getDynamicBestForZone(zone: string): string {
    const comparison = $productComparison.find(item => item.zoneRange === zone);
    return comparison ? recommendProduct(comparison, activeSpan, $selectedFareType, concessionName)?.name ?? 'N/A' : 'N/A';
  }

  // Chart data
  let chartData = $derived.by(() => {
    const zoneLabels = $productComparison.map((c: any) => c.zoneRange);
    if ($productComparison.length === 0) return null;

    const getValues = (key: string) => $productComparison.map((c: any) => c[key]);

    const paygLabel = 'PAYG (Adult)';
    const rcLabel = ($selectedFareType === 'zip_11_15' || $selectedFareType === 'zip_16_17')
      ? fareTypeShortName
      : isNoDiscount
        ? `PAYG + ${fareTypeShortName || 'No Discount'}`
        : `PAYG + ${fareTypeShortName}`;

    // Build datasets dynamically based on toggles
    const buildDatasets = (
      paygKey: string,
      rcKey: string,
      railcardKey: string,
      tcKey: string,
      studentKey: string,
      busKey: string,
      busStudentKey: string,
      tcLabel: string,
      studentLabel: string,
      busLabel: string,
      busStudentLabel: string
    ) => {
      const ds: any[] = [];

      if (visibleProducts.paygStandard) {
        ds.push({
          label: paygLabel, data: getValues(paygKey),
          backgroundColor: 'rgba(0, 159, 227, 0.7)', borderColor: '#009FE3', borderWidth: 1
        });
      }

      if (visibleProducts.paygRailcard) {
        ds.push({
          label: 'PAYG + National Railcard', data: getValues(railcardKey),
          backgroundColor: 'rgba(139, 92, 246, 0.7)', borderColor: '#8b5cf6', borderWidth: 1
        });
      }

      if (visibleProducts.paygConcession && !isNoDiscount && $selectedFareType !== 'railcard') {
        ds.push({
          label: rcLabel, data: getValues(rcKey),
          backgroundColor: 'rgba(111, 67, 144, 0.7)', borderColor: '#6f4390', borderWidth: 1
        });
      }

      if (travelcardEligible && visibleProducts.travelcardStandard) {
        ds.push({
          label: tcLabel, data: getValues(tcKey),
          backgroundColor: 'rgba(231, 113, 13, 0.7)', borderColor: '#e7710d', borderWidth: 1
        });
      }

      if (travelcardEligible && visibleProducts.travelcardStudent) {
        const vals = getValues(studentKey);
        if (vals.some((v: number) => v > 0)) {
          ds.push({
            label: studentLabel, data: vals,
            backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: '#10b981', borderWidth: 1
          });
        }
      }

      if (visibleProducts.busPassStandard) {
        const vals = getValues(busKey);
        if (vals.some((v: number) => v > 0)) {
          ds.push({
            label: busLabel, data: vals,
            backgroundColor: 'rgba(220, 36, 31, 0.7)', borderColor: '#DC241F', borderWidth: 1
          });
        }
      }

      if (visibleProducts.busPassStudent) {
        const vals = getValues(busStudentKey);
        if (vals.some((v: number) => v > 0)) {
          ds.push({
            label: busStudentLabel, data: vals,
            backgroundColor: 'rgba(220, 36, 31, 0.35)', borderColor: '#DC241F', borderWidth: 1
          });
        }
      }

      return ds;
    };

    if (activeSpan === 'weekly') {
      return {
        labels: zoneLabels,
        datasets: buildDatasets(
          'weeklyPayg', 'weeklyPaygFareType', 'weeklyPaygRailcard', 'weeklyTravelcard',
          'weeklyStudentTravelcard', 'weeklyBusPass', 'weeklyStudentBusPass',
          'Weekly Travelcard', 'Student Weekly TC', 'Weekly Bus & Tram Pass', 'Student Weekly Bus Pass'
        ),
      };
    } else if (activeSpan === 'monthly') {
      return {
        labels: zoneLabels,
        datasets: buildDatasets(
          'monthlyPayg', 'monthlyPaygFareType', 'monthlyPaygRailcard', 'monthlyTravelcard',
          'monthlyStudentTravelcard', 'monthlyBusPass', 'monthlyStudentBusPass',
          'Monthly Travelcard', 'Student Monthly TC', 'Monthly Bus & Tram Pass', 'Student Monthly Bus Pass'
        ),
      };
    } else {
      return {
        labels: zoneLabels,
        datasets: buildDatasets(
          'annualPayg', 'annualPaygFareType', 'annualPaygRailcard', 'annualTravelcard',
          'annualStudentTravelcard', 'annualBusPass', 'annualStudentBusPass',
          'Annual Travelcard', 'Student Annual TC', 'Annual Bus & Tram Pass', 'Student Annual Bus Pass'
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
              ticks: { color: '#94a3b8', font: { family: 'Inter', size: 12 } },
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
            },
            y: {
              ticks: {
                color: '#94a3b8',
                font: { family: 'Inter', size: 11 },
                callback: (val: any) => `£${val}`,
              },
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
            },
          },
        },
      });
    }

    return () => {
      if (chart) {
        chart.destroy();
        chart = null;
      }
    };
  });

  // Product matrix data
  let matrixZones = $derived($productComparison.map((c: any) => c.zoneRange));

  function getProductPrice(zone: string, product: string): string {
    if (product === 'Weekly Bus Pass') return `£${BUS_PASS_WEEKLY.toFixed(2)}`;
    if (product === 'Monthly Bus Pass') return `£${BUS_PASS_MONTHLY.toFixed(2)}`;
    if (product === 'Annual Bus Pass') return `£${BUS_PASS_ANNUAL.toFixed(0)}`;
    if (product === 'Student Monthly Bus Pass') return `£${STUDENT_BUS_PASS_MONTHLY.toFixed(2)}`;
    if (product === 'Student Annual Bus Pass') return `£${STUDENT_BUS_PASS_ANNUAL.toFixed(0)}`;

    const map: Record<string, Record<string, number>> = {
      'Weekly TC': TRAVELCARD_WEEKLY,
      'Monthly TC': TRAVELCARD_MONTHLY,
      'Annual TC': TRAVELCARD_ANNUAL,
      'Student Weekly TC': STUDENT_TRAVELCARD_WEEKLY,
      'Student Monthly TC': STUDENT_TRAVELCARD_MONTHLY,
      'Student TC': STUDENT_TRAVELCARD_ANNUAL,
    };
    return map[product]?.[zone] ? `£${map[product][zone].toLocaleString()}` : '—';
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

  <CardSelector onAddData={() => (showAddDialog = true)} />

  <p class="page-subtitle">See how PAYG, Travelcards, and concession discounts compare based on your actual travel patterns</p>

  <RecommendationSummary span={activeSpan} />

  <!-- Settings bar -->
  <div class="glass-card settings-bar">
    <div class="settings-row flex flex-col md:flex-row items-start md:items-center gap-6 flex-wrap">
      <div class="setting-inline">
        <label class="setting-label-inline" for="compare-fare-type">Your eligible discount</label>
        <select class="input-field compact-select w-full md:w-[240px]" id="compare-fare-type" bind:value={$selectedFareType}>
          {#each fareTypeOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      {#if hasCardCosts}
        <button
          type="button"
          class="setting-inline card-cost-toggle"
          style="background: transparent; border: none; padding: 0; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; color: inherit; font-family: inherit; font-size: inherit;"
          onclick={() => ($includeStudentPhotocardFee = !$includeStudentPhotocardFee)}
          aria-label="Toggle card/Oyster cost"
        >
          <div class="toggle" class:active={$includeStudentPhotocardFee}>
            <span class="toggle-dot"></span>
          </div>
          <span class="card-cost-label" style="user-select: none;">
            Include {cardCostLabel}
          </span>
        </button>
      {/if}
    </div>

    <div class="discount-badge" style="justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 0.5rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span class="badge-dot" style="background: {isNoDiscount ? '#94a3b8' : '#009FE3'};"></span>
        <span>{discountBadge}</span>
      </div>
      {#if $selectedFareType === 'railcard' || $selectedFareType === 'disabled'}
        <span style="font-size: 0.75rem; color: var(--color-text-muted); opacity: 0.85;">
          ℹ️ The cost of the railcard is excluded from the comparison
        </span>
      {/if}
    </div>
  </div>

  <!-- Dynamic product toggles -->
  <div class="glass-card toggles-bar" style="padding: 1rem 1.25rem; margin-bottom: 1.5rem;">
    <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-secondary); display: block; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Show in chart and table (does not change recommendation)</span>
    <div class="toggles-grid">
      <button 
        type="button" 
        class="product-chip payg-standard" 
        class:active={visibleProducts.paygStandard}
        aria-pressed={visibleProducts.paygStandard}
        onclick={() => visibleProducts.paygStandard = !visibleProducts.paygStandard}
      >
        <span class="product-dot" style="background: #009FE3;"></span>
        <span>PAYG (Adult)</span>
      </button>

      <button 
        type="button" 
        class="product-chip payg-railcard" 
        class:active={visibleProducts.paygRailcard}
        aria-pressed={visibleProducts.paygRailcard}
        onclick={() => visibleProducts.paygRailcard = !visibleProducts.paygRailcard}
      >
        <span class="product-dot" style="background: #8b5cf6;"></span>
        <span>PAYG + Railcard</span>
      </button>

      {#if !isNoDiscount && $selectedFareType !== 'railcard'}
      <button 
        type="button" 
        class="product-chip payg-concession" 
        class:active={visibleProducts.paygConcession}
        aria-pressed={visibleProducts.paygConcession}
        onclick={() => visibleProducts.paygConcession = !visibleProducts.paygConcession}
      >
        <span class="product-dot" style="background: #6f4390;"></span>
        <span>{concessionName}</span>
      </button>
      {/if}

      {#if travelcardEligible}
      <button 
        type="button" 
        class="product-chip travelcard-standard" 
        class:active={visibleProducts.travelcardStandard}
        aria-pressed={visibleProducts.travelcardStandard}
        onclick={() => visibleProducts.travelcardStandard = !visibleProducts.travelcardStandard}
      >
        <span class="product-dot" style="background: #e7710d;"></span>
        <span>Travelcard</span>
      </button>

      <button 
        type="button" 
        class="product-chip travelcard-student" 
        class:active={visibleProducts.travelcardStudent}
        aria-pressed={visibleProducts.travelcardStudent}
        onclick={() => visibleProducts.travelcardStudent = !visibleProducts.travelcardStudent}
      >
        <span class="product-dot" style="background: #10b981;"></span>
        <span>Student Travelcard</span>
      </button>
      {/if}

      <button 
        type="button" 
        class="product-chip buspass-standard" 
        class:active={visibleProducts.busPassStandard}
        aria-pressed={visibleProducts.busPassStandard}
        onclick={() => visibleProducts.busPassStandard = !visibleProducts.busPassStandard}
      >
        <span class="product-dot" style="background: #DC241F;"></span>
        <span>Bus & Tram Pass</span>
      </button>

      {#if activeSpan !== 'weekly'}
      <button 
        type="button" 
        class="product-chip buspass-student" 
        class:active={visibleProducts.busPassStudent}
        aria-pressed={visibleProducts.busPassStudent}
        onclick={() => visibleProducts.busPassStudent = !visibleProducts.busPassStudent}
      >
        <span class="product-dot" style="background: #DC241F; opacity: 0.5;"></span>
        <span>Student Bus Pass</span>
      </button>
      {/if}
    </div>
  </div>

  {#if hasContactlessOnlyJourneys && travelSummary}
    <div class="glass-card travelcard-eligibility-notice" role="note">
      <strong>{travelcardEligible ? 'Contactless-only journeys are charged separately.' : 'Travelcards excluded from these recommendations.'}</strong>
      {#if travelcardEligible}
        Travelcard recommendations apply only to journeys between Oyster-eligible stations. Journeys involving a contactless-only Elizabeth line or National Rail station remain charged at the full contactless PAYG cost.
      {:else}
        Every rail journey in this history involves a contactless-only station and cannot be completed with an Oyster Travelcard, so Travelcards are not recommendation candidates.
      {/if}
    </div>
  {/if}

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
  <div class="glass-card chart-container h-[300px] md:h-[400px]">
    <canvas bind:this={chartCanvas}></canvas>
  </div>

  <!-- Dynamic cost table -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scroll region must be keyboard focusable to expose columns on narrow screens.) -->
  <div class="glass-card comparison-table" role="region" aria-label="Product costs by zone. Scroll horizontally to compare all zones." tabindex="0">
    <div>
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
          {#if visibleProducts.paygStandard}
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #009FE3;"></span> PAYG (Adult)</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyPayg' : activeSpan === 'monthly' ? 'monthlyPayg' : 'annualPayg')}</td>
            {/each}
          </tr>
          {/if}
          {#if visibleProducts.paygRailcard}
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #8b5cf6;"></span> PAYG + Railcard</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyPaygRailcard' : activeSpan === 'monthly' ? 'monthlyPaygRailcard' : 'annualPaygRailcard')}</td>
            {/each}
          </tr>
          {/if}
          {#if visibleProducts.paygConcession && !isNoDiscount && $selectedFareType !== 'railcard'}
            <tr>
              <td class="product-name"><span class="product-dot" style="background: #6f4390;"></span> {concessionName}</td>
              {#each matrixZones as zone}
                <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyPaygFareType' : activeSpan === 'monthly' ? 'monthlyPaygFareType' : 'annualPaygFareType')}</td>
              {/each}
            </tr>
          {/if}
          {#if travelcardEligible && visibleProducts.travelcardStandard}
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #e7710d;"></span> Travelcard</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyTravelcard' : activeSpan === 'monthly' ? 'monthlyTravelcard' : 'annualTravelcard')}</td>
            {/each}
          </tr>
          {/if}
          {#if travelcardEligible && visibleProducts.travelcardStudent}
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #10b981;"></span> Student Travelcard</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyStudentTravelcard' : activeSpan === 'monthly' ? 'monthlyStudentTravelcard' : 'annualStudentTravelcard')}</td>
            {/each}
          </tr>
          {/if}
          {#if visibleProducts.busPassStandard}
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #DC241F;"></span> Bus & Tram Pass</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyBusPass' : activeSpan === 'monthly' ? 'monthlyBusPass' : 'annualBusPass')}</td>
            {/each}
          </tr>
          {/if}
          {#if visibleProducts.busPassStudent && activeSpan !== 'weekly'}
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
              <td class="price-cell best-cell">{getDynamicBestForZone(zone)}</td>
            {/each}
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Static travelcard price reference -->
  <div class="glass-card" style="padding: 0; overflow: hidden; margin-top: 1.5rem;">
    <div style="padding: 0.75rem 1.25rem; border-bottom: {showPriceReference ? '1px solid rgba(255, 255, 255, 0.04)' : 'none'}; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="font-size: 0.9rem; font-weight: 600; color: var(--color-text-secondary); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
        📋 Travelcard Price Reference
      </h3>
      {#if showPriceReference}
        <button
          type="button"
          class="cost-btn"
          style="padding: 0.25rem 0.6rem; font-size: 0.725rem; border-radius: 6px; background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06); color: var(--color-text-secondary); cursor: pointer;"
          onclick={() => showPriceReference = false}
        >
          Collapse ▲
        </button>
      {/if}
    </div>

    {#if !showPriceReference}
      <div style="padding: 1.75rem 1.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.85rem; background: rgba(255,255,255,0.01); text-align: center;">
        <span style="font-size: 1.75rem; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));">📊</span>
        <div>
          <h4 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: #fff;">Need to check TfL fare rates?</h4>
          <p style="margin: 0.35rem 0 0 0; font-size: 0.775rem; color: var(--color-text-secondary); max-width: 460px; line-height: 1.45;">
            View the complete static weekly, monthly, and annual Travelcard pricing matrix for all zone combinations and bus passes.
          </p>
        </div>
        <button
          type="button"
          class="btn-primary"
          style="margin-top: 0.35rem; padding: 0.5rem 1.5rem; font-size: 0.8rem; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 159, 227, 0.25);"
          onclick={() => showPriceReference = true}
        >
          📂 Open Travelcard Price Reference Table
        </button>
      </div>
    {:else}
      <div style="overflow-x: auto;" class="animate-fade-in">
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
            <td class="product-name"><span class="product-dot" style="background: #e7710d;"></span> Weekly Travelcard</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Weekly TC')}</td>
            {/each}
          </tr>
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #e7710d;"></span> Monthly Travelcard</td>
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
            <td class="product-name"><span class="product-dot" style="background: #10b981;"></span> Student Weekly TC</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getProductPrice(zone, 'Student Weekly TC')}</td>
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
    {/if}
  </div>

  <AddCardDialog bind:open={showAddDialog} />
</div>

<style>
  .comparison-table { padding: 0; overflow-x: auto; margin-top: 1.5rem; }
  @media (max-width: 767px) {
    .setting-inline { width: 100%; min-width: 0; flex-direction: column; align-items: stretch; }
    .setting-inline .compact-select { width: 100%; min-width: 0; }
  }
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

  /* Toggles Grid */
  .toggles-grid {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .product-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--color-text-secondary);
    font-size: 0.825rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
  }

  .product-chip:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  /* Specific color themes for active states */
  .product-chip.payg-standard.active {
    background: rgba(0, 159, 227, 0.10);
    border-color: rgba(0, 159, 227, 0.4);
    color: #009FE3;
    font-weight: 600;
    box-shadow: 0 0 12px rgba(0, 159, 227, 0.05);
  }

  .product-chip.payg-railcard.active {
    background: rgba(139, 92, 246, 0.10);
    border-color: rgba(139, 92, 246, 0.4);
    color: #a78bfa;
    font-weight: 600;
    box-shadow: 0 0 12px rgba(139, 92, 246, 0.05);
  }

  .product-chip.payg-concession.active {
    background: rgba(111, 67, 144, 0.10);
    border-color: rgba(111, 67, 144, 0.4);
    color: #c084fc;
    font-weight: 600;
    box-shadow: 0 0 12px rgba(111, 67, 144, 0.05);
  }

  .product-chip.travelcard-standard.active {
    background: rgba(231, 113, 13, 0.10);
    border-color: rgba(231, 113, 13, 0.4);
    color: #e7710d;
    font-weight: 600;
    box-shadow: 0 0 12px rgba(231, 113, 13, 0.05);
  }

  .product-chip.travelcard-student.active {
    background: rgba(16, 185, 129, 0.10);
    border-color: rgba(16, 185, 129, 0.4);
    color: #34d399;
    font-weight: 600;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.05);
  }

  .product-chip.buspass-standard.active {
    background: rgba(220, 36, 31, 0.10);
    border-color: rgba(220, 36, 31, 0.4);
    color: #f87171;
    font-weight: 600;
    box-shadow: 0 0 12px rgba(220, 36, 31, 0.05);
  }

  .product-chip.buspass-student.active {
    background: rgba(220, 36, 31, 0.05);
    border-color: rgba(220, 36, 31, 0.25);
    color: #f87171;
    opacity: 0.9;
    font-weight: 600;
    box-shadow: 0 0 12px rgba(220, 36, 31, 0.03);
  }

  /* Micro-animation for active product dot */
  .product-chip .product-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.2s ease;
  }

  .product-chip.active .product-dot {
    transform: scale(1.25);
    filter: drop-shadow(0 0 4px currentColor);
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
    background: rgba(139, 92, 246, 0.04);
    border-top: 2px solid rgba(139, 92, 246, 0.15);
  }

  .best-cell {
    color: #bda4ff;
    font-weight: 700;
    font-family: var(--font-sans) !important;
    font-size: 0.75rem;
  }

</style>

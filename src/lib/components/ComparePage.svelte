<script lang="ts">
  import {
    productComparison, classifiedJourneys,
    includeStudentPhotocardFee, selectedFareType,
    fareTypeCost, capSummary, weeklyCapResults
  } from '$lib/stores/stores';
  import {
    FARE_TYPES, TRAVELCARD_WEEKLY, TRAVELCARD_MONTHLY,
    TRAVELCARD_ANNUAL, STUDENT_TRAVELCARD_WEEKLY, STUDENT_TRAVELCARD_MONTHLY, STUDENT_TRAVELCARD_ANNUAL,
    BUS_PASS_WEEKLY, BUS_PASS_MONTHLY, BUS_PASS_ANNUAL,
    STUDENT_BUS_PASS_WEEKLY, STUDENT_BUS_PASS_MONTHLY, STUDENT_BUS_PASS_ANNUAL,
    type FareType
  } from '$lib/data/fareData';
  import { Chart, registerables } from 'chart.js';

  Chart.register(...registerables);

  let activeSpan = $state<'weekly' | 'monthly' | 'annual'>('monthly');
  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;

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

  // Dynamic best option calculator that respects visibility toggles
  function getDynamicBestForZone(zone: string): string {
    const comp = $productComparison.find((c: any) => c.zoneRange === zone);
    if (!comp) return 'N/A';

    const options: [string, number][] = [];
    if (activeSpan === 'weekly') {
      if (visibleProducts.paygStandard) options.push(['PAYG', comp.weeklyPayg]);
      if (visibleProducts.paygConcession && !isNoDiscount && $selectedFareType !== 'railcard') options.push(['PAYG + Concession', comp.weeklyPaygFareType]);
      if (visibleProducts.paygRailcard) options.push(['PAYG + Railcard', comp.weeklyPaygRailcard]);
      if (visibleProducts.travelcardStandard) options.push(['Travelcard', comp.weeklyTravelcard]);
      if (visibleProducts.travelcardStudent) options.push(['Student Travelcard', comp.weeklyStudentTravelcard]);
      if (visibleProducts.busPassStandard) options.push(['Bus & Tram Pass', comp.weeklyBusPass]);
    } else if (activeSpan === 'monthly') {
      if (visibleProducts.paygStandard) options.push(['PAYG', comp.monthlyPayg]);
      if (visibleProducts.paygConcession && !isNoDiscount && $selectedFareType !== 'railcard') options.push(['PAYG + Concession', comp.monthlyPaygFareType]);
      if (visibleProducts.paygRailcard) options.push(['PAYG + Railcard', comp.monthlyPaygRailcard]);
      if (visibleProducts.travelcardStandard) options.push(['Travelcard', comp.monthlyTravelcard]);
      if (visibleProducts.travelcardStudent) options.push(['Student Travelcard', comp.monthlyStudentTravelcard]);
      if (visibleProducts.busPassStandard) options.push(['Bus & Tram Pass', comp.monthlyBusPass]);
      if (visibleProducts.busPassStudent) options.push(['Student Bus Pass', comp.monthlyStudentBusPass]);
    } else {
      if (visibleProducts.paygStandard) options.push(['PAYG', comp.annualPayg]);
      if (visibleProducts.paygConcession && !isNoDiscount && $selectedFareType !== 'railcard') options.push(['PAYG + Concession', comp.annualPaygFareType]);
      if (visibleProducts.paygRailcard) options.push(['PAYG + Railcard', comp.annualPaygRailcard]);
      if (visibleProducts.travelcardStandard) options.push(['Travelcard', comp.annualTravelcard]);
      if (visibleProducts.travelcardStudent) options.push(['Student Travelcard', comp.annualStudentTravelcard]);
      if (visibleProducts.busPassStandard) options.push(['Bus & Tram Pass', comp.annualBusPass]);
      if (visibleProducts.busPassStudent) options.push(['Student Bus Pass', comp.annualStudentBusPass]);
    }

    const valid = options.filter(([, v]) => v > 0);
    if (valid.length === 0) return 'N/A';
    valid.sort((a, b) => a[1] - b[1]);
    return valid[0][0];
  }

  // Best option for current time span (respecting dynamic selection)
  let bestOption = $derived.by(() => {
    if ($productComparison.length === 0 || !travelSummary) return null;

    const comp = $productComparison.find(c => c.zoneRange === travelSummary.topZone)
      ?? $productComparison[0];

    const span = activeSpan;
    const best = getDynamicBestForZone(comp.zoneRange);

    const paygCost = span === 'weekly' ? comp.weeklyPayg
      : span === 'monthly' ? comp.monthlyPayg
      : comp.annualPayg;

    const rcCost = span === 'weekly' ? comp.weeklyPaygFareType
      : span === 'monthly' ? comp.monthlyPaygFareType
      : comp.annualPaygFareType;

    const railcardCost = span === 'weekly' ? comp.weeklyPaygRailcard
      : span === 'monthly' ? comp.monthlyPaygRailcard
      : comp.annualPaygRailcard;

    const tcCost = span === 'weekly' ? comp.weeklyTravelcard
      : span === 'monthly' ? comp.monthlyTravelcard
      : comp.annualTravelcard;

    const studentTcCost = span === 'weekly' ? comp.weeklyStudentTravelcard
      : span === 'monthly' ? comp.monthlyStudentTravelcard
      : comp.annualStudentTravelcard;

    const busCost = span === 'weekly' ? comp.weeklyBusPass
      : span === 'monthly' ? comp.monthlyBusPass
      : comp.annualBusPass;

    const studentBusCost = span === 'weekly' ? 0
      : span === 'monthly' ? comp.monthlyStudentBusPass
      : comp.annualStudentBusPass;

    return {
      best,
      zoneRange: comp.zoneRange,
      payg: paygCost,
      fareType: rcCost,
      paygRailcard: railcardCost,
      travelcard: tcCost,
      studentTravelcard: studentTcCost,
      busPass: busCost,
      studentBusPass: studentBusCost
    };
  });

  // Chart data
  let chartData = $derived.by(() => {
    const zoneLabels = $productComparison.map((c: any) => c.zoneRange);
    if ($productComparison.length === 0) return null;

    const getValues = (key: string) => $productComparison.map((c: any) => c[key]);

    const paygLabel = 'PAYG (Adult)';
    const rcLabel = isNoDiscount
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

      if (visibleProducts.travelcardStandard) {
        ds.push({
          label: tcLabel, data: getValues(tcKey),
          backgroundColor: 'rgba(231, 113, 13, 0.7)', borderColor: '#e7710d', borderWidth: 1
        });
      }

      if (visibleProducts.travelcardStudent) {
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

    <div class="discount-badge" style="justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 0.5rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span class="badge-dot" style="background: {isNoDiscount ? '#64748b' : '#009FE3'};"></span>
        <span>{discountBadge}</span>
      </div>
      <span style="font-size: 0.75rem; color: var(--color-text-muted); opacity: 0.85;">
        ℹ️ The £30 annual purchase cost of the National Railcard is excluded from comparison calculations.
      </span>
    </div>
  </div>

  <!-- Dynamic product toggles -->
  <div class="glass-card toggles-bar" style="padding: 1rem 1.25rem; margin-bottom: 1.5rem;">
    <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-secondary); display: block; margin-bottom: 0.75rem; letter-spacing: 0.05em;">👁️ Visible Products in Chart & Table</span>
    <div class="toggles-grid">
      <label class="toggle-checkbox">
        <input type="checkbox" bind:checked={visibleProducts.paygStandard} style="accent-color: #009FE3;" />
        <span class="product-dot" style="background: #009FE3;"></span> PAYG (Adult)
      </label>
      <label class="toggle-checkbox">
        <input type="checkbox" bind:checked={visibleProducts.paygRailcard} style="accent-color: #8b5cf6;" />
        <span class="product-dot" style="background: #8b5cf6;"></span> PAYG + Railcard
      </label>
      {#if !isNoDiscount && $selectedFareType !== 'railcard'}
      <label class="toggle-checkbox">
        <input type="checkbox" bind:checked={visibleProducts.paygConcession} style="accent-color: #6f4390;" />
        <span class="product-dot" style="background: #6f4390;"></span> PAYG + Concession
      </label>
      {/if}
      <label class="toggle-checkbox">
        <input type="checkbox" bind:checked={visibleProducts.travelcardStandard} style="accent-color: #e7710d;" />
        <span class="product-dot" style="background: #e7710d;"></span> Travelcard
      </label>
      <label class="toggle-checkbox">
        <input type="checkbox" bind:checked={visibleProducts.travelcardStudent} style="accent-color: #10b981;" />
        <span class="product-dot" style="background: #10b981;"></span> Student Travelcard
      </label>
      <label class="toggle-checkbox">
        <input type="checkbox" bind:checked={visibleProducts.busPassStandard} style="accent-color: #DC241F;" />
        <span class="product-dot" style="background: #DC241F;"></span> Bus & Tram Pass
      </label>
      {#if activeSpan !== 'weekly'}
      <label class="toggle-checkbox">
        <input type="checkbox" bind:checked={visibleProducts.busPassStudent} style="accent-color: rgba(220, 36, 31, 0.5);" />
        <span class="product-dot" style="background: #DC241F; opacity: 0.5;"></span> Student Bus Pass
      </label>
      {/if}
    </div>
  </div>

  <!-- High-visibility Recommendation Banner -->
  {#if travelSummary && bestOption}
    <div class="glass-card recommendation-banner animate-fade-in">
      <div class="banner-icon">💡</div>
      <div class="banner-content">
        <span class="banner-tag">Our Recommendation</span>
        <h2 class="banner-title">
          Use {
            bestOption.best === 'PAYG' ? 'Pay As You Go (Adult)' :
            bestOption.best === 'PAYG + Concession' ? 'PAYG + ' + fareTypeShortName :
            bestOption.best === 'PAYG + Railcard' ? 'PAYG + National Railcard' :
            bestOption.best
          } for {bestOption.zoneRange}
        </h2>
        <p class="banner-desc">
          Based on your travel history of <strong>{travelSummary.journeys}</strong> journeys in <strong>{travelSummary.weeks}</strong> weeks,
          the cheapest option for your most common zone range ({travelSummary.topZone}) is 
          <strong>{
            bestOption.best === 'PAYG' ? 'PAYG (Adult)' :
            bestOption.best === 'PAYG + Concession' ? 'PAYG + ' + fareTypeShortName :
            bestOption.best === 'PAYG + Railcard' ? 'PAYG + National Railcard' :
            bestOption.best
          }</strong>.
          This will cost you approximately 
          <strong>
            £{
              bestOption.best === 'PAYG' ? bestOption.payg.toFixed(2) : 
              bestOption.best === 'PAYG + Concession' ? bestOption.fareType.toFixed(2) : 
              bestOption.best === 'PAYG + Railcard' ? bestOption.paygRailcard.toFixed(2) :
              bestOption.best === 'Travelcard' ? bestOption.travelcard.toFixed(2) :
              bestOption.best === 'Student Travelcard' ? bestOption.studentTravelcard.toFixed(2) :
              bestOption.best === 'Bus & Tram Pass' ? bestOption.busPass.toFixed(2) :
              bestOption.best === 'Student Bus Pass' ? (bestOption.studentBusPass ? bestOption.studentBusPass.toFixed(2) : '0.00') :
              '0.00'
            }
          </strong> {getSpanLabel()}.
        </p>
      </div>
      <div class="banner-action">
        <span class="action-label">Estimated Cost</span>
        <span class="action-price">
          £{
            bestOption.best === 'PAYG' ? bestOption.payg.toFixed(2) : 
            bestOption.best === 'PAYG + Concession' ? bestOption.fareType.toFixed(2) : 
            bestOption.best === 'PAYG + Railcard' ? bestOption.paygRailcard.toFixed(2) :
            bestOption.best === 'Travelcard' ? bestOption.travelcard.toFixed(2) :
            bestOption.best === 'Student Travelcard' ? bestOption.studentTravelcard.toFixed(2) :
            bestOption.best === 'Bus & Tram Pass' ? bestOption.busPass.toFixed(2) :
            bestOption.best === 'Student Bus Pass' ? (bestOption.studentBusPass ? bestOption.studentBusPass.toFixed(2) : '0.00') :
            '0.00'
          }
        </span>
        <span class="action-period">{getSpanLabel()}</span>
      </div>
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
              <td class="product-name"><span class="product-dot" style="background: #6f4390;"></span> PAYG + Concession ({fareTypeShortName})</td>
              {#each matrixZones as zone}
                <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyPaygFareType' : activeSpan === 'monthly' ? 'monthlyPaygFareType' : 'annualPaygFareType')}</td>
              {/each}
            </tr>
          {/if}
          {#if visibleProducts.travelcardStandard}
          <tr>
            <td class="product-name"><span class="product-dot" style="background: #e7710d;"></span> Travelcard</td>
            {#each matrixZones as zone}
              <td class="price-cell">{getCostForZone(zone, activeSpan === 'weekly' ? 'weeklyTravelcard' : activeSpan === 'monthly' ? 'monthlyTravelcard' : 'annualTravelcard')}</td>
            {/each}
          </tr>
          {/if}
          {#if visibleProducts.travelcardStudent}
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

  /* Toggles Grid */
  .toggles-grid {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .toggle-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--color-text-secondary);
    user-select: none;
    transition: opacity 0.2s ease;
  }

  .toggle-checkbox:hover {
    opacity: 0.9;
  }

  .toggle-checkbox input[type="checkbox"] {
    width: 1.1rem;
    height: 1.1rem;
    cursor: pointer;
  }

  /* Recommendation Banner */
  .recommendation-banner {
    background: linear-gradient(135deg, rgba(0, 159, 227, 0.12), rgba(139, 92, 246, 0.15));
    border: 1px solid rgba(139, 92, 246, 0.35);
    padding: 1.5rem;
    border-radius: 16px;
    margin-bottom: 1.5rem;
    display: flex;
    gap: 1.25rem;
    align-items: center;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
  }

  .banner-icon {
    font-size: 2.5rem;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
    flex-shrink: 0;
  }

  .banner-content {
    flex: 1;
  }

  .banner-tag {
    font-size: 0.725rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #8b5cf6;
    display: block;
    margin-bottom: 0.25rem;
  }

  .banner-title {
    font-size: 1.35rem;
    font-weight: 800;
    margin: 0 0 0.5rem 0;
    color: #fff;
  }

  .banner-desc {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .banner-action {
    text-align: right;
    min-width: 140px;
    flex-shrink: 0;
  }

  .action-label {
    font-size: 0.725rem;
    color: var(--color-text-muted);
    display: block;
    margin-bottom: 0.25rem;
  }

  .action-price {
    font-size: 1.75rem;
    font-weight: 900;
    color: #8b5cf6;
    display: block;
    line-height: 1;
  }

  .action-period {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-weight: 500;
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
    color: #8b5cf6;
    font-weight: 700;
    font-family: var(--font-sans) !important;
    font-size: 0.75rem;
  }

  @media (max-width: 768px) {
    .chart-container { height: 300px; }
    .settings-row { flex-direction: column; align-items: flex-start; }
    .compact-select { min-width: 100%; }
    .recommendation-banner {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
    .banner-action {
      text-align: left;
      min-width: 0;
    }
  }
</style>

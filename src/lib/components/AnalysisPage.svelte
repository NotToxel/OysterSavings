<script lang="ts">
  import {
    classifiedJourneys,
    fareResults,
    dailyCapResults,
    weeklyCapResults,
    capSummary,
    selectedFareType,
    fareTypeCost,
    includeOysterCost,
    savingsResult,
    detectedDiscount,
  } from "$lib/stores/stores";
  import { calculateFareTypeSavings } from "$lib/engine/savingsEngine";
  import { FARE_TYPES, type FareType } from "$lib/data/fareData";
  import { getZoneColor } from "$lib/data/stationService";
  import InsightsPage from "./InsightsPage.svelte";

  let activeTab = $state<"journeys" | "insights" | "savings" | "caps">(
    "journeys",
  );
  let sortKey = $state<string>("date");
  let sortAsc = $state(false);
  let filterMode = $state<string>("all");
  let includeCardCost = $state(false);
  let overrideCost = $state(false);
  let searchQuery = $state("");
  let customCostInput = $state("");
  let isCardCostDisabled = $derived(
    ($selectedFareType === "railcard" && $detectedDiscount === "railcard") ||
    ($selectedFareType === "disabled" && $detectedDiscount === "disabled")
  );
  let farePrefs = $state<
    Record<string, { include: boolean; override: boolean; cost: number }>
  >({});
  let avgWeeklySpend = $derived.by(() => {
    if (!$weeklyCapResults || $weeklyCapResults.length === 0) return 0;
    const total = $weeklyCapResults.reduce((sum, w) => sum + w.totalSpend, 0);
    return total / $weeklyCapResults.length;
  });

  // Auto-sync fare type cost when selection changes — always reset to £0 so the
  // fresh simulation shows fares-only cost. User can opt-in via 'Include card cost'.
  // Cache the selected fare type so we know what we are switching FROM
  let prevFareType = $selectedFareType;

  $effect(() => {
    // ONLY run if the dropdown actually changed
    if ($selectedFareType !== prevFareType) {
      // 1. SAVE: Store the current UI state into the outgoing fare type's memory
      farePrefs[prevFareType] = {
        include: includeCardCost,
        override: overrideCost,
        cost: $fareTypeCost,
      };

      // 2. LOAD: Check if we have saved memory for the incoming fare type
      const saved = farePrefs[$selectedFareType];
      const rc = FARE_TYPES[$selectedFareType];

      // If the newly selected fare type doesn't even support card costs (like standard Adult), force reset
      if (rc && rc.cost1Year === 0) {
        includeCardCost = false;
        overrideCost = false;
        $fareTypeCost = 0;
      }
      // If we have saved memory for this fare type, restore it exactly as you left it
      else if (saved) {
        includeCardCost = saved.include;
        overrideCost = saved.override;
        $fareTypeCost = saved.cost;
      }
      // If this is the first time selecting this fare type, use clean defaults
      else {
        includeCardCost = false;
        overrideCost = false;
        $fareTypeCost = 0;
      }

      // 3. Update our tracker for the next time you switch
      prevFareType = $selectedFareType;
    }
  });

  // Auto-sync includeOysterCost when selection changes (do not force to true)
  $effect(() => {
    if ($selectedFareType === "none") {
      $includeOysterCost = false;
    }
  });

  $effect(() => {
    if (isCardCostDisabled) {
      includeCardCost = false;
      overrideCost = false;
      $fareTypeCost = 0;
    }
  });

  $effect(() => {
    if (overrideCost) {
      customCostInput = $fareTypeCost.toString();
    }
  });

  // Detect fare types with no PAYG discount
  let isNoDiscount = $derived(
    $selectedFareType === "none" || $selectedFareType === "student",
  );

  let filteredJourneys = $derived.by(() => {
    let list = [...$classifiedJourneys];

    if (filterMode === "peak") list = list.filter((j) => j.isPeak);
    else if (filterMode === "offpeak") list = list.filter((j) => !j.isPeak);
    else if (filterMode === "bus") list = list.filter((j) => j.isBus);
    else if (filterMode === "tube")
      list = list.filter((j) => j.mode === "underground");
    else if (filterMode === "rail")
      list = list.filter((j) =>
        ["national_rail", "overground", "elizabeth", "dlr"].includes(j.mode),
      );
    else if (filterMode === "nrtube")
      list = list.filter((j) => j.mode === "nr_tube");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((j) => {
        const action = (j.raw.journeyAction || "").toLowerCase();
        const origin = (j.origin || "").toLowerCase();
        const destination = (j.destination || "").toLowerCase();
        const route = (j.busRoute || "").toLowerCase();
        const mode = (j.mode || "").toLowerCase();
        return (
          action.includes(q) ||
          origin.includes(q) ||
          destination.includes(q) ||
          route.includes(q) ||
          mode.includes(q)
        );
      });
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.raw.date.getTime() - b.raw.date.getTime();
      else if (sortKey === "charge") cmp = a.raw.charge - b.raw.charge;
      else if (sortKey === "mode") cmp = a.mode.localeCompare(b.mode);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  });

  function toggleSort(key: string) {
    if (sortKey === key) sortAsc = !sortAsc;
    else {
      sortKey = key;
      sortAsc = true;
    }
  }

  function getModeLabel(mode: string): string {
    if (mode === "underground") return "Tube";
    if (mode === "overground") return "Overground";
    if (mode === "elizabeth") return "Elizabeth";
    if (mode === "dlr") return "DLR";
    if (mode === "national_rail") return "Rail";
    if (mode === "nr_tube") return "NR/Tube";
    if (mode === "bus") return "Bus";
    return mode;
  }

  // getZoneColor is imported from $lib/data/stationService for consistent zone coloring

  function getModeBadgeClass(m: string): string {
    if (m === "bus") return "badge-bus";
    if (m === "underground") return "badge-underground";
    if (m === "national_rail") return "badge-rail";
    if (m === "nr_tube") return "badge-rail";
    if (m === "overground") return "badge-overground";
    if (m === "elizabeth") return "badge-elizabeth";
    if (m === "dlr") return "badge-dlr";
    if (m === "tram") return "badge-tram";
    return "badge-rail";
  }

  function formatCapProgress(progress: number): string {
    return `${Math.round(progress * 100)}%`;
  }

  function getCapColor(progress: number): string {
    if (progress >= 1) return "#10b981";
    if (progress >= 0.7) return "#f59e0b";
    return "#009FE3";
  }

  const fareTypeOptions = Object.entries(FARE_TYPES).map(([key, info]) => ({
    value: key as FareType,
    label: info.name,
  }));

  let netSaving = $derived($savingsResult?.netSaving ?? 0);
  let breakEvenText = $derived.by(() => {
    if (!$savingsResult) return "N/A";
    if ($savingsResult.breakEvenJourneys === -1) return "Not achievable";
    if ($savingsResult.breakEvenDate) {
      return `${$savingsResult.breakEvenJourneys} journeys (~${$savingsResult.breakEvenDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})`;
    }
    return `${$savingsResult.breakEvenJourneys} journeys`;
  });

  // Disabled Persons Railcard vs detected National Railcard comparison
  // When a National Railcard is detected, disabled sim is compared against actual spend.
  // netSaving > 0 means disabled would be cheaper than the railcard; == 0 means equal.
  let isDisabledVsRailcard = $derived(
    $selectedFareType === "disabled" && $detectedDiscount === "railcard",
  );
  let disabledVsRailcardLabel = $derived.by(() => {
    if (!isDisabledVsRailcard || !$savingsResult) return "";
    const diff = netSaving; // netSaving = totalActual - (totalFareType + costs)
    if (Math.abs(diff) <= 0.5) return "🔄 Equal to National Railcard Discount";
    if (diff > 0)
      return "❌ Missed Saving — Disabled Persons Railcard would be cheaper";
    return "⚠️ Disabled Persons Railcard costs more than your National Railcard";
  });
</script>

<div class="analysis-page">
  <h1 class="page-title">Journey Analysis</h1>

  <!-- Tab navigation -->
  <div class="tab-nav" style="margin-bottom: 1.5rem;">
    <button
      class="tab-btn"
      class:active={activeTab === "journeys"}
      onclick={() => (activeTab = "journeys")}
    >
      🚆 Journeys
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "insights"}
      onclick={() => (activeTab = "insights")}
    >
      💡 Insights
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "savings"}
      onclick={() => (activeTab = "savings")}
    >
      💰 Discounted Fares
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "caps"}
      onclick={() => (activeTab = "caps")}
    >
      📊 Cap Analysis
    </button>
  </div>

  {#if activeTab === "journeys"}
    <!-- Journey filter pills -->
    <div class="filter-pills">
      {#each [{ id: "all", label: "All", count: $classifiedJourneys.length }, { id: "peak", label: "Peak", count: $classifiedJourneys.filter((j) => j.isPeak).length }, { id: "offpeak", label: "Off-Peak", count: $classifiedJourneys.filter((j) => !j.isPeak).length }, { id: "tube", label: "Tube", count: $classifiedJourneys.filter((j) => j.mode === "underground").length }, { id: "rail", label: "Rail", count: $classifiedJourneys.filter( (j) => ["national_rail", "overground", "elizabeth", "dlr"].includes(j.mode), ).length }, { id: "nrtube", label: "NR/Tube", count: $classifiedJourneys.filter((j) => j.mode === "nr_tube").length }, { id: "bus", label: "Bus & Tram", count: $classifiedJourneys.filter((j) => j.isBus).length }, { id: "capped", label: "Cap Hit", count: $classifiedJourneys.filter((j) => j.isCapHit).length }] as pill}
        <button
          class="filter-pill"
          class:active={filterMode === pill.id}
          onclick={() => (filterMode = pill.id)}
        >
          {pill.label} <span class="pill-count">{pill.count}</span>
        </button>
      {/each}
    </div>

    <!-- Search Bar -->
    <div
      class="search-bar"
      style="margin-bottom: 1rem; display: flex; gap: 0.5rem; align-items: center; width: 100%;"
    >
      <span
        class="search-icon"
        style="opacity: 0.6; font-size: 0.9rem; margin-left: 0.25rem;">🔍</span
      >
      <input
        type="text"
        placeholder="Search station, route, or mode..."
        class="input-field"
        style="flex: 1; font-size: 0.85rem; padding: 0.5rem 0.75rem; border-radius: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--color-border); color: var(--color-text);"
        bind:value={searchQuery}
      />
      {#if searchQuery}
        <button
          onclick={() => (searchQuery = "")}
          style="background: none; border: none; color: var(--color-text-secondary); cursor: pointer; padding: 0 0.5rem; font-size: 0.85rem;"
        >
          Clear
        </button>
      {/if}
    </div>

    <!-- Journey table -->
    <div
      class="table-container glass-card"
      style="padding: 0; overflow: hidden;"
    >
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th class="sortable" onclick={() => toggleSort("date")}>
                Date {sortKey === "date" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
              <th>Time</th>
              <th>Journey</th>
              <th>Mode</th>
              <th>Zones</th>
              <th>Peak</th>
              <th class="sortable" onclick={() => toggleSort("charge")}>
                Charge {sortKey === "charge" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredJourneys as j, i}
              <tr
                class="animate-fade-in"
                style="animation-delay: {Math.min(i * 20, 500)}ms"
              >
                <td class="date-cell">{j.raw.dateStr}</td>
                <td class="time-cell">{j.raw.startTime || "—"}</td>
                <td class="journey-cell">
                  {#if j.isBus}
                    {j.raw.journeyAction}
                  {:else if j.origin && j.destination}
                    <span class="station"
                      >{j.origin.replace(/\s*\[.*?\]/g, "")}</span
                    >
                    <span class="arrow">→</span>
                    <span class="station"
                      >{j.destination.replace(/\s*\[.*?\]/g, "")}</span
                    >
                  {:else}
                    {j.raw.journeyAction}
                  {/if}
                </td>
                <td>
                  <span class="badge {getModeBadgeClass(j.mode)}"
                    >{getModeLabel(j.mode)}</span
                  >
                </td>
                <td class="zone-cell">{j.zoneRange || "—"}</td>
                <td>
                  {#if j.isBus}
                    <span class="badge badge-bus">Flat</span>
                  {:else if j.isPeak}
                    <span class="badge badge-peak">Peak</span>
                  {:else}
                    <span class="badge badge-offpeak">Off-Pk</span>
                  {/if}
                  {#if j.isEveningPeakException}
                    <span
                      class="badge badge-offpeak"
                      style="margin-left: 2px;"
                      title="Evening peak exception: inbound to Zone 1"
                      >Exc</span
                    >
                  {/if}
                </td>
                <td class="charge-cell">
                  {#if j.raw.charge === 0 && j.isCapHit}
                    <span style="color: #34d399;">FREE</span>
                  {:else}
                    £{j.raw.charge.toFixed(2)}
                  {/if}
                </td>
                <td class="note-cell">
                  {#if j.isCapHit}
                    <span class="badge badge-cap">Cap Hit</span>
                  {:else if j.isHopperFree}
                    <span class="badge badge-cap">Hopper</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else if activeTab === "insights"}
    <InsightsPage />
  {:else if activeTab === "savings"}
    <!-- Fare Type Savings Panel -->
    <div class="savings-layout">
      <!-- Settings -->
      <div class="glass-card savings-settings">
        <h3 class="settings-title">⚙️ Savings Settings</h3>

        <div class="setting-group">
          <label class="setting-label" for="fare-type-select">Fare Type</label>
          <select
            class="input-field"
            id="fare-type-select"
            bind:value={$selectedFareType}
          >
            {#each fareTypeOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>

        {#if $selectedFareType === "railcard" || $selectedFareType === "disabled"}
          <div class="setting-group">
            <span class="setting-label">Include card cost in simulation</span>
            <div class="toggle-row">
              <button
                class="toggle"
                class:active={includeCardCost}
                disabled={isCardCostDisabled}
                onclick={() => {
                  includeCardCost = !includeCardCost;
                  overrideCost = false;
                  $fareTypeCost = includeCardCost
                    ? FARE_TYPES[$selectedFareType].cost1Year
                    : 0;
                }}
                aria-label="Toggle card cost inclusion"
              >
                <span class="toggle-dot"></span>
              </button>
              <span class="toggle-label">
                {#if isCardCostDisabled}
                  Already detected on card
                {:else if !includeCardCost}
                  Not included (fares only)
                {:else if overrideCost}
                  +£{$fareTypeCost.toFixed(2)} (custom)
                {:else}
                  +£{$fareTypeCost.toFixed(2)}
                {/if}
              </span>
            </div>
            {#if includeCardCost && !isCardCostDisabled}
              <div class="cost-buttons" style="margin-top: 0.5rem;">
                <button
                  class="cost-btn"
                  class:active={!overrideCost &&
                    $fareTypeCost === FARE_TYPES[$selectedFareType].cost1Year}
                  onclick={() => {
                    overrideCost = false;
                    $fareTypeCost = FARE_TYPES[$selectedFareType].cost1Year;
                  }}
                >
                  £{FARE_TYPES[$selectedFareType].cost1Year} (1yr)
                </button>
                {#if FARE_TYPES[$selectedFareType].cost3Year > 0}
                  <button
                    class="cost-btn"
                    class:active={!overrideCost &&
                      $fareTypeCost === FARE_TYPES[$selectedFareType].cost3Year}
                    onclick={() => {
                      overrideCost = false;
                      $fareTypeCost = FARE_TYPES[$selectedFareType].cost3Year;
                    }}
                  >
                    £{FARE_TYPES[$selectedFareType].cost3Year} (3yr)
                  </button>
                {/if}
                <button
                  class="cost-btn"
                  class:active={overrideCost}
                  onclick={() => (overrideCost = !overrideCost)}
                >
                  Custom
                </button>
              </div>
              {#if overrideCost}
                <input
                  type="number"
                  class="input-field"
                  id="fare-type-cost"
                  value={customCostInput}
                  oninput={(e) => {
                    const target = e.target as HTMLInputElement;
                    let valStr = target.value;
                    if (valStr.includes('-')) {
                      valStr = valStr.replace(/-/g, '');
                      target.value = valStr;
                    }
                    let val = parseFloat(valStr);
                    if (!isNaN(val)) {
                      if (val > 1000) {
                        val = 1000;
                        valStr = "1000";
                        target.value = "1000";
                      }
                      $fareTypeCost = val;
                    } else {
                      $fareTypeCost = 0;
                    }
                    customCostInput = valStr;
                  }}
                  onblur={(e) => {
                    const target = e.target as HTMLInputElement;
                    let val = parseFloat(target.value);
                    if (isNaN(val) || val < 0) {
                      val = 0;
                    } else if (val > 1000) {
                      val = 1000;
                    }
                    $fareTypeCost = val;
                    customCostInput = val.toString();
                    target.value = val.toString();
                  }}
                  min="0"
                  max="1000"
                  step="1"
                  style="margin-top: 0.5rem;"
                />
              {/if}
            {/if}
          </div>
        {/if}

        <div class="setting-group">
          <span class="setting-label">
            {#if $selectedFareType === "student"}
              Include Apprentice / 18+ Student Photocard Fee
            {:else if $selectedFareType === "zip_11_15" || $selectedFareType === "zip_16_17"}
              Include Zip Photocard Fee
            {:else if $selectedFareType === "none"}
              Oyster / Contactless Card Fee
            {:else}
              Include Oyster Card Cost
            {/if}
          </span>
          <div class="toggle-row">
            <button
              class="toggle"
              class:active={$includeOysterCost && $selectedFareType !== "none"}
              onclick={() => ($includeOysterCost = !$includeOysterCost)}
              aria-label="Toggle Oyster card cost"
              disabled={$selectedFareType === "none"}
            >
              <span class="toggle-dot"></span>
            </button>
            <span class="toggle-label">
              {#if !$includeOysterCost || $selectedFareType === "none"}
                Not included / Free
              {:else if $selectedFareType === "student"}
                +£12.00
              {:else if $selectedFareType === "zip_11_15"}
                +£16.50
              {:else if $selectedFareType === "zip_16_17"}
                +£22.00
              {:else}
                +£7.00
              {/if}
            </span>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div class="savings-results">
        {#if $savingsResult}
          {#if isNoDiscount}
            <!-- No discount info panel -->
            <div
              class="glass-card savings-hero"
              style="border-color: rgba(59, 130, 246, 0.3);"
            >
              <div class="savings-hero-label">
                ℹ️ {$savingsResult.fareTypeName} — No PAYG Fare Discount
              </div>
              <div
                class="savings-hero-value"
                style="color: #60a5fa; font-size: 2rem;"
              >
                £{$savingsResult.totalExpectedSpend.toFixed(2)}
              </div>
              <div class="savings-hero-sub">
                Total PAYG cost across {$savingsResult.totalJourneys} journeys (no
                fare discount applies)
                <br />
                <span style="font-size: 0.75rem; opacity: 0.8;"
                  >Actual historical spend: £{$savingsResult.totalActualSpend.toFixed(
                    2,
                  )}</span
                >
              </div>
            </div>

            {#if $selectedFareType === "none" && $detectedDiscount === "railcard"}
              <div
                class="glass-card savings-hero positive"
                style="border-color: rgba(139, 92, 246, 0.4); background: rgba(139, 92, 246, 0.05); margin-bottom: 1.5rem; text-align: left; align-items: flex-start; padding: 1.5rem;"
              >
                <div
                  class="savings-hero-label"
                  style="color: #c084fc; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;"
                >
                  💡 National Railcard Discount Detected!
                </div>
                <div
                  class="savings-hero-sub"
                  style="color: var(--color-text-secondary); margin-bottom: 1.25rem; font-size: 0.875rem; text-align: left; line-height: 1.5;"
                >
                  We analyzed your travel history and detected that your actual
                  fares match the <strong>National Railcard</strong> discount rate
                  (e.g. you paid £1.95 instead of £3.00 on off-peak journeys).
                </div>
                <button
                  class="cost-btn"
                  style="background: #8b5cf6; color: white; border: none; font-weight: bold; padding: 0.625rem 1.25rem; border-radius: 8px; cursor: pointer; transition: all 0.2s;"
                  onclick={() => {
                    $selectedFareType = "railcard";
                    $includeOysterCost = false;
                  }}
                >
                  Apply National Railcard in Simulation
                </button>
              </div>
            {/if}

            <!-- Potential savings teaser -->
            <div
              class="glass-card"
              style="padding: 1.5rem; border-color: rgba(52, 211, 153, 0.2);"
            >
              <h3
                style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem;"
              >
                💡 Potential Savings with a Discount
              </h3>
              <p
                style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 1rem;"
              >
                {$selectedFareType === "student"
                  ? "The Apprentice / 18+ Student Oyster gives 30% off Travelcards but has no standard PAYG single fare discount. To get 1/3 off PAYG fares, add a National Railcard to your Oyster."
                  : "Adult / Contactless has standard fares with no discount. Select a discount profile above to see how much you could save."}
              </p>
              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <button
                  class="cost-btn"
                  style="flex: none; padding: 0.5rem 1rem;"
                  onclick={() => ($selectedFareType = "railcard")}
                >
                  Try National Railcard
                </button>
                <button
                  class="cost-btn"
                  style="flex: none; padding: 0.5rem 1rem;"
                  onclick={() => ($selectedFareType = "jobcentre")}
                >
                  Try Jobcentre Plus
                </button>
                {#if $detectedDiscount !== "railcard" && $selectedFareType !== "railcard"}
                  <button
                    class="cost-btn"
                    style="flex: none; padding: 0.5rem 1rem;"
                    onclick={() => ($selectedFareType = "disabled")}
                  >
                    Try Disabled Persons
                  </button>
                {/if}
              </div>
            </div>
          {:else if $savingsResult.hasExistingDiscount}
            <!-- Already discounted info panel -->
            <div class="glass-card savings-hero positive">
              <div class="savings-hero-label">
                ✅ Discount correctly detected in your travel history!
              </div>
              <div class="savings-hero-value green">
                You saved £{$savingsResult.totalSaving.toFixed(2)}
              </div>
              <div class="savings-hero-sub">
                Compared to standard Adult PAYG fares over {$savingsResult.totalJourneys}
                journeys.
                <br />
                <span style="font-size: 0.75rem; opacity: 0.8;"
                  >(We detected that your travel history matches the {$savingsResult.fareTypeName}
                  rate. Your actual spend was £{$savingsResult.totalActualSpend.toFixed(
                    2,
                  )} vs standard adult £{$savingsResult.totalExpectedSpend.toFixed(
                    2,
                  )})</span
                >
              </div>
            </div>
          {:else}
            <!-- Main savings stat -->
            {#if isDisabledVsRailcard}
              <!-- Special comparison: Disabled Persons Railcard vs detected National Railcard -->
              <div
                class="glass-card savings-hero"
                class:positive={netSaving > 0}
                class:negative={netSaving <= 0}
              >
                <div class="savings-hero-label">
                  {disabledVsRailcardLabel}
                </div>
                <div
                  class="savings-hero-value"
                  class:green={netSaving > 0}
                  class:red={netSaving < 0}
                  style={Math.abs(netSaving) <= 0.5 ? "color: #f59e0b;" : ""}
                >
                  {netSaving >= 0 ? "+" : ""}£{netSaving.toFixed(2)}
                </div>
                <div class="savings-hero-sub">
                  Compared to your actual spend of £{$savingsResult.totalActualSpend.toFixed(
                    2,
                  )} (National Railcard detected)
                  <br />
                  <span style="font-size: 0.75rem; opacity: 0.8;"
                    >Disabled Persons Railcard simulated fares: £{$savingsResult.totalFareTypeSpend.toFixed(
                      2,
                    )} vs your actual £{$savingsResult.totalActualSpend.toFixed(
                      2,
                    )}</span
                  >
                </div>
              </div>
            {:else}
              <div
                class="glass-card savings-hero"
                class:positive={netSaving > 0}
                class:negative={netSaving <= 0}
              >
                <div class="savings-hero-label">
                  {#if $savingsResult.totalActualSpend > $savingsResult.totalFareTypeSpend + 5}
                    {netSaving > 0
                      ? "❌ Missed Net Saving with"
                      : "⚠️ Net Result with"}
                    {$savingsResult.fareTypeName}
                  {:else}
                    {netSaving > 0
                      ? "✅ Achieved Net Saving with"
                      : "⚠️ Net Result with"}
                    {$savingsResult.fareTypeName}
                  {/if}
                </div>
                <div
                  class="savings-hero-value"
                  class:green={netSaving > 0}
                  class:red={netSaving <= 0}
                >
                  {netSaving >= 0 ? "+" : ""}£{netSaving.toFixed(2)}
                </div>
                <div class="savings-hero-sub">
                  Over {$savingsResult.totalJourneys} journeys ({$savingsResult.eligibleJourneys}
                  eligible for discount)
                  <br />
                  <span style="font-size: 0.75rem; opacity: 0.8;"
                    >Actual historical spend: £{$savingsResult.totalActualSpend.toFixed(
                      2,
                    )}</span
                  >
                </div>
              </div>
            {/if}

            <!-- Breakdown cards -->
            <div class="savings-cards">
              <div class="stat-card">
                <div class="stat-value">
                  £{$savingsResult.totalExpectedSpend.toFixed(2)}
                </div>
                <div class="stat-label">Simulated Adult PAYG</div>
              </div>
              <div class="stat-card">
                <div class="stat-value" style="color: #34d399;">
                  £{(
                    $savingsResult.totalFareTypeSpend +
                    $savingsResult.fareTypeCost +
                    $savingsResult.oysterCost
                  ).toFixed(2)}
                </div>
                <div class="stat-label">
                  Simulated Fare Type
                  {$savingsResult.fareTypeCost === 0 &&
                  $savingsResult.oysterCost === 0
                    ? "(fares only)"
                    : "(Total Cost)"}
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-value" style="color: #60a5fa;">
                  £{$savingsResult.totalActualSpend.toFixed(2)}
                </div>
                <div class="stat-label">Actual Spend</div>
              </div>
              <div class="stat-card">
                <div class="stat-value" style="color: #fbbf24;">
                  £{netSaving.toFixed(2)}
                </div>
                <div class="stat-label">Net Saving</div>
              </div>
            </div>

            <!-- Break-even -->
            <div class="glass-card break-even-card">
              <h3>📈 Break-Even Analysis</h3>
              <div class="break-even-detail">
                <div class="be-row">
                  <span>Fare Type cost</span>
                  <span>£{$savingsResult.fareTypeCost.toFixed(2)}</span>
                </div>
                {#if $savingsResult.oysterCost > 0}
                  <div class="be-row">
                    <span
                      >{$selectedFareType === "student"
                        ? "18+ Student Photocard fee"
                        : "Oyster card cost"}</span
                    >
                    <span>£{$savingsResult.oysterCost.toFixed(2)}</span>
                  </div>
                {/if}
                <div class="be-row">
                  <span>Total upfront cost</span>
                  <span
                    >£{(
                      $savingsResult.fareTypeCost + $savingsResult.oysterCost
                    ).toFixed(2)}</span
                  >
                </div>
                <div class="be-row highlight">
                  <span>Break-even point</span>
                  <span>{breakEvenText}</span>
                </div>
              </div>

              {#if $savingsResult.breakEvenJourneys > 0 && $savingsResult.breakEvenJourneys !== -1}
                <div class="be-progress">
                  <div class="be-progress-bar">
                    <div
                      class="be-progress-fill"
                      style="width: {Math.min(
                        100,
                        ($savingsResult.eligibleJourneys /
                          $savingsResult.breakEvenJourneys) *
                          100,
                      )}%"
                    ></div>
                  </div>
                  <div class="be-progress-labels">
                    <span>{$savingsResult.eligibleJourneys} journeys taken</span
                    >
                    <span>{$savingsResult.breakEvenJourneys} to break even</span
                    >
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {:else if activeTab === "caps"}
    <!-- Cap Analysis -->
    <div class="cap-layout">
      {#if $capSummary}
        <!-- Summary cards -->
        <div class="cap-summary-grid">
          <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-value">
              {$capSummary.daysCapHit}<span class="stat-total"
                >/{$capSummary.totalDays}</span
              >
            </div>
            <div class="stat-label">Days Cap Hit</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📆</div>
            <div class="stat-value">
              {$capSummary.weeksCapHit}<span class="stat-total"
                >/{$capSummary.totalWeeks}</span
              >
            </div>
            <div class="stat-label">Weeks Cap Hit</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💷</div>
            <div class="stat-value" style="color: #34d399;">
              £{$capSummary.totalSavedByDailyCap.toFixed(2)}
            </div>
            <div class="stat-label">Saved by Daily Cap</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-value">
              £{$capSummary.averageDailySpend.toFixed(2)}
            </div>
            <div class="stat-label">Avg Daily Spend</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💳</div>
            <div class="stat-value">£{avgWeeklySpend.toFixed(2)}</div>
            <div class="stat-label">Avg Weekly Spend</div>
          </div>
        </div>
      {/if}

      <!-- Daily cap bars -->
      <div class="glass-card" style="padding: 1.5rem;">
        <h3 class="cap-section-title">Daily Cap Progress</h3>
        <div class="cap-bars">
          {#each $dailyCapResults as day}
            <div class="cap-day-row" class:cap-hit={day.capHit}>
              <div class="cap-day-date">{day.date}</div>
              <div
                class="cap-day-zones"
                style="font-size: 0.8rem; font-weight: 700; color: {getZoneColor(
                  day.maxZoneRange,
                )}; min-width: 60px;"
              >
                {day.maxZoneRange}
              </div>
              <div class="cap-day-bar-container">
                <div class="cap-progress">
                  <div
                    class="cap-progress-bar"
                    style="width: {day.capProgress *
                      100}%; background: {getCapColor(day.capProgress)};"
                  ></div>
                </div>
              </div>
              <div class="cap-day-values">
                <span class="cap-day-spend">£{day.totalSpend.toFixed(2)}</span>
                <span class="cap-day-divider">/</span>
                <span
                  class="cap-day-cap"
                  title={day.capType === "peak"
                    ? "Peak Cap"
                    : day.capType === "off-peak"
                      ? "Off-Peak Cap"
                      : "Cap"}
                >
                  £{day.dailyCap.toFixed(2)}
                </span>
              </div>
              <div class="cap-day-journeys">{day.journeys.length} trips</div>
              {#if day.capHit}
                <span
                  class="badge badge-cap"
                  class:badge-peak={day.capType === "peak"}
                  class:badge-off-peak={day.capType === "off-peak"}
                >
                  {day.capType === "peak"
                    ? "Peak Cap Hit"
                    : day.capType === "off-peak"
                      ? "Off-Peak Cap Hit"
                      : "Cap Hit"}
                </span>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Weekly caps -->
      <div class="glass-card" style="padding: 1.5rem; margin-top: 1rem;">
        <h3 class="cap-section-title">Weekly Cap Progress</h3>
        <div class="cap-bars">
          {#each $weeklyCapResults as week}
            <div class="cap-day-row" class:cap-hit={week.capHit}>
              <div class="cap-day-date" style="min-width: 160px;">
                {week.weekStart.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })} –
                {week.weekEnd.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </div>
              <div class="cap-day-bar-container">
                <div class="cap-progress">
                  <div
                    class="cap-progress-bar"
                    style="width: {week.capProgress *
                      100}%; background: {getCapColor(week.capProgress)};"
                  ></div>
                </div>
              </div>
              <div class="cap-day-values">
                <span class="cap-day-spend">£{week.totalSpend.toFixed(2)}</span>
                <span class="cap-day-divider">/</span>
                <span class="cap-day-cap">£{week.weeklyCap.toFixed(2)}</span>
              </div>
              <div class="cap-day-journeys">{week.days.length} days</div>
              {#if week.capHit}
                <span class="badge badge-cap">Cap Hit</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .analysis-page {
    max-width: 1100px;
    margin: 0 auto;
  }

  .toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 1rem;
  }

  /* Filter pills */
  .filter-pills {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .filter-pill {
    padding: 0.375rem 0.875rem;
    border-radius: 999px;
    font-size: 0.775rem;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .filter-pill:hover {
    border-color: var(--color-border-accent);
  }
  .filter-pill.active {
    background: rgba(0, 159, 227, 0.1);
    border-color: rgba(0, 159, 227, 0.3);
    color: var(--color-oyster-blue);
  }

  .pill-count {
    background: rgba(255, 255, 255, 0.06);
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    font-size: 0.7rem;
  }

  /* Table */
  .table-container {
    margin-top: 0.5rem;
  }
  .table-scroll {
    overflow-x: auto;
    max-height: 600px;
    overflow-y: auto;
  }

  .data-table th {
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(12px);
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }
  .sortable:hover {
    color: var(--color-oyster-blue);
  }

  .date-cell {
    font-weight: 500;
    font-size: 0.8rem;
    white-space: nowrap;
  }
  .time-cell {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .journey-cell {
    max-width: 300px;
  }
  .station {
    font-weight: 500;
    font-size: 0.8rem;
  }
  .arrow {
    color: var(--color-text-muted);
    margin: 0 0.25rem;
    font-size: 0.7rem;
  }
  .zone-cell {
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }
  .charge-cell {
    font-weight: 600;
    font-family: monospace;
  }
  .note-cell {
    white-space: nowrap;
  }

  /* Savings layout */
  .savings-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  .savings-settings {
    padding: 1.5rem;
  }
  .settings-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1.25rem;
  }

  .setting-group {
    margin-bottom: 1.25rem;
  }
  .setting-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .cost-buttons {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .cost-btn {
    flex: 1;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .cost-btn:hover {
    border-color: var(--color-border-accent);
  }
  .cost-btn.active {
    background: rgba(0, 159, 227, 0.1);
    border-color: rgba(0, 159, 227, 0.3);
    color: var(--color-oyster-blue);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .toggle-label {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  /* Savings results */
  .savings-hero {
    padding: 1.5rem;
    text-align: center;
    margin-bottom: 1rem;
  }

  .savings-hero-label {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
  }

  .savings-hero-value {
    font-size: 2.5rem;
    font-weight: 900;
    letter-spacing: -0.03em;
  }

  .savings-hero-value.green {
    color: #34d399;
  }
  .savings-hero-value.red {
    color: #f87171;
  }

  .savings-hero-sub {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-top: 0.375rem;
  }

  .savings-hero.positive {
    border-color: rgba(16, 185, 129, 0.3);
  }
  .savings-hero.negative {
    border-color: rgba(239, 68, 68, 0.2);
  }

  .savings-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .savings-cards .stat-value {
    font-size: 1.25rem;
  }

  /* Break-even */
  .break-even-card {
    padding: 1.5rem;
  }
  .break-even-card h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .be-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    font-size: 0.85rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .be-row.highlight {
    border-bottom: none;
    font-weight: 700;
    color: var(--color-oyster-blue);
    font-size: 0.9rem;
    padding-top: 0.75rem;
  }

  .be-progress {
    margin-top: 1rem;
  }
  .be-progress-bar {
    height: 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 999px;
    overflow: hidden;
  }
  .be-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #009fe3, #6950a1);
    border-radius: 999px;
    transition: width 1s ease;
  }
  .be-progress-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 0.375rem;
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }

  /* Cap analysis */
  .cap-summary-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .cap-summary-grid .stat-total {
    font-size: 0.9rem;
    font-weight: 400;
    color: var(--color-text-muted);
  }

  .cap-section-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .cap-bars {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .cap-day-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    transition: background 0.2s ease;
  }

  .cap-day-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }
  .cap-day-row.cap-hit {
    background: rgba(16, 185, 129, 0.04);
  }

  .cap-day-date {
    min-width: 100px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .cap-day-bar-container {
    flex: 1;
  }

  .cap-day-values {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8rem;
    font-family: monospace;
    min-width: 120px;
    justify-content: flex-end;
  }

  .cap-day-spend {
    font-weight: 600;
  }
  .cap-day-divider {
    color: var(--color-text-muted);
  }
  .cap-day-cap {
    color: var(--color-text-muted);
  }
  .cap-day-journeys {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    min-width: 50px;
    text-align: right;
  }

  @media (max-width: 768px) {
    .savings-layout {
      grid-template-columns: 1fr;
    }
    .savings-cards {
      grid-template-columns: repeat(2, 1fr);
    }
    .cap-summary-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .cap-day-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.25rem 0.5rem;
      padding: 0.75rem;
      border-radius: 8px;
    }
    .cap-day-date {
      grid-row: 1;
      grid-column: 1;
      font-size: 0.85rem;
      min-width: 0 !important;
    }
    .cap-day-zones {
      grid-row: 2;
      grid-column: 1;
      font-size: 0.75rem;
      min-width: 0 !important;
    }
    .cap-day-values {
      grid-row: 1;
      grid-column: 2;
      justify-content: flex-end;
      min-width: 0 !important;
      font-size: 0.85rem;
    }
    .cap-day-journeys {
      grid-row: 2;
      grid-column: 2;
      min-width: 0 !important;
      font-size: 0.75rem;
      text-align: right;
    }
    .cap-day-bar-container {
      grid-row: 3;
      grid-column: 1 / 3;
      width: 100%;
      margin: 0.25rem 0;
    }
    .cap-day-row .badge-cap {
      grid-row: 4;
      grid-column: 1 / 3;
      justify-self: start;
      margin-top: 0.25rem;
    }
  }
</style>

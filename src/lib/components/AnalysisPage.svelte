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
    productComparison,
    includeStudentPhotocardFee,
    cards,
    activeCardId,
    type MultiCardClassifiedJourney,
    combinedSimulation,
  } from "$lib/stores/stores";
  import { calculateFareTypeSavings } from "$lib/engine/savingsEngine";
  import { FARE_TYPES, type FareType, lookupDailyCap, lookupWeeklyCap } from "$lib/data/fareData";
  import { getZoneColor } from "$lib/data/stationService";
  import InsightsPage from "./InsightsPage.svelte";
  import CardSelector from "./CardSelector.svelte";
  import AddCardDialog from "./AddCardDialog.svelte";

  let activeTab = $state<"journeys" | "insights" | "savings" | "caps">(
    "insights",
  );
  let showAddDialog = $state(false);
  let sortKey = $state<string>("date");
  let sortAsc = $state(false);
  let filterMode = $state<string>("all");
  let includeCardCost = $state(false);
  let overrideCost = $state(false);
  let searchQuery = $state("");
  let customCostInput = $state("");

  // Multi-card simulation and journey view state
  let selectedSimCardId = $state<string>("");
  let journeyViewMode = $state<"table" | "timeline" | "split">("table");

  let activeSim = $derived(
    $combinedSimulation?.simulations[selectedSimCardId] ?? null
  );

  $effect(() => {
    if ($combinedSimulation) {
      if (!selectedSimCardId || !$combinedSimulation.simulations[selectedSimCardId]) {
        selectedSimCardId = $combinedSimulation.optimalCardId;
      }
    } else {
      selectedSimCardId = "";
    }
  });
  let isCardCostDisabled = $derived(
    ($selectedFareType === "railcard" && $detectedDiscount === "railcard") ||
      ($selectedFareType === "disabled" && $detectedDiscount === "disabled"),
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

  // Find top zone range for student travelcard savings comparison
  let topZone = $derived.by(() => {
    const j = $classifiedJourneys;
    if (j.length === 0) return 'Z1-2';

    const zoneCounts = new Map<string, number>();
    for (const jj of j) {
      if (jj.zoneRange) {
        zoneCounts.set(jj.zoneRange, (zoneCounts.get(jj.zoneRange) ?? 0) + 1);
      }
    }
    let top = 'Z1-2';
    let topCount = 0;
    for (const [z, c] of zoneCounts) {
      if (c > topCount) { top = z; topCount = c; }
    }
    return top;
  });

  let topZoneComparison = $derived(
    $productComparison.find(c => c.zoneRange === topZone)
  );

  let filteredJourneys = $derived.by(() => {
    let list = [...$classifiedJourneys] as MultiCardClassifiedJourney[];

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
      if (sortKey === "date") {
        cmp = a.raw.date.getTime() - b.raw.date.getTime();
        if (cmp === 0) cmp = (a.raw.startTime || '').localeCompare(b.raw.startTime || '');
      }
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

  let activeZoneRanges = $derived.by(() => {
    const ranges = new Set<string>();
    for (const j of $classifiedJourneys) {
      if (j.zoneRange && j.zoneRange !== '—') {
        ranges.add(j.zoneRange);
      }
    }
    if (ranges.size === 0) ranges.add('Z1-2');
    return Array.from(ranges).sort();
  });

  interface TimelineDayGroup {
    dateStr: string;
    dateObj: Date;
    journeys: MultiCardClassifiedJourney[];
    cardsActive: Array<{
      id: string;
      name: string;
      color: string;
      discount: FareType;
      zones: string[];
      isCapPeakDay: boolean; // whether the first rail journey on this day counts as peak cap
    }>;
  }

  interface TimelineWeekGroup {
    weekStart: Date;
    weekStartStr: string;
    days: TimelineDayGroup[];
    actualSpend: number;
    simulatedSpend: number;
    savings: number;
    capLimit: number;
    maxZoneRange: string;
    isCapped: boolean;
    simCapHit: boolean;
  }

  // Group journeys by week, then day chronologically for the timeline layout
  let groupedTimelineWeeks = $derived.by(() => {
    // 1. Group journeys by date to form days
    const dayMap = new Map<string, { dateStr: string; dateObj: Date; journeys: MultiCardClassifiedJourney[] }>();
    
    for (const j of filteredJourneys) {
      const key = j.raw.dateStr;
      const existing = dayMap.get(key);
      if (existing) {
        existing.journeys.push(j);
      } else {
        dayMap.set(key, {
          dateStr: key,
          dateObj: new Date(j.raw.date),
          journeys: [j],
        });
      }
    }
    
    // Sort journeys within each day — LATEST time at top (reverse chronological)
    const days: TimelineDayGroup[] = Array.from(dayMap.values()).map(day => {
      day.journeys.sort((a, b) => {
        const timeA = a.raw.startTime || "";
        const timeB = b.raw.startTime || "";
        return timeB.localeCompare(timeA); // reversed: latest first
      });
      
      // Determine cards active on this day and their zones
      // Also determine whether today is a peak or off-peak cap day per card
      const cardsActiveMap = new Map<string, { id: string; name: string; color: string; discount: FareType; zones: Set<string>; isCapPeakDay: boolean | null }>();
      for (const j of day.journeys) {
        if (!j.cardId) continue;
        const zoneNorm = j.zoneRange === 'Z1' ? 'Z1-2' : j.zoneRange;
        const existing = cardsActiveMap.get(j.cardId);
        if (existing) {
          if (zoneNorm && zoneNorm !== '—') {
            existing.zones.add(zoneNorm);
          }
          // Track cap peak: first non-bus journey's isCapPeak decides the day's cap type
          if (!j.isBus && existing.isCapPeakDay === null) {
            existing.isCapPeakDay = j.isCapPeak;
          }
        } else {
          const card = $cards.find(c => c.id === j.cardId);
          const zones = new Set<string>();
          if (zoneNorm && zoneNorm !== '—') {
            zones.add(zoneNorm);
          }
          cardsActiveMap.set(j.cardId, {
            id: j.cardId,
            name: j.cardName || 'Card',
            color: j.cardColor || '#fff',
            discount: card?.detectedDiscount || 'none',
            zones,
            isCapPeakDay: !j.isBus ? j.isCapPeak : null,
          });
        }
      }
      
      return {
        dateStr: day.dateStr,
        dateObj: day.dateObj,
        journeys: day.journeys,
        cardsActive: Array.from(cardsActiveMap.values()).map(c => ({
          ...c,
          zones: Array.from(c.zones).sort(),
          isCapPeakDay: c.isCapPeakDay ?? false,
        })),
      };
    });
    
    // 2. Group days by week (Monday start)
    const weekMap = new Map<number, { weekStart: Date; days: TimelineDayGroup[] }>();
    
    const getMondayOfDate = (d: Date): Date => {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      return monday;
    };
    
    for (const d of days) {
      const mon = getMondayOfDate(d.dateObj);
      const key = mon.getTime();
      const existing = weekMap.get(key);
      if (existing) {
        existing.days.push(d);
      } else {
        weekMap.set(key, {
          weekStart: mon,
          days: [d],
        });
      }
    }
    
    // Convert to week groups and compute summaries
    const weeks: TimelineWeekGroup[] = Array.from(weekMap.values()).map(w => {
      w.days.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
      
      const keyTime = w.weekStart.getTime();
      
      const actualWeek = $weeklyCapResults?.find(wr => wr.weekStart.getTime() === keyTime);
      const actualSpend = actualWeek?.totalSpend ?? w.days.reduce((sum, d) => sum + d.journeys.reduce((js, j) => js + j.raw.charge, 0), 0);
      const isCapped = actualWeek?.capHit ?? false;
      const maxZoneRange = actualWeek?.maxZoneRange ?? 'Z1-2';
      const capLimit = actualWeek?.weeklyCap ?? lookupWeeklyCap(maxZoneRange, 'none');
      
      let simulatedSpend = actualSpend;
      let simCapHit = false;
      if ($combinedSimulation) {
        const optimalSim = $combinedSimulation.simulations[$combinedSimulation.optimalCardId];
        if (optimalSim) {
          const simWeek = optimalSim.simulatedWeeklyCaps.find(sw => sw.weekStart.getTime() === keyTime);
          if (simWeek) {
            simulatedSpend = simWeek.totalSpend;
            simCapHit = simWeek.capHit;
          }
        }
      }
      
      const savings = Math.max(0, Math.round((actualSpend - simulatedSpend) * 100) / 100);
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const weekStartStr = `Week of ${w.weekStart.getDate()} ${months[w.weekStart.getMonth()]}`;
      
      return {
        weekStart: w.weekStart,
        weekStartStr,
        days: w.days,
        actualSpend: Math.round(actualSpend * 100) / 100,
        simulatedSpend: Math.round(simulatedSpend * 100) / 100,
        savings,
        capLimit,
        maxZoneRange,
        isCapped,
        simCapHit,
      };
    });
    
    // Sort weeks descending or ascending depending on sortAsc
    weeks.sort((a, b) => {
      const cmp = a.weekStart.getTime() - b.weekStart.getTime();
      return sortAsc ? cmp : -cmp;
    });
    
    return weeks;
  });

  // Collapsed days state for the timeline view
  let collapsedDays = $state<Record<string, boolean>>({});

  function toggleDayCollapse(dateStr: string) {
    collapsedDays[dateStr] = !collapsedDays[dateStr];
  }

  function collapseAllDays() {
    for (const week of groupedTimelineWeeks) {
      for (const day of week.days) {
        collapsedDays[day.dateStr] = true;
      }
    }
  }

  function expandAllDays() {
    collapsedDays = {};
  }
</script>

<div class="analysis-page">
  <h1 class="page-title">Journey Analysis</h1>

  <CardSelector onAddData={() => (showAddDialog = true)} />

  <!-- Tab navigation -->
  <div class="tab-nav" style="margin-bottom: 1.5rem;">
    <button
      class="tab-btn"
      class:active={activeTab === "insights"}
      onclick={() => (activeTab = "insights")}
    >
      💡 Insights
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "journeys"}
      onclick={() => (activeTab = "journeys")}
    >
      🚆 Journeys
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

    <!-- View Switcher (only for combined multi-card mode) -->
    {#if $activeCardId === 'combined' && $cards.length > 1}
      <div class="view-switcher" style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem; background: rgba(255,255,255,0.02); padding: 0.25rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); width: fit-content;">
        <button
          class="switch-btn"
          class:active={journeyViewMode === 'table'}
          onclick={() => journeyViewMode = 'table'}
          style="padding: 0.45rem 0.9rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid transparent; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; font-weight: 600; background: {journeyViewMode === 'table' ? 'rgba(255, 255, 255, 0.08)' : 'transparent'}; color: {journeyViewMode === 'table' ? '#fff' : 'var(--color-text-secondary)'}; border-color: {journeyViewMode === 'table' ? 'rgba(255, 255, 255, 0.12)' : 'transparent'}; transition: all 0.2s;"
        >
          📋 Table View
        </button>
        <button
          class="switch-btn"
          class:active={journeyViewMode === 'timeline'}
          onclick={() => journeyViewMode = 'timeline'}
          style="padding: 0.45rem 0.9rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid transparent; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; font-weight: 600; background: {journeyViewMode === 'timeline' ? 'rgba(255, 255, 255, 0.08)' : 'transparent'}; color: {journeyViewMode === 'timeline' ? '#fff' : 'var(--color-text-secondary)'}; border-color: {journeyViewMode === 'timeline' ? 'rgba(255, 255, 255, 0.12)' : 'transparent'}; transition: all 0.2s;"
        >
          ⏱️ Timeline View
        </button>
        <button
          class="switch-btn"
          class:active={journeyViewMode === 'split'}
          onclick={() => journeyViewMode = 'split'}
          style="padding: 0.45rem 0.9rem; font-size: 0.8rem; border-radius: 6px; border: 1px solid transparent; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; font-weight: 600; background: {journeyViewMode === 'split' ? 'rgba(255, 255, 255, 0.08)' : 'transparent'}; color: {journeyViewMode === 'split' ? '#fff' : 'var(--color-text-secondary)'}; border-color: {journeyViewMode === 'split' ? 'rgba(255, 255, 255, 0.12)' : 'transparent'}; transition: all 0.2s;"
        >
          🥞 Split View
        </button>
      </div>
    {/if}

    {#if !($activeCardId === 'combined' && $cards.length > 1) || journeyViewMode === 'table'}
      <!-- Standard Journey table -->
      <div
        class="table-container glass-card"
        style="padding: 0; overflow: hidden;"
      >
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                {#if $activeCardId === 'combined' && $cards.length > 1}
                  <th>Card</th>
                {/if}
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
                  {#if $activeCardId === 'combined' && $cards.length > 1}
                    <td>
                      <div class="table-card-badge" style="--badge-color: {j.cardColor || 'rgba(255,255,255,0.1)'}">
                        <span class="badge-dot" style="background: {j.cardColor || 'rgba(255,255,255,0.5)'}"></span>
                        <span class="badge-text">{j.cardName || 'Card'}</span>
                      </div>
                    </td>
                  {/if}
                  <td class="date-cell"><span class="day-of-week" style="opacity: 0.8; font-weight: 600; margin-right: 0.25rem;">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][j.dayOfWeek]}</span>{j.raw.dateStr}</td>
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
    {:else if journeyViewMode === 'timeline'}
      <!-- Multi-Card Optimization & Caps Info Box -->
      {#if $activeCardId === 'combined' && $cards.length > 1 && $combinedSimulation}
        {@const optimalSim = $combinedSimulation.simulations[$combinedSimulation.optimalCardId]}
        
        <div class="glass-card timeline-summary-widget animate-fade-in" style="padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); display: flex; flex-direction: column; gap: 1rem; position: relative; overflow: hidden; margin-bottom: 1.25rem;">
          <!-- Subtle glow accent of the optimal card -->
          <div style="position: absolute; right: 0; top: 0; width: 200px; height: 200px; background: radial-gradient(circle, {($cards.find(c => c.id === $combinedSimulation.optimalCardId)?.color || 'rgba(0,159,227,0.4)')}10 0%, transparent 70%); pointer-events: none;"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 800; color: #fff; margin: 0 0 0.25rem 0; display: flex; align-items: center; gap: 0.4rem;">
                🔮 Combined Capping & Savings Summary
              </h3>
              <p style="font-size: 0.8rem; color: var(--color-text-secondary); margin: 0;">
                Review each card's caps, simulated one-card performance, and consolidation recommendations.
              </p>
            </div>
            {#if optimalSim && optimalSim.netDifference > 0}
              <div class="badge-saving" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25); color: #34d399; font-weight: 700; padding: 0.3rem 0.65rem; border-radius: 8px; font-size: 0.8rem;">
                🎉 Potential Saving: £{optimalSim.netDifference.toFixed(2)}
              </div>
            {/if}
          </div>

          <!-- Cards Caps & Spend Comparison Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.85rem; width: 100%;">
            {#each $cards as card}
              {@const sim = $combinedSimulation.simulations[card.id]}
              {@const discount = card.detectedDiscount || 'none'}
              {@const discountName = FARE_TYPES[discount].name}
              
              <!-- Relevant zone ranges that the card actually travelled in -->
              {@const cardZones = Array.from(new Set(card.classifiedJourneys.map(j => j.zoneRange === 'Z1' ? 'Z1-2' : j.zoneRange).filter((z): z is string => typeof z === 'string' && z !== '—'))).sort()}
              
              <div class="glass-card" style="border: 1px solid {card.color}25; background: rgba(0,0,0,0.15); padding: 0.85rem; border-radius: 10px; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.4rem;">
                  <span style="font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 0.35rem; color: #fff;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background: {card.color}"></span>
                    {card.name}
                  </span>
                  <span style="font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.35rem; border-radius: 4px; background: rgba(255,255,255,0.06); color: var(--color-text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {discountName}
                  </span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.75rem;">
                  <div>
                    <span style="color: var(--color-text-muted); display: block;">Actual spend:</span>
                    <strong style="color: #fff;">£{(card.weeklyCapResults.reduce((sum, w) => sum + w.totalSpend, 0)).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style="color: var(--color-text-muted); display: block;">Caps hit:</span>
                    <strong style="color: #fff;">
                      {card.capSummary?.daysCapHit ?? 0}d / {card.capSummary?.weeksCapHit ?? 0}w
                    </strong>
                  </div>
                </div>

                <!-- Show specific fare caps rules for this card's discount type and active zone ranges -->
                <div style="margin-top: 0.25rem; padding-top: 0.4rem; border-top: 1px dashed rgba(255,255,255,0.05); font-size: 0.7rem; color: var(--color-text-secondary); display: flex; flex-direction: column; gap: 0.35rem;">
                  <div style="font-weight: 600; color: var(--color-text-muted); font-size: 0.65rem; text-transform: uppercase; margin-bottom: 0.1rem;">Fare Cap Rates:</div>
                  {#if cardZones.length > 0}
                    {#each cardZones as zone}
                      {@const dailyPeak = lookupDailyCap(zone, true, discount)}
                      {@const dailyOffPeak = lookupDailyCap(zone, false, discount)}
                      {@const weeklyVal = lookupWeeklyCap(zone, discount)}
                      <div style="background: rgba(255,255,255,0.02); padding: 0.3rem 0.4rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); display: flex; flex-direction: column; gap: 0.1rem;">
                        <div style="font-weight: 700; color: #fff; font-size: 0.725rem;">🚇 {zone}</div>
                        <div style="display: flex; justify-content: space-between;">
                          <span>Daily (Peak/Off-Peak):</span>
                          <strong>£{dailyPeak.toFixed(2)} / £{dailyOffPeak.toFixed(2)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                          <span>Weekly:</span>
                          <strong>£{weeklyVal.toFixed(2)}</strong>
                        </div>
                      </div>
                    {/each}
                  {:else}
                    <div style="font-style: italic; color: var(--color-text-muted);">No zones travelled in</div>
                  {/if}
                </div>

                {#if sim && sim.netDifference > 0}
                  <div style="margin-top: 0.4rem; padding: 0.35rem 0.5rem; background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 6px; font-size: 0.725rem; color: #34d399; display: flex; justify-content: space-between; align-items: center;">
                    <span>Simulated One-Card Spend:</span>
                    <strong>£{sim.simulatedTotalSpend.toFixed(2)} (-£{sim.netDifference.toFixed(2)})</strong>
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          <!-- Consolidation savings box -->
          {#if optimalSim && optimalSim.netDifference > 0}
            <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 0.75rem 1rem; border-left: 4px solid #10b981; font-size: 0.8rem; line-height: 1.45; color: var(--color-text-primary);">
              <strong>💡 Consolidation Opportunity:</strong> Had you consolidated all journeys onto a single card — specifically the <strong>{optimalSim.cardName}</strong> (which features the <strong>{optimalSim.discountName}</strong> discount, which has the lowest daily and weekly capping thresholds), you would have spent a total of <strong style="color: #34d399;">£{optimalSim.simulatedTotalSpend.toFixed(2)}</strong> instead of £{$combinedSimulation.actualTotalSpend.toFixed(2)}, saving a whopping <strong>£{optimalSim.netDifference.toFixed(2)}</strong>!
              {#if optimalSim.consolidationBenefit > 0 || optimalSim.discountUpgradeBenefit > 0}
                <div style="margin-top: 0.4rem; font-size: 0.75rem; color: var(--color-text-secondary); display: flex; gap: 1rem; flex-wrap: wrap;">
                  {#if optimalSim.consolidationBenefit > 0}
                    <span>• <strong>Capping Consolidation:</strong> £{optimalSim.consolidationBenefit.toFixed(2)} saved by pooling journeys under one cap.</span>
                  {/if}
                  {#if optimalSim.discountUpgradeBenefit > 0}
                    <span>• <strong>Discount Upgrades:</strong> £{optimalSim.discountUpgradeBenefit.toFixed(2)} saved by applying the card's concession rates to all journeys.</span>
                  {/if}
                </div>
              {/if}
            </div>
          {:else}
            <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 0.75rem 1rem; border-left: 4px solid #10b981; font-size: 0.8rem; color: var(--color-text-primary);">
              <strong>✓ Fully Optimized:</strong> Your journeys are already distributed across your cards in a way that minimizes total spend. No consolidation savings are available!
            </div>
          {/if}
        </div>
      {/if}

      <!-- Chronological Interleaved Timeline View -->
      <div class="timeline-container animate-fade-in" style="display: flex; flex-direction: column; gap: 1.5rem; margin-top: 0.5rem;">
        {#if groupedTimelineWeeks.length === 0}
          <div class="glass-card" style="padding: 3rem 1.5rem; text-align: center; color: var(--color-text-muted);">
            No journeys matching search/filters.
          </div>
        {:else}
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-bottom: -0.5rem;">
            <button
              class="cost-btn"
              style="padding: 0.25rem 0.6rem; font-size: 0.725rem; border-radius: 4px; background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06); color: var(--color-text-secondary); cursor: pointer;"
              onclick={expandAllDays}
            >
              Expand All Days
            </button>
            <button
              class="cost-btn"
              style="padding: 0.25rem 0.6rem; font-size: 0.725rem; border-radius: 4px; background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06); color: var(--color-text-secondary); cursor: pointer;"
              onclick={collapseAllDays}
            >
              Collapse All Days
            </button>
          </div>
          
          {#each groupedTimelineWeeks as week}
            <div class="timeline-week-block" style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; position: relative;">
              <!-- Subtle card background glow if weekly cap is hit -->
              {#if week.isCapped}
                <div style="position: absolute; inset: 0; background: radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.03), transparent 60%); pointer-events: none; border-radius: 12px;"></div>
              {/if}

              <!-- Week Header -->
              <div class="timeline-week-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.6rem; margin-bottom: 1rem; position: relative; z-index: 1;">
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 0.4rem;">
                  🗓️ {week.weekStartStr}
                </h4>
                <div style="font-size: 0.8rem; color: var(--color-text-secondary); text-align: right; display: flex; align-items: center; gap: 0.5rem;">
                  <span>Weekly Spend: <strong style="color: #fff;">£{week.actualSpend.toFixed(2)}</strong></span>
                  {#if week.isCapped}
                    <span class="badge-dot" style="background: var(--color-success);" title="Weekly Cap Reached"></span>
                    <span style="color: #34d399; font-weight: 700; font-size: 0.725rem;">CAPPED</span>
                  {/if}
                </div>
              </div>

              <!-- Days within Week -->
              <div style="display: flex; flex-direction: column; gap: 1rem; position: relative; z-index: 1;">
                {#each week.days as group}
                  {@const isCollapsed = !!collapsedDays[group.dateStr]}
                  <div class="timeline-group" style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <button
                      type="button"
                      class="timeline-date-divider"
                      style="display: flex; align-items: center; gap: 1rem; cursor: pointer; user-select: none; width: 100%; border: none; background: none; font-family: inherit; font-size: inherit; color: inherit; padding: 0;"
                      onclick={() => toggleDayCollapse(group.dateStr)}
                    >
                      <span
                        class="timeline-date-header"
                        style="font-size: 0.8rem; font-weight: 800; color: #fff; background: rgba(255,255,255,0.06); padding: 0.2rem 0.55rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.04); display: inline-flex; align-items: center; gap: 0.35rem; transition: background 0.2s;"
                      >
                        <span class="chevron" style="display: inline-block; font-size: 0.65rem; transition: transform 0.2s; transform: {isCollapsed ? 'rotate(-90deg)' : 'none'};">▼</span>
                        {group.dateStr}
                        {#if isCollapsed}
                          <span style="font-size: 0.7rem; font-weight: 500; opacity: 0.6; margin-left: 0.35rem;">({group.journeys.length} {group.journeys.length === 1 ? 'journey' : 'journeys'})</span>
                        {/if}
                      </span>
                      <span style="flex: 1; height: 1px; background: rgba(255,255,255,0.06);"></span>
                    </button>

                    {#if !isCollapsed}
                      <!-- Card day summary showing relevant daily zones and caps for that day -->
                      <div style="display: flex; flex-direction: column; gap: 0.3rem; margin-left: 1.5rem; margin-bottom: 0.25rem;">
                        {#each group.cardsActive as cardInfo}
                      <div class="card-day-summary" style="display: flex; align-items: flex-start; gap: 0.35rem; font-size: 0.725rem; color: var(--color-text-secondary); flex-wrap: wrap;">
                            <span class="badge-dot" style="background: {cardInfo.color}; width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-top: 0.35rem;"></span>
                            <strong style="color: #fff; margin-top: 0.15rem;">{cardInfo.name}:</strong>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                            {#each cardInfo.zones as zone}
                              {@const peakCap = lookupDailyCap(zone, true, cardInfo.discount)}
                              {@const offPeakCap = lookupDailyCap(zone, false, cardInfo.discount)}
                              {@const isPeakActive = cardInfo.isCapPeakDay}
                              <span style="background: rgba(255,255,255,0.03); padding: 0.15rem 0.4rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.04); font-size: 0.7rem; display: flex; gap: 0.3rem; align-items: center;">
                                <span style="color: {zone.includes('-') && parseInt(zone.replace('Z','').split('-')[1]) > 2 ? '#a78bfa' : 'var(--color-oyster-blue)'};">🚇 {zone}</span>
                                <span style="padding: 0.05rem 0.3rem; border-radius: 3px; font-size: 0.65rem; font-weight: 700; {isPeakActive ? 'background: rgba(245,158,11,0.18); color: #fbbf24; border: 1px solid rgba(245,158,11,0.35);' : 'background: rgba(255,255,255,0.04); color: var(--color-text-muted); border: 1px solid rgba(255,255,255,0.06);'}" title="{isPeakActive ? 'Peak cap active' : 'Not active'}">Peak £{peakCap.toFixed(2)}</span>
                                <span style="padding: 0.05rem 0.3rem; border-radius: 3px; font-size: 0.65rem; font-weight: 700; {!isPeakActive ? 'background: rgba(16,185,129,0.18); color: #34d399; border: 1px solid rgba(16,185,129,0.35);' : 'background: rgba(255,255,255,0.04); color: var(--color-text-muted); border: 1px solid rgba(255,255,255,0.06);'}" title="{!isPeakActive ? 'Off-peak cap active' : 'Not active'}">Off-Pk £{offPeakCap.toFixed(2)}</span>
                              </span>
                            {/each}
                            </div>
                          </div>
                        {/each}
                      </div>

                      <div class="timeline-nodes" style="display: flex; flex-direction: column; gap: 0.4rem; position: relative;">
                        <!-- Vertical connection line -->
                        <div style="position: absolute; left: 11px; top: 10px; bottom: 10px; width: 1px; background: rgba(255,255,255,0.06); pointer-events: none;"></div>

                        {#each group.journeys as j}
                          <div
                            class="timeline-node flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4"
                            style="position: relative; padding: 0.5rem 0.75rem 0.5rem 2rem; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.02); border-left: 3px solid {j.cardColor || 'var(--color-oyster-blue)'}; border-radius: 4px;"
                          >
                            <!-- Colored dot on the line -->
                            <div style="position: absolute; left: 7px; top: 50%; transform: translateY(-50%); width: 9px; height: 9px; border-radius: 50%; background: {j.cardColor || 'var(--color-oyster-blue)'}; border: 2px solid var(--color-bg); box-shadow: 0 0 0 1px rgba(255,255,255,0.05);"></div>
                            
                            <!-- Time & Mode badge -->
                            <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 120px; flex-shrink: 0;">
                              <span style="font-size: 0.8rem; font-weight: 700; color: #fff; font-family: monospace; opacity: 0.95;">{j.raw.startTime || "—"}</span>
                              <span class="badge {getModeBadgeClass(j.mode)}" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">{getModeLabel(j.mode)}</span>
                            </div>

                            <!-- Journey Details -->
                            <div style="flex: 1; font-size: 0.8rem; color: var(--color-text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" class="w-full md:w-auto">
                              {#if j.isBus}
                                <span style="color: var(--color-text-secondary); font-weight: 500;">{j.raw.journeyAction}</span>
                              {:else if j.origin && j.destination}
                                <span style="font-weight: 600; color: #fff;">{j.origin.replace(/\s*\[.*?\]/g, "")}</span>
                                <span style="color: var(--color-text-muted); margin: 0 0.2rem;">→</span>
                                <span style="font-weight: 600; color: #fff;">{j.destination.replace(/\s*\[.*?\]/g, "")}</span>
                                {#if j.zoneRange}
                                  <span style="font-size: 0.7rem; color: {getZoneColor(j.zoneRange)}; font-weight: 700; margin-left: 0.3rem;">({j.zoneRange})</span>
                                {/if}
                              {:else}
                                <span style="color: var(--color-text-secondary);">{j.raw.journeyAction}</span>
                              {/if}
                            </div>

                            <!-- Card badge & Cost info -->
                            <div style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;" class="w-full justify-between md:w-auto md:justify-start">
                              <div class="table-card-badge" style="--badge-color: {j.cardColor || 'rgba(255,255,255,0.1)'}; margin: 0; padding: 0.1rem 0.4rem; font-size: 0.65rem;">
                                <span class="badge-dot" style="background: {j.cardColor || 'rgba(255,255,255,0.5)'}"></span>
                                <span class="badge-text">{j.cardName || 'Card'}</span>
                              </div>
                              
                              <div style="text-align: right; min-width: 60px;">
                                <span style="font-size: 0.8rem; font-weight: 700; color: {j.raw.charge === 0 && j.isCapHit ? '#34d399' : '#fff'};">
                                  {#if j.raw.charge === 0 && j.isCapHit}
                                    FREE
                                  {:else}
                                    £{j.raw.charge.toFixed(2)}
                                  {/if}
                                </span>
                                {#if j.isCapHit}
                                  <div style="font-size: 0.55rem; color: #10b981; font-weight: 700; text-transform: uppercase; line-height: 1;">Cap Hit</div>
                                {:else if j.isHopperFree}
                                  <div style="font-size: 0.55rem; color: #009FE3; font-weight: 700; text-transform: uppercase; line-height: 1;">Hopper</div>
                                {/if}
                              </div>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>

              <!-- Weekly Cap Summary Footer -->
              <div class="timeline-weekly-summary-footer" style="margin-top: 1.25rem; padding-top: 0.85rem; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; font-size: 0.775rem; position: relative; z-index: 1;">
                <div style="color: var(--color-text-secondary);">
                  📊 <strong>{week.maxZoneRange} Weekly Cap Limit:</strong> £{week.capLimit.toFixed(2)}
                </div>
                <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                  <div>
                    <span style="color: var(--color-text-muted);">Weekly spend:</span>
                    <strong style="color: #fff; margin-left: 0.25rem;">£{week.actualSpend.toFixed(2)}</strong>
                  </div>
                  {#if week.savings > 0}
                    <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); padding: 0.15rem 0.45rem; border-radius: 4px; color: #34d399; font-weight: 600;">
                      Simulated saving: <strong>-£{week.savings.toFixed(2)}</strong>
                    </div>
                  {/if}
                </div>
              </div>

            </div>
          {/each}
        {/if}
      </div>
    {:else if journeyViewMode === 'split'}
      <!-- Per-Card Split panels layout -->
      <div class="split-columns-container animate-fade-in" style="display: flex; gap: 1rem; flex-wrap: wrap; width: 100%; margin-top: 0.5rem;">
        {#each $cards as card}
          {@const cardJourneys = filteredJourneys.filter(j => j.cardId === card.id)}
          <div class="glass-card split-column" style="flex: 1 1 350px; min-width: 320px; padding: 1.25rem 1rem; border-color: {card.color}20; background: rgba(255,255,255,0.01); position: relative; border-radius: 12px; display: flex; flex-direction: column; gap: 0.75rem;">
            <!-- Column glow -->
            <div style="position: absolute; inset: 0; background: radial-gradient(circle at 100% 0%, {card.color}05, transparent 60%); pointer-events: none; border-radius: 12px;"></div>
            
            <!-- Column Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.5rem; position: relative; z-index: 1;">
              <div>
                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; display: flex; align-items: center; gap: 0.4rem; color: #fff;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: {card.color}"></span>
                  {card.name}
                </h4>
                <span style="font-size: 0.75rem; color: var(--color-text-secondary);">{card.detectedDiscount ? FARE_TYPES[card.detectedDiscount].name : 'Adult PAYG'}</span>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.95rem; font-weight: 800; color: #fff;">£{cardJourneys.reduce((sum, j) => sum + j.raw.charge, 0).toFixed(2)}</div>
                <span style="font-size: 0.7rem; color: var(--color-text-muted);">{cardJourneys.length} journeys</span>
              </div>
            </div>

            <!-- Scrollable Table -->
            <div style="overflow-x: auto; overflow-y: auto; max-height: 450px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); background: rgba(0,0,0,0.15); position: relative; z-index: 1;">
              <table class="data-table" style="font-size: 0.75rem; width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: rgba(255,255,255,0.02);">
                    <th style="padding: 0.5rem; text-align: left; color: var(--color-text-secondary); font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.04);">Date/Time</th>
                    <th style="padding: 0.5rem; text-align: left; color: var(--color-text-secondary); font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.04);">Journey</th>
                    <th style="padding: 0.5rem; text-align: right; color: var(--color-text-secondary); font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.04);">Charge</th>
                  </tr>
                </thead>
                <tbody>
                  {#if cardJourneys.length === 0}
                    <tr>
                      <td colspan="3" style="text-align: center; color: var(--color-text-muted); padding: 3rem 1rem;">No journeys matching filters</td>
                    </tr>
                  {:else}
                    {#each cardJourneys as j}
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                        <td style="padding: 0.5rem; white-space: nowrap; vertical-align: middle;">
                          <div style="font-weight: 600; color: #fff;">{j.raw.dateStr}</div>
                          <div style="font-size: 0.65rem; color: var(--color-text-secondary);">{j.raw.startTime || '—'}</div>
                        </td>
                        <td style="padding: 0.5rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="{j.isBus ? j.raw.journeyAction : (j.origin && j.destination ? `${j.origin} → ${j.destination}` : j.raw.journeyAction)}">
                          {#if j.isBus}
                            <span style="color: var(--color-text-secondary);">{j.raw.journeyAction}</span>
                          {:else if j.origin && j.destination}
                            <span style="color: #fff;">{j.origin.replace(/\s*\[.*?\]/g, "")} → {j.destination.replace(/\s*\[.*?\]/g, "")}</span>
                          {:else}
                            <span style="color: var(--color-text-secondary);">{j.raw.journeyAction}</span>
                          {/if}
                        </td>
                        <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: {j.raw.charge === 0 && j.isCapHit ? '#34d399' : '#fff'}; vertical-align: middle;">
                          {#if j.raw.charge === 0 && j.isCapHit}
                            FREE
                          {:else}
                            £{j.raw.charge.toFixed(2)}
                          {/if}
                          {#if j.isCapHit}
                            <div style="font-size: 0.55rem; color: #10b981; font-weight: 700; text-transform: uppercase; line-height: 1;">Cap</div>
                          {:else if j.isHopperFree}
                            <div style="font-size: 0.55rem; color: #009FE3; font-weight: 700; text-transform: uppercase; line-height: 1;">Hopper</div>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else if activeTab === "insights"}
    <InsightsPage />
  {:else if activeTab === "savings"}
    <!-- Fare Type Savings Panel -->
    <div class="savings-layout grid grid-cols-1 md:grid-cols-[280px_1fr]">
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
                    if (valStr.includes("-")) {
                      valStr = valStr.replace(/-/g, "");
                      target.value = valStr;
                    }
                    let val = parseFloat(valStr);
                    if (!isNaN(val)) {
                      if (val > 99) {
                        val = 99;
                        valStr = "99";
                        target.value = "99";
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
                    } else if (val > 99) {
                      val = 99;
                    }
                    $fareTypeCost = val;
                    customCostInput = val.toString();
                    target.value = val.toString();
                  }}
                  min="0"
                  max="99"
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

            {#if $selectedFareType === "student" && topZoneComparison}
              {@const weeklySaving = topZoneComparison.weeklyPayg - topZoneComparison.weeklyStudentTravelcard}
              {@const monthlySaving = topZoneComparison.monthlyPayg - topZoneComparison.monthlyStudentTravelcard}
              {@const annualSaving = topZoneComparison.annualPayg - topZoneComparison.annualStudentTravelcard}
              <div
                class="glass-card savings-hero positive"
                style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.05); margin-bottom: 1.5rem; text-align: left; align-items: flex-start; padding: 1.5rem;"
              >
                <div
                  class="savings-hero-label"
                  style="color: #34d399; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;"
                >
                  🎓 Apprentice / 18+ Student Travelcard Savings
                </div>
                <div
                  class="savings-hero-sub"
                  style="color: var(--color-text-secondary); margin-bottom: 1.25rem; font-size: 0.875rem; text-align: left; line-height: 1.5;"
                >
                  While Apprentice/Student Oyster photocards do not discount standard Pay As You Go single fares, you can save 30% on Travelcards! Based on your travel history, here is how much you would save buying Student Travelcards for your most common zone range (<strong>{topZone}</strong>) compared to standard adult PAYG:
                </div>
                
                <div class="savings-cards" style="width: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 0.5rem;">
                  <div class="stat-card" style="padding: 1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted);">Weekly Comparison</div>
                    <div style="font-size: 1.1rem; font-weight: bold; color: #fff;">
                      Adult PAYG: £{topZoneComparison.weeklyPayg.toFixed(2)}
                    </div>
                    <div style="font-size: 1.1rem; font-weight: bold; color: #34d399;">
                      Student TC: £{topZoneComparison.weeklyStudentTravelcard.toFixed(2)}
                    </div>
                    <div style="font-size: 0.85rem; font-weight: 600; color: {weeklySaving > 0 ? '#34d399' : '#ef4444'}; margin-top: 0.25rem;">
                      {weeklySaving > 0 ? `Savings: +£${weeklySaving.toFixed(2)}` : `Cost: £${Math.abs(weeklySaving).toFixed(2)} extra`}
                    </div>
                  </div>

                  <div class="stat-card" style="padding: 1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted);">Monthly Comparison</div>
                    <div style="font-size: 1.1rem; font-weight: bold; color: #fff;">
                      Adult PAYG: £{topZoneComparison.monthlyPayg.toFixed(2)}
                    </div>
                    <div style="font-size: 1.1rem; font-weight: bold; color: #34d399;">
                      Student TC: £{topZoneComparison.monthlyStudentTravelcard.toFixed(2)}
                    </div>
                    <div style="font-size: 0.85rem; font-weight: 600; color: {monthlySaving > 0 ? '#34d399' : '#ef4444'}; margin-top: 0.25rem;">
                      {monthlySaving > 0 ? `Savings: +£${monthlySaving.toFixed(2)}` : `Cost: £${Math.abs(monthlySaving).toFixed(2)} extra`}
                    </div>
                  </div>

                  <div class="stat-card" style="padding: 1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted);">Annual Comparison</div>
                    <div style="font-size: 1.1rem; font-weight: bold; color: #fff;">
                      Adult PAYG: £{topZoneComparison.annualPayg.toFixed(2)}
                    </div>
                    <div style="font-size: 1.1rem; font-weight: bold; color: #34d399;">
                      Student TC: £{topZoneComparison.annualStudentTravelcard.toFixed(2)}
                    </div>
                    <div style="font-size: 0.85rem; font-weight: 600; color: {annualSaving > 0 ? '#34d399' : '#ef4444'}; margin-top: 0.25rem;">
                      {annualSaving > 0 ? `Savings: +£${annualSaving.toFixed(2)}` : `Cost: £${Math.abs(annualSaving).toFixed(2)} extra`}
                    </div>
                  </div>
                </div>
              </div>
            {/if}

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
            <div class="savings-cards grid grid-cols-2 md:grid-cols-4">
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
      {#if $activeCardId === 'combined' && $cards.length > 1 && $combinedSimulation && activeSim}
        {@const optimalSim = $combinedSimulation.simulations[$combinedSimulation.optimalCardId]}
        <div class="glass-card consolidation-simulation-card animate-fade-in">
          <div class="consolidation-glow"></div>
          
          <div style="position: relative; z-index: 1;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
              <div>
                <h3 style="font-size: 1.15rem; font-weight: 800; margin: 0 0 0.25rem 0; display: flex; align-items: center; gap: 0.5rem; color: #fff;">
                  ✨ Single-Card Consolidation Simulation
                </h3>
                <p style="font-size: 0.825rem; color: var(--color-text-secondary); margin: 0;">
                  Simulate consolidating all journeys onto a single physical card to identify optimal strategies and capping benefits.
                </p>
              </div>
              {#if activeSim.netDifference > 0}
                <div class="badge-saving">
                  🎉 Potential Saving: £{activeSim.netDifference.toFixed(2)}
                </div>
              {:else}
                <div class="badge-saving neutral">
                  🔄 Fully Optimized
                </div>
              {/if}
            </div>

            <!-- Selector Controls for Simulation Target Card -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem; flex-wrap: wrap; align-items: center;">
              <span style="font-size: 0.8rem; color: var(--color-text-muted); margin-right: 0.5rem;">Simulate using card:</span>
              {#each Object.values($combinedSimulation.simulations) as sim}
                {@const simCard = $cards.find(c => c.id === sim.cardId)}
                <button
                  class="cost-btn"
                  class:active={selectedSimCardId === sim.cardId}
                  onclick={() => selectedSimCardId = sim.cardId}
                  style="padding: 0.35rem 0.75rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem; border-radius: 20px; background: {selectedSimCardId === sim.cardId ? (simCard?.color ? `${simCard.color}25` : 'rgba(255,255,255,0.1)') : 'transparent'}; border-color: {selectedSimCardId === sim.cardId ? (simCard?.color || 'var(--color-border-accent)') : 'rgba(255,255,255,0.1)'}; color: #fff;"
                >
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: {simCard?.color || '#fff'}"></span>
                  <strong>{sim.cardName}</strong> <span style="opacity: 0.7; font-size: 0.75rem;">({sim.discountName})</span>
                </button>
              {/each}
            </div>

            <!-- Optimal Strategy Banner -->
            {#if selectedSimCardId === $combinedSimulation.optimalCardId}
              {#if activeSim.netDifference > 0}
                <div class="glass-card" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem; display: flex; align-items: flex-start; gap: 0.75rem; border-left: 4px solid #10b981;">
                  <span style="font-size: 1.25rem; line-height: 1;">💡</span>
                  <div>
                    <strong style="color: #34d399; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.25rem;">Optimal Strategy</strong>
                    <p style="margin: 0; font-size: 0.825rem; color: var(--color-text-secondary); line-height: 1.45;">
                      Consolidating all travel onto a single card with <strong>{activeSim.cardName} ({activeSim.discountName})</strong> is your best choice, saving you <strong>£{activeSim.netDifference.toFixed(2)}</strong>!
                    </p>
                  </div>
                </div>
              {/if}
            {:else if optimalSim && optimalSim.netDifference > 0}
              <button
                type="button"
                class="glass-card"
                style="background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem; display: flex; align-items: flex-start; gap: 0.75rem; border-left: 4px solid #fbbf24; cursor: pointer; text-align: left; font-family: inherit; font-size: inherit; color: inherit; width: 100%; outline: none;"
                onclick={() => { selectedSimCardId = $combinedSimulation.optimalCardId; }}
              >
                <span style="font-size: 1.25rem; line-height: 1;">⚠️</span>
                <span style="display: block; text-align: left;">
                  <strong style="color: #fbbf24; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 0.25rem;">Sub-optimal Strategy</strong>
                  <span style="display: block; margin: 0; font-size: 0.825rem; color: var(--color-text-secondary); line-height: 1.45;">
                    Consolidating on <strong>{optimalSim.cardName} ({optimalSim.discountName})</strong> would be more optimal, saving you <strong>£{optimalSim.netDifference.toFixed(2)}</strong> (compared to £{activeSim.netDifference.toFixed(2)} with this card). <u>Click here to switch to optimal.</u>
                  </span>
                </span>
              </button>
            {/if}

            <!-- Breakdown comparison grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
              <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; padding: 1rem;">
                <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 600; letter-spacing: 0.05em;">Actual Combined Spend</div>
                <div style="font-size: 1.6rem; font-weight: 900; color: #fff; margin-top: 0.25rem;">£{$combinedSimulation.actualTotalSpend.toFixed(2)}</div>
                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">Split across {$cards.length} separate cards</div>
              </div>

              <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; padding: 1rem; border-color: rgba(52, 211, 153, 0.15);">
                <div style="font-size: 0.72rem; text-transform: uppercase; color: #34d399; font-weight: 600; letter-spacing: 0.05em;">Simulated Consolidated Spend</div>
                <div style="font-size: 1.6rem; font-weight: 900; color: #34d399; margin-top: 0.25rem;">£{activeSim.simulatedTotalSpend.toFixed(2)}</div>
                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">One card ({activeSim.discountName})</div>
              </div>

              <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; padding: 1rem;">
                <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 600; letter-spacing: 0.05em;">Simulated Capping Hits</div>
                <div style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-top: 0.25rem;">
                  { activeSim.simulatedCapSummary.daysCapHit } Days <span style="font-size: 0.8rem; font-weight: 500; color: var(--color-text-muted);">/ { activeSim.simulatedCapSummary.weeksCapHit } Weeks</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">
                  vs { $capSummary?.daysCapHit ?? 0 } Days / { $capSummary?.weeksCapHit ?? 0 } Weeks actual
                </div>
              </div>
            </div>

            <!-- Savings components details -->
            {#if activeSim.netDifference > 0}
              <div style="background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.1); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; font-size: 0.825rem; line-height: 1.5; color: var(--color-text-secondary);">
                <div style="font-weight: 700; color: #fff; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                  🔍 Why would you save £{activeSim.netDifference.toFixed(2)}?
                </div>
                <ul style="margin: 0; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.25rem;">
                  {#if activeSim.consolidationBenefit > 0}
                    <li>
                      <strong>Capping Consolidation Benefit:</strong> Combining travel onto a single card pool saves you <strong>£{activeSim.consolidationBenefit.toFixed(2)}</strong> by hitting daily or weekly caps earlier instead of split spend.
                    </li>
                  {/if}
                  {#if activeSim.discountUpgradeBenefit > 0}
                    <li>
                      <strong>Discount Upgrade Benefit:</strong> Upgrading journeys on adult cards to the best available <strong>{activeSim.discountName}</strong> discount saves you <strong>£{activeSim.discountUpgradeBenefit.toFixed(2)}</strong> on single fares.
                    </li>
                  {/if}
                </ul>
              </div>
            {/if}

            <!-- Missed Caps Section -->
            {#if activeSim.missedDailyCaps.length > 0 || activeSim.missedWeeklyCaps.length > 0}
              <div style="margin-top: 1rem;">
                <button
                  class="cost-btn"
                  style="display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 0.75rem 1rem; background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06); border-radius: 8px; color: var(--color-text-primary); font-size: 0.85rem; font-weight: 600;"
                  onclick={() => {
                    const el = document.getElementById('missed-caps-details');
                    if (el) {
                      el.style.display = el.style.display === 'none' ? 'block' : 'none';
                    }
                  }}
                >
                  <span>📋 Show Missed Capping Opportunities ({activeSim.missedDailyCaps.length + activeSim.missedWeeklyCaps.length})</span>
                  <span>▼</span>
                </button>
                
                <div id="missed-caps-details" style="display: none; margin-top: 0.75rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); max-height: 250px; overflow-y: auto;">
                  {#if activeSim.missedWeeklyCaps.length > 0}
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700; margin: 0.5rem 0.5rem 0.25rem 0.5rem; letter-spacing: 0.05em;">Missed Weekly Caps</div>
                    {#each activeSim.missedWeeklyCaps as w}
                      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; padding: 0.4rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.02);">
                        <span style="color: var(--color-text-secondary);">
                          Week of {w.weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ({w.zoneRange})
                        </span>
                        <span style="font-weight: 600; color: #34d399;">
                          Spent £{w.actualSpend.toFixed(2)} (cap: £{w.capLimit.toFixed(2)}) → Saved £{w.saving.toFixed(2)}
                        </span>
                      </div>
                    {/each}
                  {/if}

                  {#if activeSim.missedDailyCaps.length > 0}
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-text-muted); font-weight: 700; margin: 0.75rem 0.5rem 0.25rem 0.5rem; letter-spacing: 0.05em;">Missed Daily Caps</div>
                    {#each activeSim.missedDailyCaps as d}
                      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; padding: 0.4rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.02);">
                        <span style="color: var(--color-text-secondary);">
                          {d.date} ({d.zoneRange})
                        </span>
                        <span style="font-weight: 600; color: #34d399;">
                          Spent £{d.actualSpend.toFixed(2)} (cap: £{d.capLimit.toFixed(2)}) → Saved £{d.saving.toFixed(2)}
                        </span>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if $activeCardId === 'combined' && $cards.length > 1}
        <div class="glass-card combined-caps-breakdown">
          <h4 class="breakdown-title">
            💳 Per-Card Cap Breakdown
          </h4>
          <div class="breakdown-grid">
            {#each $cards as card}
              <div class="breakdown-card" style="--card-theme: {card.color}">
                <div class="breakdown-card-glow" style="background: radial-gradient(circle at 100% 0%, {card.color}15, transparent 60%);"></div>
                <div class="breakdown-card-header">
                  <span class="breakdown-card-dot" style="background: {card.color}"></span>
                  <span class="breakdown-card-name">{card.name}</span>
                </div>
                <div class="breakdown-card-stats">
                  <div class="breakdown-stat">
                    <span class="stat-num">{card.capSummary?.daysCapHit ?? 0}</span>
                    <span class="stat-desc">Cap Days Hit</span>
                  </div>
                  <div class="breakdown-stat highlighted">
                    <span class="stat-num" style="color: {card.color}">£{(card.capSummary?.totalSavedByDailyCap ?? 0).toFixed(2)}</span>
                    <span class="stat-desc">Daily Cap Savings</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
      {#if $capSummary}
        <!-- Summary cards -->
        <div class="cap-summary-grid grid grid-cols-2 lg:grid-cols-5">
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
            <div class="cap-day-row flex md:flex-row max-md:grid max-md:grid-cols-2 max-md:gap-x-2 max-md:gap-y-1 max-md:p-3" class:cap-hit={day.capHit}>
              <div class="cap-day-date max-md:row-start-1 max-md:col-start-1 max-md:text-[0.85rem] max-md:!min-w-0">{day.date}</div>
              <div
                class="cap-day-zones max-md:row-start-2 max-md:col-start-1 max-md:text-[0.75rem] max-md:!min-w-0"
                style="font-size: 0.8rem; font-weight: 700; color: {getZoneColor(
                  day.maxZoneRange,
                )}; min-width: 60px;"
              >
                {day.maxZoneRange}
              </div>
              <div class="cap-day-bar-container max-md:row-start-3 max-md:col-span-2 max-md:w-full max-md:my-1">
                <div class="cap-progress">
                  <div
                    class="cap-progress-bar"
                    style="width: {day.capProgress *
                      100}%; background: {getCapColor(day.capProgress)};"
                  ></div>
                </div>
              </div>
              <div class="cap-day-values max-md:row-start-1 max-md:col-start-2 max-md:justify-end max-md:!min-w-0 max-md:text-[0.85rem]">
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
              <div class="cap-day-journeys max-md:row-start-2 max-md:col-start-2 max-md:!min-w-0 max-md:text-[0.75rem] max-md:text-right">{day.journeys.length} trips</div>
              {#if day.capHit}
                <span
                  class="badge badge-cap max-md:row-start-4 max-md:col-span-2 max-md:justify-self-start max-md:mt-1"
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
            <div class="cap-day-row flex md:flex-row max-md:grid max-md:grid-cols-2 max-md:gap-x-2 max-md:gap-y-1 max-md:p-3" class:cap-hit={week.capHit}>
              <div class="cap-day-date max-md:row-start-1 max-md:col-start-1 max-md:text-[0.85rem] max-md:!min-w-0" style="min-width: 160px;">
                {week.weekStart.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })} –
                {week.weekEnd.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </div>
              <div class="cap-day-bar-container max-md:row-start-3 max-md:col-span-2 max-md:w-full max-md:my-1">
                <div class="cap-progress">
                  <div
                    class="cap-progress-bar"
                    style="width: {week.capProgress *
                      100}%; background: {getCapColor(week.capProgress)};"
                  ></div>
                </div>
              </div>
              <div class="cap-day-values max-md:row-start-1 max-md:col-start-2 max-md:justify-end max-md:!min-w-0 max-md:text-[0.85rem]">
                <span class="cap-day-spend">£{week.totalSpend.toFixed(2)}</span>
                <span class="cap-day-divider">/</span>
                <span class="cap-day-cap">£{week.weeklyCap.toFixed(2)}</span>
              </div>
              <div class="cap-day-journeys max-md:row-start-2 max-md:col-start-2 max-md:!min-w-0 max-md:text-[0.75rem] max-md:text-right">{week.days.length} days</div>
              {#if week.capHit}
                <span class="badge badge-cap max-md:row-start-4 max-md:col-span-2 max-md:justify-self-start max-md:mt-1">Cap Hit</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <AddCardDialog bind:open={showAddDialog} />
</div>

<style>
  .analysis-page {
    max-width: 1100px;
    margin: 0 auto;
  }

  /* Table Card Badge */
  .table-card-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .table-card-badge:hover {
    border-color: var(--badge-color);
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-primary);
  }

  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .badge-text {
    opacity: 0.95;
    letter-spacing: -0.01em;
  }

  /* Consolidation Simulation Card */
  .consolidation-simulation-card {
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    position: relative;
    overflow: hidden;
    border-color: rgba(52, 211, 153, 0.2);
  }

  .consolidation-glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle at 0% 0%, rgba(16, 185, 129, 0.05), transparent 70%);
    z-index: 0;
  }

  .badge-saving {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
    font-weight: 700;
    font-size: 0.85rem;
    padding: 0.35rem 0.75rem;
    border-radius: 20px;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .badge-saving.neutral {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--color-text-secondary);
  }

  /* Per-card cap breakdown in combined view */
  .combined-caps-breakdown {
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.5rem;
    position: relative;
    overflow: hidden;
  }

  .breakdown-title {
    margin: 0 0 1rem 0;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .breakdown-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .breakdown-card {
    position: relative;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 1rem;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .breakdown-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--card-theme);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  .breakdown-card-glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .breakdown-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    position: relative;
    z-index: 1;
  }

  .breakdown-card-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 8px var(--card-theme);
  }

  .breakdown-card-name {
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--color-text-primary);
  }

  .breakdown-card-stats {
    display: flex;
    gap: 1.25rem;
    position: relative;
    z-index: 1;
  }

  .breakdown-stat {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .breakdown-stat .stat-num {
    font-size: 1.1rem;
    font-weight: 800;
    font-family: var(--font-sans);
    color: var(--color-text-primary);
  }

  .breakdown-stat .stat-desc {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    font-weight: 500;
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

</style>

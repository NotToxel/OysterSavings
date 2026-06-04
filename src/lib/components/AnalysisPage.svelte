<script lang="ts">
  import {
    classifiedJourneys, fareResults, dailyCapResults,
    weeklyCapResults, capSummary, selectedRailcard,
    railcardCost, includeOysterCost, savingsResult
  } from '$lib/stores/stores';
  import { calculateRailcardSavings } from '$lib/engine/savingsEngine';
  import { RAILCARDS, type RailcardType } from '$lib/data/fareData';

  let activeTab = $state<'journeys' | 'savings' | 'caps'>('journeys');
  let sortKey = $state<string>('date');
  let sortAsc = $state(false);
  let filterMode = $state<string>('all');

  // Recalculate savings when settings change
  $effect(() => {
    if ($classifiedJourneys.length > 0) {
      $savingsResult = calculateRailcardSavings(
        $classifiedJourneys,
        $selectedRailcard,
        $railcardCost,
        $includeOysterCost
      );
    }
  });

  let filteredJourneys = $derived.by(() => {
    let list = [...$classifiedJourneys];

    if (filterMode === 'peak') list = list.filter(j => j.isPeak);
    else if (filterMode === 'offpeak') list = list.filter(j => !j.isPeak);
    else if (filterMode === 'bus') list = list.filter(j => j.isBus);
    else if (filterMode === 'rail') list = list.filter(j => !j.isBus);
    else if (filterMode === 'capped') list = list.filter(j => j.isCapHit);

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.raw.date.getTime() - b.raw.date.getTime();
      else if (sortKey === 'charge') cmp = a.raw.charge - b.raw.charge;
      else if (sortKey === 'mode') cmp = a.mode.localeCompare(b.mode);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  });

  function toggleSort(key: string) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = true; }
  }

  function getModeLabel(mode: string): string {
    const map: Record<string, string> = {
      underground: 'Tube', national_rail: 'NR', overground: 'OGN',
      bus: 'Bus', tram: 'Tram', dlr: 'DLR', elizabeth: 'Eliz', unknown: '?'
    };
    return map[mode] || mode;
  }

  function getModeBadgeClass(mode: string): string {
    if (mode === 'bus' || mode === 'tram') return 'badge-bus';
    if (mode === 'national_rail') return 'badge-rail';
    if (mode === 'overground') return 'badge-overground';
    return 'badge-underground';
  }

  function formatCapProgress(progress: number): string {
    return `${Math.round(progress * 100)}%`;
  }

  function getCapColor(progress: number): string {
    if (progress >= 1) return '#10b981';
    if (progress >= 0.7) return '#f59e0b';
    return '#009FE3';
  }

  const railcardOptions = Object.entries(RAILCARDS).map(([key, info]) => ({
    value: key as RailcardType,
    label: info.name,
  }));

  let netSaving = $derived($savingsResult?.netSaving ?? 0);
  let breakEvenText = $derived.by(() => {
    if (!$savingsResult) return 'N/A';
    if ($savingsResult.breakEvenJourneys === -1) return 'Not achievable';
    if ($savingsResult.breakEvenDate) {
      return `${$savingsResult.breakEvenJourneys} journeys (~${$savingsResult.breakEvenDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})`;
    }
    return `${$savingsResult.breakEvenJourneys} journeys`;
  });
</script>

<div class="analysis-page">
  <h1 class="page-title">Journey Analysis</h1>

  <!-- Tab navigation -->
  <div class="tab-nav" style="margin-bottom: 1.5rem;">
    <button class="tab-btn" class:active={activeTab === 'journeys'} onclick={() => activeTab = 'journeys'}>
      🚆 Journeys
    </button>
    <button class="tab-btn" class:active={activeTab === 'savings'} onclick={() => activeTab = 'savings'}>
      💰 Railcard Savings
    </button>
    <button class="tab-btn" class:active={activeTab === 'caps'} onclick={() => activeTab = 'caps'}>
      📊 Cap Analysis
    </button>
  </div>

  {#if activeTab === 'journeys'}
    <!-- Journey filter pills -->
    <div class="filter-pills">
      {#each [
        { id: 'all', label: 'All', count: $classifiedJourneys.length },
        { id: 'peak', label: 'Peak', count: $classifiedJourneys.filter(j => j.isPeak).length },
        { id: 'offpeak', label: 'Off-Peak', count: $classifiedJourneys.filter(j => !j.isPeak).length },
        { id: 'bus', label: 'Bus', count: $classifiedJourneys.filter(j => j.isBus).length },
        { id: 'rail', label: 'Rail/Tube', count: $classifiedJourneys.filter(j => !j.isBus).length },
        { id: 'capped', label: 'Cap Hit', count: $classifiedJourneys.filter(j => j.isCapHit).length },
      ] as pill}
        <button
          class="filter-pill"
          class:active={filterMode === pill.id}
          onclick={() => filterMode = pill.id}
        >
          {pill.label} <span class="pill-count">{pill.count}</span>
        </button>
      {/each}
    </div>

    <!-- Journey table -->
    <div class="table-container glass-card" style="padding: 0; overflow: hidden;">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th class="sortable" onclick={() => toggleSort('date')}>
                Date {sortKey === 'date' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th>Time</th>
              <th>Journey</th>
              <th>Mode</th>
              <th>Zones</th>
              <th>Peak</th>
              <th class="sortable" onclick={() => toggleSort('charge')}>
                Charge {sortKey === 'charge' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredJourneys as j, i}
              <tr class="animate-fade-in" style="animation-delay: {Math.min(i * 20, 500)}ms">
                <td class="date-cell">{j.raw.dateStr}</td>
                <td class="time-cell">{j.raw.startTime || '—'}</td>
                <td class="journey-cell">
                  {#if j.isBus}
                    {j.raw.journeyAction}
                  {:else if j.origin && j.destination}
                    <span class="station">{j.origin.replace(/\s*\[.*?\]/g, '')}</span>
                    <span class="arrow">→</span>
                    <span class="station">{j.destination.replace(/\s*\[.*?\]/g, '')}</span>
                  {:else}
                    {j.raw.journeyAction}
                  {/if}
                </td>
                <td>
                  <span class="badge {getModeBadgeClass(j.mode)}">{getModeLabel(j.mode)}</span>
                </td>
                <td class="zone-cell">{j.zoneRange || '—'}</td>
                <td>
                  {#if j.isBus}
                    <span class="badge badge-bus">Flat</span>
                  {:else if j.isPeak}
                    <span class="badge badge-peak">Peak</span>
                  {:else}
                    <span class="badge badge-offpeak">Off-Pk</span>
                  {/if}
                  {#if j.isEveningPeakException}
                    <span class="badge badge-offpeak" style="margin-left: 2px;" title="Evening peak exception: inbound to Zone 1">Exc</span>
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

  {:else if activeTab === 'savings'}
    <!-- Railcard Savings Panel -->
    <div class="savings-layout">
      <!-- Settings -->
      <div class="glass-card savings-settings">
        <h3 class="settings-title">⚙️ Savings Settings</h3>

        <div class="setting-group">
          <label class="setting-label" for="railcard-select">Railcard Type</label>
          <select class="input-field" id="railcard-select" bind:value={$selectedRailcard}>
            {#each railcardOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>

        <div class="setting-group">
          <label class="setting-label" for="railcard-cost">Railcard Cost (£)</label>
          <div class="cost-buttons">
            <button class="cost-btn" class:active={$railcardCost === 30} onclick={() => $railcardCost = 30}>£30 (1yr)</button>
            <button class="cost-btn" class:active={$railcardCost === 70} onclick={() => $railcardCost = 70}>£70 (3yr)</button>
          </div>
          <input type="number" class="input-field" id="railcard-cost" bind:value={$railcardCost} min="0" step="1" />
        </div>

        <div class="setting-group">
          <span class="setting-label">Include Oyster Card Cost</span>
          <div class="toggle-row">
            <button
              class="toggle"
              class:active={$includeOysterCost}
              onclick={() => $includeOysterCost = !$includeOysterCost}
              aria-label="Toggle Oyster card cost"
            >
              <span class="toggle-dot"></span>
            </button>
            <span class="toggle-label">{$includeOysterCost ? '+£7.00' : 'Not included'}</span>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div class="savings-results">
        {#if $savingsResult}
          <!-- Main savings stat -->
          <div class="glass-card savings-hero" class:positive={netSaving > 0} class:negative={netSaving <= 0}>
            <div class="savings-hero-label">
              {netSaving > 0 ? '✅ Net Saving with' : '⚠️ Net Result with'} {$savingsResult.railcardName}
            </div>
            <div class="savings-hero-value" class:green={netSaving > 0} class:red={netSaving <= 0}>
              {netSaving >= 0 ? '+' : ''}£{netSaving.toFixed(2)}
            </div>
            <div class="savings-hero-sub">
              Over {$savingsResult.totalJourneys} journeys
              ({$savingsResult.eligibleJourneys} eligible for discount)
            </div>
          </div>

          <!-- Breakdown cards -->
          <div class="savings-cards">
            <div class="stat-card">
              <div class="stat-value">£{$savingsResult.totalExpectedSpend.toFixed(2)}</div>
              <div class="stat-label">Standard PAYG</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #34d399;">£{$savingsResult.totalRailcardSpend.toFixed(2)}</div>
              <div class="stat-label">With Railcard</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: #fbbf24;">£{$savingsResult.totalSaving.toFixed(2)}</div>
              <div class="stat-label">Gross Saving</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">£{$savingsResult.perJourneySaving.toFixed(2)}</div>
              <div class="stat-label">Per Journey</div>
            </div>
          </div>

          <!-- Break-even -->
          <div class="glass-card break-even-card">
            <h3>📈 Break-Even Analysis</h3>
            <div class="break-even-detail">
              <div class="be-row">
                <span>Railcard cost</span>
                <span>£{$savingsResult.railcardCost.toFixed(2)}</span>
              </div>
              {#if $savingsResult.oysterCost > 0}
                <div class="be-row">
                  <span>Oyster card cost</span>
                  <span>£{$savingsResult.oysterCost.toFixed(2)}</span>
                </div>
              {/if}
              <div class="be-row">
                <span>Total upfront cost</span>
                <span>£{($savingsResult.railcardCost + $savingsResult.oysterCost).toFixed(2)}</span>
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
                    style="width: {Math.min(100, ($savingsResult.eligibleJourneys / $savingsResult.breakEvenJourneys) * 100)}%"
                  ></div>
                </div>
                <div class="be-progress-labels">
                  <span>{$savingsResult.eligibleJourneys} journeys taken</span>
                  <span>{$savingsResult.breakEvenJourneys} to break even</span>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

  {:else if activeTab === 'caps'}
    <!-- Cap Analysis -->
    <div class="cap-layout">
      {#if $capSummary}
        <!-- Summary cards -->
        <div class="cap-summary-grid">
          <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-value">{$capSummary.daysCapHit}<span class="stat-total">/{$capSummary.totalDays}</span></div>
            <div class="stat-label">Days Cap Hit</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📆</div>
            <div class="stat-value">{$capSummary.weeksCapHit}<span class="stat-total">/{$capSummary.totalWeeks}</span></div>
            <div class="stat-label">Weeks Cap Hit</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💷</div>
            <div class="stat-value" style="color: #34d399;">£{$capSummary.totalSavedByDailyCap.toFixed(2)}</div>
            <div class="stat-label">Saved by Daily Cap</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-value">£{$capSummary.averageDailySpend.toFixed(2)}</div>
            <div class="stat-label">Avg Daily Spend</div>
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
              <div class="cap-day-bar-container">
                <div class="cap-progress">
                  <div
                    class="cap-progress-bar"
                    style="width: {day.capProgress * 100}%; background: {getCapColor(day.capProgress)};"
                  ></div>
                </div>
              </div>
              <div class="cap-day-values">
                <span class="cap-day-spend">£{day.totalSpend.toFixed(2)}</span>
                <span class="cap-day-divider">/</span>
                <span class="cap-day-cap">£{day.dailyCap.toFixed(2)}</span>
              </div>
              <div class="cap-day-journeys">{day.journeys.length} trips</div>
              {#if day.capHit}
                <span class="badge badge-cap">Cap Hit</span>
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
                {week.weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –
                {week.weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </div>
              <div class="cap-day-bar-container">
                <div class="cap-progress">
                  <div
                    class="cap-progress-bar"
                    style="width: {week.capProgress * 100}%; background: {getCapColor(week.capProgress)};"
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
  .analysis-page { max-width: 1100px; margin: 0 auto; }

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

  .filter-pill:hover { border-color: var(--color-border-accent); }
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
  .table-container { margin-top: 0.5rem; }
  .table-scroll { overflow-x: auto; max-height: 600px; overflow-y: auto; }

  .sortable { cursor: pointer; user-select: none; }
  .sortable:hover { color: var(--color-oyster-blue); }

  .date-cell { font-weight: 500; font-size: 0.8rem; white-space: nowrap; }
  .time-cell { font-size: 0.8rem; color: var(--color-text-secondary); white-space: nowrap; }
  .journey-cell { max-width: 300px; }
  .station { font-weight: 500; font-size: 0.8rem; }
  .arrow { color: var(--color-text-muted); margin: 0 0.25rem; font-size: 0.7rem; }
  .zone-cell { font-family: monospace; font-size: 0.8rem; color: var(--color-text-secondary); }
  .charge-cell { font-weight: 600; font-family: monospace; }
  .note-cell { white-space: nowrap; }

  /* Savings layout */
  .savings-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  .savings-settings { padding: 1.5rem; }
  .settings-title { font-size: 1rem; font-weight: 600; margin-bottom: 1.25rem; }

  .setting-group { margin-bottom: 1.25rem; }
  .setting-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .cost-buttons { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
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
  .cost-btn:hover { border-color: var(--color-border-accent); }
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

  .toggle-label { font-size: 0.8rem; color: var(--color-text-secondary); }

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

  .savings-hero-value.green { color: #34d399; }
  .savings-hero-value.red { color: #f87171; }

  .savings-hero-sub {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-top: 0.375rem;
  }

  .savings-hero.positive { border-color: rgba(16, 185, 129, 0.3); }
  .savings-hero.negative { border-color: rgba(239, 68, 68, 0.2); }

  .savings-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .savings-cards .stat-value { font-size: 1.25rem; }

  /* Break-even */
  .break-even-card { padding: 1.5rem; }
  .break-even-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }

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

  .be-progress { margin-top: 1rem; }
  .be-progress-bar {
    height: 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 999px;
    overflow: hidden;
  }
  .be-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #009FE3, #6950A1);
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
    grid-template-columns: repeat(4, 1fr);
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

  .cap-bars { display: flex; flex-direction: column; gap: 0.5rem; }

  .cap-day-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    transition: background 0.2s ease;
  }

  .cap-day-row:hover { background: rgba(255, 255, 255, 0.02); }
  .cap-day-row.cap-hit { background: rgba(16, 185, 129, 0.04); }

  .cap-day-date {
    min-width: 100px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .cap-day-bar-container { flex: 1; }

  .cap-day-values {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8rem;
    font-family: monospace;
    min-width: 120px;
    justify-content: flex-end;
  }

  .cap-day-spend { font-weight: 600; }
  .cap-day-divider { color: var(--color-text-muted); }
  .cap-day-cap { color: var(--color-text-muted); }
  .cap-day-journeys { font-size: 0.7rem; color: var(--color-text-muted); min-width: 50px; text-align: right; }

  @media (max-width: 768px) {
    .savings-layout { grid-template-columns: 1fr; }
    .savings-cards { grid-template-columns: repeat(2, 1fr); }
    .cap-summary-grid { grid-template-columns: repeat(2, 1fr); }
    .cap-day-row { flex-wrap: wrap; }
  }
</style>

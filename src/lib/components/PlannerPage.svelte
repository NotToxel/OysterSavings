<script lang="ts">
  import {
    classifiedJourneys, detectedPatterns, recurrenceRules,
    plannedJourneys, forecastResult, selectedRailcard, railcardCost
  } from '$lib/stores/stores';
  import {
    type RecurrenceRule, generatePlannedJourneys,
    patternToRule
  } from '$lib/engine/recurrenceEngine';
  import { runForecast } from '$lib/engine/forecastEngine';
  import { getZoneRange, lookupFare, BUS_SINGLE_FARE, RAILCARDS, roundToNearest10p, type RailcardType } from '$lib/data/fareData';

  // Calendar state
  let calendarDate = $state(new Date());
  let showRecurrenceModal = $state(false);

  // Default Settings for Quick Add
  let defOriginZone = $state(3);
  let defDestZone = $state(1);
  let defMode = $state<'underground' | 'national_rail' | 'nr_tube' | 'bus'>('national_rail');
  let defTimePeriod = $state('06:30-09:30');

  // New rule form
  let newRuleName = $state('');
  let newOriginZone = $state(defOriginZone);
  let newDestZone = $state(defDestZone);
  let newMode = $state(defMode);
  let newTimePeriod = $state(defTimePeriod);
  let newIsReturn = $state(false);
  let newReturnTimePeriod = $state('16:00-19:00');
  let newDays = $state<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  let newIntervalType = $state<'days' | 'weeks' | 'months' | 'years' | 'none'>('weeks');
  let newIntervalValue = $state(1);
  let editRuleId = $state<string | null>(null);

  function getEstimatedFare(origin: number, dest: number, timePeriod: string, mode: string, discount: string): number {
    const isPeakFare = timePeriod === '06:30-09:30' || timePeriod === '16:00-19:00';
    const zoneRange = getZoneRange(origin, dest);
    const rawFare = mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, mode);
    
    if (discount === 'none' || discount === 'student' || mode === 'bus') {
      return rawFare;
    }
    
    const rc = RAILCARDS[discount as RailcardType];
    if (rc) {
      if (!isPeakFare || rc.appliesToPeak) {
        return roundToNearest10p(rawFare * (1 - rc.discount));
      }
    }
    return rawFare;
  }

  const TIME_PERIODS = [
    { value: '04:30-06:29', label: '04:30 - 06:29' },
    { value: '06:30-09:30', label: '06:30 - 09:30' },
    { value: '09:31-15:59', label: '09:31 - 15:59' },
    { value: '16:00-19:00', label: '16:00 - 19:00' },
    { value: '19:01-04:29', label: '19:01 - 04:29' },
  ];

  let returnTimePeriodOptions = $derived(
    TIME_PERIODS.filter((_, i) => i >= TIME_PERIODS.findIndex(t => t.value === newTimePeriod))
  );

  $effect(() => {
    const validValues = returnTimePeriodOptions.map(t => t.value);
    if (!validValues.includes(newReturnTimePeriod)) {
      newReturnTimePeriod = validValues[0];
    }
  });

  // Date range for planning
  let planStart = $state(formatInputDate(new Date()));
  let planEnd = $state(formatInputDate(addMonths(new Date(), 1)));

  let calendarMonth = $derived(calendarDate.getMonth());
  let calendarYear = $derived(calendarDate.getFullYear());

  // Generate calendar grid
  let calendarDays = $derived.by(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);

    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month fill
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - i - 1);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(calendarYear, calendarMonth, d), isCurrentMonth: true });
    }

    // Next month fill
    while (days.length < 42) {
      const d = new Date(lastDay);
      d.setDate(d.getDate() + days.length - (startOffset + lastDay.getDate()) + 1);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  });

  // Map planned journeys to calendar
  let journeysByDate = $derived.by(() => {
    const map = new Map<string, typeof $plannedJourneys>();
    for (const j of $plannedJourneys) {
      const key = j.date.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    }
    return map;
  });

  // Forecast day data by date
  let forecastByDate = $derived.by(() => {
    const map = new Map<string, NonNullable<typeof $forecastResult>['days'][0]>();
    if ($forecastResult) {
      for (const day of $forecastResult.days) {
        const key = day.date.toISOString().split('T')[0];
        map.set(key, day);
      }
    }
    return map;
  });

  function prevMonth() {
    calendarDate = new Date(calendarYear, calendarMonth - 1, 1);
  }

  function nextMonth() {
    calendarDate = new Date(calendarYear, calendarMonth + 1, 1);
  }

  function toggleDay(day: number) {
    if (newDays.includes(day)) {
      newDays = newDays.filter(d => d !== day);
    } else {
      newDays = [...newDays, day].sort();
    }
  }

  function saveRule() {
    if (newIntervalType === 'none') {
      newDays = [new Date(planStart).getDay()];
    }

    const rule: RecurrenceRule = {
      id: editRuleId || crypto.randomUUID(),
      name: newRuleName || (newIntervalType === 'none' ? 'One-off Journey' : `Zone ${newOriginZone} → Zone ${newDestZone}`),
      originZone: newOriginZone,
      destinationZone: newDestZone,
      mode: newMode,
      timePeriod: newTimePeriod,
      isReturn: newIsReturn,
      returnTimePeriod: newReturnTimePeriod,
      daysOfWeek: newDays,
      intervalType: newIntervalType,
      intervalValue: newIntervalValue,
      startDate: new Date(planStart),
      endDate: newIntervalType === 'none' ? new Date(planStart) : new Date(planEnd),
    };

    if (editRuleId) {
      $recurrenceRules = $recurrenceRules.map(r => r.id === editRuleId ? rule : r);
    } else {
      $recurrenceRules = [...$recurrenceRules, rule];
    }
    
    regenerate();
    showRecurrenceModal = false;
    resetForm();
  }

  function editRule(rule: RecurrenceRule) {
    editRuleId = rule.id;
    newRuleName = rule.name;
    newOriginZone = rule.originZone;
    newDestZone = rule.destinationZone;
    newMode = rule.mode;
    newTimePeriod = rule.timePeriod || '06:30-09:30';
    newIsReturn = rule.isReturn || false;
    newReturnTimePeriod = rule.returnTimePeriod || '16:00-19:00';
    newDays = [...rule.daysOfWeek];
    newIntervalType = rule.intervalType;
    newIntervalValue = rule.intervalValue;
    showRecurrenceModal = true;
  }



  function quickAddOnDate(d: Date) {
    resetForm();
    newIntervalType = 'none';
    planStart = formatInputDate(d);
    showRecurrenceModal = true;
  }

  function removeRule(id: string) {
    $recurrenceRules = $recurrenceRules.filter(r => r.id !== id);
    regenerate();
  }

  function importPattern(patternIndex: number) {
    const pattern = $detectedPatterns[patternIndex];
    const rule = patternToRule(pattern, new Date(planStart), new Date(planEnd));
    $recurrenceRules = [...$recurrenceRules, rule];
    regenerate();
  }

  function regenerate() {
    $plannedJourneys = generatePlannedJourneys($recurrenceRules);
    if ($plannedJourneys.length > 0) {
      $forecastResult = runForecast($plannedJourneys, $selectedRailcard, $railcardCost);
    } else {
      $forecastResult = null;
    }
  }

  function resetForm() {
    editRuleId = null;
    newRuleName = '';
    newOriginZone = defOriginZone;
    newDestZone = defDestZone;
    newMode = defMode;
    newTimePeriod = defTimePeriod;
    newIsReturn = false;
    newReturnTimePeriod = '16:00-19:00';
    newDays = [1, 2, 3, 4, 5];
    newIntervalType = 'weeks';
    newIntervalValue = 1;
  }

  function getCapColor(progress: number): string {
    if (progress >= 1) return '#10b981';
    if (progress >= 0.7) return '#f59e0b';
    return '#009FE3';
  }

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayValues = [1, 2, 3, 4, 5, 6, 0]; // JS day values for Mon-Sun

  function formatInputDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function addMonths(d: Date, months: number): Date {
    const result = new Date(d);
    result.setMonth(result.getMonth() + months);
    return result;
  }
</script>

<div class="planner-page">
  <div class="planner-header">
    <h1 class="page-title">Journey Planner</h1>
    <div class="planner-actions" style="display: flex; gap: 0.5rem;">

      <button class="btn-primary" onclick={() => { resetForm(); showRecurrenceModal = true; }}>
        + Add Schedule
      </button>
    </div>
  </div>

  <div class="planner-layout">
    <!-- Sidebar: Rules & patterns -->
    <div class="planner-sidebar">
      <!-- Date range -->
      <div class="glass-card sidebar-section">
        <h3 class="sidebar-title">📅 Planning Period</h3>
        <div class="date-inputs">
          <label class="setting-label" for="plan-start">Start</label>
          <input type="date" class="input-field" id="plan-start" bind:value={planStart} onchange={regenerate} />
          <label class="setting-label" for="plan-end" style="margin-top: 0.5rem;">End</label>
          <input type="date" class="input-field" id="plan-end" bind:value={planEnd} onchange={regenerate} />
        </div>
      </div>

      <!-- Default Settings -->
      <div class="glass-card sidebar-section">
        <h3 class="sidebar-title">⚙️ Default Journey Settings</h3>
        <p style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.75rem;">
          These settings will be used when you click a date on the calendar to add a one-off journey.
        </p>
        <div class="date-inputs">
          <label class="setting-label">Default Mode</label>
          <select class="input-field" bind:value={defMode}>
            <option value="underground">Underground / Tube</option>
            <option value="national_rail">National Rail</option>
            <option value="nr_tube">NR + Tube / Mixed</option>
            <option value="bus">Bus / Tram</option>
          </select>
          
          <label class="setting-label" style="margin-top: 0.5rem;">Default Time</label>
          <select class="input-field" bind:value={defTimePeriod}>
            {#each TIME_PERIODS as t}
              <option value={t.value}>{t.label}</option>
            {/each}
          </select>

          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <div style="flex: 1;">
              <label class="setting-label">Origin Zone</label>
              <select class="input-field" bind:value={defOriginZone}>
                {#each [1,2,3,4,5,6,7,8,9] as z}
                  <option value={z}>Zone {z}</option>
                {/each}
              </select>
            </div>
            <div style="flex: 1;">
              <label class="setting-label">Dest. Zone</label>
              <select class="input-field" bind:value={defDestZone}>
                {#each [1,2,3,4,5,6,7,8,9] as z}
                  <option value={z}>Zone {z}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="glass-card sidebar-section">
        <h3 class="sidebar-title">🏷️ Railcard Discount</h3>
        <div class="date-inputs">
          <label class="setting-label">Railcard Applied</label>
          <select class="input-field" bind:value={$selectedRailcard} onchange={regenerate}>
            <option value="none">Adult / Contactless</option>
            <option value="student">18+ Student</option>
            <option value="16-25">16-25 Railcard</option>
            <option value="26-30">26-30 Railcard</option>
            <option value="senior">Senior Railcard</option>
            <option value="disabled">Disabled Persons Railcard</option>
            <option value="hmforces">HM Forces Railcard</option>
            <option value="veterans">Veterans Railcard</option>
            <option value="network">Network Railcard / Gold Card</option>
            <option value="jobcentre">Jobcentre Plus Travel Discount</option>
          </select>
        </div>
      </div>

      <div class="glass-card sidebar-section" style="max-height: 400px; overflow-y: auto;">
        <h3 class="sidebar-title">🔄 Active Schedules</h3>
        {#if $recurrenceRules.filter(r => r.intervalType !== 'none').length === 0}
          <p class="empty-text">No recurring schedules yet.</p>
        {:else}
          {#each $recurrenceRules.filter(r => r.intervalType !== 'none') as rule}
            <div class="rule-card">
              <div class="rule-info">
                <div class="rule-name">{rule.name}</div>
                <div class="rule-detail">
                  Z{rule.originZone}→Z{rule.destinationZone} •
                  {rule.timePeriod} •
                  {rule.daysOfWeek.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(',')}
                </div>
              </div>
              <div class="rule-actions" style="display: flex; gap: 0.25rem;">
                <button class="rule-edit" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;" onclick={() => editRule(rule)}>✏️</button>
                <button class="rule-remove" onclick={() => removeRule(rule.id)}>✕</button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- One-off rules -->
      <div class="glass-card sidebar-section" style="max-height: 400px; overflow-y: auto;">
        <h3 class="sidebar-title">📌 One-off Journeys</h3>
        {#each $recurrenceRules.filter(r => r.intervalType === 'none') as rule}
          <div class="rule-card">
            <div class="rule-info">
              <div class="rule-name">{rule.name}</div>
              <div class="rule-detail">
                {rule.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} •
                Z{rule.originZone}→Z{rule.destinationZone} • {rule.timePeriod}
              </div>
            </div>
            <div class="rule-actions" style="display: flex; gap: 0.25rem;">
              <button class="rule-edit" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;" onclick={() => editRule(rule)}>✏️</button>
              <button class="rule-remove" onclick={() => removeRule(rule.id)}>✕</button>
            </div>
          </div>
        {/each}
      </div>

      <!-- Detected patterns -->
      {#if $detectedPatterns.length > 0}
        <div class="glass-card sidebar-section">
          <h3 class="sidebar-title">🔍 Detected from CSV</h3>
          {#each $detectedPatterns.slice(0, 5) as pattern, i}
            <div class="pattern-card">
              <div class="pattern-info">
                <div class="pattern-route">{pattern.origin.replace(/\s*\[.*?\]/g, '')} → {pattern.destination.replace(/\s*\[.*?\]/g, '')}</div>
                <div class="pattern-detail">
                  {pattern.frequency}x/week •
                  {pattern.isPeak ? 'Peak' : 'Off-Peak'} •
                  {Math.round(pattern.confidence * 100)}% confidence
                </div>
              </div>
              <button class="btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick={() => importPattern(i)}>
                Import
              </button>
            </div>
          {/each}
        </div>
      {/if}

    </div>

    <!-- Calendar -->
    <div class="calendar-area">
      <!-- Forecast summary -->
      {#if $forecastResult}
        <div class="glass-card forecast-summary" style="margin-bottom: 1.25rem; display: flex; justify-content: space-around; padding: 1.25rem;">
          <div class="forecast-stat" style="display: flex; flex-direction: column; align-items: center; border: none; padding: 0; margin: 0;">
            <span style="font-size: 0.85rem; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Standard PAYG</span>
            <span class="forecast-value" style="font-size: 2rem;">£{$forecastResult.totalPaygCapped.toFixed(2)}</span>
          </div>
          <div class="forecast-stat" style="display: flex; flex-direction: column; align-items: center; border: none; padding: 0; margin: 0;">
            <span style="font-size: 0.85rem; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">With Railcard Discount</span>
            <span class="forecast-value green" style="font-size: 2rem; color: #34d399;">£{$forecastResult.totalPaygRailcardCapped.toFixed(2)}</span>
          </div>
          <div class="forecast-stat highlight" style="display: flex; flex-direction: column; align-items: center; border: none; padding: 0; margin: 0; background: transparent;">
            <span style="font-size: 0.85rem; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Potential Saving</span>
            <span class="forecast-value green" style="font-size: 2.5rem; font-weight: 900; color: #34d399;">
              £{($forecastResult.totalPaygCapped - $forecastResult.totalPaygRailcardCapped).toFixed(2)}
            </span>
          </div>
        </div>
      {/if}

      <div class="glass-card" style="padding: 1.25rem;">
        <!-- Calendar header -->
        <div class="calendar-nav">
          <button class="btn-secondary" style="padding: 0.375rem 0.75rem;" onclick={prevMonth}>←</button>
          <h2 class="calendar-month-label">
            {calendarDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </h2>
          <button class="btn-secondary" style="padding: 0.375rem 0.75rem;" onclick={nextMonth}>→</button>
        </div>

        <!-- Calendar grid -->
        <div class="calendar-grid">
          {#each dayLabels as label}
            <div class="calendar-header">{label}</div>
          {/each}

          {#each calendarDays as day}
            {@const dateKey = day.date.toISOString().split('T')[0]}
            {@const dayJourneys = journeysByDate.get(dateKey) || []}
            {@const forecast = forecastByDate.get(dateKey)}
            <div
              class="calendar-cell"
              class:other-month={!day.isCurrentMonth}
              class:cap-hit={forecast?.capHit}
              class:has-journeys={dayJourneys.length > 0}
              role="button"
              tabindex="0"
              onclick={() => quickAddOnDate(day.date)}
              onkeydown={(e) => { if (e.key === 'Enter') quickAddOnDate(day.date); }}
              style="cursor: pointer;"
            >
              <div class="day-number">{day.date.getDate()}</div>
              {#if dayJourneys.length > 0}
                <div class="day-journey-count">{dayJourneys.length} trip{dayJourneys.length > 1 ? 's' : ''}</div>
                {#if forecast}
                  <div class="day-spend">£{forecast.cappedFare.toFixed(2)}</div>
                  <div class="mini-cap-bar">
                    <div
                      class="mini-cap-fill"
                      style="width: {forecast.capProgress * 100}%; background: {getCapColor(forecast.capProgress)};"
                    ></div>
                  </div>
                  {#if forecast.capHit}
                    <div class="cap-hit-label">Cap Hit ✓</div>
                  {/if}
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Recurrence Modal -->
  {#if showRecurrenceModal}
    <div class="modal-overlay" onclick={() => showRecurrenceModal = false} onkeydown={(e) => { if (e.key === 'Escape') showRecurrenceModal = false; }} role="dialog" tabindex="-1" aria-label="Add recurring schedule">
      <div class="modal-content glass-card" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="document">
        <div class="modal-header">
          <h2>{newIntervalType === 'none' ? 'Add One-off Journey' : 'Add Recurring Schedule'}</h2>
          <button class="modal-close" onclick={() => showRecurrenceModal = false}>✕</button>
        </div>

        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="setting-label">{newIntervalType === 'none' ? 'Journey Name' : 'Schedule Name'}</label>
              <input type="text" class="input-field" bind:value={newRuleName} placeholder="e.g., Morning Commute" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="setting-label">Transport Mode</label>
              <select class="input-field" bind:value={newMode}>
                <option value="underground">Underground / Tube</option>
                <option value="national_rail">National Rail</option>
                <option value="nr_tube">National Rail & Tube</option>
                <option value="bus">Bus / Tram</option>
              </select>
            </div>
            {#if newMode !== 'bus'}
              <div class="form-group">
                <label class="setting-label">Time Period</label>
                <select class="input-field" bind:value={newTimePeriod}>
                  {#each TIME_PERIODS as t}
                    <option value={t.value}>{t.label}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>

          {#if newMode !== 'bus'}
            <div class="form-row" style="margin-top: 0.5rem; align-items: center;">
              <label class="setting-label" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" bind:checked={newIsReturn} style="width: 1rem; height: 1rem;" />
                Include Return Journey
              </label>
              {#if newIsReturn}
                <select class="input-field" bind:value={newReturnTimePeriod}>
                  {#each returnTimePeriodOptions as t}
                    <option value={t.value}>Return {t.label}</option>
                  {/each}
                </select>
              {/if}
            </div>
          {/if}

          {#if newMode !== 'bus'}
            <div class="form-row">
              <div class="form-group">
                <label class="setting-label">Origin Zone</label>
                <select class="input-field" bind:value={newOriginZone}>
                  {#each [1,2,3,4,5,6,7,8,9] as z}
                    <option value={z}>Zone {z}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group">
                <label class="setting-label">Destination Zone</label>
                <select class="input-field" bind:value={newDestZone}>
                  {#each [1,2,3,4,5,6,7,8,9] as z}
                    <option value={z}>Zone {z}</option>
                  {/each}
                </select>
              </div>
            </div>
          {/if}

          {#if newIntervalType !== 'none'}
            <div class="form-group">
              <label class="setting-label">Days of Week</label>
              <div class="day-selector">
                {#each dayLabels as label, i}
                  <button
                    class="day-btn"
                    class:selected={newDays.includes(dayValues[i])}
                    onclick={() => toggleDay(dayValues[i])}
                  >
                    {label}
                  </button>
                {/each}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="setting-label">Repeat Every</label>
                <input type="number" class="input-field" bind:value={newIntervalValue} min="1" max="52" />
              </div>
              <div class="form-group">
                <label class="setting-label">Interval Type</label>
                <select class="input-field" bind:value={newIntervalType}>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          {/if}

          {#if newMode !== 'bus'}
            <div class="form-group" style="margin-top: 0.5rem;">
              <div class="zone-preview">
                Fare zone: <strong>{getZoneRange(newOriginZone, newDestZone)}</strong>
                <span style="margin: 0 0.5rem;">•</span>
                Estimated Fare: <strong>£{getEstimatedFare(newOriginZone, newDestZone, newTimePeriod, newMode, $selectedRailcard).toFixed(2)}</strong>
              </div>
            </div>
          {:else}
            <div class="form-group" style="margin-top: 0.5rem;">
              <div class="zone-preview">
                Estimated Fare: <strong>£{BUS_SINGLE_FARE.toFixed(2)}</strong>
              </div>
            </div>
          {/if}
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" onclick={() => showRecurrenceModal = false}>Cancel</button>
          <button class="btn-primary" onclick={saveRule} disabled={newIntervalType !== 'none' && newDays.length === 0}>{editRuleId ? 'Save Schedule' : 'Add Schedule'}</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .planner-page { max-width: 1200px; margin: 0 auto; }

  .planner-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .planner-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  /* Sidebar */
  .sidebar-section { padding: 1.25rem; margin-bottom: 1rem; }
  .sidebar-title { font-size: 0.9rem; font-weight: 600; margin-bottom: 0.75rem; }

  .date-inputs { display: flex; flex-direction: column; gap: 0.25rem; }
  .setting-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .empty-text { font-size: 0.8rem; color: var(--color-text-muted); }

  .rule-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .rule-name { font-size: 0.8rem; font-weight: 600; }
  .rule-detail { font-size: 0.7rem; color: var(--color-text-muted); margin-top: 0.125rem; }

  .rule-remove {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.25rem;
    transition: color 0.2s;
  }
  .rule-remove:hover { color: var(--color-danger); }

  .pattern-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    gap: 0.5rem;
  }

  .pattern-route { font-size: 0.75rem; font-weight: 600; }
  .pattern-detail { font-size: 0.65rem; color: var(--color-text-muted); margin-top: 0.125rem; }

  .forecast-summary { border-color: rgba(16, 185, 129, 0.2); }
  .forecast-stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.375rem 0;
    font-size: 0.8rem;
  }
  .forecast-stat.highlight {
    font-weight: 700;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 0.5rem;
    margin-top: 0.25rem;
  }
  .forecast-value { font-weight: 600; font-family: monospace; }
  .forecast-value.green { color: #34d399; }

  /* Calendar area */
  .calendar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .calendar-month-label {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .calendar-cell.has-journeys {
    background: rgba(0, 159, 227, 0.04);
    border-color: rgba(0, 159, 227, 0.15);
  }

  .day-journey-count {
    font-size: 0.65rem;
    color: var(--color-oyster-blue);
    font-weight: 500;
  }

  .day-spend {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-top: 0.125rem;
  }

  .mini-cap-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 0.25rem;
  }

  .mini-cap-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .cap-hit-label {
    font-size: 0.55rem;
    color: #34d399;
    font-weight: 700;
    margin-top: 0.125rem;
    text-transform: uppercase;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }

  .modal-content {
    max-width: 520px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 { font-size: 1.1rem; font-weight: 700; }

  .modal-close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
  }

  .modal-body { padding: 1.5rem; }
  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .form-group { margin-bottom: 1rem; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

  .day-selector { display: flex; gap: 0.375rem; }
  .day-btn {
    flex: 1;
    padding: 0.5rem 0;
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .day-btn:hover { border-color: var(--color-border-accent); }
  .day-btn.selected {
    background: rgba(0, 159, 227, 0.15);
    border-color: rgba(0, 159, 227, 0.4);
    color: var(--color-oyster-blue);
  }

  .zone-preview {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.03);
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
  }

  @media (max-width: 768px) {
    .planner-layout { grid-template-columns: 1fr; }
  }
</style>

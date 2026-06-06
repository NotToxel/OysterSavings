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
  import { getZoneRange, lookupFare, BUS_SINGLE_FARE, RAILCARDS, calculateDiscountedFare, type RailcardType, isPeakJourney, getRepresentativeTime, formatLocalDate, parseLocalDate } from '$lib/data/fareData';

  // Calendar state
  let calendarDate = $state(new Date());
  let showRecurrenceModal = $state(false);
  let showActiveSchedules = $state(true);
  let showOneOffJourneys = $state(true);

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
  let newRuleDate = $state('');
  let newRuleEndDate = $state('');



  function getEstimatedFare(origin: number, dest: number, timePeriod: string, mode: string, discount: string): number {
    const dateObj = parseLocalDate(planStart);
    const repTime = getRepresentativeTime(timePeriod);
    const isPeakFare = isPeakJourney(dateObj, repTime, origin, dest);
    const zoneRange = getZoneRange(origin, dest);
    const rawFare = mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, mode);
    return calculateDiscountedFare(rawFare, discount as RailcardType, isPeakFare, mode === 'bus', origin, dest, mode);
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

  $effect(() => {
    // Automatically regenerate planned journeys and forecast when dates, rules, or selected railcard change
    planStart;
    planEnd;
    $recurrenceRules;
    $selectedRailcard;
    regenerate();
  });

  let estimatedTotalFare = $derived.by(() => {
    const outbound = getEstimatedFare(newOriginZone, newDestZone, newTimePeriod, newMode, $selectedRailcard);
    if (newIsReturn) {
      const ret = getEstimatedFare(newDestZone, newOriginZone, newReturnTimePeriod, newMode, $selectedRailcard);
      return outbound + ret;
    }
    return outbound;
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
      const key = formatLocalDate(j.date);
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
        const key = formatLocalDate(day.date);
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
      newDays = [parseLocalDate(newRuleDate).getDay()];
    }

    const rule: RecurrenceRule = {
      id: editRuleId || crypto.randomUUID(),
      name: newRuleName || (newIntervalType === 'none'
        ? (newIsReturn ? 'One-off Return Journey' : 'One-off Journey')
        : (newMode === 'bus'
            ? (newIsReturn ? 'Bus Commute (Return)' : 'Bus Commute')
            : `Zone ${newOriginZone} ${newIsReturn ? '↔' : '→'} Zone ${newDestZone}`
          )
      ),
      originZone: newOriginZone,
      destinationZone: newDestZone,
      mode: newMode,
      timePeriod: newTimePeriod,
      isReturn: newIsReturn,
      returnTimePeriod: newReturnTimePeriod,
      daysOfWeek: newDays,
      intervalType: newIntervalType,
      intervalValue: newIntervalValue,
      startDate: parseLocalDate(newRuleDate),
      endDate: newIntervalType === 'none' ? parseLocalDate(newRuleDate) : parseLocalDate(newRuleEndDate),
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
    newRuleDate = formatInputDate(rule.startDate);
    newRuleEndDate = formatInputDate(rule.endDate);
    showRecurrenceModal = true;
  }



  function quickAddOnDate(d: Date) {
    resetForm();
    newIntervalType = 'none';
    newRuleDate = formatInputDate(d);
    newRuleEndDate = formatInputDate(d);
    showRecurrenceModal = true;
  }

  function removeRule(id: string) {
    $recurrenceRules = $recurrenceRules.filter(r => r.id !== id);
    regenerate();
  }

  function clearJourneysForDate(dateKey: string) {
    const dayJourneys = journeysByDate.get(dateKey) || [];
    if (dayJourneys.length === 0) return;

    const ruleIdsToAffect = new Set(
      dayJourneys.map(j => j.ruleId.replace('-return', ''))
    );

    $recurrenceRules = $recurrenceRules
      .map(rule => {
        if (ruleIdsToAffect.has(rule.id)) {
          if (rule.intervalType === 'none') {
            return null;
          } else {
            const currentExcludes = rule.excludeDates || [];
            if (!currentExcludes.includes(dateKey)) {
              return {
                ...rule,
                excludeDates: [...currentExcludes, dateKey]
              };
            }
          }
        }
        return rule;
      })
      .filter((rule): rule is RecurrenceRule => rule !== null);

    regenerate();
  }

  function importPattern(patternIndex: number) {
    const pattern = $detectedPatterns[patternIndex];
    const rule = patternToRule(pattern, parseLocalDate(planStart), parseLocalDate(planEnd));
    $recurrenceRules = [...$recurrenceRules, rule];
    regenerate();
  }

  function regenerate() {
    const journeys = generatePlannedJourneys($recurrenceRules);
    $plannedJourneys = journeys;
    if (journeys.length > 0) {
      $forecastResult = runForecast(journeys, $selectedRailcard, $railcardCost);
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
    newRuleDate = planStart;
    newRuleEndDate = planEnd;
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



      <div class="glass-card sidebar-section">
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick={() => showActiveSchedules = !showActiveSchedules}>
          <h3 class="sidebar-title" style="margin: 0;">🔄 Active Schedules</h3>
          <span style="font-size: 0.8rem; color: var(--color-text-muted);">{showActiveSchedules ? '▼' : '▶'}</span>
        </div>
        {#if showActiveSchedules}
          <div style="margin-top: 1rem; max-height: 400px; overflow-y: auto;">
            {#if $recurrenceRules.filter(r => r.intervalType !== 'none').length === 0}
              <p class="empty-text">No recurring schedules yet.</p>
            {:else}
              {#each $recurrenceRules.filter(r => r.intervalType !== 'none') as rule}
                <div class="rule-card">
                  <div class="rule-info">
                    <div class="rule-name">{rule.name}</div>
                    <div class="rule-detail">
                      {#if rule.mode === 'bus'}
                        Bus •
                      {:else}
                        Z{rule.originZone}{rule.isReturn ? '↔' : '→'}Z{rule.destinationZone} •
                      {/if}
                      {rule.timePeriod}{rule.isReturn ? ` (+${rule.returnTimePeriod})` : ''} •
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
        {/if}
      </div>

      <!-- One-off rules -->
      <div class="glass-card sidebar-section">
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick={() => showOneOffJourneys = !showOneOffJourneys}>
          <h3 class="sidebar-title" style="margin: 0;">📌 One-off Journeys</h3>
          <span style="font-size: 0.8rem; color: var(--color-text-muted);">{showOneOffJourneys ? '▼' : '▶'}</span>
        </div>
        {#if showOneOffJourneys}
          <div style="margin-top: 1rem; max-height: 400px; overflow-y: auto;">
            {#each $recurrenceRules.filter(r => r.intervalType === 'none') as rule}
              <div class="rule-card">
                <div class="rule-info">
                  <div class="rule-name">{rule.name}</div>
                  <div class="rule-detail">
                    {rule.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} •
                    {#if rule.mode === 'bus'}
                      Bus
                    {:else}
                      Z{rule.originZone}{rule.isReturn ? '↔' : '→'}Z{rule.destinationZone}
                    {/if}
                    • {rule.timePeriod}{rule.isReturn ? ` (+${rule.returnTimePeriod})` : ''}
                  </div>
                </div>
                <div class="rule-actions" style="display: flex; gap: 0.25rem;">
                  <button class="rule-edit" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;" onclick={() => editRule(rule)}>✏️</button>
                  <button class="rule-remove" onclick={() => removeRule(rule.id)}>✕</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
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
                  {pattern.timePeriod.includes('06:30') || pattern.timePeriod.includes('16:00') ? 'Peak' : 'Off-Peak'} •
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

    <!-- Calendar and Settings -->
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
            {@const dateKey = formatLocalDate(day.date)}
            {@const dayJourneys = journeysByDate.get(dateKey) || []}
            {@const forecast = forecastByDate.get(dateKey)}
            <div
              class="calendar-cell"
              class:other-month={!day.isCurrentMonth}
              class:cap-hit={forecast?.capHitRailcard}
              class:has-journeys={dayJourneys.length > 0}
              class:in-planning-period={dateKey >= planStart && dateKey <= planEnd}
              role="button"
              tabindex="0"
              onclick={() => quickAddOnDate(day.date)}
              onkeydown={(e) => { if (e.key === 'Enter') quickAddOnDate(day.date); }}
              style="cursor: pointer;"
            >
              <div class="day-number">{day.date.getDate()}</div>
              {#if dayJourneys.length > 0}
                <button
                  class="clear-day-btn"
                  onclick={(e) => { e.stopPropagation(); clearJourneysForDate(dateKey); }}
                  aria-label="Clear journeys for this day"
                >
                  ✕
                </button>
                <div class="day-journey-count">{dayJourneys.length} trip{dayJourneys.length > 1 ? 's' : ''}</div>
                {#if forecast}
                  <div class="day-spend">£{forecast.cappedFareRailcard.toFixed(2)}</div>
                  <div class="mini-cap-bar">
                    <div
                      class="mini-cap-fill"
                      style="width: {forecast.capProgressRailcard * 100}%; background: {getCapColor(forecast.capProgressRailcard)};"
                    ></div>
                  </div>
                  {#if forecast.capHitRailcard}
                    <div class="cap-hit-label">Cap Hit ✓</div>
                  {/if}
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Right Sidebar for Settings -->
    <div class="planner-sidebar">
      <!-- Default Settings -->
      <div class="glass-card sidebar-section">
        <h3 class="sidebar-title">⚙️ Default Journey Settings</h3>
        <p style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.75rem;">
          These settings apply when adding one-off journeys from the calendar.
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

      <!-- Railcard Discount -->
      <div class="glass-card sidebar-section">
        <h3 class="sidebar-title">🏷️ Railcard Discount</h3>
        <div class="date-inputs">
          <label class="setting-label">Railcard Applied to Planner</label>
          <select class="input-field" bind:value={$selectedRailcard} onchange={regenerate}>
            <option value="none">Adult / Contactless</option>
            <option value="student">Apprentice / 18+ Student Oyster</option>
            <option value="zip_11_15">11-15 Zip Oyster Card</option>
            <option value="zip_16_17">16+ Zip Oyster Card</option>
            <option value="jobcentre">Jobcentre Plus Travel Discount</option>
            <option value="disabled">Disabled Persons Railcard</option>
            <option value="railcard">National Railcard / Gold Card</option>
          </select>
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
              <label class="setting-label" for="modal-rule-name">{newIntervalType === 'none' ? 'Journey Name' : 'Schedule Name'}</label>
              <input type="text" class="input-field" id="modal-rule-name" bind:value={newRuleName} placeholder="e.g., Morning Commute" />
            </div>
            {#if newIntervalType === 'none'}
              <div class="form-group">
                <label class="setting-label" for="modal-journey-date">Journey Date</label>
                <input type="date" class="input-field" id="modal-journey-date" bind:value={newRuleDate} />
              </div>
            {/if}
          </div>

          {#if newIntervalType !== 'none'}
            <div class="form-row">
              <div class="form-group">
                <label class="setting-label" for="modal-start-date">Start Date</label>
                <input type="date" class="input-field" id="modal-start-date" bind:value={newRuleDate} />
              </div>
              <div class="form-group">
                <label class="setting-label" for="modal-end-date">End Date</label>
                <input type="date" class="input-field" id="modal-end-date" bind:value={newRuleEndDate} />
              </div>
            </div>
          {/if}

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

          <div class="form-row return-journey-row" style="margin-top: 0.5rem; align-items: flex-end;">
            <div class="form-group checkbox-group" style="margin-bottom: 0;">
              <label class="setting-label" style="margin-bottom: 0.5rem; display: block;">Return Trip</label>
              <label class="checkbox-field" class:active={newIsReturn}>
                <input type="checkbox" bind:checked={newIsReturn} />
                <span class="checkmark"></span>
                <span class="checkbox-text">Add Return Journey</span>
              </label>
            </div>
            <div class="form-group" style="margin-bottom: 0;" class:hidden-field={!newIsReturn}>
              <label class="setting-label">Return Time</label>
              <select class="input-field" bind:value={newReturnTimePeriod} disabled={!newIsReturn}>
                {#each returnTimePeriodOptions as t}
                  <option value={t.value}>{t.label}</option>
                {/each}
              </select>
            </div>
          </div>

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

          <div class="form-group" style="margin-top: 0.5rem;">
            <div class="zone-preview">
              {#if newMode !== 'bus'}
                Fare zone: <strong>{getZoneRange(newOriginZone, newDestZone)}</strong>
                <span style="margin: 0 0.5rem;">•</span>
              {/if}
              Estimated Fare: <strong>£{estimatedTotalFare.toFixed(2)}</strong>
              {#if newIsReturn}
                <span style="font-size: 0.75rem; color: var(--color-text-muted);"> (includes return)</span>
              {/if}
            </div>
          </div>
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
    grid-template-columns: 280px 1fr 280px;
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

  .calendar-cell.in-planning-period {
    background: rgba(0, 159, 227, 0.05) !important;
    border: 1.5px dashed rgba(0, 159, 227, 0.35) !important;
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

  /* Checkbox and field alignments */
  .checkbox-field {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    height: 38px; /* Perfectly matches input-field height */
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    width: 100%;
  }

  .checkbox-field:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .checkbox-field.active {
    border-color: var(--color-oyster-blue);
    background: rgba(0, 159, 227, 0.05);
  }

  .checkbox-field input {
    display: none;
  }

  .checkbox-field .checkmark {
    width: 1.125rem;
    height: 1.125rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.02);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    position: relative;
    flex-shrink: 0;
  }

  .checkbox-field:hover .checkmark {
    border-color: rgba(0, 159, 227, 0.5);
  }

  .checkbox-field input:checked + .checkmark {
    background: var(--color-oyster-blue);
    border-color: var(--color-oyster-blue);
    box-shadow: 0 0 8px rgba(0, 159, 227, 0.4);
  }

  .checkbox-field input:checked + .checkmark::after {
    content: "";
    width: 0.25rem;
    height: 0.45rem;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    position: absolute;
    top: 3px;
    left: 6px;
  }

  .checkbox-text {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    transition: color 0.2s ease;
  }

  .checkbox-field.active .checkbox-text {
    color: var(--color-text-primary);
  }

  .input-field:disabled {
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.04);
    color: var(--color-text-muted);
  }

  .hidden-field {
    opacity: 0.35;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .calendar-cell {
    position: relative;
  }

  .clear-day-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 0.55rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s ease;
    z-index: 5;
    padding: 0;
    line-height: 1;
  }

  .calendar-cell:hover .clear-day-btn {
    opacity: 1;
  }

  .clear-day-btn:hover {
    background: rgba(239, 68, 68, 0.35);
    border-color: rgba(239, 68, 68, 0.6);
    color: #ffffff;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
    transform: scale(1.1);
  }

  @media (max-width: 768px) {
    .planner-layout { grid-template-columns: 1fr; }
  }
</style>

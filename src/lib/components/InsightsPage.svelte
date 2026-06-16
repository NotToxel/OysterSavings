<script lang="ts">
  import {
    classifiedJourneys,
    weeklyCapResults,
    dailyCapResults,
    capSummary,
    selectedFareType
  } from '$lib/stores/stores';
  import { FARE_TYPES } from '$lib/data/fareData';
  import { getZoneColor } from '$lib/data/stationService';

  // Helper: Parse time string "HH:MM" to minutes of day
  function timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return isNaN(h) || isNaN(m) ? 0 : h * 60 + m;
  }

  // Helper: Categorize start time into standard TfL and day periods
  function getTimePeriod(timeStr: string): string {
    const mins = timeToMinutes(timeStr);
    if (mins >= 270 && mins < 390) return 'early_morning'; // 04:30 - 06:30
    if (mins >= 390 && mins < 570) return 'morning_peak'; // 06:30 - 09:30
    if (mins >= 570 && mins < 960) return 'midday'; // 09:30 - 16:00
    if (mins >= 960 && mins < 1140) return 'evening_peak'; // 16:00 - 19:00
    if (mins >= 1140 && mins < 1320) return 'evening_offpeak'; // 19:00 - 22:00
    return 'late_night'; // 22:00 - 04:30
  }

  // Traveler Persona Derivation
  let persona = $derived.by(() => {
    const j = $classifiedJourneys;
    if (j.length === 0) {
      return {
        title: 'Mysterious Traveler',
        desc: 'Upload your Oyster history to discover your commuting persona and unlock travel statistics.',
        badge: '❓',
        class: 'persona-mysterious'
      };
    }

    let earlyMorning = 0;
    let peak = 0;
    let midday = 0;
    let eveningOffpeak = 0;
    let lateNight = 0;

    for (const jj of j) {
      const period = getTimePeriod(jj.raw.startTime);
      if (period === 'early_morning') earlyMorning++;
      else if (period === 'morning_peak' || period === 'evening_peak') peak++;
      else if (period === 'midday') midday++;
      else if (period === 'evening_offpeak') eveningOffpeak++;
      else if (period === 'late_night') lateNight++;
    }

    const total = j.length;
    const peakPct = (peak / total) * 100;
    const offPeakPct = 100 - peakPct;

    const maxVal = Math.max(earlyMorning, peak, midday, eveningOffpeak + lateNight);

    if (maxVal === peak) {
      return {
        title: 'Rush Hour Commuter',
        desc: `You brave the peak crowds to keep London running. With ${Math.round(peakPct)}% of your journeys during morning or evening peak, your routines strongly mirror the standard 9-to-5 commute.`,
        badge: '🚇',
        class: 'persona-commuter'
      };
    }
    if (maxVal === earlyMorning) {
      return {
        title: 'Early Bird',
        desc: `You are on the platforms before London fully wakes up. With ${earlyMorning} early starts, you benefit from off-peak rates and quiet train services.`,
        badge: '🌅',
        class: 'persona-early'
      };
    }
    if (maxVal === midday) {
      return {
        title: 'Mid-Day Explorer',
        desc: `You take travel in your stride. With ${midday} daytime off-peak journeys, you enjoy cheaper fares, less crowded carriages, and flexible travel hours.`,
        badge: '🌍',
        class: 'persona-explorer'
      };
    }
    return {
      title: 'Night Owl',
      desc: `You navigate London after dark. With ${eveningOffpeak + lateNight} late evening and night journeys, you rely on the Night Tube, buses, and off-peak rail services.`,
      badge: '🦉',
      class: 'persona-owl'
    };
  });

  // Top 5 Most Common Journeys
  let topJourneys = $derived.by(() => {
    const j = $classifiedJourneys;
    const counts = new Map<string, { origin: string; destination: string; isBus: boolean; mode: string; route: string; count: number }>();

    for (const jj of j) {
      let key = '';
      let originName = '';
      let destName = '';
      let isBus = jj.isBus;
      let route = jj.busRoute || '';

      if (isBus) {
        originName = jj.raw.journeyAction;
        key = `bus-${originName}`;
      } else {
        if (!jj.origin || !jj.destination) continue;
        originName = jj.origin.replace(/\s*\[.*?\]/g, '').trim();
        destName = jj.destination.replace(/\s*\[.*?\]/g, '').trim();
        key = `${originName.toLowerCase()} to ${destName.toLowerCase()}`;
      }

      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, {
          origin: originName,
          destination: destName,
          isBus,
          mode: jj.mode,
          route,
          count: 1
        });
      }
    }

    const total = j.length || 1;
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(item => ({
        ...item,
        percentage: (item.count / total) * 100
      }));
  });

  // Mode Share Statistics
  let modeShareStats = $derived.by(() => {
    const j = $classifiedJourneys;
    const counts = new Map<string, number>();
    for (const jj of j) {
      let m = jj.mode as string;
      if (jj.isBus) m = 'bus';
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    const total = j.length || 1;
    return Array.from(counts.entries()).map(([mode, c]) => {
      let label = mode;
      let emoji = '🚈';
      if (mode === 'underground') { label = 'Underground'; emoji = '🚇'; }
      else if (mode === 'national_rail') { label = 'National Rail'; emoji = '🚆'; }
      else if (mode === 'elizabeth') { label = 'Elizabeth line'; emoji = '💜'; }
      else if (mode === 'overground') { label = 'Overground'; emoji = '🧡'; }
      else if (mode === 'dlr') { label = 'DLR'; emoji = '🔴'; }
      else if (mode === 'bus') { label = 'Bus & Tram'; emoji = '🚌'; }
      else if (mode === 'nr_tube') { label = 'NR / Tube connection'; emoji = '🔄'; }

      return {
        mode,
        label,
        emoji,
        count: c,
        percentage: (c / total) * 100
      };
    }).sort((a, b) => b.count - a.count);
  });

  // Time of Day distribution stats
  let timeOfDayStats = $derived.by(() => {
    const j = $classifiedJourneys;
    const counts = {
      early_morning: 0,
      morning_peak: 0,
      midday: 0,
      evening_peak: 0,
      evening_offpeak: 0,
      late_night: 0
    };

    for (const jj of j) {
      const p = getTimePeriod(jj.raw.startTime);
      if (p in counts) {
        counts[p as keyof typeof counts]++;
      }
    }

    const total = j.length || 1;
    return Object.entries(counts).map(([key, val]) => {
      let label = '';
      let icon = '🕐';
      if (key === 'early_morning') { label = 'Early Morning (04:30 - 06:30)'; icon = '🌅'; }
      else if (key === 'morning_peak') { label = 'Morning Peak (06:30 - 09:30)'; icon = '🌆'; }
      else if (key === 'midday') { label = 'Mid-day Off-Peak (09:30 - 16:00)'; icon = '☀️'; }
      else if (key === 'evening_peak') { label = 'Evening Peak (16:00 - 19:00)'; icon = '🌇'; }
      else if (key === 'evening_offpeak') { label = 'Evening Off-Peak (19:00 - 22:00)'; icon = '🌃'; }
      else if (key === 'late_night') { label = 'Late Night (22:00 - 04:30)'; icon = '🌙'; }

      return {
        key,
        label,
        icon,
        count: val,
        percentage: (val / total) * 100
      };
    });
  });

  // Day of Week frequency stats
  let dayOfWeekStats = $derived.by(() => {
    const j = $classifiedJourneys;
    const counts = Array(7).fill(0);
    for (const jj of j) {
      const d = jj.dayOfWeek;
      if (d >= 0 && d <= 6) {
        counts[d]++;
      }
    }
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const total = j.length || 1;
    
    // Shift arrays to start with Monday (1) to Sunday (0)
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map(idx => ({
      name: days[idx],
      count: counts[idx],
      percentage: (counts[idx] / total) * 100
    }));
  });

  // Penalty fares and same-station exit anomalies
  let anomalies = $derived.by(() => {
    const j = $classifiedJourneys;
    const list: { date: string; time: string; description: string; charge: number; type: 'same_station' | 'no_touch' }[] = [];
    let totalPenaltySpend = 0;

    for (const jj of j) {
      const action = (jj.raw.journeyAction || '').toLowerCase();
      const note = (jj.raw.note || '').toLowerCase();

      // Same station exit
      if (jj.origin && jj.destination && jj.origin.toLowerCase().trim() === jj.destination.toLowerCase().trim()) {
        list.push({
          date: jj.raw.dateStr,
          time: jj.raw.startTime || '—',
          description: `Entered & exited ${jj.origin.replace(/\s*\[.*?\]/g, '')}`,
          charge: jj.raw.charge,
          type: 'same_station'
        });
        totalPenaltySpend += jj.raw.charge;
      }
      // Maximum fare / did not touch
      else if (
        action.includes('did not touch') ||
        action.includes('unstarted') ||
        action.includes('incomplete') ||
        note.includes('maximum fare') ||
        note.includes('did not touch')
      ) {
        list.push({
          date: jj.raw.dateStr,
          time: jj.raw.startTime || '—',
          description: `Incomplete tap-out / maximum charge`,
          charge: jj.raw.charge,
          type: 'no_touch'
        });
        totalPenaltySpend += jj.raw.charge;
      }
    }

    return {
      list: list.sort((a, b) => b.date.localeCompare(a.date)),
      totalPenaltySpend,
      count: list.length
    };
  });

  // Primary Travel Profile Stats Card
  let travelProfile = $derived.by(() => {
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
      projectedMonthly: Math.round(avgWeekly * 4.33 * 100) / 100,
      projectedAnnual: Math.round(avgWeekly * 52),
      topZone
    };
  });

  function getModeBadgeClass(m: string): string {
    if (m === 'bus') return 'badge-bus';
    if (m === 'underground') return 'badge-underground';
    if (m === 'overground') return 'badge-overground';
    if (m === 'elizabeth') return 'badge-elizabeth';
    return 'badge-rail';
  }

  function getModeLabel(mode: string): string {
    if (mode === 'underground') return 'Tube';
    if (mode === 'overground') return 'Overground';
    if (mode === 'elizabeth') return 'Elizabeth';
    if (mode === 'dlr') return 'DLR';
    if (mode === 'national_rail') return 'Rail';
    if (mode === 'nr_tube') return 'NR/Tube';
    if (mode === 'bus') return 'Bus';
    return mode;
  }
</script>

<div class="insights-page">
  <h1 class="page-title">Travel Insights</h1>
  <p class="page-subtitle">Personalized commutes analysis, traveler profiling, mode shares, and anomaly cost estimation</p>

  {#if !travelProfile}
    <!-- Empty State -->
    <div class="glass-card empty-state">
      <div class="empty-icon">💡</div>
      <h2>No Travel Data Uploaded</h2>
      <p>Please go to the Upload page and load your TfL Oyster CSV history to view comprehensive insights.</p>
    </div>
  {:else}
    <!-- Active Insights Grid -->
    <div class="insights-grid">
      
      <!-- Column 1: Traveler Profile & Top Journeys -->
      <div class="column">
        
        <!-- Traveler Persona Card -->
        <div class="glass-card persona-card {persona.class}">
          <div class="persona-header">
            <span class="persona-badge">{persona.badge}</span>
            <div class="persona-text-col">
              <span class="persona-tag">Your Persona</span>
              <h2 class="persona-title">{persona.title}</h2>
            </div>
          </div>
          <p class="persona-desc">{persona.desc}</p>
        </div>

        <!-- Travel Profile Card -->
        <div class="glass-card stats-card-large">
          <h3 class="card-title">📊 Travel Profile</h3>
          <div class="grid-stats">
            <div class="metric">
              <span class="metric-val">{travelProfile.journeys}</span>
              <span class="metric-label">Total Journeys</span>
            </div>
            <div class="metric">
              <span class="metric-val">{travelProfile.weeks}</span>
              <span class="metric-label">Active Weeks</span>
            </div>
            <div class="metric">
              <span class="metric-val" style="color: var(--color-oyster-blue);">£{travelProfile.avgWeekly.toFixed(2)}</span>
              <span class="metric-label">Avg Weekly Spend</span>
            </div>
            <div class="metric">
              <span class="metric-val" style="color: {getZoneColor(travelProfile.topZone)}">{travelProfile.topZone}</span>
              <span class="metric-label">Primary Zone Range</span>
            </div>
          </div>
          <div class="projections-bar">
            <div class="projection">
              <span class="proj-label">Projected Monthly</span>
              <span class="proj-val">£{travelProfile.projectedMonthly.toFixed(2)}</span>
            </div>
            <div class="projection">
              <span class="proj-label">Projected Annual</span>
              <span class="proj-val">£{travelProfile.projectedAnnual.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <!-- Top 5 Most Common Journeys -->
        <div class="glass-card journeys-card">
          <h3 class="card-title">🏆 Top 5 Most Common Routes</h3>
          <div class="journeys-list">
            {#each topJourneys as route, i}
              <div class="journey-item">
                <span class="rank-badge">#{i + 1}</span>
                <div class="journey-details">
                  {#if route.isBus}
                    <span class="route-names">{route.origin}</span>
                  {:else}
                    <span class="route-names">
                      {route.origin} <span class="arrow">→</span> {route.destination}
                    </span>
                  {/if}
                  <span class="route-meta">
                    <span class="badge {getModeBadgeClass(route.mode)}">{getModeLabel(route.mode)}</span>
                    • {route.count} times ({Math.round(route.percentage)}% of travel)
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>

      </div>

      <!-- Column 2: Heatmaps, Mode Shares, & Anomalies -->
      <div class="column">
        
        <!-- Network Mode Share -->
        <div class="glass-card share-card">
          <h3 class="card-title">🚇 Network Mode Share</h3>
          <div class="bar-chart-list">
            {#each modeShareStats as stat}
              <div class="bar-row">
                <div class="bar-labels">
                  <span>{stat.emoji} {stat.label}</span>
                  <span class="bar-val">{stat.count} ({Math.round(stat.percentage)}%)</span>
                </div>
                <div class="progress-bar-container">
                  <div class="progress-bar-fill" style="width: {stat.percentage}%; background: var(--color-oyster-blue);"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Time of Day Heatmap -->
        <div class="glass-card share-card">
          <h3 class="card-title">🕒 Time of Day Activity</h3>
          <div class="bar-chart-list">
            {#each timeOfDayStats as stat}
              <div class="bar-row">
                <div class="bar-labels">
                  <span>{stat.icon} {stat.label}</span>
                  <span class="bar-val">{stat.count} ({Math.round(stat.percentage)}%)</span>
                </div>
                <div class="progress-bar-container">
                  <div class="progress-bar-fill" style="width: {stat.percentage}%; background: var(--color-elizabeth-purple);"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Day of Week Frequency -->
        <div class="glass-card share-card">
          <h3 class="card-title">📅 Day of Week Frequency</h3>
          <div class="bar-chart-list">
            {#each dayOfWeekStats as stat}
              <div class="bar-row">
                <div class="bar-labels">
                  <span>{stat.name}</span>
                  <span class="bar-val">{stat.count} ({Math.round(stat.percentage)}%)</span>
                </div>
                <div class="progress-bar-container">
                  <div class="progress-bar-fill" style="width: {stat.percentage}%; background: var(--color-overground-orange);"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Penalty Fares & Anomalies Tracker -->
        <div class="glass-card penalty-card" class:anomalies-found={anomalies.count > 0}>
          <div class="card-header-flex">
            <h3 class="card-title">⚠️ Penalty Fares & Anomalies</h3>
            {#if anomalies.count > 0}
              <span class="anomaly-alert">Estimate: £{anomalies.totalPenaltySpend.toFixed(2)} Lost</span>
            {/if}
          </div>
          
          {#if anomalies.count === 0}
            <div class="no-anomalies">
              <span class="success-icon">💚</span>
              <p>No anomalies or maximum fares detected in your history. You always tap in and out correctly!</p>
            </div>
          {:else}
            <p class="penalty-intro">We detected <strong>{anomalies.count}</strong> maximum fares or same-station exits. Ensure you request refund claims on the TfL website.</p>
            <div class="anomaly-scroll">
              {#each anomalies.list as err}
                <div class="anomaly-row">
                  <div class="anomaly-left">
                    <span class="anomaly-date">{err.date} {err.time}</span>
                    <span class="anomaly-desc">{err.description}</span>
                  </div>
                  <span class="anomaly-charge">£{err.charge.toFixed(2)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      </div>

    </div>
  {/if}
</div>

<style>
  .insights-page { max-width: 1100px; margin: 0 auto; }

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

  /* Empty state */
  .empty-state {
    padding: 3rem;
    text-align: center;
    max-width: 600px;
    margin: 4rem auto;
  }
  .empty-icon {
    font-size: 3.5rem;
    margin-bottom: 1rem;
  }
  .empty-state h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  .empty-state p {
    color: var(--color-text-secondary);
    line-height: 1.6;
    font-size: 0.95rem;
  }

  /* Grid Layout */
  .insights-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .card-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  /* Persona Card */
  .persona-card {
    padding: 1.5rem;
    border-radius: 16px;
    position: relative;
    overflow: hidden;
  }

  .persona-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .persona-badge {
    font-size: 2.25rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .persona-text-col {
    display: flex;
    flex-direction: column;
  }

  .persona-tag {
    font-size: 0.7rem;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .persona-title {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0;
  }

  .persona-desc {
    font-size: 0.85rem;
    line-height: 1.6;
    margin: 0;
    color: var(--color-text-secondary);
  }

  /* Persona Color Variants */
  .persona-commuter {
    background: linear-gradient(135deg, rgba(0, 159, 227, 0.12), rgba(0, 159, 227, 0.03));
    border-color: rgba(0, 159, 227, 0.3);
  }
  .persona-commuter .persona-title { color: var(--color-oyster-blue); }

  .persona-early {
    background: linear-gradient(135deg, rgba(239, 123, 16, 0.12), rgba(239, 123, 16, 0.03));
    border-color: rgba(239, 123, 16, 0.3);
  }
  .persona-early .persona-title { color: var(--color-overground-orange); }

  .persona-explorer {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.03));
    border-color: rgba(16, 185, 129, 0.3);
  }
  .persona-explorer .persona-title { color: var(--color-success); }

  .persona-owl {
    background: linear-gradient(135deg, rgba(105, 80, 161, 0.12), rgba(105, 80, 161, 0.03));
    border-color: rgba(105, 80, 161, 0.3);
  }
  .persona-owl .persona-title { color: var(--color-elizabeth-light); }

  /* Stats Card */
  .stats-card-large {
    padding: 1.5rem;
  }

  .grid-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .metric {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    padding: 1rem;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metric-val {
    font-size: 1.5rem;
    font-weight: 800;
  }

  .metric-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .projections-bar {
    display: flex;
    gap: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding-top: 1rem;
  }

  .projection {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .proj-label {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 0.15rem;
  }

  .proj-val {
    font-size: 1.1rem;
    font-weight: 700;
  }

  /* Routes / Journeys List */
  .journeys-card {
    padding: 1.5rem;
  }

  .journeys-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .journey-item {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding-bottom: 0.875rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .journey-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .rank-badge {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.75rem;
    font-weight: 700;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .journey-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .route-names {
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .arrow {
    color: var(--color-text-muted);
    margin: 0 0.2rem;
  }

  .route-meta {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .badge {
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  /* Mode / Share Bars */
  .share-card {
    padding: 1.5rem;
  }

  .bar-chart-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .bar-row {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .bar-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  .bar-val {
    font-weight: 500;
    font-family: monospace;
    font-size: 0.8rem;
  }

  .progress-bar-container {
    height: 8px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 99px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Penalty / Anomalies */
  .penalty-card {
    padding: 1.5rem;
  }

  .card-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .anomaly-alert {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--color-danger);
    font-size: 0.725rem;
    font-weight: 700;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
  }

  .no-anomalies {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(16, 185, 129, 0.04);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: 12px;
  }

  .no-anomalies p {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.4;
  }

  .penalty-intro {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0 0 1rem 0;
    line-height: 1.4;
  }

  .anomaly-scroll {
    max-height: 250px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-right: 0.25rem;
  }

  .anomaly-row {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    padding: 0.75rem;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .anomaly-left {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .anomaly-date {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .anomaly-desc {
    font-size: 0.775rem;
    font-weight: 500;
    line-height: 1.3;
  }

  .anomaly-charge {
    font-weight: 700;
    color: var(--color-danger);
    font-family: monospace;
    font-size: 0.85rem;
  }

  @media (max-width: 768px) {
    .insights-grid { grid-template-columns: 1fr; }
    .grid-stats { grid-template-columns: repeat(2, 1fr); }
    .projections-bar { flex-direction: column; gap: 0.5rem; }
  }
</style>

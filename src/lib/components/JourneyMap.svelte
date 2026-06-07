<script lang="ts">
  import { onMount } from 'svelte';
  import { classifiedJourneys } from '$lib/stores/stores';
  import {
    STATION_COORDS,
    LINE_CONNECTIONS,
    COORDINATE_BOUNDS,
    type NetworkStation,
    type NetworkConnection
  } from '$lib/data/networkData';

  // Helper to normalize names exactly as done in pre-processing to ensure matches
  function normalizeName(name: string | null): string {
    if (!name) return '';
    let norm = name
      .toLowerCase()
      .replace(/\[.*?\]/g, '') // remove [National Rail]
      .replace(/\(.*?\)/g, '') // remove (Bakerloo)
      .replace(/’/g, "'") // normalize smart apostrophes
      .replace(/\bst\./g, 'st') // normalize St. -> st
      .replace(/\bst\b/g, 'st') // normalize st -> st
      .replace(/\./g, '') // remove other periods
      .replace(/\s+/g, ' ') // collapse multiple spaces
      .trim();

    // Special case corrections to align csv with stations.ts keys
    if (norm === 'caledonian road and barnsbury') norm = 'caledonian road & barnsbury';
    if (norm === 'highbury and islington') norm = 'highbury & islington';
    if (norm === 'kings cross st pancras') norm = "king's cross st pancras";
    if (norm === 'elephants & castle') norm = 'elephant & castle';
    if (norm === 'elephant and castle') norm = 'elephant & castle';
    if (norm === 'st jamess park') norm = "st james's park";
    if (norm === 'st johns wood') norm = "st john's wood";
    if (norm === 'st pauls') norm = "st paul's";
    if (norm === 'walthamstow queens road') norm = "walthamstow queen's road";
    if (norm === 'earls court') norm = "earl's court";
    if (norm === 'shepherds bush') norm = "shepherd's bush";
    if (norm === 'queens road peckham') norm = 'queens road peckham';
    if (norm === 'heathrow terminals 1 2 3') norm = 'heathrow terminals 2 & 3';
    if (norm === 'heathrow terminals 2 and 3') norm = 'heathrow terminals 2 & 3';
    if (norm === 'heathrow terminals 1, 2, 3') norm = 'heathrow terminals 2 & 3';
    if (norm === 'heathrow terminal 4') norm = 'heathrow terminal 4';
    if (norm === 'heathrow terminal 5') norm = 'heathrow terminal 5';
    
    return norm;
  }

  // Bounds for view calculations
  const minX = COORDINATE_BOUNDS.minX;
  const maxX = COORDINATE_BOUNDS.maxX;
  const minY = COORDINATE_BOUNDS.minY;
  const maxY = COORDINATE_BOUNDS.maxY;
  
  const width = maxX - minX;
  const height = maxY - minY;

  // Store stations mapped directly to coordinates
  const stations = Object.entries(STATION_COORDS).reduce((acc, [key, station]) => {
    acc[key] = {
      ...station,
      x: station.x,
      y: station.y
    };
    return acc;
  }, {} as Record<string, NetworkStation & { x: number; y: number }>);

  // Adjacency graph for BFS routing
  const graph = LINE_CONNECTIONS.reduce((acc, conn) => {
    if (!acc[conn.from]) acc[conn.from] = [];
    if (!acc[conn.to]) acc[conn.to] = [];
    acc[conn.from].push(conn.to);
    acc[conn.to].push(conn.from);
    return acc;
  }, {} as Record<string, string[]>);

  // Shortest path router (BFS)
  function findShortestPath(startKey: string, endKey: string): string[] {
    if (startKey === endKey) return [startKey];
    if (!graph[startKey] || !graph[endKey]) return [];

    const queue: string[][] = [[startKey]];
    const visited = new Set<string>([startKey]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const node = path[path.length - 1];

      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        if (neighbor === endKey) {
          return [...path, neighbor];
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    return [];
  }

  // Interactivity state
  let zoomScale = $state(1.2);
  let panX = $state(0);
  let panY = $state(0);
  let isDragging = $state(false);
  let startDragX = $state(0);
  let startDragY = $state(0);
  let showAllLabels = $state(false);
  let mapFilterMode = $state<'all' | 'underground' | 'overground' | 'elizabeth' | 'national_rail'>('all');

  // Tooltips
  let hoveredNode = $state<(NetworkStation & { x: number; y: number; count: number }) | null>(null);
  let hoveredConnection = $state<{ line: string; fromName: string; toName: string; count: number } | null>(null);
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  // Major hubs to show at low zoom levels
  const MAJOR_HUBS = new Set([
    'waterloo', 'victoria', 'kings cross st pancras', 'london bridge', 
    'stratford', 'paddington', 'euston', 'liverpool street', 'clapham junction'
  ]);

  // Compute active traveled stations and lines from ClassifiedJourneys
  const travelFootprint = $derived.by(() => {
    const activeSegments: Record<string, number> = {}; // key: "stationA-stationB", val: count
    const activeStations: Record<string, number> = {};  // key: stationKey, val: count
    const unroutedPaths: { from: string; to: string; count: number }[] = [];

    const railJourneys = $classifiedJourneys.filter(j => !j.isBus && j.origin && j.destination);

    for (const j of railJourneys) {
      const fromKey = normalizeName(j.origin);
      const toKey = normalizeName(j.destination);

      if (!fromKey || !toKey) continue;
      if (!stations[fromKey] || !stations[toKey]) continue;

      activeStations[fromKey] = (activeStations[fromKey] || 0) + 1;
      activeStations[toKey] = (activeStations[toKey] || 0) + 1;

      const path = findShortestPath(fromKey, toKey);
      if (path.length > 1) {
        for (let i = 0; i < path.length - 1; i++) {
          const u = path[i];
          const v = path[i + 1];
          const segKey = u < v ? `${u}-${v}` : `${v}-${u}`;
          activeSegments[segKey] = (activeSegments[segKey] || 0) + 1;

          if (i > 0) {
            activeStations[u] = (activeStations[u] || 0) + 0.15; // mark traversed stations
          }
        }
      } else {
        const segKey = fromKey < toKey ? `${fromKey}-${toKey}` : `${toKey}-${fromKey}`;
        unroutedPaths.push({ from: fromKey, to: toKey, count: 1 });
      }
    }

    return {
      activeSegments,
      activeStations,
      unroutedPaths
    };
  });

  // Fit view bounds to traveled stations
  function fitToActiveBounds() {
    const activeKeys = Object.keys(travelFootprint.activeStations);
    let minActiveX = Infinity;
    let maxActiveX = -Infinity;
    let minActiveY = Infinity;
    let maxActiveY = -Infinity;

    let hasActive = false;
    for (const key of activeKeys) {
      const s = stations[key];
      if (s) {
        hasActive = true;
        if (s.x < minActiveX) minActiveX = s.x;
        if (s.x > maxActiveX) maxActiveX = s.x;
        if (s.y < minActiveY) minActiveY = s.y;
        if (s.y > maxActiveY) maxActiveY = s.y;
      }
    }

    const containerW = 950;
    const containerH = 580;

    if (!hasActive) {
      zoomScale = 1.0;
      panX = (containerW - width) / 2 - minX;
      panY = (containerH - height) / 2 - minY;
      return;
    }

    const padding = 80;
    const boundsW = (maxActiveX - minActiveX) + padding * 2;
    const boundsH = (maxActiveY - minActiveY) + padding * 2;

    const scaleX = containerW / boundsW;
    const scaleY = containerH / boundsH;
    const targetScale = Math.max(0.7, Math.min(8, Math.min(scaleX, scaleY)));

    const centerX = minActiveX + (maxActiveX - minActiveX) / 2;
    const centerY = minActiveY + (maxActiveY - minActiveY) / 2;

    zoomScale = targetScale;
    panX = containerW / 2 - centerX * zoomScale;
    panY = containerH / 2 - centerY * zoomScale;
  }

  onMount(() => {
    setTimeout(fitToActiveBounds, 100);
  });

  // TfL line color palette
  function getLineColor(line: string): string {
    const name = line.toLowerCase();
    if (name.includes('bakerloo')) return '#B26300';
    if (name.includes('central')) return '#DC241F';
    if (name.includes('circle')) return '#FFD300';
    if (name.includes('district')) return '#00782A';
    if (name.includes('hammersmith')) return '#F15B7E';
    if (name.includes('jubilee')) return '#868F98';
    if (name.includes('metropolitan')) return '#9B005A';
    if (name.includes('northern')) return '#ffffff'; // white on dark background
    if (name.includes('piccadilly')) return '#003688';
    if (name.includes('victoria')) return '#0098D4';
    if (name.includes('waterloo')) return '#95CDBA';
    if (name.includes('elizabeth')) return '#6950A1';
    if (name.includes('dlr')) return '#00A4A6';
    if (
      name.includes('overground') || 
      name.includes('mildmay') || 
      name.includes('lioness') || 
      name.includes('suffragette') || 
      name.includes('weaver') || 
      name.includes('windrush') || 
      name.includes('liberty')
    ) {
      return '#EF7B10';
    }
    return '#4b5563'; // Slate grey for standard rail
  }

  // drag pan
  function handleMouseDown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.map-controls')) return;
    isDragging = true;
    startDragX = e.clientX - panX;
    startDragY = e.clientY - panY;
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = e.currentTarget ? (e.currentTarget as HTMLElement).getBoundingClientRect() : null;
    if (rect) {
      tooltipX = e.clientX - rect.left + 15;
      tooltipY = e.clientY - rect.top + 15;
    }

    if (!isDragging) return;
    panX = e.clientX - startDragX;
    panY = e.clientY - startDragY;
  }

  function handleMouseUp() {
    isDragging = false;
  }

  // zoom relative to cursor
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = 1.15;
    const nextScale = e.deltaY < 0 ? zoomScale * zoomFactor : zoomScale / zoomFactor;
    const clampedScale = Math.max(0.4, Math.min(15, nextScale));

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasX = (mouseX - panX) / zoomScale;
    const canvasY = (mouseY - panY) / zoomScale;

    zoomScale = clampedScale;
    panX = mouseX - canvasX * zoomScale;
    panY = mouseY - canvasY * zoomScale;
  }

  // Touch Support
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTouchDistance = 0;

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      isDragging = true;
      touchStartX = e.touches[0].clientX - panX;
      touchStartY = e.touches[0].clientY - panY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (isDragging && e.touches.length === 1) {
      panX = e.touches[0].clientX - touchStartX;
      panY = e.touches[0].clientY - touchStartY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (lastTouchDistance > 0) {
        const factor = distance / lastTouchDistance;
        const nextScale = zoomScale * factor;
        const clampedScale = Math.max(0.4, Math.min(15, nextScale));

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        const canvasX = (midX - panX) / zoomScale;
        const canvasY = (midY - panY) / zoomScale;

        zoomScale = clampedScale;
        panX = midX - canvasX * zoomScale;
        panY = midY - canvasY * zoomScale;
      }
      lastTouchDistance = distance;
    }
  }

  function handleTouchEnd() {
    isDragging = false;
    lastTouchDistance = 0;
  }

  function zoomIn() { zoomScale = Math.min(15, zoomScale * 1.35); }
  function zoomOut() { zoomScale = Math.max(0.4, zoomScale / 1.35); }

  function shouldDisplaySegment(conn: NetworkConnection): boolean {
    if (mapFilterMode === 'all') return true;
    const lm = conn.line.toLowerCase();
    if (mapFilterMode === 'underground') {
      return ['bakerloo', 'central', 'circle', 'district', 'hammersmith', 'jubilee', 'metropolitan', 'northern', 'piccadilly', 'victoria', 'waterloo'].some(m => lm.includes(m));
    }
    if (mapFilterMode === 'overground') {
      return ['overground', 'mildmay', 'lioness', 'suffragette', 'weaver', 'windrush', 'liberty', 'dlr'].some(m => lm.includes(m));
    }
    if (mapFilterMode === 'elizabeth') return lm.includes('elizabeth');
    if (mapFilterMode === 'national_rail') {
      return !['bakerloo', 'central', 'circle', 'district', 'hammersmith', 'jubilee', 'metropolitan', 'northern', 'piccadilly', 'victoria', 'waterloo', 'elizabeth', 'dlr', 'overground', 'mildmay', 'lioness', 'suffragette', 'weaver', 'windrush', 'liberty'].some(m => lm.includes(m));
    }
    return true;
  }
</script>

<div class="journey-map-container glass-card">
  <div class="map-header">
    <div class="map-title-row">
      <h3>🗺️ Personalised Vector-Recreated Schematic Map</h3>
      <p class="map-subtitle">A fully rendered vector reconstruction of the London Tube & Rail network, highlighting your commute routes.</p>
    </div>

    <!-- Filters HUD -->
    <div class="map-filters">
      <div class="filter-group">
        <span class="filter-label">Filter Network:</span>
        <div class="tab-nav compact">
          <button class="tab-btn" class:active={mapFilterMode === 'all'} onclick={() => mapFilterMode = 'all'}>All</button>
          <button class="tab-btn" class:active={mapFilterMode === 'underground'} onclick={() => mapFilterMode = 'underground'}>Tube</button>
          <button class="tab-btn" class:active={mapFilterMode === 'overground'} onclick={() => mapFilterMode = 'overground'}>Overground/DLR</button>
          <button class="tab-btn" class:active={mapFilterMode === 'elizabeth'} onclick={() => mapFilterMode = 'elizabeth'}>Liz Line</button>
          <button class="tab-btn" class:active={mapFilterMode === 'national_rail'} onclick={() => mapFilterMode = 'national_rail'}>Rail</button>
        </div>
      </div>

      <div class="toggle-row">
        <input type="checkbox" id="toggle-all-labels" bind:checked={showAllLabels} style="accent-color: var(--color-oyster-blue); cursor: pointer;" />
        <label for="toggle-all-labels" style="font-size: 0.8rem; color: var(--color-text-secondary); cursor: pointer; user-select: none;">Show all names</label>
      </div>
    </div>
  </div>

  <!-- Interactive SVG Map Area -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="map-canvas" 
    onmousedown={handleMouseDown}
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onmouseleave={handleMouseUp}
    onwheel={handleWheel}
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    style="cursor: {isDragging ? 'grabbing' : 'grab'};"
  >
    <svg width="100%" height="100%" viewBox="50 -30 830 710" preserveAspectRatio="xMidYMid meet">
      <!-- Defs for filter glow effects -->
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Transformable Group -->
      <g transform="translate({panX}, {panY}) scale({zoomScale})">
        
        <!-- ==================== BACKGROUND LINES (TfL STANDARD THICK BANDS) ==================== -->
        <g class="network-background-lines">
          {#each LINE_CONNECTIONS as conn}
            {#if shouldDisplaySegment(conn)}
              {@const fromStation = stations[conn.from]}
              {@const toStation = stations[conn.to]}
              {#if fromStation && toStation}
                <line
                  x1={fromStation.x}
                  y1={fromStation.y}
                  x2={toStation.x}
                  y2={toStation.y}
                  stroke={getLineColor(conn.line)}
                  stroke-width={2.2 / zoomScale}
                  opacity="0.14"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              {/if}
            {/if}
          {/each}
        </g>

        <!-- ==================== HIGHLIGHTED TRAVELED LINES (GLOWING BANDS) ==================== -->
        <g class="network-active-lines">
          {#each LINE_CONNECTIONS as conn}
            {#if shouldDisplaySegment(conn)}
              {@const fromStation = stations[conn.from]}
              {@const toStation = stations[conn.to]}
              {#if fromStation && toStation}
                {@const segKey = conn.from < conn.to ? `${conn.from}-${conn.to}` : `${conn.to}-${conn.from}`}
                {@const count = travelFootprint.activeSegments[segKey] || 0}
                {#if count > 0}
                  <!-- Glow outline behind -->
                  <line
                    x1={fromStation.x}
                    y1={fromStation.y}
                    x2={toStation.x}
                    y2={toStation.y}
                    stroke="var(--color-oyster-blue)"
                    stroke-width={(5 + Math.min(count * 0.4, 4)) / zoomScale}
                    opacity="0.35"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    style="filter: url(#glow);"
                  />
                  <!-- Solid core line band -->
                  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
                  <line
                    x1={fromStation.x}
                    y1={fromStation.y}
                    x2={toStation.x}
                    y2={toStation.y}
                    stroke={getLineColor(conn.line)}
                    stroke-width={(3.2 + Math.min(count * 0.3, 3)) / zoomScale}
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    cursor="pointer"
                    onmouseover={() => {
                      hoveredConnection = {
                        line: conn.line,
                        fromName: fromStation.name,
                        toName: toStation.name,
                        count
                      };
                    }}
                    onmouseout={() => hoveredConnection = null}
                  />
                {/if}
              {/if}
            {/if}
          {/each}
        </g>

        <!-- ==================== UNROUTED FLIGHT LINES (YELLOW DASHED) ==================== -->
        <g class="network-fallback-lines">
          {#each travelFootprint.unroutedPaths as path}
            {@const fromStation = stations[path.from]}
            {@const toStation = stations[path.to]}
            {#if fromStation && toStation}
              <path
                d="M {fromStation.x} {fromStation.y} Q {(fromStation.x + toStation.x) / 2} {Math.min(fromStation.y, toStation.y) - 40} {toStation.x} {toStation.y}"
                fill="none"
                stroke="#eab308"
                stroke-width={2.2 / zoomScale}
                stroke-dasharray="{5 / zoomScale}, {5 / zoomScale}"
                opacity="0.6"
              />
            {/if}
          {/each}
        </g>

        <!-- ==================== STATION NODES (CIRCLES & INTERCHANGES) ==================== -->
        <g class="network-nodes">
          {#each Object.entries(stations) as [key, station]}
            {@const count = travelFootprint.activeStations[key] || 0}
            {@const isTraveled = count > 0}
            {@const isInterchange = station.modes.length > 1}
            {@const showDot = isTraveled || (zoomScale > 1.2 && (mapFilterMode === 'all' || station.modes.includes(mapFilterMode)))}

            {#if showDot}
              {#if isTraveled}
                <!-- Traveled Halo Pulsing Effect -->
                <circle
                  cx={station.x}
                  cy={station.y}
                  r={(12 + Math.min(count * 1.5, 8)) / zoomScale}
                  fill="none"
                  stroke="var(--color-oyster-blue)"
                  stroke-width={1.6 / zoomScale}
                  opacity="0.35"
                />
              {/if}

              <!-- Core Node Circle -->
              <!-- svelte-ignore a11y_mouse_events_have_key_events -->
              <circle
                cx={station.x}
                cy={station.y}
                r={((isInterchange ? 4.2 : 2.5) + (isTraveled ? 1.0 : 0)) / zoomScale}
                fill={isTraveled ? "#ffffff" : "#1e293b"}
                stroke={isTraveled ? "var(--color-oyster-blue)" : (isInterchange ? "#f1f5f9" : "#64748b")}
                stroke-width={(isInterchange ? 1.5 : 1) / zoomScale}
                cursor="pointer"
                onmouseover={() => {
                  hoveredNode = {
                    ...station,
                    count: Math.round(count)
                  };
                }}
                onmouseout={() => hoveredNode = null}
              />
            {/if}
          {/each}
        </g>

        <!-- ==================== STATION LABELS ==================== -->
        <g class="network-labels" style="pointer-events: none; user-select: none;">
          {#each Object.entries(stations) as [key, station]}
            {@const count = travelFootprint.activeStations[key] || 0}
            {@const isTraveled = count >= 1}
            {@const isMajor = MAJOR_HUBS.has(key)}
            {@const showLabel = showAllLabels || (isTraveled && zoomScale > 0.8) || (isMajor && zoomScale > 0.7) || (zoomScale > 2.8)}

            {#if showLabel}
              <!-- Label Outline/Glow for Contrast -->
              <text
                x={station.x}
                y={station.y}
                dx={6 / zoomScale}
                dy={3.5 / zoomScale}
                font-size={9.5 / zoomScale}
                font-weight={isTraveled ? 'bold' : '500'}
                fill="#070a13"
                stroke="#070a13"
                stroke-width={3 / zoomScale}
                stroke-linejoin="round"
                opacity="0.9"
              >
                {station.name}
              </text>
              <!-- Primary Text -->
              <text
                x={station.x}
                y={station.y}
                dx={6 / zoomScale}
                dy={3.5 / zoomScale}
                font-size={9.5 / zoomScale}
                font-weight={isTraveled ? 'bold' : '500'}
                fill={isTraveled ? '#ffffff' : '#94a3b8'}
              >
                {station.name}
              </text>
            {/if}
          {/each}
        </g>
      </g>
    </svg>

    <!-- Floating Tooltip -->
    {#if hoveredNode}
      <div class="map-tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
        <div class="tooltip-header">
          <strong>{hoveredNode.name}</strong>
          <span class="zone-badge">Zone {hoveredNode.zone}</span>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-row">
            <span>Modes:</span>
            <span style="text-transform: capitalize; font-size: 0.7rem;">{hoveredNode.modes.join(', ')}</span>
          </div>
          <div class="tooltip-row">
            <span>Your Trips:</span>
            <strong style="color: var(--color-oyster-blue);">{hoveredNode.count}</strong>
          </div>
        </div>
      </div>
    {:else if hoveredConnection}
      <div class="map-tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
        <div class="tooltip-header">
          <strong>{hoveredConnection.line} Line</strong>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-row" style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">
            <span>{hoveredConnection.fromName} ➔ {hoveredConnection.toName}</span>
          </div>
          <div class="tooltip-row">
            <span>Trips Taken:</span>
            <strong style="color: var(--color-oyster-blue);">{hoveredConnection.count}</strong>
          </div>
        </div>
      </div>
    {/if}

    <!-- Zoom & Control HUD Overlay -->
    <div class="map-controls">
      <button class="control-btn" onclick={zoomIn} title="Zoom In">＋</button>
      <button class="control-btn" onclick={zoomOut} title="Zoom Out">－</button>
      <button class="control-btn reset" onclick={fitToActiveBounds} title="Fit Commute Bounds">🎯</button>
    </div>
  </div>

  <!-- Legend / Info footer -->
  <div class="map-legend">
    <div class="legend-item"><span class="legend-circle traveled"></span> Traveled Station</div>
    <div class="legend-item"><span class="legend-circle background"></span> Interchange Hub</div>
    <div class="legend-item"><span class="legend-line active"></span> Traveled Segment</div>
    <div class="legend-item"><span class="legend-line background"></span> Regular Rail Line</div>
    <div class="legend-note">💡 Use scroll wheel (desktop) or pinch (mobile) to zoom. Click and drag to pan. Highlighted tracks represent your commute.</div>
  </div>
</div>

<style>
  .journey-map-container {
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 700px;
    margin-bottom: 2rem;
  }

  .map-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .map-title-row h3 {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
  }

  .map-subtitle {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin: 0.25rem 0 0 0;
  }

  .map-filters {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-label {
    font-size: 0.775rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .tab-nav.compact {
    padding: 2px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
  }
  .tab-nav.compact .tab-btn {
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    border-radius: 6px;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Map Canvas area */
  .map-canvas {
    flex: 1;
    position: relative;
    background: #070a13;
    overflow: hidden;
    user-select: none;
  }

  /* Hover Tooltip styling */
  .map-tooltip {
    position: absolute;
    pointer-events: none;
    z-index: 100;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    padding: 0.75rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    min-width: 180px;
    transform: translate(0, 0);
  }

  .tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    padding-bottom: 0.375rem;
    margin-bottom: 0.375rem;
  }
  .tooltip-header strong {
    font-size: 0.85rem;
    color: #f1f5f9;
  }
  .zone-badge {
    font-size: 0.7rem;
    background: var(--color-oyster-blue-dark);
    color: white;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .tooltip-body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .tooltip-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  /* Zoom controls HUD overlay */
  .map-controls {
    position: absolute;
    bottom: 1.25rem;
    right: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    z-index: 10;
  }

  .control-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(17, 24, 39, 0.9);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
  }

  .control-btn:hover {
    background: var(--color-bg-glass-hover);
    border-color: var(--color-border-accent);
    color: var(--color-oyster-blue);
  }

  .control-btn.reset {
    font-size: 0.95rem;
  }

  /* Map Legend footer */
  .map-legend {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border);
    background: rgba(17, 24, 39, 0.4);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.5rem;
    font-size: 0.775rem;
    color: var(--color-text-secondary);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .legend-circle {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }

  .legend-circle.traveled {
    background: white;
    border: 2px solid var(--color-oyster-blue);
    box-shadow: 0 0 6px var(--color-oyster-blue);
  }

  .legend-circle.background {
    background: #1e293b;
    border: 2.5px solid #f1f5f9;
  }

  .legend-line {
    width: 20px;
    height: 4px;
    border-radius: 2px;
    display: inline-block;
  }

  .legend-line.active {
    background: #0098D4; /* Victoria light blue as an example */
    box-shadow: 0 0 4px var(--color-oyster-blue);
  }

  .legend-line.background {
    background: rgba(255, 255, 255, 0.15);
  }

  .legend-note {
    margin-left: auto;
    color: var(--color-text-muted);
    font-size: 0.725rem;
  }

  @media (max-width: 768px) {
    .journey-map-container {
      height: 500px;
    }
    .map-header {
      padding: 0.75rem 1rem;
      flex-direction: column;
      align-items: flex-start;
    }
    .map-filters {
      width: 100%;
      justify-content: space-between;
    }
    .legend-note {
      margin-left: 0;
      width: 100%;
    }
  }
</style>

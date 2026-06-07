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
  
  import MapLine from './map/MapLine.svelte';
  import MapStation from './map/MapStation.svelte';
  import MapLegend from './map/MapLegend.svelte';
  import ZoneBoundary from './map/ZoneBoundary.svelte';

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
  
  // Hovered tube line (for full line glow highlight)
  let hoveredLine = $state<string | null>(null);

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
    if (name.includes('bakerloo')) return '#B36305';
    if (name.includes('central')) return '#DC241F';
    if (name.includes('circle')) return '#FFD300';
    if (name.includes('district')) return '#007D32';
    if (name.includes('hammersmith')) return '#F3A9BB';
    if (name.includes('jubilee')) return '#A0A5A9';
    if (name.includes('metropolitan')) return '#9B0058';
    if (name.includes('northern')) return '#ffffff'; // white on dark background
    if (name.includes('piccadilly')) return '#003688';
    if (name.includes('victoria')) return '#0098D4';
    if (name.includes('waterloo')) return '#95CDBA';
    if (name.includes('elizabeth')) return '#6950A1';
    if (name.includes('dlr')) return '#00AFAD';
    if (
      name.includes('overground') || 
      name.includes('mildmay') || 
      name.includes('lioness') || 
      name.includes('suffragette') || 
      name.includes('weaver') || 
      name.includes('windrush') || 
      name.includes('liberty')
    ) {
      return '#EE7C0E';
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

  // Parallel offsets logic
  function getSegmentKey(from: string, to: string) {
    return from < to ? `${from}_${to}` : `${to}_${from}`;
  }

  const segmentGroups = $derived.by(() => {
    const groups: Record<string, string[]> = {};
    for (const conn of LINE_CONNECTIONS) {
      if (!shouldDisplaySegment(conn)) continue;
      const key = getSegmentKey(conn.from, conn.to);
      if (!groups[key]) groups[key] = [];
      if (!groups[key].includes(conn.line)) {
        groups[key].push(conn.line);
      }
    }
    for (const key in groups) {
      groups[key].sort();
    }
    return groups;
  });

  const spacing = 3.5;
  function getLineOffset(conn: NetworkConnection): number {
    const key = getSegmentKey(conn.from, conn.to);
    const group = segmentGroups[key];
    if (!group) return 0;
    const idx = group.indexOf(conn.line);
    if (idx === -1) return 0;
    return (idx - (group.length - 1) / 2) * spacing;
  }

  // Precompute set of stations served by each line
  const lineStations = $derived.by(() => {
    const mapping: Record<string, Set<string>> = {};
    for (const conn of LINE_CONNECTIONS) {
      const lineLower = conn.line.toLowerCase();
      if (!mapping[lineLower]) mapping[lineLower] = new Set();
      mapping[lineLower].add(conn.from);
      mapping[lineLower].add(conn.to);
    }
    return mapping;
  });

  function stationServesLine(stationKey: string, lineName: string): boolean {
    const lineLower = lineName.toLowerCase();
    return lineStations[lineLower]?.has(stationKey) || false;
  }

  // Precompute average track directions at each station for perpendicular tick markers
  const stationDirections = $derived.by(() => {
    const directions: Record<string, { x: number; y: number }> = {};
    
    for (const sKey in stations) {
      const station = stations[sKey];
      const conns = LINE_CONNECTIONS.filter(
        c => shouldDisplaySegment(c) && (c.from === sKey || c.to === sKey)
      );
      
      if (conns.length === 0) {
        directions[sKey] = { x: 1, y: 0 };
        continue;
      }
      
      let sumDx = 0;
      let sumDy = 0;
      let count = 0;
      
      for (const c of conns) {
        const otherKey = c.from === sKey ? c.to : c.from;
        const other = stations[otherKey];
        if (other) {
          const dx = other.x - station.x;
          const dy = other.y - station.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            // Normalize and force positive X hemisphere to avoid cancellation
            const factor = dx < 0 || (dx === 0 && dy < 0) ? -1 : 1;
            sumDx += (dx / len) * factor;
            sumDy += (dy / len) * factor;
            count++;
          }
        }
      }
      
      if (count > 0) {
        const avgDx = sumDx / count;
        const avgDy = sumDy / count;
        const len = Math.sqrt(avgDx * avgDx + avgDy * avgDy);
        directions[sKey] = len > 0 ? { x: avgDx / len, y: avgDy / len } : { x: 1, y: 0 };
      } else {
        directions[sKey] = { x: 1, y: 0 };
      }
    }
    return directions;
  });

  // Hover handlers
  function handleStationHover(hovered: boolean, station: NetworkStation) {
    if (hovered) {
      const count = travelFootprint.activeStations[station.key] || 0;
      hoveredNode = {
        ...station,
        x: stations[station.key]?.x || station.x,
        y: stations[station.key]?.y || station.y,
        count: Math.round(count)
      };
    } else {
      hoveredNode = null;
    }
  }

  function handleLineHover(hovered: boolean, conn: NetworkConnection) {
    if (hovered) {
      hoveredLine = conn.line;
      const key = getSegmentKey(conn.from, conn.to);
      const count = travelFootprint.activeSegments[key] || 0;
      hoveredConnection = {
        line: conn.line,
        fromName: stations[conn.from]?.name || conn.from,
        toName: stations[conn.to]?.name || conn.to,
        count
      };
    } else {
      hoveredLine = null;
      hoveredConnection = null;
    }
  }
</script>

<div class="journey-map-container glass-card">
  <div class="map-header">
    <div class="map-title-row">
      <h3>🗺️ Personalised Vector-Recreated Schematic Map</h3>
      <p class="map-subtitle">A pixel-perfect vector schematic of the London Tube & Rail network, highlighting your commute footprints.</p>
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
        
        <!-- ==================== ZONE BOUNDARY RINGS ==================== -->
        <ZoneBoundary {zoomScale} />

        <!-- ==================== RIVER THAMES ==================== -->
        <path
          d="M 191,440 
             L 300,440 
             L 400,450 
             L 460,410 
             L 490,410 
             L 510,365 
             L 545,365 
             L 565,355 
             L 580,390 
             L 610,390 
             L 625,360 
             L 645,420 
             L 655,420 
             L 670,320 
             L 710,320 
             L 750,365 
             L 950,365"
          fill="none"
          stroke="#1d4ed8"
          stroke-width={10 / zoomScale}
          opacity="0.22"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- ==================== BACKGROUND & ACTIVE LINES ==================== -->
        <g class="network-lines">
          {#each LINE_CONNECTIONS as conn}
            {#if shouldDisplaySegment(conn)}
              {@const fromStation = stations[conn.from]}
              {@const toStation = stations[conn.to]}
              {#if fromStation && toStation}
                {@const segKey = conn.from < conn.to ? `${conn.from}-${conn.to}` : `${conn.to}-${conn.from}`}
                {@const travelCount = travelFootprint.activeSegments[segKey] || 0}
                {@const isActive = travelCount > 0}
                {@const isDimmed = hoveredLine !== null && conn.line.toLowerCase() !== hoveredLine.toLowerCase()}
                {@const offset = getLineOffset(conn)}
                {@const color = getLineColor(conn.line)}
                
                <MapLine
                  {conn}
                  {fromStation}
                  {toStation}
                  {color}
                  {offset}
                  {zoomScale}
                  {isActive}
                  {travelCount}
                  {isDimmed}
                  onHover={(hovered) => handleLineHover(hovered, conn)}
                />
              {/if}
            {/if}
          {/each}
        </g>

        <!-- ==================== UNROUTED FLIGHT LINES ==================== -->
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

        <!-- ==================== STATION NODES & LABELS ==================== -->
        <g class="network-stations">
          {#each Object.entries(stations) as [key, station]}
            {@const count = travelFootprint.activeStations[key] || 0}
            {@const isTraveled = count > 0}
            {@const isMajor = MAJOR_HUBS.has(key)}
            {@const showDot = isTraveled || (zoomScale > 1.2 && (mapFilterMode === 'all' || station.modes.includes(mapFilterMode)))}
            {@const showLabel = showAllLabels || (isTraveled && zoomScale > 0.8) || (isMajor && zoomScale > 0.7) || (zoomScale > 2.8)}
            {@const isDimmed = hoveredLine !== null && !stationServesLine(key, hoveredLine)}

            {#if showDot}
              <MapStation
                {station}
                {zoomScale}
                {isTraveled}
                travelCount={Math.round(count)}
                {isDimmed}
                {showLabel}
                {isMajor}
                trackDirection={stationDirections[key]}
                onHover={(hovered) => handleStationHover(hovered, station)}
              />
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
  <MapLegend />
</div>

<style>
  .journey-map-container {
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 720px;
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
  }
</style>

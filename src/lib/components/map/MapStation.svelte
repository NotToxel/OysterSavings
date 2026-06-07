<script lang="ts">
  import type { NetworkStation } from '$lib/data/networkData';

  interface Props {
    station: NetworkStation;
    zoomScale: number;
    isTraveled: boolean;
    travelCount: number;
    isDimmed: boolean;
    showLabel: boolean;
    isMajor: boolean;
    trackDirection?: { x: number; y: number }; // unit direction vector of the line at this station
    onHover: (hovered: boolean, e: MouseEvent) => void;
  }

  let {
    station,
    zoomScale,
    isTraveled,
    travelCount,
    isDimmed,
    showLabel,
    isMajor,
    trackDirection = { x: 1, y: 0 },
    onHover
  }: Props = $props();

  const isInterchange = $derived(station.modes.length > 1);

  // Perpendicular vector for tick mark
  let tickCoords = $derived.by(() => {
    // trackDirection is unit vector (ux, uy)
    // perpendicular vector is (-uy, ux)
    const px = -trackDirection.y;
    const py = trackDirection.x;
    const tickLen = 5.0 / zoomScale;
    
    return {
      x1: station.x - px * tickLen,
      y1: station.y - py * tickLen,
      x2: station.x + px * tickLen,
      y2: station.y + py * tickLen
    };
  });

  // Decide label offset direction
  // For most stations, offset to the right. For some known key terminals on the right boundary, offset left.
  let labelOffset = $derived.by(() => {
    const key = station.key.toLowerCase();
    const isRightEdge = station.x > 800 || key.includes('upminster') || key.includes('shenfield') || key.includes('abbey wood');
    
    if (isRightEdge) {
      return {
        anchor: 'end',
        dx: -8 / zoomScale,
        dy: 3.5 / zoomScale
      };
    }
    return {
      anchor: 'start',
      dx: 8 / zoomScale,
      dy: 3.5 / zoomScale
    };
  });
</script>

<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<g 
  role="presentation"
  class="map-station-group"
  opacity={isDimmed ? 0.3 : 1.0}
  onmouseover={(e) => onHover(true, e)}
  onmouseout={(e) => onHover(false, e)}
>
  {#if isTraveled}
    <!-- Commute pulsing halo -->
    <circle
      cx={station.x}
      cy={station.y}
      r={(11 + Math.min(travelCount * 1.5, 7)) / zoomScale}
      fill="none"
      stroke="var(--color-oyster-blue)"
      stroke-width={1.6 / zoomScale}
      opacity="0.4"
      class="pulsing-halo"
    />
  {/if}

  {#if isInterchange}
    <!-- Interchange Node: White circle with dark stroke -->
    <circle
      cx={station.x}
      cy={station.y}
      r={(isTraveled ? 5.5 : 4.5) / zoomScale}
      fill="#ffffff"
      stroke={isTraveled ? "var(--color-oyster-blue)" : "#1e293b"}
      stroke-width={(isTraveled ? 2.2 : 1.8) / zoomScale}
      cursor="pointer"
      class="station-node interchange"
    />
  {:else}
    <!-- Regular Node: Perpendicular tick mark crossing the line -->
    <line
      x1={tickCoords.x1}
      y1={tickCoords.y1}
      x2={tickCoords.x2}
      y2={tickCoords.y2}
      stroke={isTraveled ? "#ffffff" : "#64748b"}
      stroke-width={(isTraveled ? 2.5 : 1.8) / zoomScale}
      cursor="pointer"
      class="station-node tick"
    />
  {/if}

  <!-- Transparent larger hover target circle -->
  <circle
    cx={station.x}
    cy={station.y}
    r={12 / zoomScale}
    fill="transparent"
    cursor="pointer"
  />

  {#if showLabel}
    <!-- Station Name Label -->
    <!-- Shadow outline for contrast -->
    <text
      x={station.x}
      y={station.y}
      dx={labelOffset.dx}
      dy={labelOffset.dy}
      text-anchor={labelOffset.anchor}
      font-size={9.0 / zoomScale}
      font-weight={isTraveled ? 'bold' : '500'}
      fill="#070a13"
      stroke="#070a13"
      stroke-width={3 / zoomScale}
      stroke-linejoin="round"
      opacity="0.95"
      class="station-label-outline"
    >
      {station.name}
    </text>
    <!-- Foreground text -->
    <text
      x={station.x}
      y={station.y}
      dx={labelOffset.dx}
      dy={labelOffset.dy}
      text-anchor={labelOffset.anchor}
      font-size={9.0 / zoomScale}
      font-weight={isTraveled ? 'bold' : '500'}
      fill={isTraveled ? '#ffffff' : '#94a3b8'}
      class="station-label-text"
    >
      {station.name}
    </text>
  {/if}
</g>

<style>
  .station-node {
    transition: transform 0.2s ease, stroke-width 0.2s ease;
  }
  .station-label-text, .station-label-outline {
    font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
    user-select: none;
    pointer-events: none;
    transition: fill 0.2s ease;
  }
  
  @keyframes pulse {
    0% {
      transform: scale(0.95) translate(0px, 0px);
      opacity: 0.2;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      transform: scale(1.05) translate(0px, 0px);
      opacity: 0.2;
    }
  }
</style>

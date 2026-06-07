<script lang="ts">
  import type { NetworkConnection } from '$lib/data/networkData';

  interface Props {
    conn: NetworkConnection;
    fromStation: { name: string; x: number; y: number };
    toStation: { name: string; x: number; y: number };
    color: string;
    offset: number; // offset distance
    zoomScale: number;
    isActive: boolean; // traveled segment
    travelCount: number;
    isDimmed: boolean;
    onHover: (hovered: boolean) => void;
  }

  let {
    conn,
    fromStation,
    toStation,
    color,
    offset,
    zoomScale,
    isActive,
    travelCount,
    isDimmed,
    onHover
  }: Props = $props();

  // Calculate coordinates with offset
  let coords = $derived.by(() => {
    const dx = toStation.x - fromStation.x;
    const dy = toStation.y - fromStation.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len === 0) {
      return { x1: fromStation.x, y1: fromStation.y, x2: toStation.x, y2: toStation.y };
    }
    
    // Perpendicular vector
    const px = -dy / len;
    const py = dx / len;
    
    return {
      x1: fromStation.x + px * offset,
      y1: fromStation.y + py * offset,
      x2: toStation.x + px * offset,
      y2: toStation.y + py * offset
    };
  });
</script>

<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<g 
  role="presentation"
  class="map-line-group"
  onmouseover={() => onHover(true)}
  onmouseout={() => onHover(false)}
>
  {#if isActive}
    <!-- Active commute glow background line -->
    <line
      x1={coords.x1}
      y1={coords.y1}
      x2={coords.x2}
      y2={coords.y2}
      stroke="var(--color-oyster-blue)"
      stroke-width={(5 + Math.min(travelCount * 0.4, 4)) / zoomScale}
      opacity="0.35"
      stroke-linecap="round"
      stroke-linejoin="round"
      style="filter: url(#glow);"
    />
  {/if}

  <!-- Core colored tube line -->
  <line
    x1={coords.x1}
    y1={coords.y1}
    x2={coords.x2}
    y2={coords.y2}
    stroke={color}
    stroke-width={(isActive ? (3.2 + Math.min(travelCount * 0.3, 3)) : 2.5) / zoomScale}
    opacity={isDimmed ? 0.15 : 1.0}
    stroke-linecap="round"
    stroke-linejoin="round"
    class="core-line"
  />

  <!-- Transparent hit target for hover ease -->
  <line
    x1={coords.x1}
    y1={coords.y1}
    x2={coords.x2}
    y2={coords.y2}
    stroke="transparent"
    stroke-width={12 / zoomScale}
    stroke-linecap="round"
    cursor="pointer"
  />
</g>

<style>
  .core-line {
    transition: stroke-width 0.2s ease, opacity 0.2s ease;
  }
</style>

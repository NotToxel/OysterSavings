<script lang="ts">
  interface Props {
    zoomScale: number;
  }

  let { zoomScale }: Props = $props();

  const centerX = 530;
  const centerY = 310;

  // Concentric zone ellipses with radii and label positions
  const zones = [
    { zone: 1, rx: 90, ry: 75, labelX: 530, labelY: 235 },
    { zone: 2, rx: 180, ry: 145, labelX: 530, labelY: 165 },
    { zone: 3, rx: 280, ry: 220, labelX: 530, labelY: 90 },
    { zone: 4, rx: 390, ry: 300, labelX: 530, labelY: 10 },
    { zone: 5, rx: 500, ry: 380, labelX: 530, labelY: -70 },
    { zone: 6, rx: 610, ry: 460, labelX: 530, labelY: -150 }
  ];
</script>

<g class="zone-boundaries" style="pointer-events: none; user-select: none;">
  {#each zones as z}
    <!-- Dashed boundary circle/ellipse -->
    <ellipse
      cx={centerX}
      cy={centerY}
      rx={z.rx}
      ry={z.ry}
      fill="none"
      stroke="rgba(255, 255, 255, 0.05)"
      stroke-width={1.2 / zoomScale}
      stroke-dasharray="{4 / zoomScale},{4 / zoomScale}"
    />
    
    <!-- Zone label marker -->
    <text
      x={z.labelX}
      y={z.labelY}
      text-anchor="middle"
      font-size={9.0 / zoomScale}
      fill="rgba(255, 255, 255, 0.2)"
      font-weight="bold"
      letter-spacing="1.5"
      class="zone-text"
    >
      ZONE {z.zone}
    </text>
  {/each}
</g>

<style>
  .zone-text {
    font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
  }
</style>

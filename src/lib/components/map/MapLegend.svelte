<script lang="ts">
  const lineDetails = [
    { name: 'Bakerloo', color: '#B36305' },
    { name: 'Central', color: '#DC241F' },
    { name: 'Circle', color: '#FFD300' },
    { name: 'District', color: '#007D32' },
    { name: 'Hammersmith & City', color: '#F3A9BB' },
    { name: 'Jubilee', color: '#A0A5A9' },
    { name: 'Metropolitan', color: '#9B0058' },
    { name: 'Northern', color: '#FFFFFF' }, // White for dark mode contrast
    { name: 'Piccadilly', color: '#003688' },
    { name: 'Victoria', color: '#0098D4' },
    { name: 'Waterloo & City', color: '#95CDBA' },
    { name: 'Elizabeth Line', color: '#6950A1' },
    { name: 'DLR', color: '#00AFAD' },
    { name: 'Overground', color: '#EE7C0E' }
  ];
</script>

<div class="map-legend-outer">
  <!-- Interactive details -->
  <div class="map-status-legend">
    <div class="legend-item">
      <span class="legend-circle traveled"></span> 
      <span class="legend-label">Commuted Station</span>
    </div>
    <div class="legend-item">
      <span class="legend-circle interchange"></span> 
      <span class="legend-label">Interchange Hub</span>
    </div>
    <div class="legend-item">
      <span class="legend-line active"></span> 
      <span class="legend-label">Commuted Segment</span>
    </div>
    <div class="legend-item">
      <span class="legend-line regular"></span> 
      <span class="legend-label">Regular Track</span>
    </div>
    <div class="legend-note">
      💡 Drag to pan. Scroll/pinch to zoom. Commutes highlight in cyan.
    </div>
  </div>

  <div class="divider"></div>

  <!-- Tube Lines color strip -->
  <div class="map-lines-legend">
    {#each lineDetails as line}
      <div class="line-badge-item">
        <span 
          class="color-stripe" 
          style="background-color: {line.color}; border: {line.name === 'Northern' ? '1px solid rgba(255,255,255,0.4)' : 'none'}"
        ></span>
        <span class="line-name">{line.name}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .map-legend-outer {
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--color-border);
    background: rgba(10, 15, 30, 0.4);
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    font-size: 0.775rem;
    color: var(--color-text-secondary);
  }

  .map-status-legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.5rem;
    width: 100%;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.05);
    width: 100%;
  }

  .map-lines-legend {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 0.5rem 1rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .legend-label {
    font-weight: 500;
  }

  .legend-circle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }

  .legend-circle.traveled {
    background: white;
    border: 2px solid var(--color-oyster-blue);
    box-shadow: 0 0 6px var(--color-oyster-blue);
  }

  .legend-circle.interchange {
    background: #ffffff;
    border: 1.5px solid #1e293b;
  }

  .legend-line {
    width: 18px;
    height: 4px;
    border-radius: 2px;
    display: inline-block;
  }

  .legend-line.active {
    background: var(--color-oyster-blue);
    box-shadow: 0 0 4px var(--color-oyster-blue);
  }

  .legend-line.regular {
    background: rgba(255, 255, 255, 0.15);
  }

  .legend-note {
    margin-left: auto;
    color: var(--color-text-muted);
    font-size: 0.725rem;
  }

  .line-badge-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .color-stripe {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .line-name {
    color: var(--color-text-muted);
    font-size: 0.725rem;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .legend-note {
      margin-left: 0;
      width: 100%;
      margin-top: 0.25rem;
    }
  }
</style>

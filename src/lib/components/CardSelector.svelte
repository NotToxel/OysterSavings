<script lang="ts">
  import { cards, activeCardId } from '$lib/stores/stores';

  let { onAddCard }: { onAddCard?: () => void } = $props();

  let showSelector = $derived($cards.length > 1);
  let showAddButton = $derived($cards.length >= 1 && $cards.length < 3);

  function selectCard(id: string) {
    $activeCardId = id;
  }
</script>

{#if showSelector || showAddButton}
  <div class="card-selector" class:multi={showSelector}>
    {#if showSelector}
      <div class="card-pills">
        {#each $cards as card}
          <button
            class="card-pill"
            class:active={$activeCardId === card.id}
            onclick={() => selectCard(card.id)}
            style="--card-accent: {card.color}"
          >
            <span class="card-dot" style="background: {card.color}"></span>
            <span class="card-pill-label">{card.name}</span>
          </button>
        {/each}
        <button
          class="card-pill combined-pill"
          class:active={$activeCardId === 'combined'}
          onclick={() => selectCard('combined')}
        >
          <span class="card-dot combined-dot"></span>
          <span class="card-pill-label">Combined</span>
        </button>
      </div>
    {/if}

    {#if showAddButton}
      <button
        class="add-card-btn"
        onclick={() => onAddCard?.()}
        title="Upload another CSV file"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Card
      </button>
    {/if}
  </div>
{/if}

<style>
  .card-selector {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .card-pills {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 4px;
    flex-wrap: wrap;
  }

  .card-pill {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.85rem;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.25s ease;
    white-space: nowrap;
  }

  .card-pill:hover:not(.active) {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.05);
  }

  .card-pill.active {
    color: white;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--card-accent, rgba(255, 255, 255, 0.15));
    box-shadow: 0 1px 8px rgba(0, 0, 0, 0.2);
  }

  .card-pill.combined-pill.active {
    background: linear-gradient(135deg, rgba(0, 159, 227, 0.15), rgba(111, 67, 144, 0.15));
    border-color: rgba(0, 159, 227, 0.3);
  }

  .card-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .combined-dot {
    background: linear-gradient(135deg, #009FE3, #6f4390) !important;
  }

  .card-pill-label {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }

  .add-card-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.85rem;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--color-text-muted);
    background: transparent;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: all 0.25s ease;
    white-space: nowrap;
  }

  .add-card-btn:hover {
    color: var(--color-oyster-blue);
    border-color: rgba(0, 159, 227, 0.3);
    background: rgba(0, 159, 227, 0.05);
  }

  @media (max-width: 768px) {
    .card-selector {
      flex-direction: column;
      align-items: stretch;
    }

    .card-pills {
      overflow-x: auto;
      flex-wrap: nowrap;
    }

    .card-pill-label {
      max-width: 120px;
    }
  }
</style>

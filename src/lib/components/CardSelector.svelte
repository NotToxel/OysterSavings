<script lang="ts">
  import { cards, activeCardId, isDemoMode, isSwitchingCard } from '$lib/stores/stores';

  let { onAddData }: { onAddData?: () => void } = $props();

  let showSelector = $derived($cards.length > 1);
  let showAddButton = $derived($cards.length >= 1);

  function selectCard(id: string) {
    if ($activeCardId === id) return;
    $isSwitchingCard = true;
    setTimeout(() => {
      $activeCardId = id;
      setTimeout(() => {
        $isSwitchingCard = false;
      }, 50);
    }, 50);
  }
</script>

{#if showSelector || showAddButton}
  <div class="card-selector flex flex-wrap items-center gap-2 mb-5" class:multi={showSelector}>
    {#if showSelector}
      <div class="card-pills flex flex-wrap items-center gap-1.5 bg-white/3 rounded-xl p-1 max-w-full">
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
        disabled={$isDemoMode}
        onclick={() => onAddData?.()}
        title={$isDemoMode ? "Cannot add data in Demo Mode. Exit Demo Mode to upload more data." : "Upload another CSV file"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Data
      </button>
    {/if}
  </div>
{/if}

<style>
  .card-selector {
    width: 100%;
  }

  .card-pills {
    box-sizing: border-box;
  }

  .card-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.25s ease;
    white-space: nowrap;
    max-width: 100%;
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
    white-space: nowrap;
  }

  .add-card-btn {
    display: inline-flex;
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

  .add-card-btn:hover:not(:disabled) {
    color: var(--color-oyster-blue);
    border-color: rgba(0, 159, 227, 0.3);
    background: rgba(0, 159, 227, 0.05);
  }

  .add-card-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: rgba(255, 255, 255, 0.05);
    color: var(--color-text-muted);
  }

  @media (max-width: 640px) {
    .card-selector {
      gap: 0.5rem;
    }
    .card-pills {
      width: 100%;
    }
    .card-pill {
      flex: 1 1 auto;
      justify-content: center;
      padding: 0.4rem 0.6rem;
      font-size: 0.75rem;
    }
    .add-card-btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>

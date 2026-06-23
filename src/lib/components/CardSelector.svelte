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
  <div class="card-selector flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-5 flex-wrap" class:multi={showSelector}>
    {#if showSelector}
      <div class="card-pills flex flex-row flex-nowrap md:flex-wrap overflow-x-auto md:overflow-x-visible gap-[4px] bg-white/3 rounded-xl p-[4px]">
        {#each $cards as card}
          <button
            class="card-pill"
            class:active={$activeCardId === card.id}
            onclick={() => selectCard(card.id)}
            style="--card-accent: {card.color}"
          >
            <span class="card-dot" style="background: {card.color}"></span>
            <span class="card-pill-label max-w-[120px] md:max-w-[180px] truncate">{card.name}</span>
          </button>
        {/each}
        <button
          class="card-pill combined-pill"
          class:active={$activeCardId === 'combined'}
          onclick={() => selectCard('combined')}
        >
          <span class="card-dot combined-dot"></span>
          <span class="card-pill-label max-w-[120px] md:max-w-[180px] truncate">Combined</span>
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
</style>

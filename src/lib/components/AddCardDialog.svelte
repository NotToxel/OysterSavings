<script lang="ts">
  import { parseCSV } from '$lib/engine/csvParser';
  import { filterJourneys, getFilterSummary } from '$lib/engine/journeyFilter';
  import { classifyAll } from '$lib/engine/journeyClassifier';
  import { calculateAllFares } from '$lib/engine/fareCalculator';
  import { calculateDailyCaps, calculateWeeklyCaps, getCapSummary } from '$lib/engine/capEngine';
  import { preFetchLiveFaresForJourneys } from '$lib/engine/tflApi';
  import { detectCommutePatterns } from '$lib/engine/recurrenceEngine';
  import { detectActiveDiscount } from '$lib/engine/savingsEngine';
  import { addCard, mergeIntoCard, cards } from '$lib/stores/stores';
  import { generateCardId, generateCardName, CARD_COLORS, MAX_CARDS } from '$lib/stores/cardTypes';
  import type { CardState } from '$lib/stores/cardTypes';
  import type { ParsedJourney } from '$lib/engine/csvParser';
  import type { ClassifiedJourney } from '$lib/engine/journeyClassifier';
  import type { FareType } from '$lib/data/fareData';

  let { open = $bindable(false) }: { open: boolean } = $props();

  // Dialog state
  type DialogStep = 'upload' | 'preview' | 'decide' | 'processing' | 'merged';
  let step = $state<DialogStep>('upload');
  let isDragOver = $state(false);

  // Parsed preview data
  let previewFileName = $state('');
  let previewJourneyCount = $state(0);
  let previewDateRange = $state('');
  let previewDiscount = $state<FareType>('none');
  let previewDiscountLabel = $state('');
  let previewFilteredCount = $state(0);
  let parsedJourneys = $state<ParsedJourney[]>([]);
  let classifiedPreview = $state<ClassifiedJourney[]>([]);

  // Processing state
  let progressText = $state('');
  let progressPercent = $state(0);

  // Merge state
  let selectedMergeCardId = $state('');
  let mergeResult = $state<{ newJourneys: number; duplicates: number } | null>(null);
  let addMode = $state<'merge' | 'new'>('merge');
  let showAllConflicts = $state(false);

  const discountLabels: Record<FareType, string> = {
    none: 'Standard adult fares',
    railcard: 'National Railcard detected',
    disabled: 'Disabled Persons Railcard detected',
    student: 'Student discount detected',
    jobcentre: 'Jobcentre Plus detected',
    zip_11_15: '11-15 Zip detected',
    zip_16_17: '16+ Zip detected',
  };

  function resetDialog() {
    step = 'upload';
    isDragOver = false;
    previewFileName = '';
    previewJourneyCount = 0;
    previewDateRange = '';
    previewDiscount = 'none';
    previewDiscountLabel = '';
    previewFilteredCount = 0;
    parsedJourneys = [];
    classifiedPreview = [];
    progressText = '';
    progressPercent = 0;
    selectedMergeCardId = '';
    mergeResult = null;
    addMode = 'merge';
    showAllConflicts = false;
  }

  function closeDialog() {
    open = false;
    resetDialog();
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleFile(input.files[0]);
    }
  }

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) return;

    previewFileName = file.name;
    step = 'preview';

    const content = await file.text();
    const parseResult = parseCSV(content);
    parsedJourneys = parseResult.journeys;

    const filtered = filterJourneys(parseResult.journeys);
    const classified = classifyAll(filtered.valid);
    classifiedPreview = classified;

    previewJourneyCount = filtered.valid.length;
    previewFilteredCount = filtered.excluded.length;

    // Date range
    if (classified.length > 0) {
      const dates = classified.map(j => j.raw.date.getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      const fmt = (d: Date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      };
      previewDateRange = `${fmt(minDate)} – ${fmt(maxDate)}`;
    }

    // Detect discount
    previewDiscount = detectActiveDiscount(classified);
    previewDiscountLabel = discountLabels[previewDiscount] || 'Standard adult fares';

    step = 'decide';
    if ($cards.length > 0) {
      selectedMergeCardId = $cards[0].id;
      // Pre-select addMode based on conflict detection
      const firstCardClash = detectMergeClash(classified, parseResult.journeys, $cards[0]);
      if (firstCardClash) {
        addMode = 'new';
      } else {
        addMode = 'merge';
      }
    } else {
      addMode = 'new';
    }
  }

  function hasEligibleJourneysForDiscount(classified: ClassifiedJourney[]): boolean {
    const baseFares = calculateAllFares(classified, 'railcard');
    for (const f of baseFares) {
      if (f.journey.isBus || f.journey.isCapHit || f.actualCharge <= 0 || f.expectedFare <= 0) continue;
      if (f.journey.origin && f.journey.destination && f.journey.origin === f.journey.destination) continue;
      if (f.actualCharge === 4.65) continue;
      const discountApplies = Math.abs((f.fareTypeFare ?? f.expectedFare) - f.expectedFare) >= 0.05;
      if (discountApplies) return true;
    }
    return false;
  }

  interface ClashResult {
    hasClash: boolean;
    type: 'overlap' | 'discount';
    reason: string;
    missingInTargetCount: number;
    missingInNewCount: number;
    overlapRange?: string;
    clashes: Array<{
      source: 'target' | 'new';
      label: string;
      journey: ParsedJourney;
    }>;
  }

  function detectMergeClash(
    newClassified: ClassifiedJourney[],
    newRaw: ParsedJourney[],
    targetCard: CardState
  ): ClashResult | null {
    // 1. Check for overlapping date range mismatch
    const newDates = newRaw.map(j => new Date(j.date).getTime());
    const targetDates = targetCard.rawJourneys.map(j => new Date(j.date).getTime());

    if (newDates.length > 0 && targetDates.length > 0) {
      const getStartOfDay = (time: number) => {
        const d = new Date(time);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      };

      const newMinDay = getStartOfDay(Math.min(...newDates));
      const newMaxDay = getStartOfDay(Math.max(...newDates));
      const targetMinDay = getStartOfDay(Math.min(...targetDates));
      const targetMaxDay = getStartOfDay(Math.max(...targetDates));

      const overlapStartDay = Math.max(newMinDay, targetMinDay);
      const overlapEndDay = Math.min(newMaxDay, targetMaxDay);

      if (overlapStartDay <= overlapEndDay) {
        const overlapStart = overlapStartDay;
        const overlapEnd = overlapEndDay + 24 * 60 * 60 * 1000 - 1;

        const keyOf = (j: ParsedJourney) => `${j.dateStr}|${j.startTime}|${j.journeyAction}|${j.charge}`;

        const targetOverlapMap = new Map<string, ParsedJourney>();
        targetCard.rawJourneys.forEach(j => {
          const t = new Date(j.date).getTime();
          if (t >= overlapStart && t <= overlapEnd) {
            targetOverlapMap.set(keyOf(j), j);
          }
        });

        const newOverlapMap = new Map<string, ParsedJourney>();
        newRaw.forEach(j => {
          const t = new Date(j.date).getTime();
          if (t >= overlapStart && t <= overlapEnd) {
            newOverlapMap.set(keyOf(j), j);
          }
        });

        const missingInNew: ParsedJourney[] = [];
        for (const [key, j] of targetOverlapMap.entries()) {
          if (!newOverlapMap.has(key)) {
            missingInNew.push(j);
          }
        }

        const missingInTarget: ParsedJourney[] = [];
        for (const [key, j] of newOverlapMap.entries()) {
          if (!targetOverlapMap.has(key)) {
            missingInTarget.push(j);
          }
        }

        const isMismatch = missingInNew.length > 0 || missingInTarget.length > 0;

        if (isMismatch) {
          const sortedClashes = [
            ...missingInNew.map(j => ({ source: 'target' as const, label: `Only on ${targetCard.name}`, journey: j })),
            ...missingInTarget.map(j => ({ source: 'new' as const, label: 'Only in Upload', journey: j }))
          ].sort((a, b) => {
            const timeA = new Date(a.journey.date).getTime();
            const timeB = new Date(b.journey.date).getTime();
            if (timeA !== timeB) return timeA - timeB;
            return (a.journey.startTime || '').localeCompare(b.journey.startTime || '');
          });

          const formatDate = (time: number) => {
            const d = new Date(time);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
          };
          const overlapRangeText = `${formatDate(overlapStartDay)} – ${formatDate(overlapEndDay)}`;

          return {
            hasClash: true,
            type: 'overlap',
            reason: 'Overlapping travel period contains different journeys. A single card would have identical journeys on the same days.',
            missingInTargetCount: missingInTarget.length,
            missingInNewCount: missingInNew.length,
            overlapRange: overlapRangeText,
            clashes: sortedClashes
          };
        }
      }
    }

    // 2. Check for discount mismatch (only if both have eligible journeys)
    const targetDiscount = targetCard.detectedDiscount;
    const newDiscount = detectActiveDiscount(newClassified);

    if (targetDiscount !== newDiscount) {
      const newHasEligible = hasEligibleJourneysForDiscount(newClassified);
      const targetHasEligible = hasEligibleJourneysForDiscount(targetCard.classifiedJourneys);

      if (newHasEligible && targetHasEligible) {
        const discountLabels: Record<string, string> = {
          none: 'Standard Adult',
          railcard: 'National Railcard',
          disabled: 'Disabled Persons Railcard',
          student: 'Student Discount',
          jobcentre: 'Jobcentre Plus',
          zip_11_15: '11-15 Zip',
          zip_16_17: '16+ Zip',
        };
        const label1 = discountLabels[targetDiscount] || targetDiscount;
        const label2 = discountLabels[newDiscount] || newDiscount;
        return {
          hasClash: true,
          type: 'discount',
          reason: `Mismatched card discount types. Target card has '${label1}' discount, but uploaded file has '${label2}'.`,
          missingInTargetCount: 0,
          missingInNewCount: 0,
          clashes: []
        };
      }
    }

    return null;
  }

  let mergeClash = $derived.by<ClashResult | null>(() => {
    if (step !== 'decide' || !selectedMergeCardId) return null;
    const targetCard = $cards.find(c => c.id === selectedMergeCardId);
    if (!targetCard) return null;
    return detectMergeClash(classifiedPreview, parsedJourneys, targetCard);
  });

  function handleSameCard() {
    if (!selectedMergeCardId) return;
    const dupes = mergeIntoCard(selectedMergeCardId, parsedJourneys);
    mergeResult = {
      newJourneys: parsedJourneys.length - dupes,
      duplicates: dupes,
    };
    step = 'merged';
  }

  async function handleDifferentCard() {
    step = 'processing';
    progressText = 'Establishing connection to TfL API...';
    progressPercent = 10;

    try {
      await preFetchLiveFaresForJourneys(classifiedPreview, (current, total) => {
        progressText = `Fetching live TfL fares: route ${current} of ${total}...`;
        progressPercent = Math.round(10 + (current / total) * 70);
      });

      progressText = 'Calculating fares and caps...';
      progressPercent = 85;
      await new Promise(r => setTimeout(r, 100));

      const fares = calculateAllFares(classifiedPreview);
      const dailyCaps = calculateDailyCaps(fares);
      const weeklyCaps = calculateWeeklyCaps(dailyCaps);
      const capSummaryResult = getCapSummary(dailyCaps, weeklyCaps);
      const patterns = detectCommutePatterns(classifiedPreview);

      const filtered = filterJourneys(parsedJourneys);
      const cardIndex = $cards.length;
      const cardColor = CARD_COLORS[cardIndex % CARD_COLORS.length];

      const card: CardState = {
        id: generateCardId(),
        name: generateCardName(cardIndex, previewDiscount),
        color: cardColor,
        fileName: previewFileName,
        isDemoCard: false,
        rawJourneys: parsedJourneys,
        validJourneys: filtered.valid,
        excludedJourneys: filtered.excluded,
        classifiedJourneys: classifiedPreview,
        fareResults: fares,
        dailyCapResults: dailyCaps,
        weeklyCapResults: weeklyCaps,
        capSummary: capSummaryResult,
        detectedPatterns: patterns,
        parseErrors: [],
        selectedFareType: previewDiscount !== 'none' ? previewDiscount : 'none',
        fareTypeCost: 0,
        includeOysterCost: false,
        detectedDiscount: previewDiscount,
        duplicatesRemoved: 0,
      };

      addCard(card);
      progressText = 'Data added!';
      progressPercent = 100;

      setTimeout(() => closeDialog(), 600);
    } catch (err) {
      progressText = `Error: ${err}`;
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onclick={closeDialog} onkeydown={(e) => { if (e.key === 'Escape') closeDialog(); }}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dialog-card glass-card" class:wide-dialog={step === 'decide' && addMode === 'merge' && mergeClash} onclick={(e) => e.stopPropagation()}>
      <div class="dialog-header">
        <h3 class="dialog-title">
          {#if step === 'upload'}📂 Add Data / CSV
          {:else if step === 'decide'}📋 File Preview
          {:else if step === 'processing'}⚙️ Processing...
          {:else if step === 'merged'}✅ Merged Successfully
          {/if}
        </h3>
        <button class="dialog-close" onclick={closeDialog}>✕</button>
      </div>

      <div class="dialog-body">
        {#if step === 'upload' || step === 'preview'}
          <!-- Upload zone -->
          <div
            class="mini-upload-zone"
            class:dragover={isDragOver}
            role="button"
            tabindex="0"
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            onclick={() => document.getElementById('add-card-file-input')?.click()}
            onkeydown={(e) => { if (e.key === 'Enter') document.getElementById('add-card-file-input')?.click(); }}
          >
            <input
              type="file"
              id="add-card-file-input"
              accept=".csv"
              style="display: none;"
              onchange={handleFileInput}
            />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.5;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 0.5rem;">
              Drop CSV here or click to browse
            </p>
          </div>

        {:else if step === 'decide'}
          <!-- Preview panel -->
          <div class="preview-panel">
            <div class="preview-row">
              <span class="preview-label">File</span>
              <span class="preview-value">{previewFileName}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">Date Range</span>
              <span class="preview-value">{previewDateRange}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">Journeys</span>
              <span class="preview-value">{previewJourneyCount} valid, {previewFilteredCount} filtered</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">Discount</span>
              <span class="preview-value discount-badge">{previewDiscountLabel}</span>
            </div>
          </div>

          <!-- Decision section -->
          <div class="decision-section">
            <p class="decision-question">How would you like to add this data?</p>

            <div class="mode-selector">
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="mode-card"
                class:active={addMode === 'merge'}
                onclick={() => addMode = 'merge'}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') addMode = 'merge'; }}
                role="button"
                tabindex="0"
              >
                <div class="mode-card-icon">📄</div>
                <div class="mode-card-info">
                  <span class="mode-card-title">Extend Existing Card</span>
                  <span class="mode-card-desc">Merge travel history into a card you already added.</span>
                </div>
              </div>

              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="mode-card"
                class:active={addMode === 'new'}
                onclick={() => addMode = 'new'}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') addMode = 'new'; }}
                role="button"
                tabindex="0"
              >
                <div class="mode-card-icon">💳</div>
                <div class="mode-card-info">
                  <span class="mode-card-title">Add as New Card</span>
                  <span class="mode-card-desc">Keep this data separate as a new physical card.</span>
                </div>
              </div>
            </div>

            <div class="mode-content-panel">
              {#if addMode === 'merge'}
                <div class="merge-panel-config">
                  <span class="config-label">Select Card to Merge Into</span>
                  {#if $cards.length > 1}
                    <select class="merge-select" bind:value={selectedMergeCardId}>
                      {#each $cards as card}
                        <option value={card.id}>{card.name}</option>
                      {/each}
                    </select>
                  {:else if $cards.length === 1}
                    <span class="merge-target">Merging into: <strong>{$cards[0].name}</strong></span>
                  {/if}

                  {#if mergeClash}
                    <div class="clash-warning-box">
                      <div class="clash-warning-header">
                        <span class="clash-warning-icon">⚠️</span>
                        <span class="clash-warning-title">Potential Card Conflict</span>
                      </div>
                      <div class="clash-warning-content">
                        <p class="clash-warning-text">{mergeClash.reason}</p>

                        {#if mergeClash.type === 'overlap'}
                          {#if mergeClash.overlapRange}
                            <p class="clash-warning-text clash-overlap-range">
                              <strong>Date Overlap:</strong> {mergeClash.overlapRange}
                            </p>
                          {/if}

                          <div class="clash-stats-grid">
                            <div class="clash-stat-card target-missing">
                              <span class="clash-stat-label">Missing on {$cards.find(c => c.id === selectedMergeCardId)?.name || 'Card'}</span>
                              <span class="clash-stat-val">{mergeClash.missingInTargetCount} journeys</span>
                            </div>
                            <div class="clash-stat-card upload-missing">
                              <span class="clash-stat-label">Missing in Upload</span>
                              <span class="clash-stat-val">{mergeClash.missingInNewCount} journeys</span>
                            </div>
                          </div>

                          {#if mergeClash.clashes.length > 0}
                            <div class="clash-list-container">
                              <span class="clash-list-title">Mismatched Journeys:</span>
                              <div class="clash-list">
                                {#each (showAllConflicts ? mergeClash.clashes : mergeClash.clashes.slice(0, 5)) as clash}
                                  <div class="clash-item {clash.source}">
                                    <div class="clash-item-row-1">
                                      <span class="clash-source-tag">{clash.label}</span>
                                      <span class="clash-amount">£{clash.journey.charge.toFixed(2)}</span>
                                    </div>
                                    <div class="clash-item-row-2">
                                      <span class="clash-time">
                                        {clash.journey.dateStr} {clash.journey.startTime}
                                      </span>
                                      <span class="clash-item-bullet">•</span>
                                      <span class="clash-item-desc">
                                        {clash.journey.journeyAction}
                                      </span>
                                    </div>
                                  </div>
                                {/each}
                                {#if mergeClash.clashes.length > 5}
                                  {#if !showAllConflicts}
                                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <div class="clash-more clickable" onclick={() => showAllConflicts = true} role="button" tabindex="0">
                                      ...and {mergeClash.clashes.length - 5} more conflicts (click to expand)
                                    </div>
                                  {:else}
                                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <div class="clash-more clickable" onclick={() => showAllConflicts = false} role="button" tabindex="0">
                                      Show less conflicts
                                    </div>
                                  {/if}
                                {/if}
                              </div>
                            </div>
                          {/if}
                        {/if}
                      </div>
                    </div>
                  {/if}
                </div>

                <button class="decision-btn same-card primary-action" onclick={handleSameCard}>
                  📄 Confirm & Merge Data
                </button>
              {:else}
                {#if $cards.length < MAX_CARDS}
                  <button class="decision-btn different-card primary-action" onclick={handleDifferentCard}>
                    💳 Confirm & Add as New Card
                  </button>
                {:else}
                  <button class="decision-btn different-card primary-action" disabled title="Maximum {MAX_CARDS} cards reached">
                    💳 Add as New Card (Max {MAX_CARDS} reached)
                  </button>
                {/if}
              {/if}
            </div>
          </div>

        {:else if step === 'processing'}
          <div class="processing-panel">
            <div class="spinner"></div>
            <p class="progress-text">{progressText}</p>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: {progressPercent}%"></div>
            </div>
            <span class="progress-percent">{progressPercent}%</span>
          </div>

        {:else if step === 'merged'}
          <div class="merge-result-panel">
            <div class="merge-icon">✅</div>
            <p class="merge-summary">
              Merged <strong>{mergeResult?.newJourneys ?? 0}</strong> new journeys.
            </p>
            {#if mergeResult && mergeResult.duplicates > 0}
              <p class="merge-dedup">
                Removed <strong>{mergeResult.duplicates}</strong> duplicate entries
                <span class="dedup-detail">(same date, time, action, and charge)</span>
              </p>
            {/if}
            <button class="btn-dismiss" onclick={closeDialog}>Done</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .dialog-card {
    width: 480px;
    max-width: 90vw;
    max-height: 85vh;
    overflow-y: auto;
    padding: 0;
    animation: slideUp 0.3s ease;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .dialog-card.wide-dialog {
    width: 580px;
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .dialog-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .dialog-close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem;
    transition: color 0.2s;
  }

  .dialog-close:hover {
    color: var(--color-text-primary);
  }

  .dialog-body {
    padding: 1.5rem;
  }

  /* Mini upload zone */
  .mini-upload-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    border: 2px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: center;
  }

  .mini-upload-zone:hover,
  .mini-upload-zone.dragover {
    border-color: var(--color-oyster-blue);
    background: rgba(0, 159, 227, 0.05);
  }

  /* Preview panel */
  .preview-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    margin-bottom: 1.25rem;
  }

  .preview-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .preview-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .preview-value {
    font-size: 0.85rem;
    color: var(--color-text-primary);
    text-align: right;
  }

  .discount-badge {
    color: #34d399;
    font-weight: 500;
  }

  /* Decision section */
  .decision-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .decision-question {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-primary);
    text-align: center;
  }

  .decision-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .decision-option {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .decision-btn {
    width: 100%;
    padding: 0.85rem 1rem;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: var(--color-text-primary);
  }

  .decision-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .decision-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .decision-btn.same-card:hover:not(:disabled) {
    border-color: rgba(0, 159, 227, 0.3);
    background: rgba(0, 159, 227, 0.08);
  }

  .decision-btn.different-card:hover:not(:disabled) {
    border-color: rgba(231, 113, 13, 0.3);
    background: rgba(231, 113, 13, 0.08);
  }

  .merge-select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    font-size: 0.82rem;
  }

  .merge-target {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    padding-left: 0.25rem;
  }

  /* Processing panel */
  .processing-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem 0;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-oyster-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .progress-text {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .progress-bar-container {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-oyster-blue), #6f4390);
    border-radius: 9999px;
    transition: width 0.2s ease-out;
  }

  .progress-percent {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-family: monospace;
  }

  /* Merge result */
  .merge-result-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem 0;
    text-align: center;
  }

  .merge-icon {
    font-size: 2rem;
  }

  .merge-summary {
    font-size: 1rem;
    color: var(--color-text-primary);
  }

  .merge-dedup {
    font-size: 0.85rem;
    color: #34d399;
  }

  .dedup-detail {
    display: block;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-top: 0.25rem;
  }

  .btn-dismiss {
    margin-top: 0.5rem;
    padding: 0.5rem 2rem;
    border-radius: 8px;
    background: var(--color-oyster-blue);
    color: white;
    border: none;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-dismiss:hover {
    background: #0078ab;
  }

  /* Overhauled Clash warnings styles */
  .clash-warning-box {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 10px;
    background: rgba(245, 158, 11, 0.04);
    border: 1px solid rgba(245, 158, 11, 0.2);
    margin-top: 0.75rem;
    animation: fadeIn 0.2s ease;
    text-align: left;
  }

  .clash-warning-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .clash-warning-icon {
    font-size: 1.1rem;
    line-height: 1.2;
    flex-shrink: 0;
  }

  .clash-warning-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #f59e0b;
  }

  .clash-warning-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .clash-warning-text {
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    line-height: 1.35;
    margin: 0;
  }

  .clash-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .clash-stat-card {
    display: flex;
    flex-direction: column;
    padding: 0.6rem;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    border-top: 2px solid transparent;
  }

  .clash-stat-card.target-missing {
    border-top-color: var(--color-oyster-blue);
  }

  .clash-stat-card.upload-missing {
    border-top-color: var(--color-overground-orange);
  }

  .clash-stat-label {
    font-size: 0.65rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .clash-stat-val {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-top: 0.15rem;
  }

  .clash-list-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .clash-list-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .clash-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 160px;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    padding: 0.4rem;
  }

  .clash-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0.6rem;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.02);
    border-left: 3px solid transparent;
  }

  .clash-item.target {
    border-left-color: var(--color-oyster-blue);
  }

  .clash-item.new {
    border-left-color: var(--color-overground-orange);
  }

  .clash-item-row-1 {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .clash-item-row-2 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    color: var(--color-text-secondary);
  }

  .clash-item-bullet {
    color: var(--color-text-muted);
    font-weight: bold;
  }

  .clash-item-desc {
    color: var(--color-text-primary);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .clash-source-tag {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.15rem 0.35rem;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
  }

  .clash-item.target .clash-source-tag {
    color: var(--color-oyster-blue-light);
    background: rgba(0, 159, 227, 0.1);
  }

  .clash-item.new .clash-source-tag {
    color: var(--color-overground-orange);
    background: rgba(231, 113, 13, 0.15);
  }

  .clash-time {
    color: var(--color-text-muted);
    font-family: monospace;
    white-space: nowrap;
  }

  .clash-amount {
    color: var(--color-text-primary);
    font-weight: 600;
    font-family: monospace;
  }

  .clash-more {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    text-align: center;
    padding: 0.25rem 0;
    font-style: italic;
  }

  /* Mode selector elements */
  .mode-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .mode-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.85rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--color-border);
    cursor: pointer;
    transition: all 0.25s ease;
    text-align: left;
  }

  .mode-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .mode-card.active {
    background: rgba(0, 159, 227, 0.05);
    border-color: var(--color-oyster-blue);
    box-shadow: 0 0 15px rgba(0, 159, 227, 0.1);
  }

  .mode-card-icon {
    font-size: 1.3rem;
  }

  .mode-card-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .mode-card-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .mode-card-desc {
    font-size: 0.68rem;
    color: var(--color-text-secondary);
    line-height: 1.3;
  }

  .mode-content-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .merge-panel-config {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: left;
  }

  .config-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .decision-btn.primary-action {
    margin-top: 0.5rem;
  }

  .clash-overlap-range {
    margin-top: 0.15rem;
    font-size: 0.76rem;
    color: var(--color-warning);
  }

  .clash-more.clickable {
    cursor: pointer;
    text-decoration: underline;
    transition: color 0.2s;
  }

  .clash-more.clickable:hover {
    color: var(--color-text-primary);
  }
</style>

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
  let hasError = $state(false);

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
    hasError = false;
    selectedMergeCardId = '';
    mergeResult = null;
    addMode = 'merge';
    showAllConflicts = false;
  }

  function closeDialog() {
    if (step === 'processing' && !hasError) {
      open = false;
      return;
    }
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
      if ($cards.length >= MAX_CARDS) {
        addMode = 'merge';
      } else {
        // Pre-select addMode based on conflict detection
        const firstCardClash = detectMergeClash(classified, parseResult.journeys, $cards[0]);
        if (firstCardClash) {
          addMode = 'new';
        } else {
          addMode = 'merge';
        }
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
      const dailyCaps = calculateDailyCaps(fares, previewDiscount);
      const weeklyCaps = calculateWeeklyCaps(dailyCaps, previewDiscount);
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

      setTimeout(() => {
        open = false;
        resetDialog();
      }, 600);
    } catch (err) {
      progressText = `Error: ${err}`;
      hasError = true;
      if (!open) {
        resetDialog();
      }
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeDialog(); }} onkeydown={(e) => { if (e.key === 'Escape') closeDialog(); }}>
    <div class="dialog-card glass-card" class:wide-dialog={step === 'decide' && addMode === 'merge' && mergeClash}>
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
              <button
                type="button"
                class="mode-card"
                class:active={addMode === 'merge'}
                onclick={() => addMode = 'merge'}
              >
                <div class="mode-card-icon">📄</div>
                <div class="mode-card-info">
                  <span class="mode-card-title">Extend Existing Card</span>
                  <span class="mode-card-desc">Merge travel history into a card you already added.</span>
                </div>
              </button>

              <button
                type="button"
                class="mode-card"
                class:active={addMode === 'new'}
                onclick={() => addMode = 'new'}
              >
                <div class="mode-card-icon">💳</div>
                <div class="mode-card-info">
                  <span class="mode-card-title">Add as New Card</span>
                  <span class="mode-card-desc">Keep this data separate as a new physical card.</span>
                </div>
              </button>
            </div>

            <div class="mode-content-panel">
              {#if addMode === 'merge'}
                <div class="merge-panel-config">
                  <span class="config-label">Select Card to Merge Into</span>
                  {#if $cards.length > 0}
                    <div class="merge-cards-grid">
                      {#each $cards as card}
                        <button
                          type="button"
                          class="merge-card-option"
                          class:active={selectedMergeCardId === card.id}
                          onclick={() => selectedMergeCardId = card.id}
                          style="--card-theme-color: {card.color}"
                        >
                          <div class="card-option-header">
                            <span class="card-option-dot" style="background: {card.color}"></span>
                            <span class="card-option-title">{card.name}</span>
                          </div>
                          <div class="card-option-details">
                            <div class="card-option-stat">
                              <span class="stat-icon">📄</span>
                              <span><strong>{card.validJourneys?.length ?? 0}</strong> journeys</span>
                            </div>
                            <div class="card-option-badge">
                              <span class="badge-icon">🏷️</span>
                              <span>
                                {card.detectedDiscount === 'none' ? 'Adult/Contactless' :
                                 card.detectedDiscount === 'railcard' ? 'Railcard' :
                                 card.detectedDiscount === 'disabled' ? 'Disabled Persons' :
                                 card.detectedDiscount === 'student' ? 'Student' :
                                 card.detectedDiscount === 'jobcentre' ? 'Jobcentre Plus' :
                                 card.detectedDiscount === 'zip_11_15' ? '11-15 Zip' :
                                 card.detectedDiscount === 'zip_16_17' ? '16+ Zip' : 'Standard'}
                              </span>
                            </div>
                          </div>
                          <div class="card-option-footer" title={card.fileName}>
                            <span class="file-icon">📁</span>
                            <span class="file-name">{card.fileName}</span>
                          </div>
                        </button>
                      {/each}
                    </div>
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
                                    <button type="button" class="clash-more clickable" onclick={() => showAllConflicts = true}>
                                      ...and {mergeClash.clashes.length - 5} more conflicts (click to expand)
                                    </button>
                                  {:else}
                                    <button type="button" class="clash-more clickable" onclick={() => showAllConflicts = false}>
                                      Show less conflicts
                                    </button>
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
            <div class="oyster-scanner">
              <div class="oyster-card-silhouette">
                <div class="oyster-circle circle-1"></div>
                <div class="oyster-circle circle-2"></div>
                <div class="oyster-logo-mini">🦪</div>
                <div class="scan-laser"></div>
              </div>
            </div>
            
            <p class="progress-text" class:text-glow={!hasError} class:error-text={hasError}>{progressText}</p>
            
            {#if !hasError}
              <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: {progressPercent}%"></div>
              </div>
              <span class="progress-percent">{progressPercent}%</span>
            {:else}
              <button class="btn-secondary" onclick={closeDialog} style="margin-top: 0.5rem; padding: 0.5rem 1.25rem;">
                Dismiss
              </button>
            {/if}

            <div class="progress-phases">
              <!-- Phase 1 -->
              <div class="phase-item completed">
                <div class="phase-indicator">
                  <svg class="phase-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span class="phase-label">CSV Clean & Parse</span>
              </div>

              <!-- Phase 2 -->
              <div class="phase-item completed">
                <div class="phase-indicator">
                  <svg class="phase-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span class="phase-label">Route & Mode Classifier</span>
              </div>

              <!-- Phase 3 -->
              <div class="phase-item" class:completed={progressPercent > 80} class:active={progressPercent >= 10 && progressPercent <= 80} class:pending={progressPercent < 10}>
                <div class="phase-indicator">
                  {#if progressPercent > 80}
                    <svg class="phase-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  {:else}
                    <div class="phase-bullet"></div>
                  {/if}
                </div>
                <span class="phase-label">Fetch Live TfL Fares</span>
              </div>

              <!-- Phase 4 -->
              <div class="phase-item" class:completed={progressPercent === 100} class:active={progressPercent > 80 && progressPercent < 100} class:pending={progressPercent <= 80}>
                <div class="phase-indicator">
                  {#if progressPercent === 100}
                    <svg class="phase-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  {:else}
                    <div class="phase-bullet"></div>
                  {/if}
                </div>
                <span class="phase-label">Cap & Savings Analytics</span>
              </div>
            </div>
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
    width: 100%;
  }

  .text-glow {
    text-shadow: 0 0 10px rgba(0, 159, 227, 0.2);
    animation: pulse-text 1.5s ease-in-out infinite;
  }

  @keyframes pulse-text {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1; }
  }

  /* Oyster Scanning Animation */
  .oyster-scanner {
    position: relative;
    width: 180px;
    height: 110px;
    margin: 0 auto;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(0, 159, 227, 0.2) 0%, rgba(111, 67, 144, 0.1) 100%);
    border: 1.5px solid rgba(0, 159, 227, 0.35);
    box-shadow: 0 8px 32px rgba(0, 159, 227, 0.12), inset 0 0 20px rgba(0, 159, 227, 0.05);
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .oyster-card-silhouette {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .oyster-circle {
    position: absolute;
    border: 1px dashed rgba(255, 255, 255, 0.06);
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .circle-1 {
    width: 150px;
    height: 150px;
    animation: rotate-dashed-clockwise 25s linear infinite;
  }

  .circle-2 {
    width: 90px;
    height: 90px;
    animation: rotate-dashed-counter 18s linear infinite;
  }

  .oyster-logo-mini {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 2.25rem;
    filter: drop-shadow(0 0 8px rgba(0, 159, 227, 0.5));
    animation: pulse-logo 2s ease-in-out infinite;
  }

  .scan-laser {
    position: absolute;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--color-oyster-blue), transparent);
    box-shadow: 0 0 10px var(--color-oyster-blue), 0 0 3px var(--color-oyster-blue);
    animation: scan-vertical 2.2s ease-in-out infinite;
  }

  @keyframes scan-vertical {
    0% { top: 0%; }
    50% { top: 100%; }
    100% { top: 0%; }
  }

  @keyframes rotate-dashed-clockwise {
    from { transform: translate(-50%, -50%) rotate(0deg); }
    to { transform: translate(-50%, -50%) rotate(360deg); }
  }

  @keyframes rotate-dashed-counter {
    from { transform: translate(-50%, -50%) rotate(360deg); }
    to { transform: translate(-50%, -50%) rotate(0deg); }
  }

  @keyframes pulse-logo {
    0%, 100% { transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 0 8px rgba(0, 159, 227, 0.5)); }
    50% { transform: translate(-50%, -50%) scale(1.1); filter: drop-shadow(0 0 16px rgba(0, 159, 227, 0.8)); }
  }

  /* Multi-stage process phases list */
  .progress-phases {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    width: 100%;
    max-width: 280px;
    margin: 1.25rem auto 0 auto;
    text-align: left;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 0.875rem;
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .phase-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.3s ease;
  }

  .phase-indicator {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .phase-check {
    width: 14px;
    height: 14px;
    color: var(--color-success);
    filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.3));
    animation: check-scale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes check-scale {
    0% { transform: scale(0); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  .phase-bullet {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-text-muted);
    transition: all 0.3s ease;
  }

  .phase-item.active .phase-bullet {
    background: var(--color-oyster-blue);
    box-shadow: 0 0 8px var(--color-oyster-blue);
    animation: pulse-bullet 1.5s ease-in-out infinite;
    width: 8px;
    height: 8px;
  }

  .phase-item.pending {
    opacity: 0.35;
  }

  .phase-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
  }

  .phase-item.active .phase-label {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .phase-item.completed .phase-label {
    color: var(--color-success);
  }

  @keyframes pulse-bullet {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.25); opacity: 1; }
  }

  .progress-text {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .error-text {
    color: #f87171 !important;
    text-shadow: 0 0 10px rgba(248, 113, 113, 0.2);
    font-weight: 500;
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
    background: none;
    border: none;
    font-family: inherit;
    font-size: 0.68rem;
    color: var(--color-text-muted);
    text-align: center;
    padding: 0.25rem 0;
    font-style: italic;
    width: 100%;
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
    color: inherit;
    font-family: inherit;
    font-size: inherit;
    width: 100%;
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

  .merge-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
    margin-top: 0.25rem;
  }

  .merge-card-option {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.85rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    text-align: left;
    color: inherit;
    font-family: inherit;
    position: relative;
    overflow: hidden;
    outline: none;
  }

  .merge-card-option::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--card-theme-color, var(--color-oyster-blue));
    opacity: 0.4;
    transition: opacity 0.25s ease, width 0.25s ease;
  }

  .merge-card-option:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }

  .merge-card-option:hover::before {
    opacity: 0.8;
  }

  .merge-card-option.active {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--card-theme-color, var(--color-oyster-blue));
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25), 0 0 12px rgba(var(--card-theme-color), 0.15);
  }

  .merge-card-option.active::before {
    opacity: 1;
    width: 6px;
  }

  .card-option-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .card-option-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    box-shadow: 0 0 8px var(--card-theme-color);
  }

  .card-option-title {
    font-size: 0.825rem;
    font-weight: 700;
    color: white;
  }

  .card-option-details {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .card-option-stat, .card-option-badge {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    color: var(--color-text-secondary);
  }

  .card-option-stat strong {
    color: white;
  }

  .card-option-footer {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.65rem;
    color: var(--color-text-muted);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding-top: 0.4rem;
    margin-top: 0.15rem;
  }

  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
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

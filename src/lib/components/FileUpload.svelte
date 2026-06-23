<script lang="ts">
  import { parseCSV } from '$lib/engine/csvParser';
  import { filterJourneys, getFilterSummary } from '$lib/engine/journeyFilter';
  import { classifyAll } from '$lib/engine/journeyClassifier';
  import { calculateAllFares } from '$lib/engine/fareCalculator';
  import { calculateDailyCaps, calculateWeeklyCaps, getCapSummary } from '$lib/engine/capEngine';
  import { preFetchLiveFaresForJourneys } from '$lib/engine/tflApi';
  import { detectCommutePatterns } from '$lib/engine/recurrenceEngine';
  import { detectActiveDiscount } from '$lib/engine/savingsEngine';
  import {
    addCard, cards, currentPage, parseErrors as parseErrorsStore
  } from '$lib/stores/stores';
  import { generateCardId, generateCardName, CARD_COLORS, MAX_CARDS } from '$lib/stores/cardTypes';
  import type { CardState } from '$lib/stores/cardTypes';

  let isDragOver = $state(false);
  let isProcessing = $state(false);
  let filterSummary = $state<ReturnType<typeof getFilterSummary> | null>(null);
  let progressText = $state('Preparing...');
  let progressPercent = $state(0);
  let localParseErrors = $state<string[]>([]);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (isProcessing) return;
    isDragOver = true;
  }

  function handleDragLeave() {
    if (isProcessing) return;
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (isProcessing) return;
    isDragOver = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }

  function handleFileInput(e: Event) {
    if (isProcessing) return;
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      processFile(input.files[0]);
    }
  }

  async function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      localParseErrors = ['Please upload a CSV file'];
      return;
    }

    isProcessing = true;
    progressText = 'Reading CSV file...';
    progressPercent = 10;

    try {
      const content = await file.text();
      progressText = 'Analyzing file structure...';
      progressPercent = 20;
      await new Promise(resolve => setTimeout(resolve, 150));

      const parseResult = parseCSV(content);

      progressText = 'Filtering invalid and empty rows...';
      progressPercent = 35;
      await new Promise(resolve => setTimeout(resolve, 150));

      // Filter
      const filtered = filterJourneys(parseResult.journeys);
      filterSummary = getFilterSummary(filtered);

      progressText = 'Classifying routes, stations, and modes...';
      progressPercent = 50;
      await new Promise(resolve => setTimeout(resolve, 150));

      // Classify
      const classified = classifyAll(filtered.valid);

      progressText = 'Establishing connection to TfL API...';
      progressPercent = 60;
      await new Promise(resolve => setTimeout(resolve, 100));

      // Pre-fetch live fares
      await preFetchLiveFaresForJourneys(classified, (current, total) => {
        progressText = `Fetching live TfL fares: route ${current} of ${total}...`;
        progressPercent = Math.round(60 + (current / total) * 30);
      });

      progressText = 'Calculating fares and daily/weekly caps...';
      progressPercent = 92;
      await new Promise(resolve => setTimeout(resolve, 150));

      // Calculate fares
      const fares = calculateAllFares(classified);

      // Cap analysis
      const dailyCaps = calculateDailyCaps(fares);
      const weeklyCaps = calculateWeeklyCaps(dailyCaps);
      const capSummaryResult = getCapSummary(dailyCaps, weeklyCaps);

      progressText = 'Detecting recurring commute patterns...';
      progressPercent = 98;
      await new Promise(resolve => setTimeout(resolve, 100));

      // Detect commute patterns
      const patterns = detectCommutePatterns(classified);

      // Detect active discount on this card
      const discount = detectActiveDiscount(classified);

      // Determine card index based on existing cards
      const existingCards = $cards;
      const cardIndex = existingCards.length;
      const cardColor = CARD_COLORS[cardIndex % CARD_COLORS.length];

      // Build CardState
      const card: CardState = {
        id: generateCardId(),
        name: generateCardName(cardIndex, discount),
        color: cardColor,
        fileName: file.name,
        isDemoCard: false,
        rawJourneys: parseResult.journeys,
        validJourneys: filtered.valid,
        excludedJourneys: filtered.excluded,
        classifiedJourneys: classified,
        fareResults: fares,
        dailyCapResults: dailyCaps,
        weeklyCapResults: weeklyCaps,
        capSummary: capSummaryResult,
        detectedPatterns: patterns,
        parseErrors: parseResult.errors,
        selectedFareType: discount !== 'none' ? discount : 'none',
        fareTypeCost: 0,
        includeOysterCost: false,
        detectedDiscount: discount,
        duplicatesRemoved: 0,
      };

      addCard(card);

      progressText = 'Analysis complete!';
      progressPercent = 100;

      // Auto-navigate to analysis
      setTimeout(() => { $currentPage = 'analysis'; }, 600);
    } catch (err) {
      localParseErrors = [`Error processing file: ${err}`];
    } finally {
      isProcessing = false;
    }
  }
</script>

<div
  class="upload-zone"
  class:dragover={isDragOver}
  class:processing={isProcessing}
  role="button"
  tabindex="0"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  onclick={() => { if (!isProcessing) document.getElementById('file-input')?.click(); }}
  onkeydown={(e) => { if (e.key === 'Enter' && !isProcessing) document.getElementById('file-input')?.click(); }}
>
  <input
    type="file"
    id="file-input"
    accept=".csv, text/csv, application/csv, text/comma-separated-values, application/vnd.ms-excel"
    style="display: none;"
    onchange={handleFileInput}
  />

  {#if isProcessing}
    <div class="upload-processing">
      <div class="oyster-scanner">
        <div class="oyster-card-silhouette">
          <div class="oyster-circle circle-1"></div>
          <div class="oyster-circle circle-2"></div>
          <div class="oyster-logo-mini">🦪</div>
          <div class="scan-laser"></div>
        </div>
      </div>
      
      <p class="upload-text text-glow">{progressText}</p>
      
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: {progressPercent}%"></div>
      </div>
      <span class="progress-percent">{progressPercent}%</span>

      <div class="progress-phases">
        <!-- Phase 1 -->
        <div class="phase-item" class:completed={progressPercent > 35} class:active={progressPercent >= 10 && progressPercent <= 35} class:pending={progressPercent < 10}>
          <div class="phase-indicator">
            {#if progressPercent > 35}
              <svg class="phase-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            {:else}
              <div class="phase-bullet"></div>
            {/if}
          </div>
          <span class="phase-label">CSV Clean & Parse</span>
        </div>

        <!-- Phase 2 -->
        <div class="phase-item" class:completed={progressPercent > 50} class:active={progressPercent > 35 && progressPercent <= 50} class:pending={progressPercent <= 35}>
          <div class="phase-indicator">
            {#if progressPercent > 50}
              <svg class="phase-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            {:else}
              <div class="phase-bullet"></div>
            {/if}
          </div>
          <span class="phase-label">Route & Mode Classifier</span>
        </div>

        <!-- Phase 3 -->
        <div class="phase-item" class:completed={progressPercent > 90} class:active={progressPercent > 50 && progressPercent <= 90} class:pending={progressPercent <= 50}>
          <div class="phase-indicator">
            {#if progressPercent > 90}
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
        <div class="phase-item" class:completed={progressPercent === 100} class:active={progressPercent > 90 && progressPercent < 100} class:pending={progressPercent <= 90}>
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
  {:else}
    <div class="upload-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    </div>
    <p class="upload-text">
      <strong>Drop your TfL CSV file here</strong> or click to browse
    </p>
    <p class="upload-hint">
      Accepts standard TfL Oyster export files (.csv)
    </p>
  {/if}
</div>

{#if filterSummary}
  <div class="filter-summary animate-slide-up" style="margin-top: 1rem;">
    <div class="filter-header">
      <span class="filter-icon">✅</span>
      <span><strong>{filterSummary.validCount}</strong> journeys loaded, <strong>{filterSummary.excludedCount}</strong> rows filtered</span>
    </div>
    {#if filterSummary.excludedCount > 0}
      <div class="filter-details">
        {#each Object.entries(filterSummary.reasonCounts) as [reason, count]}
          {#if count > 0}
            <span class="filter-reason">
              {filterSummary.reasonLabels[reason as keyof typeof filterSummary.reasonLabels]}: {count}
            </span>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
{/if}

{#if localParseErrors.length > 0}
  <div class="error-box" style="margin-top: 1rem;">
    {#each localParseErrors as error}
      <p>⚠️ {error}</p>
    {/each}
  </div>
{/if}

<style>
  .upload-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--color-text-muted);
    margin-bottom: 1rem;
    transition: color 0.3s ease;
  }

  .upload-zone:hover .upload-icon {
    color: var(--color-oyster-blue);
  }

  .upload-text {
    font-size: 1rem;
    color: var(--color-text-secondary);
    margin-bottom: 0.5rem;
  }

  .upload-text strong {
    color: var(--color-text-primary);
  }

  .upload-hint {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .upload-zone.processing {
    pointer-events: none;
    cursor: not-allowed;
    border-color: rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.01);
  }

  .upload-processing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
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

  .filter-summary {
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: 12px;
    padding: 1rem 1.25rem;
  }

  .filter-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .filter-details {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .filter-reason {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.03);
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
  }

  .error-box {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 12px;
    padding: 1rem;
    font-size: 0.85rem;
    color: #f87171;
  }

  .progress-bar-container {
    width: 240px;
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    overflow: hidden;
    margin-top: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-oyster-blue), #6f4390);
    border-radius: 9999px;
    transition: width 0.2s ease-out;
  }

  .progress-percent {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-family: monospace;
  }
</style>

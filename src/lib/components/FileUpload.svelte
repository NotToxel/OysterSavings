<script lang="ts">
  import { parseCSV } from '$lib/engine/csvParser';
  import { filterJourneys, getFilterSummary } from '$lib/engine/journeyFilter';
  import { classifyAll } from '$lib/engine/journeyClassifier';
  import { calculateAllFares } from '$lib/engine/fareCalculator';
  import { calculateDailyCaps, calculateWeeklyCaps, getCapSummary } from '$lib/engine/capEngine';
  import { detectCommutePatterns } from '$lib/engine/recurrenceEngine';
  import {
    rawJourneys, validJourneys, excludedJourneys,
    classifiedJourneys, fareResults, fileName, fileLoaded,
    parseErrors, dailyCapResults, weeklyCapResults, capSummary,
    detectedPatterns, currentPage
  } from '$lib/stores/stores';

  let isDragOver = $state(false);
  let isProcessing = $state(false);
  let filterSummary = $state<ReturnType<typeof getFilterSummary> | null>(null);

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
      processFile(files[0]);
    }
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      processFile(input.files[0]);
    }
  }

  async function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      $parseErrors = ['Please upload a CSV file'];
      return;
    }

    isProcessing = true;
    $fileName = file.name;

    try {
      const content = await file.text();
      const parseResult = parseCSV(content);
      $rawJourneys = parseResult.journeys;
      $parseErrors = parseResult.errors;

      // Filter
      const filtered = filterJourneys(parseResult.journeys);
      $validJourneys = filtered.valid;
      $excludedJourneys = filtered.excluded;
      filterSummary = getFilterSummary(filtered);

      // Classify
      const classified = classifyAll(filtered.valid);
      $classifiedJourneys = classified;

      // Calculate fares
      const fares = calculateAllFares(classified);
      $fareResults = fares;

      // Cap analysis
      const dailyCaps = calculateDailyCaps(fares);
      $dailyCapResults = dailyCaps;
      const weeklyCaps = calculateWeeklyCaps(dailyCaps);
      $weeklyCapResults = weeklyCaps;
      $capSummary = getCapSummary(dailyCaps, weeklyCaps);

      // Detect commute patterns
      const patterns = detectCommutePatterns(classified);
      $detectedPatterns = patterns;

      $fileLoaded = true;

      // Auto-navigate to analysis
      setTimeout(() => { $currentPage = 'analysis'; }, 600);
    } catch (err) {
      $parseErrors = [`Error processing file: ${err}`];
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
  onclick={() => document.getElementById('file-input')?.click()}
  onkeydown={(e) => { if (e.key === 'Enter') document.getElementById('file-input')?.click(); }}
>
  <input
    type="file"
    id="file-input"
    accept=".csv"
    style="display: none;"
    onchange={handleFileInput}
  />

  {#if isProcessing}
    <div class="upload-processing">
      <div class="spinner"></div>
      <p class="upload-text">Processing your travel history...</p>
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

{#if $parseErrors.length > 0}
  <div class="error-box" style="margin-top: 1rem;">
    {#each $parseErrors as error}
      <p>⚠️ {error}</p>
    {/each}
  </div>
{/if}

<style>
  .upload-icon {
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

  .upload-processing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-oyster-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
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
</style>

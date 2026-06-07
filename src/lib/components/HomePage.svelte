<script lang="ts">
  import FileUpload from './FileUpload.svelte';
  import {
    fileLoaded, fileName, totalSpend, totalJourneys,
    classifiedJourneys, excludedJourneys, dailyCapResults,
    capSummary, currentPage
  } from '$lib/stores/stores';

  let showStats = $derived($fileLoaded);
  let journeyCount = $derived($totalJourneys);
  let spend = $derived($totalSpend);
  let excluded = $derived($excludedJourneys.length);
  let capDays = $derived($capSummary?.daysCapHit ?? 0);
  let totalCapSaved = $derived($capSummary?.totalSavedByDailyCap ?? 0);
</script>

<div class="home-page">
  {#if !$fileLoaded}
    <!-- Hero Section -->
    <section class="hero animate-fade-in">
      <div class="hero-badge">
        <span>🔒</span> Privacy-First TfL Analytics
      </div>
      <h1 class="hero-title">
        Unlock Your
        <span class="gradient-text">Oyster Savings</span>
      </h1>
      <p class="hero-subtitle">
        Upload your TfL travel history CSV and discover exactly how much you could save
        with Fare Types, Travelcards, and smarter travel planning.
      </p>

      <div class="hero-features">
        <div class="feature-pill">
          <span class="feature-icon">📊</span>
          <span>Fare Analysis</span>
        </div>
        <div class="feature-pill">
          <span class="feature-icon">💳</span>
          <span>Fare Type Savings</span>
        </div>
        <div class="feature-pill">
          <span class="feature-icon">📅</span>
          <span>Journey Planning</span>
        </div>
        <div class="feature-pill">
          <span class="feature-icon">⚖️</span>
          <span>Product Comparison</span>
        </div>
      </div>
    </section>

    <!-- Upload Section -->
    <section class="upload-section animate-slide-up" style="animation-delay: 0.2s">
      <FileUpload />
    </section>

    <!-- How it works -->
    <section class="how-it-works animate-slide-up" style="animation-delay: 0.4s">
      <h2 class="section-title">How It Works</h2>
      <div class="steps-grid">
        <div class="step-card">
          <div class="step-number">1</div>
          <h3>Export CSV</h3>
          <p>Download your journey history from <a href="https://tfl.gov.uk/fares/contactless-and-oyster-account" target="_blank" rel="noopener noreferrer">tfl.gov.uk</a></p>
        </div>
        <div class="step-card">
          <div class="step-number">2</div>
          <h3>Upload & Analyze</h3>
          <p>Drop your CSV here — all processing happens in your browser</p>
        </div>
        <div class="step-card">
          <div class="step-number">3</div>
          <h3>Discover Savings</h3>
          <p>See exactly how much Fare Types and Travelcards could save you</p>
        </div>
        <div class="step-card">
          <div class="step-number">4</div>
          <h3>Plan Ahead</h3>
          <p>Forecast future costs and find your optimal ticket combination</p>
        </div>
      </div>
    </section>
  {:else}
    <!-- Dashboard after upload -->
    <section class="dashboard animate-fade-in">
      <div class="dashboard-header">
        <div>
          <h1 class="dashboard-title">Dashboard</h1>
          <p class="dashboard-subtitle">Analyzing <strong>{$fileName}</strong></p>
        </div>
        <button class="btn-secondary" onclick={() => { import('$lib/stores/stores').then(m => m.resetData()) }}>
          ↻ New Upload
        </button>
      </div>

      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🚆</div>
          <div class="stat-value">{journeyCount}</div>
          <div class="stat-label">Valid Journeys</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💷</div>
          <div class="stat-value">£{spend.toFixed(2)}</div>
          <div class="stat-label">Total Spend</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🚫</div>
          <div class="stat-value">{excluded}</div>
          <div class="stat-label">Filtered Rows</div>
        </div>
        <div class="stat-card highlight-card">
          <div class="stat-icon">🎯</div>
          <div class="stat-value">{capDays}</div>
          <div class="stat-label">Cap Hit Days</div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="quick-actions">
        <button class="action-card" onclick={() => $currentPage = 'analysis'}>
          <div class="action-icon">📊</div>
          <div class="action-content">
            <h3>Journey Analysis</h3>
            <p>View detailed journey breakdown, fare analysis, and fare type savings</p>
          </div>
          <span class="action-arrow">→</span>
        </button>
        <button class="action-card" onclick={() => $currentPage = 'planner'}>
          <div class="action-icon">📅</div>
          <div class="action-content">
            <h3>Journey Planner</h3>
            <p>Plan future travel with recurring schedules and cap forecasting</p>
          </div>
          <span class="action-arrow">→</span>
        </button>
        <button class="action-card" onclick={() => $currentPage = 'compare'}>
          <div class="action-icon">⚖️</div>
          <div class="action-content">
            <h3>Product Comparison</h3>
            <p>Compare PAYG, Fare Types, and Travelcards across time periods</p>
          </div>
          <span class="action-arrow">→</span>
        </button>
      </div>
    </section>
  {/if}
</div>

<style>
  .home-page {
    max-width: 900px;
    margin: 0 auto;
  }

  /* Hero */
  .hero {
    text-align: center;
    padding: 2rem 0 1rem;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 1rem;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: 999px;
    font-size: 0.75rem;
    color: #34d399;
    font-weight: 500;
    margin-bottom: 1.5rem;
  }

  .hero-title {
    font-size: 3rem;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: -0.03em;
    margin-bottom: 1rem;
  }

  .gradient-text {
    background: linear-gradient(135deg, #009FE3 0%, #6950A1 50%, #EF7B10 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-subtitle {
    font-size: 1.1rem;
    color: var(--color-text-secondary);
    max-width: 600px;
    margin: 0 auto 2rem;
    line-height: 1.6;
  }

  .hero-features {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .feature-pill {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    transition: all 0.2s ease;
  }

  .feature-pill:hover {
    border-color: var(--color-border-accent);
    background: rgba(0, 159, 227, 0.05);
  }

  /* Upload section */
  .upload-section {
    margin: 2rem 0;
  }

  /* How it works */
  .how-it-works {
    margin-top: 3rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 700;
    text-align: center;
    margin-bottom: 1.5rem;
    color: var(--color-text-secondary);
  }

  .steps-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .step-card {
    text-align: center;
    padding: 1.5rem 1rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    transition: all 0.3s ease;
  }

  .step-card:hover {
    border-color: var(--color-border-accent);
    transform: translateY(-2px);
  }

  .step-number {
    width: 32px;
    height: 32px;
    margin: 0 auto 0.75rem;
    background: linear-gradient(135deg, #009FE3, #6950A1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .step-card h3 {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.375rem;
  }

  .step-card p {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  /* Dashboard */
  .dashboard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .dashboard-title {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .dashboard-subtitle {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    margin-top: 0.25rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card .stat-icon {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .stat-card .stat-value {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .stat-card .stat-label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-card.highlight-card {
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.05);
  }

  .stat-card.highlight-card .stat-value {
    color: #34d399;
  }

  /* Quick actions */
  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .action-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
    width: 100%;
    color: inherit;
  }

  .action-card:hover {
    border-color: var(--color-border-accent);
    background: rgba(0, 159, 227, 0.03);
    transform: translateX(4px);
  }

  .action-icon {
    font-size: 1.75rem;
    flex-shrink: 0;
  }

  .action-content {
    flex: 1;
  }

  .action-content h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .action-content p {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .action-arrow {
    font-size: 1.25rem;
    color: var(--color-text-muted);
    transition: transform 0.2s ease;
  }

  .action-card:hover .action-arrow {
    transform: translateX(4px);
    color: var(--color-oyster-blue);
  }

  @media (max-width: 768px) {
    .hero-title {
      font-size: 2rem;
    }

    .steps-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>

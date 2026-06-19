<script lang="ts">
  import FileUpload from "./FileUpload.svelte";
  import {
    fileLoaded,
    fileName,
    totalSpend,
    totalJourneys,
    classifiedJourneys,
    excludedJourneys,
    dailyCapResults,
    capSummary,
    currentPage,
    analysisPeriodText,
  } from "$lib/stores/stores";
  import { loadDemoData } from "$lib/data/demoDataGenerator";

  let showStats = $derived($fileLoaded);
  let journeyCount = $derived($totalJourneys);
  let spend = $derived($totalSpend);
  let excluded = $derived($excludedJourneys.length);
  let capDays = $derived($capSummary?.daysCapHit ?? 0);
  let totalCapSaved = $derived($capSummary?.totalSavedByDailyCap ?? 0);

  let showWalkthrough = $state(false);
  let showDemoProfiles = $state(false);
  let walkthroughStep = $state(1);

  function startAnalysis() {
    showWalkthrough = true;
    showDemoProfiles = false;
    walkthroughStep = 1;
  }

  function nextStep() {
    if (walkthroughStep < 6) {
      walkthroughStep += 1;
    }
  }

  function prevStep() {
    if (walkthroughStep > 1) {
      walkthroughStep -= 1;
    }
  }

  function resetWalkthrough() {
    showWalkthrough = false;
    showDemoProfiles = false;
    walkthroughStep = 1;
  }

  const demoProfiles = [
    {
      id: "sarah",
      name: "Sarah",
      avatar: "👩‍💼",
      badge: "Balanced Hybrid",
      zones: "Zone 1-3",
      description:
        "3-day Wimbledon ↔ Bank Tube/NR commute. Includes weekend leisure trips, hopper buses, and a penalty refund.",
      color: "var(--color-oyster-blue)",
    },
    {
      id: "james",
      name: "James",
      avatar: "👨‍💻",
      badge: "Tube Heavy",
      zones: "Zone 1-2",
      description:
        "5-day Finsbury Park ↔ Oxford Circus Tube commute. Includes mid-week Overground hops and a cap-hitting Saturday in central London.",
      color: "#009FE3",
    },
    {
      id: "chloe",
      name: "Chloe",
      avatar: "👩‍⚕️",
      badge: "National Rail Heavy",
      zones: "Zone 1-6",
      description:
        "4-day Surbiton ↔ Waterloo National Rail commute, connecting via local buses. Features Kingston local travel and weekend rail trips.",
      color: "#e7710d",
    },
    {
      id: "marcus",
      name: "Marcus",
      avatar: "👨‍🍳",
      badge: "Bus Heavy",
      zones: "Zone 2",
      description:
        "Wed-Sun Peckham Rye hospitality shift commute using exclusively buses. Regularly hits the daily bus cap (£5.25).",
      color: "#10b981",
    },
    {
      id: "amir",
      name: "Amir",
      avatar: "👨‍💼",
      badge: "Hybrid Mixed",
      zones: "Zone 1-4",
      description:
        "2-day Richmond ↔ Bank mixed National Rail + Tube hybrid schedule. Showcases mixed fare calculation and off-peak travel.",
      color: "#6f4390",
    },
    {
      id: "alex",
      name: "Alex",
      avatar: "🧑‍💼",
      badge: "Multi-Card",
      zones: "Zone 1",
      description:
        "Uses both an Oyster (with Railcard) for commuting and Contactless for spontaneous trips. Demonstrates multi-card analysis and consolidation insights.",
      color: "#34d399",
    },
  ];
</script>

<div class="home-page">
  {#if !$fileLoaded}
    {#if showDemoProfiles}
      <!-- Dedicated Demo Profiles Section -->
      <section class="demo-profiles-section animate-slide-up">
        <div class="walkthrough-card glass-card">
          <!-- Back & Progress Header -->
          <div class="walkthrough-header">
            <button class="btn-back" onclick={resetWalkthrough}>
              ← Back to Start
            </button>
            <div class="step-indicator-wrapper">
              <span class="step-indicator" style="font-weight: 600; color: var(--color-oyster-blue)">
                ✨ Demo Profiles
              </span>
            </div>
          </div>

          <!-- Step Content -->
          <div class="step-content-container">
            <div class="demo-profiles-container" style="padding: 1.5rem 0;">
              <h2 class="demo-section-title">✨ Try OysterSavings Demo Profiles</h2>
              <p class="demo-section-subtitle">
                Don't have a TfL CSV export handy? Select a realistic London commuter profile below to explore the dashboard and optimization engine.
              </p>

              <div class="demo-grid">
                {#each demoProfiles as profile}
                  <div class="demo-card glass-card" style="--profile-accent: {profile.color}">
                    <div class="demo-card-header">
                      <span class="demo-avatar">{profile.avatar}</span>
                      <div>
                        <h3 class="demo-name">{profile.name}</h3>
                        <div class="demo-badges">
                          <span class="demo-badge">{profile.badge}</span>
                          <span class="demo-zone-badge">{profile.zones}</span>
                        </div>
                      </div>
                    </div>
                    <p class="demo-description">{profile.description}</p>
                    <button class="btn-primary btn-demo-load" onclick={() => loadDemoData(profile.id)}>
                      ⚡ Load {profile.name}'s Log
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </section>
    {:else if !showWalkthrough}
      <!-- Hero Section -->
      <section class="hero animate-fade-in">
        <div class="hero-badge">
          <span>🔒</span> Privacy Protected TfL Analytics
        </div>
        <h1 class="hero-title">
          Unlock Your
          <span class="gradient-text">Oyster Savings</span>
        </h1>
        <p class="hero-subtitle">
          Analyze your TfL travel history, discover missed discount savings, and forecast the most cost-effective ticket combinations.
        </p>

        <div class="hero-actions animate-fade-in" style="animation-delay: 0.1s">
          <button class="btn-primary btn-lg" onclick={startAnalysis}>
            📊 Generate Analysis
          </button>
          <a
            href="https://github.com/NotToxel/OysterSavings"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-secondary btn-lg btn-github"
          >
            <svg class="github-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span>View on GitHub</span>
          </a>
        </div>

        <div class="hero-features animate-fade-in" style="animation-delay: 0.2s">
          <div class="feature-pill">
            <span class="feature-icon">📊</span>
            <span>Fare Analysis</span>
          </div>
          <div class="feature-pill">
            <span class="feature-icon">💳</span>
            <span>Unlock Potential Savings</span>
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

      <!-- Quick Demo CTA to make it easy for users without a file -->
      <section class="demo-intro-section animate-slide-up" style="animation-delay: 0.3s">
        <div class="demo-intro-card glass-card">
          <div class="demo-intro-content">
            <span class="demo-sparkle">✨</span>
            <div class="demo-intro-text">
              <h3>Just want to try it out?</h3>
              <p>Explore OysterSavings with pre-configured London commuter profiles.</p>
            </div>
          </div>
          <button class="btn-secondary btn-demo-quick" onclick={() => { showDemoProfiles = true; showWalkthrough = false; }}>
            ⚡ Browse Demo Profiles
          </button>
        </div>
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
            <p>Drop your CSV here — network requests are only made directly to TfL</p>
          </div>
          <div class="step-card">
            <div class="step-number">3</div>
            <h3>Discover Savings</h3>
            <p>See exactly how much Railcards and Travelcards could save you</p>
          </div>
          <div class="step-card">
            <div class="step-number">4</div>
            <h3>Plan Ahead</h3>
            <p>Forecast future costs and find your optimal ticket combination</p>
          </div>
        </div>
      </section>
    {:else}
      <!-- Walkthrough Section -->
      <section class="walkthrough-section animate-slide-up">
        <div class="walkthrough-card glass-card">
          <!-- Back & Progress Header -->
          <div class="walkthrough-header">
            <button class="btn-back" onclick={resetWalkthrough}>
              ← Back to Start
            </button>
            <div class="step-indicator-wrapper">
              {#if walkthroughStep < 6}
                <button class="btn-skip" onclick={() => walkthroughStep = 6}>
                  Skip to Upload ➔
                </button>
                <span class="step-indicator-divider">|</span>
              {/if}
              <div class="step-indicator">
                Step <span class="current-step">{walkthroughStep}</span> of 6
              </div>
            </div>
          </div>

          <!-- Walkthrough Progress Steps -->
          <div class="walkthrough-steps-nav">
            <button class="step-nav-item" class:active={walkthroughStep === 1} class:completed={walkthroughStep > 1} onclick={() => walkthroughStep = 1}>
              <span class="step-nav-num">1</span>
              <span class="step-nav-text">Sign In</span>
            </button>
            <div class="step-nav-line" class:completed={walkthroughStep > 1}></div>
            <button class="step-nav-item" class:active={walkthroughStep === 2} class:completed={walkthroughStep > 2} onclick={() => walkthroughStep = 2}>
              <span class="step-nav-num">2</span>
              <span class="step-nav-text">Select Card</span>
            </button>
            <div class="step-nav-line" class:completed={walkthroughStep > 2}></div>
            <button class="step-nav-item" class:active={walkthroughStep === 3} class:completed={walkthroughStep > 3} onclick={() => walkthroughStep = 3}>
              <span class="step-nav-num">3</span>
              <span class="step-nav-text">View History</span>
            </button>
            <div class="step-nav-line" class:completed={walkthroughStep > 3}></div>
            <button class="step-nav-item" class:active={walkthroughStep === 4} class:completed={walkthroughStep > 4} onclick={() => walkthroughStep = 4}>
              <span class="step-nav-num">4</span>
              <span class="step-nav-text">Select Dates</span>
            </button>
            <div class="step-nav-line" class:completed={walkthroughStep > 4}></div>
            <button class="step-nav-item" class:active={walkthroughStep === 5} class:completed={walkthroughStep > 5} onclick={() => walkthroughStep = 5}>
              <span class="step-nav-num">5</span>
              <span class="step-nav-text">Export CSV</span>
            </button>
            <div class="step-nav-line" class:completed={walkthroughStep > 5}></div>
            <button class="step-nav-item" class:active={walkthroughStep === 6} onclick={() => walkthroughStep = 6}>
              <span class="step-nav-num">6</span>
              <span class="step-nav-text">Upload</span>
            </button>
          </div>

          <!-- Step Content -->
          <div class="step-content-container">
            {#if walkthroughStep === 1}
              <div class="step-pane animate-fade-in">
                <div class="step-desc">
                  <h2>1. Sign in to your TfL Account</h2>
                  <p>Visit the official Transport for London (TfL) account portal and sign in with your registered email address and password.</p>
                  <a href="https://tfl.gov.uk/fares/contactless-and-oyster-account" target="_blank" rel="noopener noreferrer" class="btn-primary walkthrough-external-btn">
                    🌐 Open TfL Portal <span class="external-icon">↗</span>
                  </a>
                </div>
                <div class="step-screenshot-wrapper">
                  <img src="/images/tfl-walkthrough/tfl_login_step.png" alt="TfL Sign In Screen" class="step-screenshot" />
                  <div class="screenshot-caption">The TfL account sign-in page.</div>
                </div>
              </div>
            {:else if walkthroughStep === 2}
              <div class="step-pane animate-fade-in">
                <div class="step-desc">
                  <h2>2. Select Your Travel Card</h2>
                  <p>From the Dashboard main screen, click <strong>Go to Oyster</strong> or <strong>Go to contactless</strong> depending on which payment card you use for travel.</p>
                </div>
                <div class="step-screenshot-wrapper">
                  <img src="/images/tfl-walkthrough/tfl_card_select.png" alt="TfL Dashboard Select Card" class="step-screenshot" />
                  <div class="screenshot-caption">Select the Oyster or Contactless card you want to view.</div>
                </div>
              </div>
            {:else if walkthroughStep === 3}
              <div class="step-pane animate-fade-in">
                <div class="step-desc">
                  <h2>3. Go to Journey History</h2>
                  <p>On your travel card overview page, locate the <strong>Journeys</strong> card or sidebar menu and select <strong>View journey history</strong>.</p>
                </div>
                <div class="step-screenshot-wrapper">
                  <img src="/images/tfl-walkthrough/tfl_view_history.png" alt="TfL Oyster Card Overview" class="step-screenshot" />
                  <div class="screenshot-caption">Click the "View journey history" link to access your travel log.</div>
                </div>
              </div>
            {:else if walkthroughStep === 4}
              <div class="step-pane animate-fade-in">
                <div class="step-desc">
                  <h2>4. Choose Date Range</h2>
                  <p>Select your desired date range from the dropdown menu (or specify a custom range using the date picker) and click <strong>Submit</strong> to load the journey records.</p>
                </div>
                <div class="step-screenshot-wrapper">
                  <img src="/images/tfl-walkthrough/tfl_date_select.png" alt="TfL Journey History Date Selector" class="step-screenshot" />
                  <div class="screenshot-caption">Select a date range and click submit.</div>
                </div>
              </div>
            {:else if walkthroughStep === 5}
              <div class="step-pane animate-fade-in">
                <div class="step-desc">
                  <h2>5. Download CSV Statement</h2>
                  <p>Scroll down to the bottom of the journey records table and click the <strong>Download CSV format</strong> button to download your travel history file.</p>
                </div>
                <div class="step-screenshot-wrapper">
                  <img src="/images/tfl-walkthrough/tfl_export_step.png" alt="TfL CSV Statement Download Link" class="step-screenshot" />
                  <div class="screenshot-caption">Click the "Download CSV format" button at the bottom of the table.</div>
                </div>
              </div>
            {:else if walkthroughStep === 6}
              <div class="step-pane upload-pane animate-fade-in">
                <div class="step-desc-centered">
                  <h2>6. Upload and Optimize!</h2>
                  <p>Drag your downloaded CSV file here or click to browse. Fares are fetched directly from TfL to safely compute your savings.</p>
                </div>
                
                <FileUpload />

                <div class="demo-profiles-container walkthrough-demo-profiles">
                  <h2 class="demo-section-title">✨ Try OysterSavings Demo Profiles</h2>
                  <p class="demo-section-subtitle">
                    Don't have a TfL CSV export handy? Select a realistic London commuter profile below to explore the dashboard and optimization engine.
                  </p>

                  <div class="demo-grid">
                    {#each demoProfiles as profile}
                      <div class="demo-card glass-card" style="--profile-accent: {profile.color}">
                        <div class="demo-card-header">
                          <span class="demo-avatar">{profile.avatar}</span>
                          <div>
                            <h3 class="demo-name">{profile.name}</h3>
                            <div class="demo-badges">
                              <span class="demo-badge">{profile.badge}</span>
                              <span class="demo-zone-badge">{profile.zones}</span>
                            </div>
                          </div>
                        </div>
                        <p class="demo-description">{profile.description}</p>
                        <button class="btn-primary btn-demo-load" onclick={() => loadDemoData(profile.id)}>
                          ⚡ Load {profile.name}'s Log
                        </button>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Walkthrough Navigation Footer -->
          <div class="walkthrough-footer-actions">
            {#if walkthroughStep > 1}
              <button class="btn-secondary" onclick={prevStep}>
                ← Previous Step
              </button>
            {:else}
              <button class="btn-secondary" style="visibility: hidden;">
                ← Previous Step
              </button>
            {/if}

            <div class="walkthrough-dots">
              {#each [1, 2, 3, 4, 5, 6] as step}
                <button class="walkthrough-dot" class:active={walkthroughStep === step} onclick={() => walkthroughStep = step} aria-label="Go to step {step}"></button>
              {/each}
            </div>

            {#if walkthroughStep < 6}
              <button class="btn-primary" onclick={nextStep}>
                Next Step →
              </button>
            {:else}
              <button class="btn-primary" style="visibility: hidden;">
                Next Step →
              </button>
            {/if}
          </div>
        </div>
      </section>
    {/if}
  {:else}
    <!-- Dashboard after upload -->
    <section class="dashboard animate-fade-in">
      <div class="dashboard-header">
        <div>
          <h1 class="dashboard-title">Dashboard</h1>
          <p class="dashboard-subtitle">
            Analyzing <strong>{$fileName}</strong>{#if $analysisPeriodText} <span class="analysis-period" style="color: var(--color-text-muted); font-weight: normal; margin-left: 0.25rem;">({$analysisPeriodText})</span>{/if}
          </p>
        </div>
        <button
          class="btn-secondary"
          onclick={() => {
            import("$lib/stores/stores").then((m) => m.resetData());
          }}
        >
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
        <button class="action-card" onclick={() => ($currentPage = "analysis")}>
          <div class="action-icon">📊</div>
          <div class="action-content">
            <h3>Journey Analysis</h3>
            <p>
              View detailed journey breakdown, fare analysis, and fare type
              savings
            </p>
          </div>
          <span class="action-arrow">→</span>
        </button>
        <button class="action-card" onclick={() => ($currentPage = "planner")}>
          <div class="action-icon">📅</div>
          <div class="action-content">
            <h3>Journey Planner</h3>
            <p>
              Plan future travel with recurring schedules and cap forecasting
            </p>
          </div>
          <span class="action-arrow">→</span>
        </button>
        <button class="action-card" onclick={() => ($currentPage = "compare")}>
          <div class="action-icon">⚖️</div>
          <div class="action-content">
            <h3>Product Comparison</h3>
            <p>
              Compare PAYG, Discounted Travel Fares, and Travelcards across time
              periods
            </p>
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
    background: linear-gradient(135deg, #009fe3 0%, #6f4390 50%, #e7710d 100%);
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
    cursor: default;
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
    background: linear-gradient(135deg, #009fe3, #6f4390);
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

  /* Demo Profiles Grid and Cards */
  .demo-profiles-container {
    margin-top: 3.5rem;
    text-align: center;
  }

  .demo-section-title {
    font-size: 1.5rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    color: white;
  }

  .demo-section-subtitle {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    max-width: 600px;
    margin: 0 auto 2rem;
    line-height: 1.5;
  }

  .demo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.25rem;
    margin-top: 1.5rem;
  }

  .demo-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 1.5rem;
    text-align: left;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(255, 255, 255, 0.02);
  }

  .demo-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: var(--profile-accent);
    opacity: 0.7;
    transition: opacity 0.3s ease;
  }

  .demo-card:hover {
    transform: translateY(-4px);
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow:
      0 12px 30px rgba(0, 0, 0, 0.3),
      0 0 15px rgba(255, 255, 255, 0.02);
    background: rgba(255, 255, 255, 0.04);
  }

  .demo-card:hover::before {
    opacity: 1;
  }

  .demo-card-header {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    margin-bottom: 1rem;
  }

  .demo-avatar {
    font-size: 2.25rem;
    line-height: 1;
    background: rgba(255, 255, 255, 0.03);
    padding: 0.4rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .demo-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .demo-badges {
    display: flex;
    gap: 0.35rem;
    margin-top: 0.25rem;
    flex-wrap: wrap;
  }

  .demo-badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--color-text-secondary);
    border-radius: 999px;
  }

  .demo-zone-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    background: rgba(0, 159, 227, 0.1);
    border: 1px solid rgba(0, 159, 227, 0.2);
    color: #009fe3;
    border-radius: 999px;
  }

  .demo-description {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    line-height: 1.5;
    margin: 0 0 1.5rem 0;
    flex-grow: 1;
  }

  .btn-demo-load {
    width: 100%;
    justify-content: center;
    font-size: 0.8rem;
    padding: 0.65rem;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.06) 0%,
      rgba(255, 255, 255, 0.02) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    transition: all 0.2s ease;
  }

  .btn-demo-load:hover {
    background: var(--profile-accent);
    border-color: var(--profile-accent);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
  }

  /* Hero actions */
  .hero-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2.5rem;
  }

  .btn-lg {
    padding: 0.875rem 2rem;
    font-size: 1rem;
    border-radius: 12px;
  }

  .btn-github {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
  }

  .github-icon {
    transition: transform 0.3s ease;
  }

  .btn-github:hover .github-icon {
    transform: scale(1.15) rotate(5deg);
  }

  /* Quick Demo CTA */
  .demo-intro-section {
    margin: 1.5rem 0 3rem;
  }

  .demo-intro-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    gap: 1.5rem;
  }

  .demo-intro-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    text-align: left;
  }

  .demo-sparkle {
    font-size: 2rem;
    background: rgba(255, 255, 255, 0.03);
    padding: 0.5rem;
    border-radius: 12px;
    line-height: 1;
  }

  .demo-intro-text h3 {
    font-size: 1.15rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
    color: white;
  }

  .demo-intro-text p {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .btn-demo-quick {
    white-space: nowrap;
  }

  /* Walkthrough Section */
  .walkthrough-section {
    margin: 1.5rem 0;
  }

  .walkthrough-card {
    padding: 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .walkthrough-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 1.25rem;
  }

  .btn-back {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
  }

  .btn-back:hover {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.05);
  }

  .step-indicator {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .current-step {
    color: var(--color-oyster-blue);
    font-weight: 700;
  }

  .step-indicator-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-skip {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    font-size: 0.825rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
  }

  .btn-skip:hover {
    color: var(--color-oyster-blue);
    background: rgba(0, 159, 227, 0.08);
  }

  .step-indicator-divider {
    color: var(--color-border);
    font-size: 0.85rem;
  }

  /* Timeline navigation */
  .walkthrough-steps-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }

  .step-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    z-index: 2;
  }

  .step-nav-num {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #0a0e1a;
    border: 2px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    transition: all 0.3s ease;
    position: relative;
    z-index: 3;
  }

  .step-nav-text {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-muted);
    transition: all 0.3s ease;
  }

  .step-nav-item.active .step-nav-num {
    border-color: var(--color-oyster-blue);
    background: var(--color-oyster-blue);
    color: white;
    box-shadow: 0 0 15px rgba(0, 159, 227, 0.4);
  }

  .step-nav-item.active .step-nav-text {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .step-nav-item.completed .step-nav-num {
    border-color: var(--color-success);
    background: rgba(16, 185, 129, 0.1);
    color: var(--color-success);
  }

  .step-nav-line {
    flex-grow: 1;
    height: 2px;
    background: var(--color-border);
    margin: 0 -2px;
    margin-bottom: 20px;
    position: relative;
    z-index: 1;
    transition: background 0.3s ease;
  }

  .step-nav-line.completed {
    background: var(--color-success);
  }

  /* Pane layouts */
  .step-pane {
    display: grid;
    grid-template-columns: 1.2fr 1.8fr;
    gap: 2.5rem;
    align-items: center;
    min-height: 320px;
  }

  .step-desc {
    text-align: left;
  }

  .step-desc h2 {
    font-size: 1.5rem;
    font-weight: 800;
    margin-bottom: 1rem;
    letter-spacing: -0.02em;
    color: white;
  }

  .step-desc p {
    font-size: 0.95rem;
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  .walkthrough-external-btn {
    text-decoration: none;
  }

  .external-icon {
    font-size: 0.75rem;
    transition: transform 0.2s ease;
  }

  .walkthrough-external-btn:hover .external-icon {
    transform: translate(2px, -2px);
  }

  /* Screenshot display */
  .step-screenshot-wrapper {
    position: relative;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    background: rgba(0, 0, 0, 0.2);
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    transition: all 0.3s ease;
  }

  .step-screenshot-wrapper:hover {
    border-color: var(--color-border-accent);
    box-shadow: 0 15px 40px rgba(0, 159, 227, 0.15);
  }

  .step-screenshot {
    width: 100%;
    height: auto;
    display: block;
    transition: transform 0.5s ease;
  }

  .step-screenshot-wrapper:hover .step-screenshot {
    transform: scale(1.02);
  }

  .screenshot-caption {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    padding: 0.5rem 1rem;
    background: rgba(10, 14, 26, 0.8);
    border-top: 1px solid var(--color-border);
    text-align: center;
  }

  /* Upload pane specific */
  .step-pane.upload-pane {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    min-height: auto;
  }

  .step-desc-centered {
    text-align: center;
    max-width: 600px;
  }

  .step-desc-centered h2 {
    font-size: 1.5rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    color: white;
  }

  .step-desc-centered p {
    font-size: 0.95rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .walkthrough-demo-profiles {
    margin-top: 2rem;
    border-top: 1px solid var(--color-border);
    padding-top: 2rem;
    width: 100%;
  }

  /* Footer action actions */
  .walkthrough-footer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--color-border);
    padding-top: 1.5rem;
    margin-top: 1rem;
  }

  .walkthrough-dots {
    display: flex;
    gap: 0.5rem;
  }

  .walkthrough-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-border);
    border: none;
    cursor: pointer;
    transition: all 0.25s ease;
    padding: 0;
  }

  .walkthrough-dot.active {
    background: var(--color-oyster-blue);
    transform: scale(1.35);
  }

  .walkthrough-dot:hover:not(.active) {
    background: var(--color-text-muted);
  }

  /* Responsive styling */
  @media (max-width: 768px) {
    .hero-actions {
      flex-direction: column;
      align-items: center;
    }

    .hero-actions .btn-lg {
      width: 100%;
      justify-content: center;
    }

    .demo-intro-card {
      flex-direction: column;
      text-align: center;
      padding: 1.5rem;
    }

    .demo-intro-content {
      flex-direction: column;
      text-align: center;
    }

    .btn-demo-quick {
      width: 100%;
      justify-content: center;
    }

    .walkthrough-card {
      padding: 1.5rem;
    }

    .step-nav-text {
      display: none;
    }

    .step-nav-line {
      margin-bottom: 0px;
    }

    .step-pane {
      grid-template-columns: 1fr;
      gap: 1.5rem;
      min-height: auto;
    }
  }
</style>

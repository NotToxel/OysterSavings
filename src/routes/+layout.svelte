<script lang="ts">
  import './layout.css';
  import { currentPage, hasData, isDemoMode, resetData, reportGeneratedAt } from '$lib/stores/stores';
  import { TFL_FARES_LAST_ROSE } from '$lib/data/fareData';

  let { children } = $props();

  const navItems = [
    { id: 'home' as const, label: 'Upload', icon: '📂' },
    { id: 'analysis' as const, label: 'Analysis', icon: '📊' },
    { id: 'compare' as const, label: 'Compare', icon: '⚖️' },
    { id: 'planner' as const, label: 'Planner', icon: '📅' },
    { id: 'faq' as const, label: 'FAQ', icon: '❓' },
  ];

  function navigateTo(page: typeof $currentPage) {
    $currentPage = page;
  }

  function handleExitDemo() {
    resetData();
  }

  function formatDateTime(isoString: string) {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const hr = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const sec = String(date.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${d} ${hr}:${min}:${sec}`;
    } catch (e) {
      return isoString;
    }
  }

  let buildTooltipText = $derived(
    `Report generated at: ${formatDateTime($reportGeneratedAt)}\n` +
    `Build date: ${formatDateTime(__BUILD_DATE__)}\n` +
    `Version: v${__BUILD_VERSION__}`
  );
</script>

<svelte:head>
  <title>OysterSavings — TfL Fare & Discount Optimizer</title>
  <meta name="description" content="Analyze your TfL Oyster travel history, discover missed discount savings, and forecast the most cost-effective ticket combinations." />
</svelte:head>

<div class="app-container">
  <!-- Ambient background effects -->
  <div class="ambient-bg">
    <div class="ambient-orb orb-1"></div>
    <div class="ambient-orb orb-2"></div>
    <div class="ambient-orb orb-3"></div>
  </div>

  <!-- Top nav bar -->
  <header class="top-bar">
    {#if $isDemoMode}
      <div class="demo-banner animate-fade-in">
        <div class="demo-banner-content">
          <span class="demo-flash">⚡</span>
          <span>Running in <strong>Demo Mode</strong> with a pre-configured 5-week travel routine.</span>
        </div>
        <button class="btn-demo-exit" onclick={handleExitDemo}>
          ✕ Exit Demo
        </button>
      </div>
    {/if}
    <div class="top-bar-inner">
      <button class="logo" onclick={() => navigateTo('home')}>
        <span class="logo-icon">🦪</span>
        <span class="logo-text">Oyster<span class="logo-accent">Savings</span></span>
      </button>

      <nav class="nav-pills">
        {#each navItems as item}
          {#if item.id === 'home' || item.id === 'planner' || item.id === 'faq' || $hasData}
            <button
              class="nav-pill"
              class:active={$currentPage === item.id}
              onclick={() => navigateTo(item.id)}
            >
              <span class="nav-icon">{item.icon}</span>
              <span class="nav-label">{item.label}</span>
            </button>
          {/if}
        {/each}
      </nav>

      <div class="nav-badge">
        <span class="privacy-badge">🔒 100% Private</span>
      </div>
    </div>
  </header>

  <!-- Main content -->
  <main class="main-content">
    {@render children()}
  </main>

  <!-- Footer -->
  <footer class="app-footer">
    <p>Your data never leaves your browser. All calculations run locally.</p>
    <p class="fare-data-version">
      Using TfL fare rates from {TFL_FARES_LAST_ROSE} (caps frozen until 2027)
      <span class="footer-version-tag">v{__BUILD_VERSION__}</span>
    </p>
    <p class="footer-copyright">
      &copy; 2026 OysterSavings. Licensed under AGPL-3.0.
    </p>
    {#if $hasData}
      <div class="report-meta-footer">
        <span>Generated with <a href="/" onclick={(e) => { e.preventDefault(); navigateTo('home'); }} class="footer-link">OysterSavings</a></span>
        <span class="meta-divider">•</span>
        <div class="meta-build-info tooltip" data-tooltip={buildTooltipText}>
          <svg class="footer-github-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span class="build-text">build {__COMMIT_HASH__}</span>
        </div>
      </div>
    {/if}
  </footer>
</div>

<style>
  .app-container {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }

  /* Ambient background */
  .ambient-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }

  .ambient-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.15;
  }

  .orb-1 {
    width: 600px;
    height: 600px;
    background: #009FE3;
    top: -200px;
    right: -100px;
    animation: float 20s ease-in-out infinite;
  }

  .orb-2 {
    width: 500px;
    height: 500px;
    background: #6950A1;
    bottom: -150px;
    left: -100px;
    animation: float 25s ease-in-out infinite reverse;
  }

  .orb-3 {
    width: 300px;
    height: 300px;
    background: #EF7B10;
    top: 50%;
    left: 50%;
    animation: float 30s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(30px, -40px); }
    50% { transform: translate(-20px, 30px); }
    75% { transform: translate(40px, 20px); }
  }

  /* Top bar */
  .top-bar {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(10, 14, 26, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .top-bar-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .logo-icon {
    font-size: 1.5rem;
  }

  .logo-text {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--color-text-primary);
    letter-spacing: -0.02em;
  }

  .logo-accent {
    background: linear-gradient(135deg, #009FE3, #6950A1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .nav-pills {
    display: flex;
    gap: 4px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 4px;
  }

  .nav-pill {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.25s ease;
    white-space: nowrap;
  }

  .nav-pill:hover:not(:disabled) {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.05);
  }

  .nav-pill.active {
    color: white;
    background: linear-gradient(135deg, #009FE3 0%, #0078ab 100%);
    box-shadow: 0 2px 12px rgba(0, 159, 227, 0.35);
  }

  .nav-icon {
    font-size: 0.9rem;
  }

  .nav-badge {
    display: flex;
    align-items: center;
  }

  .privacy-badge {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.15);
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-weight: 500;
  }

  /* Main content */
  .main-content {
    flex: 1;
    position: relative;
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    width: 100%;
  }

  /* Footer */
  .app-footer {
    position: relative;
    text-align: center;
    padding: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .top-bar-inner {
      flex-wrap: wrap;
      justify-content: center;
    }

    .nav-pills {
      order: 3;
      width: 100%;
      justify-content: center;
    }

    .nav-label {
      display: none;
    }

    .nav-badge {
      display: none;
    }

    .main-content {
      padding: 1rem;
    }
  }

  /* Demo banner */
  .demo-banner {
    background: linear-gradient(90deg, rgba(0, 159, 227, 0.95) 0%, rgba(105, 80, 161, 0.95) 100%);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    padding: 0.5rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.8rem;
    z-index: 100;
  }

  .demo-banner-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .demo-flash {
    animation: flashPulse 1.5s infinite;
  }

  @keyframes flashPulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.15); }
  }

  .btn-demo-exit {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .btn-demo-exit:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: white;
  }

  @media (max-width: 768px) {
    .demo-banner {
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 0.5rem 1rem;
      gap: 0.5rem;
    }
    
    .btn-demo-exit {
      width: 100%;
    }
  }

  .report-meta-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .footer-link {
    color: var(--color-oyster-blue);
    text-decoration: none;
    font-weight: 500;
  }

  .footer-link:hover {
    text-decoration: underline;
  }

  .meta-divider {
    color: var(--color-text-muted);
  }

  .meta-build-info {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: default;
    color: var(--color-text-muted);
    transition: color 0.2s ease;
  }

  .meta-build-info:hover {
    color: var(--color-text-secondary);
  }

  .footer-github-icon {
    opacity: 0.7;
  }

  .meta-build-info:hover .footer-github-icon {
    opacity: 1;
  }

  .build-text {
    font-family: monospace;
    font-size: 0.7rem;
  }

  .footer-version-tag {
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.08rem 0.35rem;
    border-radius: 4px;
    margin-left: 0.4rem;
    font-family: monospace;
    letter-spacing: normal;
    display: inline-block;
    vertical-align: middle;
  }

  .fare-data-version {
    margin-top: 0.25rem;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    opacity: 0.85;
  }

  .footer-copyright {
    margin-top: 0.25rem;
    color: var(--color-text-muted);
    font-size: 0.7rem;
    opacity: 0.7;
  }

  /* Override tooltip properties specifically for build metadata */
  :global(.meta-build-info.tooltip::after) {
    white-space: pre !important;
    text-align: left !important;
    font-family: var(--font-sans);
    line-height: 1.6 !important;
    width: max-content !important;
    max-width: none !important;
    padding: 0.5rem 0.85rem !important;
  }
</style>

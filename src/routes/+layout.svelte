<script lang="ts">
  import './layout.css';
  import { currentPage, hasData, isDemoMode, resetData } from '$lib/stores/stores';

  let { children } = $props();

  const navItems = [
    { id: 'home' as const, label: 'Upload', icon: '📂' },
    { id: 'analysis' as const, label: 'Analysis', icon: '📊' },
    { id: 'compare' as const, label: 'Compare', icon: '⚖️' },
    { id: 'planner' as const, label: 'Planner', icon: '📅' },
  ];

  function navigateTo(page: typeof $currentPage) {
    $currentPage = page;
  }

  function handleExitDemo() {
    resetData();
  }
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
          {#if item.id === 'home' || item.id === 'planner' || $hasData}
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
    z-index: 1;
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    width: 100%;
  }

  /* Footer */
  .app-footer {
    position: relative;
    z-index: 1;
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
</style>

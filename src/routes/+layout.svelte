<script lang="ts">
  import './layout.css';
  import { currentPage, hasData } from '$lib/stores/stores';

  let { children } = $props();

  const navItems = [
    { id: 'home' as const, label: 'Upload', icon: '📂' },
    { id: 'analysis' as const, label: 'Analysis', icon: '📊' },
    { id: 'planner' as const, label: 'Planner', icon: '📅' },
    { id: 'compare' as const, label: 'Compare', icon: '⚖️' },
  ];

  function navigateTo(page: typeof $currentPage) {
    $currentPage = page;
  }
</script>

<svelte:head>
  <title>OysterSavings — TfL Fare & Railcard Optimizer</title>
  <meta name="description" content="Analyze your TfL Oyster travel history, discover missed railcard savings, and forecast the most cost-effective ticket combinations." />
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
    <div class="top-bar-inner">
      <button class="logo" onclick={() => navigateTo('home')}>
        <span class="logo-icon">🦪</span>
        <span class="logo-text">Oyster<span class="logo-accent">Savings</span></span>
      </button>

      <nav class="nav-pills">
        {#each navItems as item}
          <button
            class="nav-pill"
            class:active={$currentPage === item.id}
            class:disabled={item.id !== 'home' && item.id !== 'planner' && !$hasData}
            onclick={() => {
              if (item.id === 'home' || item.id === 'planner' || $hasData) navigateTo(item.id);
            }}
            disabled={item.id !== 'home' && item.id !== 'planner' && !$hasData}
          >
            <span class="nav-icon">{item.icon}</span>
            <span class="nav-label">{item.label}</span>
          </button>
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

  .nav-pill.disabled {
    opacity: 0.35;
    cursor: not-allowed;
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
</style>

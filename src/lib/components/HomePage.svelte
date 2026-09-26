<script lang="ts">
  import { tick } from "svelte";
  import { fade, fly } from "svelte/transition";
  import FileUpload from "./FileUpload.svelte";
  import LandingRouteBackground from "./LandingRouteBackground.svelte";
  import { getSampleTransactions, sampleProductPence, type SamplePatternId, type SampleScenarioId, type SampleTransaction } from "$lib/data/sampleJourneyPreview";
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
  let showUpload = $state(false);
  let walkthroughStep = $state(1);
  let stepDirection = $state<1 | -1>(1);
  let loadingDemoProfileId = $state<string | null>(null);
  let loadingProfileName = $state<string>("");
  let uploadSection: HTMLElement | undefined = $state();
  let stepContentContainer: HTMLElement | undefined = $state();
  let stepHeightAnimation: Animation | null = null;
  const defaultSamplePattern: SamplePatternId = "flexible";
  const defaultSampleTransactions = getSampleTransactions(defaultSamplePattern);
  let activeSamplePattern = $state<SamplePatternId>(defaultSamplePattern);
  let sampleTransactions = $derived(activeSamplePattern === defaultSamplePattern ? defaultSampleTransactions : getSampleTransactions(activeSamplePattern));
  let savingsWeek = $state(4);
  let monthExtraDaysShown = $state(true);
  let railcardTieReady = $state(true);
  let ledgerStep = $state(defaultSampleTransactions.length);
  let savingsPlaying = $state(false);
  let weeklyResultReady = $state(false);
  let previewComplete = $state(false);
  let reducePreviewMotion = $state(false);
  let savingsTimer: number | undefined;
  let ledgerTimer: number | undefined;
  let savingsRunId = 0;

  const samplePatterns = {
    flexible: { label: "Flexible commute", detail: "Peak trips, a midweek off-peak day and an early return." },
    offpeak: { label: "Off-peak week", detail: "Six return trips outside peak hours." },
    mixed: { label: "Daily Tube + bus", detail: "Every day: Tube commutes, bus trips and a weekend outing. Hits the weekly cap." },
  } as const;
  const sampleComparisons = {
    travelcard: {
      description: "Compare this week's Tube and bus trips with a fixed-price weekly Travelcard.",
      bestLabel: "Adult PAYG",
      alternativeLabel: "Weekly Travelcard",
      note: "Illustrative Zone 1–2 fares. Actual route fares can vary.",
    },
    railcard: {
      description: "Eligible off-peak Tube trips get the linked Railcard discount. Peak Tube and bus fares do not.",
      bestLabel: "Oyster + Railcard",
      alternativeLabel: "Oyster without Railcard",
      note: "Illustrative Zone 1–2 fares. Railcard purchase cost is excluded.",
    },
    student: {
      description: "An eligible 18+ Student weekly Travelcard covers these same Tube and bus trips at a reduced fixed price.",
      bestLabel: "Student Travelcard",
      alternativeLabel: "Adult PAYG",
      note: "Illustrative Zone 1–2 fares. Requires an eligible 18+ Student Oyster photocard; its application fee is excluded. PAYG fares have no student discount.",
    },
  } as const;
  const repeatedWeeks = 4;
  let activeSampleComparison = $state<SampleScenarioId>("travelcard");
  let showsMonthlyComparison = $derived(activeSamplePattern === "mixed" && activeSampleComparison !== "railcard");
  let sampleComparison = $derived.by(() => {
    const adultPence = sampleTransactions.reduce((sum, journey) => sum + journey.adultChargedPence, 0);
    const railcardPence = sampleTransactions.reduce((sum, journey) => sum + journey.railcardChargedPence, 0);
    const prices = activeSampleComparison === "travelcard"
      ? { bestPence: adultPence, alternativePence: sampleProductPence.travelcard }
      : activeSampleComparison === "railcard"
        ? { bestPence: railcardPence, alternativePence: adultPence }
        : { bestPence: sampleProductPence.student, alternativePence: adultPence };
    return { ...sampleComparisons[activeSampleComparison], ...prices, transactions: sampleTransactions, adultPence, railcardPence };
  });
  let weeklyDifferencePence = $derived(sampleComparison.alternativePence - sampleComparison.bestPence);
  let railcardWeeklyTie = $derived(activeSamplePattern === "mixed" && activeSampleComparison === "railcard" && weeklyDifferencePence === 0);
  let extraDaysPence = $derived(sampleComparison.transactions
    .filter((journey) => journey.day < 2)
    .reduce((sum, journey) => sum + journey.adultChargedPence, 0));
  let thirtyDayPaygPence = $derived(sampleComparison.adultPence * repeatedWeeks + extraDaysPence);
  let monthlyPaygSoFar = $derived(sampleComparison.adultPence * savingsWeek + (monthExtraDaysShown ? extraDaysPence : 0));
  let monthlyProductPence = $derived(activeSampleComparison === "student"
    ? sampleProductPence.studentMonthlyTravelcard
    : sampleProductPence.monthlyTravelcard);
  let monthlySavingPence = $derived(Math.max(0, thirtyDayPaygPence - monthlyProductPence));
  let cheaperSampleLabel = $derived(sampleComparison.bestPence <= sampleComparison.alternativePence ? sampleComparison.bestLabel : sampleComparison.alternativeLabel);
  let visibleTransactions = $derived(sampleComparison.transactions.slice(Math.max(0, ledgerStep - 3), ledgerStep));
  let adultSoFar = $derived(sampleComparison.transactions.slice(0, ledgerStep).reduce((sum, journey) => sum + journey.adultChargedPence, 0));
  let railcardSoFar = $derived(sampleComparison.transactions.slice(0, ledgerStep).reduce((sum, journey) => sum + journey.railcardChargedPence, 0));
  let visibleBestPence = $derived(activeSampleComparison === "travelcard"
    ? adultSoFar
    : activeSampleComparison === "railcard" ? railcardSoFar : sampleProductPence.student * ledgerStep / sampleTransactions.length);
  let visibleAlternativePence = $derived(activeSampleComparison === "travelcard"
    ? sampleProductPence.travelcard * ledgerStep / sampleTransactions.length
    : adultSoFar);
  let comparisonScalePence = $derived(Math.max(sampleComparison.bestPence, sampleComparison.alternativePence));
  const sampleWeeks = Array.from({ length: repeatedWeeks }, (_, index) => index + 1);

  function formatPounds(pence: number) {
    return `£${(pence / 100).toFixed(2)}`;
  }

  function railcardJourneyNote(journey: SampleTransaction) {
    const difference = journey.adultChargedPence - journey.railcardChargedPence;
    if (journey.mode === "bus") return difference === 0 ? "no bus discount" : "cap timing differs";
    if (journey.peak) return difference === 0 ? "peak fare unchanged" : "cap timing differs";
    if (difference > 0) return `save ${formatPounds(difference)}`;
    return difference < 0 ? "cap reached later" : "cap applies";
  }

  function finishSavingsPreview(runId: number) {
    savingsPlaying = false;
    savingsTimer = window.setTimeout(() => {
      if (runId !== savingsRunId) return;
      previewComplete = true;
      savingsTimer = undefined;
    }, 750);
  }

  async function playSavingsPreview() {
    const runId = ++savingsRunId;
    if (savingsTimer !== undefined) window.clearInterval(savingsTimer);
    if (ledgerTimer !== undefined) window.clearInterval(ledgerTimer);
    savingsTimer = undefined;
    ledgerTimer = undefined;
    savingsPlaying = false;
    weeklyResultReady = false;
    previewComplete = false;
    reducePreviewMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducePreviewMotion) {
      savingsWeek = repeatedWeeks;
      monthExtraDaysShown = true;
      railcardTieReady = true;
      ledgerStep = sampleComparison.transactions.length;
      weeklyResultReady = true;
      previewComplete = true;
      return;
    }

    savingsWeek = 0;
    monthExtraDaysShown = false;
    railcardTieReady = false;
    ledgerStep = 0;
    await tick();
    if (runId !== savingsRunId) return;

    savingsPlaying = true;
    ledgerTimer = window.setInterval(() => {
      ledgerStep += 1;
      if (ledgerStep >= sampleComparison.transactions.length) {
        window.clearInterval(ledgerTimer);
        ledgerTimer = undefined;
        if (runId !== savingsRunId) return;
        savingsTimer = window.setTimeout(() => {
          if (runId !== savingsRunId) return;
          weeklyResultReady = true;
          if (railcardWeeklyTie) {
            savingsTimer = window.setTimeout(() => {
              if (runId !== savingsRunId) return;
              railcardTieReady = true;
              savingsWeek = repeatedWeeks;
              finishSavingsPreview(runId);
            }, 440);
            return;
          }
          savingsTimer = window.setInterval(() => {
            savingsWeek += 1;
            if (savingsWeek >= repeatedWeeks) {
              window.clearInterval(savingsTimer);
              savingsTimer = undefined;
              if (showsMonthlyComparison) {
                savingsTimer = window.setTimeout(() => {
                  if (runId !== savingsRunId) return;
                  monthExtraDaysShown = true;
                  finishSavingsPreview(runId);
                }, 650);
              } else {
                finishSavingsPreview(runId);
              }
            }
          }, 550);
        }, 750);
      }
    }, 750);
  }

  function selectSampleComparison(comparison: SampleScenarioId) {
    if (activeSampleComparison === comparison) return;
    activeSampleComparison = comparison;
    void playSavingsPreview();
  }

  function selectSamplePattern(pattern: SamplePatternId) {
    if (activeSamplePattern === pattern) return;
    activeSamplePattern = pattern;
    void playSavingsPreview();
  }

  function startSavingsWhenVisible(node: HTMLElement) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      savingsWeek = repeatedWeeks;
      monthExtraDaysShown = true;
      railcardTieReady = true;
      ledgerStep = sampleComparison.transactions.length;
      weeklyResultReady = true;
      previewComplete = true;
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        void playSavingsPreview();
      }
    }, { threshold: 0.55 });
    observer.observe(node);

    return {
      destroy() {
        observer.disconnect();
        savingsRunId += 1;
        if (savingsTimer !== undefined) window.clearInterval(savingsTimer);
        if (ledgerTimer !== undefined) window.clearInterval(ledgerTimer);
        savingsTimer = undefined;
        ledgerTimer = undefined;
      },
    };
  }

  const stepTitles = [
    "Sign In",
    "Select Card",
    "View History",
    "Select Dates",
    "Export CSV",
    "Upload",
  ];

  const walkthroughImageSources = [
    "/images/tfl-walkthrough/tfl_login_step.png",
    "/images/tfl-walkthrough/tfl_card_select.png",
    "/images/tfl-walkthrough/tfl_view_history.png",
    "/images/tfl-walkthrough/tfl_date_select.png",
    "/images/tfl-walkthrough/tfl_export_step.png",
  ];
  let walkthroughImagePreloads: HTMLImageElement[] = [];

  function preloadWalkthroughImages() {
    if (walkthroughImagePreloads.length > 0) return;

    walkthroughImagePreloads = walkthroughImageSources.map((source) => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
      return image;
    });
  }

  async function openUpload() {
    showUpload = true;
    await tick();
    uploadSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    uploadSection
      ?.querySelector<HTMLElement>('[role="button"]')
      ?.focus({ preventScroll: true });
  }

  async function openExportGuide() {
    preloadWalkthroughImages();
    showWalkthrough = true;
    showDemoProfiles = false;
    walkthroughStep = 1;
    await tick();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function goToStep(step: number) {
    if (step === walkthroughStep || step < 1 || step > 6) return;

    const container = stepContentContainer;
    stepHeightAnimation?.cancel();
    stepHeightAnimation = null;

    if (container) {
      container.style.height = "";
      container.style.overflow = "";
    }

    const previousHeight = container?.getBoundingClientRect().height;
    stepDirection = step > walkthroughStep ? 1 : -1;
    walkthroughStep = step;
    await tick();

    if (!container || previousHeight === undefined || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const nextHeight = container.scrollHeight;
    if (Math.abs(nextHeight - previousHeight) < 1) return;

    container.style.height = `${nextHeight}px`;
    container.style.overflow = "clip";
    const animation = container.animate(
      [{ height: `${previousHeight}px` }, { height: `${nextHeight}px` }],
      { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
    stepHeightAnimation = animation;

    try {
      await animation.finished;
    } catch {
      // A newer step change superseded this transition.
    }

    if (stepHeightAnimation === animation) {
      container.style.height = "";
      container.style.overflow = "";
      stepHeightAnimation = null;
    }
  }

  function nextStep() {
    void goToStep(walkthroughStep + 1);
  }

  function prevStep() {
    void goToStep(walkthroughStep - 1);
  }

  async function resetWalkthrough() {
    showWalkthrough = false;
    showDemoProfiles = false;
    walkthroughStep = 1;
    await tick();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function openDemoProfiles() {
    showDemoProfiles = true;
    showWalkthrough = false;
    await tick();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function handleLoadDemo(profileId: string, profileName: string) {
    if (loadingDemoProfileId) return;
    loadingDemoProfileId = profileId;
    loadingProfileName = profileName;
    setTimeout(() => {
      try {
        loadDemoData(profileId);
      } finally {
        loadingDemoProfileId = null;
      }
    }, 40);
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
                    <button
                      class="btn-primary btn-demo-load"
                      disabled={loadingDemoProfileId !== null}
                      onclick={() => handleLoadDemo(profile.id, profile.name)}
                    >
                      {#if loadingDemoProfileId === profile.id}
                        <span class="inline-spinner"></span>
                        Loading {profile.name}...
                      {:else}
                        ⚡ Load {profile.name}'s Log
                      {/if}
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </section>
    {:else if !showWalkthrough}
      <main class="first-run animate-fade-in">
        <LandingRouteBackground />
        <section class="first-run-intro" aria-labelledby="first-run-title">
          <h1 id="first-run-title">Find the cheapest way to pay for your TfL travel.</h1>
          <p class="intro-summary">
            Compare pay as you go, caps, Railcard discounts and Travelcards
            using your actual journeys.
          </p>

          <div class="hero-actions">
            <button
              class="generate-analysis"
              aria-controls="upload-journey-history"
              onclick={openUpload}
            >
              Generate Analysis
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
            <a
              class="github-cta"
              href="https://github.com/NotToxel/OysterSavings"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.99c.85 0 1.71.12 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.6c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
              </svg>
              View on GitHub
            </a>
          </div>

          <div class="journey-vignette" aria-label="Sample journey analysis and recommendation" use:startSavingsWhenVisible>
            <div class="journey-map">
              <div class="journey-route" aria-hidden="true">
                <span class="journey-line"></span>
                <span class="journey-runner" class:playing={savingsPlaying} class:complete={savingsWeek >= repeatedWeeks && !savingsPlaying}></span>

                <div class="journey-stop journey-stop-blue">
                  <span class="stop-marker"></span>
                  <span class="stop-copy">
                    <strong><span class="stop-label-full">Journey history</span><span class="stop-label-compact">History</span></strong>
                    <small>Your travel week</small>
                  </span>
                </div>
                <div class="journey-stop journey-stop-purple">
                  <span class="stop-marker"></span>
                  <span class="stop-copy">
                    <strong>Fare rules</strong>
                    <small>Caps and discounts</small>
                  </span>
                </div>
                <div class="journey-stop journey-stop-orange">
                  <span class="stop-marker"></span>
                  <span class="stop-copy">
                    <strong>Best fit</strong>
                    <small>Products compared</small>
                  </span>
                </div>
              </div>

              <div class="journey-pattern-choice">
                <span>Journey mix</span>
                <div class="journey-pattern-switch" role="group" aria-label="Choose sample journeys">
                  {#each Object.entries(samplePatterns) as [pattern, details]}
                    <button type="button" aria-pressed={activeSamplePattern === pattern} onclick={() => selectSamplePattern(pattern as SamplePatternId)}>{details.label}</button>
                  {/each}
                </div>
                <small>{samplePatterns[activeSamplePattern].detail}</small>
              </div>

              <div class="sample-ledger" aria-label="Illustrative Zone 1–2 journey transactions">
                <div class="ledger-heading">
                  <strong>{sampleTransactions.length} journeys · same for every fare</strong>
                  <span>{ledgerStep} / {sampleComparison.transactions.length}</span>
                </div>
                <div class="ledger-window">
                  {#if ledgerStep === 0}
                    <p class="ledger-empty">Journeys will appear here…</p>
                  {/if}
                  {#each visibleTransactions as journey (journey.index)}
                    <div class="ledger-transaction" in:fly={{ y: 12, duration: reducePreviewMotion ? 0 : 340 }} out:fade={{ duration: reducePreviewMotion ? 0 : 200 }}>
                      <div class="ledger-transaction-top">
                        <span class="ledger-mode-and-time">
                          {#if journey.mode === "bus"}
                            <svg class="ledger-mode-icon bus-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                              <rect x="4" y="3" width="16" height="15" rx="3" />
                              <path d="M4 10h16M7 18v2m10-2v2M8 14h2m4 0h2" />
                            </svg>
                          {:else}
                            <svg class="ledger-mode-icon tube-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                              <circle cx="12" cy="12" r="8" />
                              <path d="M2 10h20v4H2z" fill="#0c1728" stroke-linejoin="round" />
                            </svg>
                          {/if}
                          {journey.dayLabel} {journey.time} · {journey.mode === "bus" ? "Bus" : journey.peak ? "Peak Tube" : "Off-peak Tube"}
                        </span>
                        <strong>{formatPounds(journey.farePence)}</strong>
                      </div>
                      <span class="ledger-route-name">{journey.origin} → {journey.destination}</span>
                      {#if activeSampleComparison === "railcard"}
                        <span class="ledger-adjustment">Adult PAYG {formatPounds(journey.adultChargedPence)} → Railcard <strong>{formatPounds(journey.railcardChargedPence)}</strong> · {railcardJourneyNote(journey)}</span>
                      {:else}
                        <span class="ledger-adjustment">Adult PAYG <strong>{formatPounds(journey.adultChargedPence)}</strong>{journey.adultCap ? ` (${journey.adultCap} cap)` : ""} · {activeSampleComparison === "student" ? "Student Travelcard" : "Travelcard"} covers trip</span>
                      {/if}
                    </div>
                  {/each}
                </div>
                <small class="ledger-context">{ledgerStep === 0 ? `All ${sampleTransactions.length} journeys count toward the totals.` : `Latest ${Math.min(ledgerStep, 3)} shown · bars include all ${sampleTransactions.length} journeys.`}</small>
              </div>
            </div>

            <article class="outcome-preview">
              <div class="outcome-preview-header">
                <h2>Which costs less?</h2>
              </div>
              <div class="sample-switch" role="group" aria-label="Choose a sample comparison">
                <button type="button" aria-pressed={activeSampleComparison === "travelcard"} onclick={() => selectSampleComparison("travelcard")}>Travelcard</button>
                <button type="button" aria-pressed={activeSampleComparison === "railcard"} onclick={() => selectSampleComparison("railcard")}>Railcard</button>
                <button type="button" aria-pressed={activeSampleComparison === "student"} onclick={() => selectSampleComparison("student")}>18+ Student</button>
              </div>
              <p>{activeSamplePattern === "mixed" && activeSampleComparison === "travelcard" ? "This week hits the PAYG cap, so a 7-Day Travelcard ties. A Monthly Travelcard can pull ahead." : sampleComparison.description}</p>

              <div class="fare-comparison" aria-label="Example weekly fare comparison">
                <div class="fare-row" class:is-best={sampleComparison.bestPence < sampleComparison.alternativePence}>
                  <div class="fare-row-label">
                    <span>{sampleComparison.bestLabel}</span>
                    <strong>{formatPounds(visibleBestPence)}</strong>
                  </div>
                  <span class="fare-track"><span style:transform={`scaleX(${visibleBestPence / comparisonScalePence})`}></span></span>
                </div>
                <div class="fare-row" class:is-best={sampleComparison.alternativePence < sampleComparison.bestPence}>
                  <div class="fare-row-label">
                    <span>{sampleComparison.alternativeLabel}</span>
                    <strong>{formatPounds(visibleAlternativePence)}</strong>
                  </div>
                  <span class="fare-track"><span style:transform={`scaleX(${visibleAlternativePence / comparisonScalePence})`}></span></span>
                </div>
              </div>
              <small class="fare-progress-note">{activeSampleComparison === "railcard" ? "Both totals grow as journeys arrive." : "Travelcards are paid upfront; their price and bar reveal alongside the PAYG journeys for comparison."}</small>

              <div class="saving-summary">
                <span>Final {activeSamplePattern === "mixed" ? "7-day" : "weekly"} difference<small>{weeklyResultReady ? weeklyDifferencePence === 0 ? "Both cost the same" : `${cheaperSampleLabel} costs less` : "Adding the week's journeys…"}</small></span>
                <strong aria-live="polite">{weeklyResultReady ? formatPounds(Math.abs(weeklyDifferencePence)) : "—"}</strong>
              </div>

              {#if railcardWeeklyTie}
                {#if railcardTieReady}
                  <div class="railcard-tie" role="status" in:fade={{ duration: reducePreviewMotion ? 0 : 260 }}>
                    <div class="railcard-tie-heading">
                      <strong>No Railcard saving this week</strong>
                      {#if previewComplete}
                      <button class="savings-replay" type="button" aria-label="Replay the sample journeys and price bars" onclick={() => void playSavingsPreview()}>
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7">
                          <path d="M16.4 9.4a6.5 6.5 0 1 1-2-4.5" />
                          <path d="M16.5 3.5v4.2h-4.2" />
                        </svg>
                        Replay
                      </button>
                      {/if}
                    </div>
                    <p>Both finish at the {formatPounds(sampleComparison.adultPence)} weekly cap. Some trip charges differ as they reach it at different times, but the off-peak Railcard discount does not lower this week’s total. Try the Off-peak week to see where it helps.</p>
                  </div>
                {/if}
              {:else if showsMonthlyComparison}
                {#if ledgerStep >= sampleTransactions.length}
                <div class="monthly-example" in:fade={{ duration: reducePreviewMotion ? 0 : 260 }}>
                  <div class="savings-story-heading">
                    <div>
                      <h3>30-day comparison</h3>
                      <p>Four copies of this week, then Monday and Tuesday again.</p>
                    </div>
                    {#if previewComplete}
                    <button class="savings-replay" type="button" aria-label="Replay the sample journeys and price bars" onclick={() => void playSavingsPreview()}>
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7">
                        <path d="M16.4 9.4a6.5 6.5 0 1 1-2-4.5" />
                        <path d="M16.5 3.5v4.2h-4.2" />
                      </svg>
                      Replay
                    </button>
                    {/if}
                  </div>
                  <div class="monthly-weeks" aria-label="30-day projection progress">
                    {#each sampleWeeks as week}
                      <span class:earned={savingsWeek >= week}>Week {week}</span>
                    {/each}
                    <span class:earned={monthExtraDaysShown}>+2 days</span>
                  </div>
                  <div class="monthly-example-prices">
                    <span>Adult PAYG <strong>{formatPounds(monthlyPaygSoFar)}</strong></span>
                    <span>{activeSampleComparison === "student" ? "18+ Student Monthly" : "Monthly Travelcard"} <strong>{formatPounds(monthlyProductPence)}</strong></span>
                  </div>
                  {#if monthExtraDaysShown}
                    <p class="monthly-example-saving">Save <strong>{formatPounds(monthlySavingPence)}</strong> across these 30 days.</p>
                  {:else}
                    <p class="monthly-example-progress">{savingsWeek === 0 ? "Adding the same journeys week by week…" : `After ${savingsWeek} ${savingsWeek === 1 ? "week" : "weeks"} of the same journeys`}</p>
                  {/if}
                  <small>30 days starting Monday. The pass lasts a calendar month; your result depends on dates and journeys.</small>
                </div>
                {/if}
              {:else}
              <div
                class="savings-story"
                role="group"
                aria-label={`Four identical ${activeSampleComparison} sample weeks at ${formatPounds(weeklyDifferencePence)} difference each would total ${formatPounds(weeklyDifferencePence * repeatedWeeks)}. This is not a monthly fare quote.`}
              >
                <div class="savings-story-heading">
                  <div>
                    <h3>Four-week projection</h3>
                    <p>Four identical weeks, not a monthly fare quote.</p>
                  </div>
                  {#if previewComplete}
                  <button
                    class="savings-replay"
                    type="button"
                    aria-label="Replay the sample journeys and savings animation"
                    onclick={() => void playSavingsPreview()}
                  >
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7">
                      <path d="M16.4 9.4a6.5 6.5 0 1 1-2-4.5" />
                      <path d="M16.5 3.5v4.2h-4.2" />
                    </svg>
                    Replay
                  </button>
                  {/if}
                </div>
                <div class="savings-weeks" aria-hidden="true">
                  {#each sampleWeeks as week}
                    <div class="savings-week" class:earned={savingsWeek >= week}>
                      <span class="week-track"><span></span></span>
                      <span class="week-label">Week {week}</span>
                      <strong>+{formatPounds(weeklyDifferencePence)}</strong>
                    </div>
                  {/each}
                </div>
                <div class="savings-total" aria-hidden="true">
                  <span>{savingsWeek === 0 ? "Starting point" : `After ${savingsWeek} ${savingsWeek === 1 ? "week" : "weeks"}`}</span>
                  <strong>{formatPounds(weeklyDifferencePence * savingsWeek)}</strong>
                </div>
              </div>
              {/if}
              <small class="outcome-note">{sampleComparison.note} Upload your journeys for your own comparison.</small>
            </article>
          </div>
        </section>

        {#if showUpload}
          <section
            class="upload-shell animate-slide-up"
            id="upload-journey-history"
            bind:this={uploadSection}
            aria-labelledby="upload-heading"
          >
            <div class="upload-shell-header">
              <div>
                <h2 id="upload-heading">Upload journey history</h2>
                <p>Most analyses take a few minutes, including live fare checks with TfL.</p>
              </div>
              <span class="local-processing">Processed locally</span>
            </div>
            <FileUpload />
            <div class="first-run-actions">
              <button class="text-action" onclick={openExportGuide}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.8 9a2.35 2.35 0 0 1 4.4 1.15c0 1.85-2.2 2.1-2.2 3.6" />
                  <path d="M12 17.25h.01" />
                </svg>
                How do I export my TfL CSV?
              </button>
              <button class="text-action" onclick={openDemoProfiles}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M5 4h14v16H5z" />
                  <path d="M8 8h8M8 12h8M8 16h5" />
                </svg>
                Explore with sample journeys
              </button>
            </div>
          </section>
        {/if}

        <section class="first-run-proof" aria-label="What OysterSavings provides">
          <div class="proof-heading">
            <h2>A recommendation grounded in your journeys</h2>
            <p>See what you spent, which product is cheaper, the estimated saving, and the data behind the answer.</p>
          </div>
          <ol class="outcome-list">
            <li>
              <span class="proof-station" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M7 3h7l4 4v14H7z" />
                  <path d="M14 3v5h5M10 12h5M10 16h5" />
                </svg>
              </span>
              <div><strong>Read your journeys</strong><p>Your TfL export is processed in this browser.</p></div>
            </li>
            <li>
              <span class="proof-station" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="6" cy="12" r="2.5" />
                  <circle cx="18" cy="6" r="2.5" />
                  <circle cx="18" cy="18" r="2.5" />
                  <path d="m8.3 10.9 7.4-3.8M8.3 13.1l7.4 3.8" />
                </svg>
              </span>
              <div><strong>Check every rule</strong><p>Routes, caps, discounts and current TfL fares are tested.</p></div>
            </li>
            <li>
              <span class="proof-station" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M5 12.5 9.2 17 19 7" />
                </svg>
              </span>
              <div><strong>See the best fit</strong><p>Products are compared with the saving made explicit.</p></div>
            </li>
          </ol>
        </section>
      </main>
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
                <button class="btn-skip" onclick={() => void goToStep(6)}>
                  Skip to Upload ➔
                </button>
                <span class="step-indicator-divider">|</span>
              {/if}
              <div class="step-indicator">
                Step <span class="current-step">{walkthroughStep}</span> of 6
              </div>
            </div>
          </div>

          <!-- Redesigned Walkthrough Progress Stepper -->
          <div class="walkthrough-stepper-container">
            <div class="stepper-track-bg">
              <div
                class="stepper-track-fill"
                style="width: {((walkthroughStep - 1) / 5) * 100}%;"
              ></div>
            </div>
            <div class="stepper-items">
              {#each [
                { step: 1, title: "Sign In" },
                { step: 2, title: "Select Card" },
                { step: 3, title: "View History" },
                { step: 4, title: "Select Dates" },
                { step: 5, title: "Export CSV" },
                { step: 6, title: "Upload" }
              ] as s}
                <button
                  type="button"
                  class="stepper-btn"
                  class:active={walkthroughStep === s.step}
                  class:completed={walkthroughStep > s.step}
                  onclick={() => void goToStep(s.step)}
                  aria-label="Step {s.step}: {s.title}"
                >
                  <span class="stepper-circle">
                    {#if walkthroughStep > s.step}
                      ✓
                    {:else}
                      {s.step}
                    {/if}
                  </span>
                  <span class="stepper-label">{s.title}</span>
                </button>
              {/each}
            </div>
          </div>

          <!-- Mobile Step Banner -->
          <div class="mobile-step-banner md:hidden">
            <span class="mobile-step-badge">Step {walkthroughStep} of 6</span>
            <span class="mobile-step-name">{stepTitles[walkthroughStep - 1]}</span>
          </div>

          <!-- Step Content -->
          <div class="step-content-container" bind:this={stepContentContainer}>
            {#if walkthroughStep === 1}
              <div class="step-pane step-swap" class:from-previous={stepDirection < 0}>
                <div class="step-desc">
                  <h2>1. Sign in to your TfL Account</h2>
                  <p>Visit the official Transport for London (TfL) account portal and sign in with your registered email address and password.</p>
                  <a href="https://tfl.gov.uk/fares/contactless-and-oyster-account" target="_blank" rel="noopener noreferrer" class="btn-primary walkthrough-external-btn">
                    🌐 Open TfL Portal <span class="external-icon">↗</span>
                  </a>
                </div>
                <div class="step-screenshot-wrapper">
                  <img src="/images/tfl-walkthrough/tfl_login_step.png" alt="TfL Sign In Screen" class="step-screenshot" width="1024" height="535" decoding="async" fetchpriority="high" />
                  <div class="screenshot-caption">The TfL account sign-in page.</div>
                </div>
              </div>
            {:else if walkthroughStep === 2}
              <div class="step-pane step-swap" class:from-previous={stepDirection < 0}>
                <div class="step-desc">
                  <h2>2. Select Your Travel Card</h2>
                  <p>From the Dashboard main screen, click <strong>Go to Oyster</strong> or <strong>Go to contactless</strong> depending on which payment card you use for travel.</p>
                </div>
                <div class="step-screenshot-wrapper">
                  <img src="/images/tfl-walkthrough/tfl_card_select.png" alt="TfL Dashboard Select Card" class="step-screenshot" width="1024" height="595" decoding="async" />
                  <div class="screenshot-caption">Select the Oyster or Contactless card you want to view.</div>
                </div>
              </div>
            {:else if walkthroughStep === 3}
              <div class="step-pane step-swap" class:from-previous={stepDirection < 0}>
                <div class="step-desc">
                  <h2>3. Go to Journey History</h2>
                  <p>On your travel card overview page, locate the <strong>Journeys</strong> card or sidebar menu and select <strong>View journey history</strong>.</p>
                </div>
                <div class="step-screenshot-wrapper">
                  <img src="/images/tfl-walkthrough/tfl_view_history.png" alt="TfL Oyster Card Overview" class="step-screenshot" width="1024" height="737" decoding="async" />
                  <div class="screenshot-caption">Click the "View journey history" link to access your travel log.</div>
                </div>
              </div>
            {:else if walkthroughStep === 4}
              <div class="step-pane step-swap" class:from-previous={stepDirection < 0}>
                <div class="step-desc">
                  <h2>4. Choose Date Range</h2>
                  <p>Select your desired date range from the dropdown menu (or specify a custom range using the date picker) and click <strong>Submit</strong> to load the journey records.</p>
                </div>
                <div class="step-screenshot-wrapper">
                  <img src="/images/tfl-walkthrough/tfl_date_select.png" alt="TfL Journey History Date Selector" class="step-screenshot" width="1024" height="822" decoding="async" />
                  <div class="screenshot-caption">Select a date range and click submit.</div>
                </div>
              </div>
            {:else if walkthroughStep === 5}
              <div class="step-pane step-swap" class:from-previous={stepDirection < 0}>
                <div class="step-desc">
                  <h2>5. Download CSV Statement</h2>
                  <p>Scroll down to the bottom of the journey records table and click the <strong>Download CSV format</strong> button to download your travel history file.</p>
                </div>
                <div class="step-screenshot-wrapper">
                  <img src="/images/tfl-walkthrough/tfl_export_step.png" alt="TfL CSV Statement Download Link" class="step-screenshot" width="985" height="675" decoding="async" />
                  <div class="screenshot-caption">Click the "Download CSV format" button at the bottom of the table.</div>
                </div>
              </div>
            {:else if walkthroughStep === 6}
              <div class="step-pane upload-pane step-swap" class:from-previous={stepDirection < 0}>
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
                        <button
                          class="btn-primary btn-demo-load"
                          disabled={loadingDemoProfileId !== null}
                          onclick={() => handleLoadDemo(profile.id, profile.name)}
                        >
                          {#if loadingDemoProfileId === profile.id}
                            <span class="inline-spinner"></span>
                            Loading {profile.name}...
                          {:else}
                            ⚡ Load {profile.name}'s Log
                          {/if}
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
              <button class="btn-secondary walkthrough-nav-button" onclick={prevStep}>
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="m12.5 4.5-5 5.5 5 5.5" />
                </svg>
                Previous
              </button>
            {:else}
              <button class="btn-secondary walkthrough-nav-button" style="visibility: hidden;" tabindex="-1" aria-hidden="true">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="m12.5 4.5-5 5.5 5 5.5" />
                </svg>
                Previous
              </button>
            {/if}

            <div class="walkthrough-dots">
              {#each [1, 2, 3, 4, 5, 6] as step}
                <button class="walkthrough-dot" class:active={walkthroughStep === step} onclick={() => void goToStep(step)} aria-label="Go to step {step}"></button>
              {/each}
            </div>

            {#if walkthroughStep < 6}
              <button class="btn-primary walkthrough-nav-button" onclick={nextStep}>
                Next
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="m7.5 4.5 5 5.5-5 5.5" />
                </svg>
              </button>
            {:else}
              <button class="btn-primary walkthrough-nav-button" style="visibility: hidden;" tabindex="-1" aria-hidden="true">
                Next
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="m7.5 4.5 5 5.5-5 5.5" />
                </svg>
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
      <div class="stats-grid grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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

  <!-- Demo Profile Loading Overlay -->
  {#if loadingDemoProfileId}
    <div class="demo-loading-overlay animate-fade-in" role="status" aria-live="polite">
      <div class="demo-loading-box glass-card">
        <div class="tfl-roundel-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-bar"></div>
        </div>
        <h3 class="loading-title">Loading {loadingProfileName}'s Commute...</h3>
        <p class="loading-desc">Simulating journeys, capping rules, and calculating TfL fare savings</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .home-page {
    max-width: 900px;
    margin: 0 auto;
  }

  .first-run {
    position: relative;
    padding: clamp(1.5rem, 5vw, 4rem) 0 2rem;
  }

  .first-run-intro {
    position: relative;
    z-index: 1;
    width: min(100%, 880px);
    margin: 0 auto;
    text-align: center;
  }

  .first-run-intro h1 {
    max-width: 18ch;
    margin: 0 auto;
    color: var(--color-text-primary);
    font-size: clamp(2.35rem, 6vw, 4rem);
    font-weight: 780;
    letter-spacing: -0.035em;
    line-height: 1.04;
    text-wrap: balance;
  }

  .intro-summary {
    max-width: 58ch;
    margin: 1.35rem auto 0;
    color: var(--color-text-secondary);
    font-size: clamp(1rem, 2vw, 1.08rem);
    line-height: 1.65;
    text-wrap: balance;
  }

  .hero-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.85rem;
    margin-top: 2rem;
  }

  .generate-analysis,
  .github-cta {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.72rem 1.25rem;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
  }

  .generate-analysis {
    color: white;
    background: var(--color-oyster-blue-dark);
    border: 1px solid #0aa9ef;
  }

  .generate-analysis svg,
  .github-cta svg {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
  }

  .generate-analysis:hover {
    background: var(--color-oyster-blue);
    transform: translateY(-1px);
  }

  .github-cta {
    color: var(--color-text-primary);
    background: #202a3b;
    border: 1px solid rgba(180, 202, 228, 0.42);
  }

  .github-cta:hover {
    color: white;
    background: #2a3950;
    border-color: rgba(213, 231, 248, 0.68);
    transform: translateY(-1px);
  }

  .generate-analysis:focus-visible,
  .github-cta:focus-visible {
    outline: 3px solid rgba(0, 159, 227, 0.42);
    outline-offset: 3px;
  }

  .journey-vignette {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    gap: 0;
    margin: clamp(2.75rem, 6vw, 4.25rem) auto 0;
    text-align: left;
    border: 1px solid rgba(129, 164, 197, 0.2);
    border-radius: 16px;
    background: rgba(16, 24, 38, 0.94);
    box-shadow: 0 24px 72px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .journey-map {
    display: grid;
    align-content: center;
    gap: 2.1rem;
    padding: 2.5rem clamp(1.5rem, 4vw, 3rem);
    background:
      radial-gradient(circle at 12% 10%, rgba(0, 159, 227, 0.13), transparent 55%),
      #0c1728;
    border-right: 1px solid rgba(129, 164, 197, 0.14);
  }

  .journey-route {
    position: relative;
    display: grid;
    gap: 2.1rem;
    width: 100%;
  }

  .journey-line {
    position: absolute;
    left: 11px;
    top: 25px;
    bottom: 25px;
    width: 4px;
    border-radius: 10px;
    background: linear-gradient(var(--color-oyster-blue), var(--color-elizabeth-purple) 52%, var(--color-overground-orange));
  }

  .journey-runner {
    position: absolute;
    z-index: 2;
    left: 7px;
    top: 19px;
    width: 12px;
    height: 12px;
    border: 2px solid white;
    border-radius: 50%;
    background: var(--color-oyster-blue);
    box-shadow: 0 3px 13px rgba(0, 159, 227, 0.65);
  }

  .journey-runner.playing {
    animation: journey-travel 4.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .journey-runner.complete {
    top: calc(100% - 31px);
    background: var(--color-overground-orange);
    box-shadow: 0 3px 13px rgba(231, 113, 13, 0.45);
  }

  @keyframes journey-travel {
    0%, 8% { top: 19px; background: var(--color-oyster-blue); }
    48%, 57% { top: calc(50% - 6px); background: var(--color-elizabeth-purple); }
    94%, 100% { top: calc(100% - 31px); background: var(--color-overground-orange); }
  }

  .journey-stop {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 1rem;
    align-items: center;
    min-width: 0;
    min-height: 50px;
  }

  .stop-marker {
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    border: 4px solid var(--stop-color);
    border-radius: 50%;
    background: #0c1728;
  }

  .journey-stop-blue { --stop-color: var(--color-oyster-blue); }
  .journey-stop-purple { --stop-color: var(--color-elizabeth-purple); }
  .journey-stop-orange { --stop-color: var(--color-overground-orange); }

  .stop-copy { display: grid; gap: 0.15rem; }
  .stop-copy strong { color: var(--color-text-primary); font-size: 0.92rem; }
  .stop-copy small { color: #aebed0; font-size: 0.74rem; }
  .stop-label-compact { display: none; }

  .journey-pattern-choice { display: grid; gap: 0.5rem; padding: 0.55rem 0; }
  .journey-pattern-choice > span { color: #e3eef8; font-size: 0.78rem; font-weight: 700; }
  .journey-pattern-choice > small { color: #b1c4d8; font-size: 0.7rem; line-height: 1.35; }
  .journey-pattern-switch { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.35rem; }
  .journey-pattern-switch button {
    min-height: 44px;
    padding: 0.4rem 0.35rem;
    border: 1px solid rgba(139, 172, 203, 0.25);
    border-radius: 0.5rem;
    background: rgba(25, 46, 70, 0.5);
    color: #b8c9d9;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1.2;
    cursor: pointer;
  }
  .journey-pattern-switch button:hover { border-color: rgba(139, 172, 203, 0.6); color: white; }
  .journey-pattern-switch button[aria-pressed="true"] { border-color: rgba(79, 195, 230, 0.7); background: rgba(21, 105, 144, 0.4); color: white; }
  .journey-pattern-switch button:focus-visible { outline: 3px solid rgba(0, 159, 227, 0.65); outline-offset: 2px; }

  .sample-ledger {
    min-width: 0;
    padding-top: 0.9rem;
    border-top: 1px solid rgba(129, 164, 197, 0.17);
  }

  .ledger-heading,
  .ledger-transaction-top {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .ledger-heading { align-items: baseline; color: #e3eef8; font-size: 0.78rem; }
  .ledger-heading > span { flex: 0 0 auto; color: #b1c4d8; font-size: 0.72rem; font-variant-numeric: tabular-nums; }

  .ledger-window {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 0;
    height: 250px;
    padding: 0.35rem 0;
    overflow: hidden;
  }

  .ledger-empty { margin: auto 0; color: #b1c4d8; font-size: 0.78rem; }
  .ledger-transaction {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
    padding: 0.45rem 0;
    border-bottom: 1px solid rgba(139, 172, 203, 0.19);
  }
  .ledger-transaction-top { color: #b7cadc; font-size: 0.73rem; font-variant-numeric: tabular-nums; }
  .ledger-mode-and-time { display: inline-flex; align-items: center; gap: 0.35rem; min-width: 0; }
  .ledger-mode-icon { width: 17px; height: 17px; flex: 0 0 17px; }
  .tube-icon { color: #60c9f2; }
  .bus-icon { color: #f0a36c; }
  .ledger-transaction-top strong { color: white; white-space: nowrap; }
  .ledger-route-name { color: white; font-size: 0.75rem; font-weight: 650; line-height: 1.3; }
  .ledger-adjustment { color: #90daba; font-size: 0.71rem; line-height: 1.3; }
  .ledger-adjustment strong { color: #a4eacb; font-variant-numeric: tabular-nums; }

  .ledger-context {
    display: block;
    min-height: 1.3em;
    margin: 0;
    color: #b1c4d8;
    font-size: 0.66rem;
    line-height: 1.3;
  }

  .outcome-preview {
    padding: clamp(1.5rem, 3.8vw, 2.5rem);
  }

  .outcome-preview-header {
    display: block;
  }

  .outcome-preview-header h2 {
    margin: 0;
    color: white;
    font-size: clamp(1.25rem, 2.5vw, 1.55rem);
    line-height: 1.18;
    letter-spacing: -0.025em;
  }

  .sample-switch {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.25rem;
    margin-top: 1.25rem;
    padding: 0.25rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.7rem;
    background: rgba(5, 20, 39, 0.55);
  }

  .sample-switch button {
    min-height: 44px;
    padding: 0.5rem 0.2rem;
    border: 1px solid transparent;
    border-radius: 0.48rem;
    background: transparent;
    color: #b8c9d9;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 180ms ease-out, color 180ms ease-out, border-color 180ms ease-out;
  }

  .sample-switch button:hover { color: white; }
  .sample-switch button[aria-pressed="true"] {
    border-color: rgba(79, 195, 230, 0.38);
    background: rgba(21, 105, 144, 0.34);
    color: white;
  }
  .sample-switch button:focus-visible { outline: 3px solid rgba(0, 159, 227, 0.65); outline-offset: 2px; }

  .outcome-preview > p {
    margin: 0.65rem 0 1.1rem;
    color: #aebed0;
    font-size: 0.85rem;
    line-height: 1.55;
  }

  .fare-comparison { display: grid; gap: 1rem; }
  .fare-row { display: grid; gap: 0.5rem; }
  .fare-row-label { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.83rem; color: #bdcadd; }
  .fare-row-label strong { color: white; font-variant-numeric: tabular-nums; }
  .fare-row.is-best .fare-row-label { color: #7ee0ba; }

  .fare-track {
    height: 7px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
  }

  .fare-track > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #697e95;
    transform-origin: left;
    transition: transform 710ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .is-best .fare-track > span { background: #23b98c; }

  .monthly-example { display: grid; gap: 0.55rem; margin-top: 1.2rem; padding-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.1); }
  .monthly-weeks { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.35rem; margin: 0.45rem 0; }
  .monthly-weeks span { min-width: 0; padding-bottom: 0.35rem; border-bottom: 3px solid rgba(255, 255, 255, 0.14); color: #aebed0; font-size: 0.67rem; text-align: center; white-space: nowrap; transition: border-color 420ms ease-out, color 420ms ease-out; }
  .monthly-weeks span.earned { border-color: #2ac397; color: #8be5c2; }
  .monthly-example-prices { display: flex; flex-wrap: wrap; gap: 0.45rem 1.2rem; color: #bdcadd; font-size: 0.76rem; }
  .monthly-example-prices span { display: inline-flex; gap: 0.35rem; }
  .monthly-example-prices strong { color: white; font-variant-numeric: tabular-nums; }
  .monthly-example-saving { margin: 0; color: #7ee0ba; font-size: 0.84rem; font-weight: 700; }
  .monthly-example-saving strong { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
  .monthly-example-progress { margin: 0; color: #b8c9d9; font-size: 0.76rem; }
  .monthly-example > small { color: #b1c4d8; font-size: 0.7rem; line-height: 1.5; }

  .railcard-tie { margin-top: 1.2rem; padding-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.1); }
  .railcard-tie-heading { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .railcard-tie-heading strong { color: #e3eef8; font-size: 0.85rem; }
  .railcard-tie p { margin: 0.35rem 0 0; color: #b8c9d9; font-size: 0.75rem; line-height: 1.5; }

  .fare-progress-note {
    display: block;
    margin-top: 0.7rem;
    color: #aebed0;
    font-size: 0.69rem;
    line-height: 1.45;
  }

  .saving-summary {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    color: #c2d1df;
    font-size: 0.82rem;
  }

  .saving-summary strong {
    color: #7ee0ba;
    font-size: 1.16rem;
    font-variant-numeric: tabular-nums;
  }
  .saving-summary small { display: block; margin-top: 0.25rem; color: #aebed0; font-size: 0.72rem; }

  .savings-story {
    margin-top: 1.5rem;
  }

  .savings-story-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .savings-story-heading h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 0.92rem;
    font-weight: 700;
  }

  .savings-story-heading p {
    margin: 0.2rem 0 0;
    color: #b8c9d9;
    font-size: 0.72rem;
    line-height: 1.4;
  }

  .savings-replay {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    flex: 0 0 auto;
    min-height: 44px;
    padding: 0.4rem 0.8rem;
    border: 1px solid rgba(122, 217, 247, 0.5);
    border-radius: 0.6rem;
    background: rgba(0, 159, 227, 0.13);
    color: #b8efff;
    font: inherit;
    font-size: 0.73rem;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
  }

  .savings-replay svg {
    width: 16px;
    height: 16px;
  }

  .savings-replay:hover { background: rgba(0, 159, 227, 0.25); border-color: #7ad9f7; color: white; }
  .savings-replay:active { background: rgba(0, 159, 227, 0.32); }
  .savings-replay:focus-visible { outline: 3px solid rgba(122, 217, 247, 0.75); outline-offset: 3px; }

  .savings-weeks {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.45rem;
    margin-top: 1rem;
  }

  .savings-week {
    display: grid;
    gap: 0.27rem;
    min-width: 0;
    color: #9aacc0;
    font-size: 0.67rem;
    font-variant-numeric: tabular-nums;
    transition: color 180ms ease-out;
  }

  .savings-week.earned { color: #8be5c2; }

  .week-track {
    display: block;
    height: 5px;
    overflow: hidden;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.11);
  }

  .week-track > span {
    display: block;
    width: 100%;
    height: 100%;
    background: #2ac397;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .savings-week.earned .week-track > span { transform: scaleX(1); }
  .savings-week strong { font-size: 0.73rem; font-weight: 700; white-space: nowrap; }

  .savings-total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    margin-top: 1.15rem;
    padding-top: 0.8rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    color: #b8c9d9;
    font-size: 0.77rem;
  }

  .savings-total strong {
    color: #7ee0ba;
    font-size: 1.4rem;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .outcome-note {
    display: block;
    margin-top: 0.8rem;
    color: #9caec2;
    font-size: 0.7rem;
    line-height: 1.5;
  }

  .upload-shell {
    width: min(100%, 680px);
    scroll-margin-top: 6.5rem;
    margin: 2.25rem auto 0;
    padding: clamp(1rem, 3vw, 1.5rem);
    background: #101725;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
  }

  .upload-shell-header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .upload-shell-header h2 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 700;
  }

  .upload-shell-header p,
  .local-processing {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    line-height: 1.45;
  }

  .local-processing {
    flex: 0 0 auto;
    padding-top: 0.15rem;
  }

  .upload-shell :global(.upload-zone) {
    min-height: 228px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 2rem 1.25rem;
    background: #0c121f;
    border-color: rgba(255, 255, 255, 0.14);
    border-radius: 12px;
  }

  .upload-shell :global(.upload-zone:focus-visible) {
    outline: 3px solid rgba(0, 159, 227, 0.42);
    outline-offset: 3px;
    border-color: var(--color-oyster-blue);
  }

  .first-run-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1.25rem;
    flex-wrap: wrap;
    padding-top: 1rem;
  }

  .text-action {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0;
    background: transparent;
    border: 0;
    color: var(--color-text-secondary);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    text-decoration: underline;
    text-decoration-color: transparent;
    text-underline-offset: 0.25rem;
    transition: color 0.16s ease, text-decoration-color 0.16s ease;
  }

  .text-action svg {
    width: 17px;
    height: 17px;
    flex: 0 0 auto;
  }

  .text-action:hover {
    color: var(--color-text-primary);
    text-decoration-color: var(--color-oyster-blue);
  }

  .text-action:focus-visible {
    outline: 3px solid rgba(0, 159, 227, 0.38);
    outline-offset: 4px;
    border-radius: 4px;
  }

  .first-run-proof {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: clamp(2rem, 7vw, 5rem);
    margin-top: clamp(4rem, 8vw, 5.5rem);
    padding-top: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .first-run-proof h2 {
    max-width: 18ch;
    margin: 0 0 0.75rem;
    font-size: clamp(1.35rem, 3vw, 1.75rem);
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .first-run-proof p {
    max-width: 48ch;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .outcome-list {
    position: relative;
    display: grid;
    gap: 1.15rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .outcome-list::before {
    content: '';
    position: absolute;
    z-index: 0;
    top: 22px;
    bottom: 22px;
    left: 21px;
    width: 2px;
    background: linear-gradient(var(--color-oyster-blue), var(--color-elizabeth-purple), var(--color-overground-orange));
  }

  .outcome-list li {
    position: relative;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
  }

  .proof-station {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 2px solid var(--color-oyster-blue);
    border-radius: 50%;
    background: #101827;
    color: #80d8f8;
  }

  .outcome-list li:nth-child(2) .proof-station { border-color: var(--color-elizabeth-purple); color: #c4a2dd; }
  .outcome-list li:nth-child(3) .proof-station { border-color: var(--color-overground-orange); color: #ffb878; }
  .proof-station svg { width: 20px; height: 20px; }

  .outcome-list strong {
    color: var(--color-text-primary);
    font-size: 0.91rem;
    font-weight: 700;
  }

  .outcome-list p {
    margin: 0.2rem 0 0;
    font-size: 0.78rem;
    line-height: 1.45;
  }

  @media (max-width: 760px) {
    .first-run {
      padding-top: 1.25rem;
    }

    .first-run-proof {
      grid-template-columns: 1fr;
    }

    .journey-vignette { grid-template-columns: 1fr; }
    .journey-map { gap: 0.8rem; padding: 1rem 1.25rem; border-right: 0; border-bottom: 1px solid rgba(129, 164, 197, 0.14); }
    .journey-route { gap: 0; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .journey-line { left: 13px; right: 13px; top: 11px; bottom: auto; width: auto; height: 4px; background: linear-gradient(90deg, var(--color-oyster-blue), var(--color-elizabeth-purple), var(--color-overground-orange)); }
    .journey-runner { top: 7px; left: 7px; }
    .journey-runner.playing { animation: journey-travel-mobile 4.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .journey-runner.complete { top: 7px; left: calc(100% - 19px); }
    @keyframes journey-travel-mobile {
      0%, 8% { left: 7px; background: var(--color-oyster-blue); }
      48%, 57% { left: calc(50% - 6px); background: var(--color-elizabeth-purple); }
      94%, 100% { left: calc(100% - 19px); background: var(--color-overground-orange); }
    }
    .journey-stop { display: grid; width: 100%; min-width: 0; min-height: 0; justify-items: start; align-content: start; gap: 0.35rem; }
    .journey-stop:last-child { justify-items: end; text-align: right; }
    .journey-stop-purple { justify-items: center; text-align: center; }
    .stop-copy { width: 100%; min-width: 0; }
    .stop-copy strong { display: block; font-size: 0.72rem; line-height: 1.25; overflow-wrap: normal; }
    .stop-label-full { display: none; }
    .stop-label-compact { display: inline; }
    .stop-copy small { display: none; }
    .outcome-preview { padding: 1.25rem; }

    .first-run-intro h1 {
      max-width: 16ch;
      font-size: clamp(2.2rem, 10vw, 3.15rem);
    }

    .intro-summary {
      font-size: 0.95rem;
    }

    .hero-actions {
      width: min(100%, 360px);
      margin-right: auto;
      margin-left: auto;
      flex-direction: column;
    }

    .generate-analysis,
    .github-cta {
      width: 100%;
    }

    .upload-shell-header {
      display: block;
    }

    .local-processing {
      display: block;
      margin-top: 0.45rem;
    }

    .upload-shell :global(.upload-zone) {
      min-height: 196px;
      padding: 1.5rem 1rem;
    }

    .first-run-actions {
      align-items: flex-start;
      flex-direction: column;
    }

    .first-run-proof {
      gap: 1.5rem;
      margin-top: 3.5rem;
    }
  }

  @media (max-width: 380px) {
    .sample-switch button { font-size: 0.7rem; }
    .ledger-window { height: 265px; }
    .saving-summary { display: grid; gap: 0.35rem; }
    .saving-summary strong { font-size: 1.05rem; white-space: nowrap; }
  }

  @media (max-width: 390px) {
    .stop-copy small { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .journey-runner.playing { animation: none; }
    .week-track > span,
    .savings-week,
    .fare-track > span { transition: none; }
    .savings-replay { display: none; }
    .generate-analysis:hover,
    .github-cta:hover { transform: none; }
  }

  /* Dashboard */
  .dashboard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
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

  /* Demo Profiles Grid and Cards */
  .demo-profiles-container {
    margin-top: 2rem;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-demo-load:hover:not(:disabled) {
    background: var(--profile-accent);
    border-color: var(--profile-accent);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
  }

  .inline-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Walkthrough Section */
  .walkthrough-section {
    margin: 1rem 0 2.5rem;
  }

  .walkthrough-card {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  @media (min-width: 768px) {
    .walkthrough-card {
      padding: 2.5rem;
      gap: 2rem;
    }
  }

  .walkthrough-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 1rem;
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

  /* Redesigned Progress Stepper */
  .walkthrough-stepper-container {
    position: relative;
    width: 100%;
    max-width: 620px;
    margin: 0.5rem auto 0;
  }

  .stepper-track-bg {
    position: absolute;
    top: 16px;
    left: 20px;
    right: 20px;
    height: 2px;
    background: rgba(255, 255, 255, 0.08);
    z-index: 0;
    border-radius: 999px;
  }

  .stepper-track-fill {
    height: 100%;
    background: linear-gradient(90deg, #009fe3, #10b981);
    border-radius: 999px;
    transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .stepper-items {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .stepper-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .stepper-circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #0a0e1a;
    border: 2px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.825rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 0 3px #0a0e1a;
  }

  .stepper-label {
    font-size: 0.725rem;
    font-weight: 500;
    color: var(--color-text-muted);
    transition: color 0.2s ease;
    white-space: nowrap;
  }

  .stepper-btn.active .stepper-circle {
    border-color: var(--color-oyster-blue);
    background: var(--color-oyster-blue);
    color: white;
    box-shadow: 0 0 0 3px #0a0e1a, 0 0 16px rgba(0, 159, 227, 0.5);
    transform: scale(1.08);
  }

  .stepper-btn.active .stepper-label {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .stepper-btn.completed .stepper-circle {
    border-color: var(--color-success);
    background-color: #0b221d;
    background-color: color-mix(in srgb, var(--color-success) 16%, #0a0e1a);
    color: var(--color-success);
    box-shadow: 0 0 0 3px #0a0e1a;
  }

  .stepper-btn.completed .stepper-label {
    color: var(--color-text-secondary);
  }

  /* Mobile Stepper Adjustments */
  @media (max-width: 640px) {
    .stepper-track-bg {
      top: 14px;
      left: 14px;
      right: 14px;
    }

    .stepper-circle {
      width: 28px;
      height: 28px;
      font-size: 0.75rem;
      box-shadow: 0 0 0 2px #0a0e1a;
    }

    .stepper-btn.completed .stepper-circle,
    .stepper-btn.active .stepper-circle {
      box-shadow: 0 0 0 2px #0a0e1a;
    }

    .stepper-label {
      display: none;
    }
  }

  .mobile-step-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    margin-top: 0.5rem;
  }

  .mobile-step-badge {
    font-size: 0.725rem;
    font-weight: 700;
    color: var(--color-oyster-blue);
    background: rgba(0, 159, 227, 0.1);
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
  }

  .mobile-step-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: white;
  }

  /* Pane layouts */
  .step-pane {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    align-items: center;
  }

  @keyframes step-swap-forward {
    from {
      opacity: 0.72;
      transform: translateX(10px);
    }
  }

  @keyframes step-swap-back {
    from {
      opacity: 0.72;
      transform: translateX(-10px);
    }
  }

  .step-swap {
    animation: step-swap-forward 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .step-swap.from-previous {
    animation-name: step-swap-back;
  }

  @media (min-width: 768px) {
    .step-pane {
      grid-template-columns: 1.2fr 1.8fr;
      gap: 2.5rem;
      min-height: 320px;
    }
  }

  .step-desc {
    text-align: left;
  }

  .step-desc h2 {
    font-size: clamp(1.2rem, 4vw, 1.5rem);
    font-weight: 800;
    margin-bottom: 0.75rem;
    letter-spacing: -0.02em;
    color: white;
  }

  .step-desc p {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin-bottom: 1.25rem;
  }

  .walkthrough-external-btn {
    text-decoration: none;
    display: inline-flex;
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
    background: rgba(0, 0, 0, 0.3);
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    transition: all 0.3s ease;
    width: 100%;
  }

  .step-screenshot-wrapper:hover {
    border-color: var(--color-border-accent);
    box-shadow: 0 15px 40px rgba(0, 159, 227, 0.15);
  }

  .step-screenshot {
    width: 100%;
    height: auto;
    max-height: 360px;
    object-fit: contain;
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
    background: rgba(10, 14, 26, 0.9);
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
    font-size: clamp(1.25rem, 4vw, 1.5rem);
    font-weight: 800;
    margin-bottom: 0.5rem;
    color: white;
  }

  .step-desc-centered p {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .walkthrough-demo-profiles {
    margin-top: 2rem;
    border-top: 1px solid var(--color-border);
    padding-top: 2rem;
    width: 100%;
  }

  /* Footer actions */
  .walkthrough-footer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--color-border);
    padding-top: 1.25rem;
    margin-top: 0.5rem;
    gap: 0.5rem;
  }

  .walkthrough-nav-button {
    min-width: 7.5rem;
    min-height: 44px;
    justify-content: center;
    white-space: nowrap;
  }

  .walkthrough-nav-button svg {
    width: 1rem;
    height: 1rem;
    flex: 0 0 auto;
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

  @media (max-width: 640px) {
    .walkthrough-footer-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 0.75rem;
    }

    .walkthrough-dots {
      grid-column: 1 / -1;
      grid-row: 1;
      justify-content: center;
      padding-bottom: 0.125rem;
    }

    .walkthrough-nav-button {
      width: 100%;
      min-width: 0;
      padding-inline: 0.875rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .step-swap,
    .step-swap.from-previous {
      animation: none;
    }
  }

  /* Demo Loading Overlay */
  .demo-loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(10, 14, 26, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .demo-loading-box {
    background: rgba(17, 24, 39, 0.95);
    border: 1px solid rgba(0, 159, 227, 0.3);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 159, 227, 0.2);
    border-radius: 16px;
    padding: 2.5rem 2rem;
    max-width: 420px;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .tfl-roundel-spinner {
    position: relative;
    width: 64px;
    height: 64px;
    margin-bottom: 0.5rem;
  }

  .spinner-ring {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 4px solid rgba(0, 159, 227, 0.2);
    border-top-color: var(--color-oyster-blue);
    border-right-color: #6f4390;
    animation: spin 1s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
  }

  .spinner-bar {
    position: absolute;
    top: 50%;
    left: -4px;
    right: -4px;
    height: 10px;
    background: linear-gradient(90deg, #009fe3, #e7710d);
    border-radius: 4px;
    transform: translateY(-50%);
    box-shadow: 0 0 10px rgba(0, 159, 227, 0.4);
  }

  .loading-title {
    font-size: 1.2rem;
    font-weight: 800;
    color: white;
    margin: 0;
  }

  .loading-desc {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }
</style>

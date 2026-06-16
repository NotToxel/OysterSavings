<script lang="ts">
  import { slide } from "svelte/transition";

  interface FAQItem {
    id: string;
    category: "capping" | "peak" | "discounts" | "privacy";
    question: string;
    answerHtml: string;
  }

  // FAQ static database
  const faqs: FAQItem[] = [
    {
      id: "capping-how",
      category: "capping",
      question: "How do TfL daily and weekly capping work?",
      answerHtml: `
        <p>Capping limits the maximum amount you pay for all your journeys in a single day or week. Once your fares reach the cap, any subsequent journeys in that period are free.</p>
        <ul>
          <li><strong>Daily Capping:</strong> Runs from <strong>04:30 AM to 04:29 AM</strong> the next day. All journeys made within this window contribute towards the daily cap of the zones you traveled through.</li>
          <li><strong>Weekly Capping:</strong> Runs from <strong>Monday to Sunday</strong>. If you travel frequently throughout the week, your total spend is capped at the equivalent price of a weekly Travelcard for those zones.</li>
        </ul>
        <p>OysterSavings automatically parses your CSV history to detect cap-hit days, calculates how much you saved from daily caps, and projects weekly cap benefits.</p>
      `,
    },
    {
      id: "oyster-vs-contactless",
      category: "capping",
      question:
        "What is the difference between Oyster and Contactless for capping?",
      answerHtml: `
        <p>Both physical Oyster cards and Contactless bank cards support daily and Monday-to-Sunday weekly capping. However, there are crucial differences:</p>
        <ul>
          <li><strong>Rolling Weekly Capping:</strong> Contactless cards feature Monday-to-Sunday capping automatically. Oyster cards also support Monday-to-Sunday weekly capping but require pre-loading pay-as-you-go credit.</li>
          <li><strong>Railcard Discounts:</strong> <strong class="text-accent">This is the biggest savings opportunity!</strong> You can link National Railcard discounts (e.g., 16-25, 26-30, Senior) to a physical Oyster card, which saves you 1/3 on off-peak single fares and off-peak daily caps. <strong>You cannot link Railcards to Contactless payment cards.</strong></li>
        </ul>
      `,
    },
    {
      id: "peak-offpeak-times",
      category: "peak",
      question: "What are the official Peak and Off-Peak times on TfL?",
      answerHtml: `
        <p>TfL charges different rates depending on the time you tap in at the start of your journey:</p>
        <ul>
          <li><strong>Peak Fares:</strong> Apply Monday to Friday from <strong>06:30 to 09:30</strong> and from <strong>16:00 to 19:00</strong> (excluding public holidays).</li>
          <li><strong>Off-Peak Fares:</strong> Apply at all other times, including all day on weekends and bank holidays. Good Friday and Easter Monday are always off-peak.</li>
          <li><strong>The Evening Peak Exemption:</strong> If you travel from a station <em>outside</em> Zone 1 to a station <em>inside</em> Zone 1 between 16:00 and 19:00 on weekdays, you are charged the lower <strong>Off-Peak</strong> rate. OysterSavings models this exemption to ensure your calculations are accurate.</li>
        </ul>
      `,
    },
    {
      id: "link-railcard",
      category: "discounts",
      question: "How do I link a National Railcard for TfL savings?",
      answerHtml: `
        <p>To get 1/3 off off-peak Pay-As-You-Go fares and off-peak daily caps, you must link your Railcard to a physical Oyster card:</p>
        <ol>
          <li>Take your physical Oyster card and a valid National Railcard (or a digital Railcard on your phone) to any Tube or TfL station.</li>
          <li>Locate a TfL station staff member. They can log in to a ticket machine and bind the Railcard discount to your Oyster card in less than two minutes.</li>
          <li>Once linked, the 1/3 discount is applied automatically when traveling off-peak. Note: You must renew the link when your Railcard expires.</li>
        </ol>
      `,
    },
    {
      id: "hopper-fare",
      category: "capping",
      question: "What is the Hopper Fare for buses and trams?",
      answerHtml: `
        <p>The Hopper Fare allows you to make <strong>unlimited bus and tram journeys within one hour</strong> of your first tap-in for a flat fare of <strong>£1.75</strong>.</p>
        <ul>
          <li>You must tap in using the same Oyster or Contactless card on every bus or tram.</li>
          <li>Even if you travel on tube or rail journeys in between, bus/tram transfers within the 60-minute window will still be free.</li>
        </ul>
        <p>OysterSavings automatically groups consecutive bus entries that happen within 60 minutes into a single charge, demonstrating where the Hopper Fare saved you money.</p>
      `,
    },
    {
      id: "uncompleted-journeys",
      category: "peak",
      question:
        'Why does my statement show "Uncompleted Journeys" or maximum fares?',
      answerHtml: `
        <p>If you fail to tap in at the start or tap out at the end of a rail journey, TfL cannot calculate the correct fare. As a result, you are charged a "maximum fare" penalty (often up to £10.40+ depending on the station).</p>
        <p><strong>How to resolve:</strong></p>
        <ul>
          <li>You can request a refund for uncompleted journeys by logging into your official TfL account at <a href="https://tfl.gov.uk" target="_blank" rel="noopener noreferrer">tfl.gov.uk</a>.</li>
          <li>OysterSavings flags uncompleted journeys in red on the <strong>Analysis</strong> tab, letting you quickly spot missed taps that are eligible for TfL refunds.</li>
        </ul>
      `,
    },
    {
      id: "privacy-safe",
      category: "privacy",
      question: "Is my travel history data safe on OysterSavings?",
      answerHtml: `
        <p><strong>Absolutely.</strong> OysterSavings is engineered with a strict privacy-first architecture:</p>
        <ul>
          <li><strong>100% Client-Side:</strong> All file parsing, fare computations, cap modeling, and recurrence forecasts happen inside your browser using local JavaScript.</li>
          <li><strong>No Data Exfiltration:</strong> The application does not send your transit logs to any external server, database, or API. It contains no tracking scripts or analytics packages.</li>
          <li><strong>Local Storage only:</strong> Your configurations (like selected railcard type or custom planner rules) are stored locally on your device via standard local storage.</li>
        </ul>
      `,
    },
    {
      id: "student-apprentice-oyster",
      category: "discounts",
      question:
        "How do 18+ Student and Apprentice Oyster cards work? Do they discount PAYG?",
      answerHtml: `
        <p>No, 18+ Student and Apprentice Oyster cards <strong>do not offer discounts on standard pay-as-you-go (PAYG) single fares</strong> natively.</p>
        <p>Instead, they give you a <strong>30% discount on 7-Day, Monthly, and Annual Travelcards</strong>, as well as Bus & Tram Passes. If you commute daily, buying a discounted Monthly/Annual Travelcard is highly cost-effective.</p>
        <p><strong>Savings Tip:</strong> If you use PAYG and do not travel enough to justify a Travelcard, you can link a National Railcard (like a 16-25 Railcard) to your Student Oyster card to get 1/3 off off-peak pay-as-you-go fares and off-peak daily caps.</p>
      `,
    },
    {
      id: "boundary-fares",
      category: "capping",
      question:
        "What are boundary fares and how do they work with Travelcards?",
      answerHtml: `
        <p>If you have a Travelcard (e.g., for Zones 1-3) loaded on your physical Oyster card, you can still travel beyond those zones (e.g., to Zone 5) without buying a paper extension ticket beforehand.</p>
        <ul>
          <li><strong>Automatic Extension:</strong> As long as you have PAYG credit on your Oyster card, simply tap in and out as usual. The gates will automatically detect your Travelcard zones and only charge you the single fare for the extra zones (in this case, Zones 4-5).</li>
          <li><strong>National Rail Tickets:</strong> If traveling on National Rail lines beyond the London Boundary zone, you can purchase a "Boundary Zone Extension ticket" from ticket offices to cover the gap.</li>
          <li><strong>Note on Contactless:</strong> Contactless bank cards do not support loading Travelcards, so they cannot utilize boundary fare extensions. You will be charged the full zone fare on a contactless card.</li>
        </ul>
      `,
    },
    {
      id: "travelcard-vs-capping",
      category: "capping",
      question:
        "Should I buy a Day or Weekly Travelcard, or just use Pay-As-You-Go capping?",
      answerHtml: `
        <p>In almost all cases, <strong>using Pay-As-You-Go (PAYG) with Oyster or Contactless is cheaper or equal</strong> to purchasing printed Travelcards:</p>
        <ul>
          <li><strong>Day Travelcards:</strong> <strong class="text-accent">Never buy these.</strong> Printed Day Travelcards are significantly more expensive than the equivalent daily cap. For example, a Zone 1-6 Day Travelcard costs £15-£23+, while the PAYG daily cap is £16.30 (Peak) or £10.85 (Off-Peak).</li>
          <li><strong>Weekly Travelcards:</strong> The Monday-to-Sunday weekly cap on Oyster/Contactless is priced <strong>exactly the same</strong> as a 7-Day Travelcard. However, PAYG is superior because you only pay for what you actually use. If you travel less than expected, you pay less, whereas a 7-Day Travelcard requires a full upfront financial commitment.</li>
          <li><strong>Exemptions:</strong> Discounted Travelcards (like the 18+ Student/Apprentice 30% discount) or Monthly/Annual Travelcards can still offer savings for very heavy commuters.</li>
        </ul>
      `,
    },
    {
      id: "odd-period-travelcard",
      category: "capping",
      question: "What is an Odd-Period Travelcard and how is it priced?",
      answerHtml: `
        <p>An <strong>Odd-Period Travelcard</strong> is a ticket valid for any custom duration of your choice between <strong>1 month and 1 year</strong> (for example, 1 month and 12 days, or 3 months and 4 days).</p>
        <p>TfL prices custom odd-period Travelcards using a specific formula:</p>
        <ul>
          <li><strong>Whole Months:</strong> Charged as a multiple of the standard monthly Travelcard rate.</li>
          <li><strong>Extra Days:</strong> Charged at a pro-rata rate of <strong>1/30th of the monthly Travelcard cost per day</strong>, rounded up to the nearest 10p.</li>
        </ul>
        <p><strong>Is it always the best option?</strong> Not necessarily. If you have many extra days (e.g., 26 extra days), it can sometimes be cheaper to buy another full monthly Travelcard or cover the remaining period using weekly Travelcards or Pay-As-You-Go. OysterSavings automatically performs these multi-product combinations in the <strong>Planner</strong> tab to find the absolute cheapest ticket configuration for your exact travel dates.</p>
      `,
    },
    {
      id: "pink-card-readers",
      category: "capping",
      question: "What are Pink Card Readers and when should I tap them?",
      answerHtml: `
        <p>If you travel between two outer zones and bypass Zone 1 (Central London), your fare is cheaper. However, because many routes naturally connect through Zone 1, TfL does not know you bypassed it unless you prove it.</p>
        <ul>
          <li><strong>How to use:</strong> Tap your card on the <strong>Pink Card Readers</strong> located on the platforms of interchange stations (such as Stratford, Highbury & Islington, Whitechapel, Richmond, Willesden Junction, or Clapham Junction) when transferring trains.</li>
          <li><strong>OysterSavings Integration:</strong> This app parses your pink reader records in the CSV log to ensure your non-Zone-1 cheaper fares are accurately computed and compared.</li>
        </ul>
      `,
    },
    {
      id: "how-program-works",
      category: "privacy",
      question:
        "How does OysterSavings calculate my savings and optimize products?",
      answerHtml: `
        <p>OysterSavings simulates your exact travel history through several local engines in your browser:</p>
        <ul>
          <li><strong>Daily/Weekly Cap Engine:</strong> Groups your journeys by day and calendar week, recreating TfL capping boundaries to see where you reached the caps.</li>
          <li><strong>Railcard Simulator:</strong> Re-calculates every single fare and daily cap with a 1/3 discount applied to eligible off-peak journeys, factoring in the cost of buying a Railcard.</li>
          <li><strong>Travelcard Comparator:</strong> Identifies your most travelled zones and checks if buying a weekly, monthly, or annual Travelcard for those zones would have been cheaper than what you paid via PAYG.</li>
        </ul>
      `,
    },
    {
      id: "dlr-overground-elizabeth",
      category: "capping",
      question: "Do the DLR, London Overground, and Elizabeth line count as Tube fares?",
      answerHtml: `
        <p><strong>Yes, absolutely.</strong> Journeys on the DLR, London Overground, and Elizabeth line are fully integrated into London's transit fare system:</p>
        <ul>
          <li><strong>Seamless Transfers:</strong> When you transfer between the Tube, DLR, London Overground, or Elizabeth line, it is treated as a single continuous journey, and your zones are calculated across the entire trip. You do not pay a new starting fare as long as you tap out and in at interchange stations within standard transfer times.</li>
          <li><strong>Shared Daily & Weekly Caps:</strong> All daily and weekly caps apply collectively across these modes. For instance, you can take a Tube train, switch to the Overground, and then take the DLR, and your total fare will still be capped at the daily/weekly cap limit for the zones you traveled through.</li>
        </ul>
      `,
    },
    {
      id: "cable-car",
      category: "capping",
      question: "How do fares and capping rules work for the IFS Cloud Cable Car?",
      answerHtml: `
        <p>The IFS Cloud Cable Car (running between Greenwich Peninsula and Royal Docks) is operated by TfL but uses a <strong>separate fare structure</strong>:</p>
        <ul>
          <li><strong>No Capping Integration:</strong> Cable car fares <strong>do not contribute to, nor are they capped by,</strong> the daily or weekly TfL capping system on Oyster or Contactless. Every ride is charged separately.</li>
          <li><strong>Pay-As-You-Go Rates:</strong> You can pay using Oyster or Contactless pay-as-you-go. A single crossing costs <strong>£6.00</strong> for adults, which is a discount compared to buying a paper boarding pass at the terminal.</li>
          <li><strong>Travelcard Discounts:</strong> If you hold a valid weekly, monthly, or annual Travelcard, you are eligible for a discount and pay a reduced rate of <strong>£3.60</strong> per crossing (though you must pay this as an extra fare).</li>
        </ul>
      `,
    },
    {
      id: "uber-boat",
      category: "capping",
      question: "How do pay-as-you-go and capping rules work for Uber Boat (Thames Clippers)?",
      answerHtml: `
        <p>Uber Boat by Thames Clippers operates river bus services along the Thames. While they accept Oyster and Contactless, their fares are <strong>not part of the standard TfL capping system</strong>:</p>
        <ul>
          <li><strong>Separate Fares:</strong> Journeys on Uber Boat do <strong>not</strong> contribute to daily or weekly caps for Tube, Rail, or Bus. Each journey is charged as a separate standalone fare.</li>
          <li><strong>Zone-Based Pricing:</strong> Fares depend on which of the three river zones (West, Central, East) you travel through. Tapping in and out with Oyster or Contactless is cheaper than buying a paper ticket at the pier.</li>
          <li><strong>Travelcard Discounts:</strong> If you have a weekly, monthly, or annual Travelcard loaded on your Oyster card, you get a <strong>1/3 discount</strong> on Thames Clippers single fares.</li>
        </ul>
      `,
    },
  ];

  // Svelte 5 States
  let searchQuery = $state("");
  let activeCategory = $state<
    "all" | "capping" | "peak" | "discounts" | "privacy"
  >("all");

  // Track open states for each item ID
  let openFaqs = $state<Record<string, boolean>>({});

  // Categories metadata
  const categories = [
    { id: "all" as const, label: "All Questions" },
    { id: "capping" as const, label: "Capping & Fares" },
    { id: "peak" as const, label: "Peak / Off-Peak" },
    { id: "discounts" as const, label: "Discounts & Railcards" },
    { id: "privacy" as const, label: "Privacy & Safety" },
  ];

  // Svelte 5 Derived state: Filtered FAQ List
  let filteredFaqs = $derived.by(() => {
    return faqs.filter((faq) => {
      const matchesCategory =
        activeCategory === "all" || faq.category === activeCategory;
      const matchesSearch =
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answerHtml.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  });

  function toggleFaq(id: string) {
    openFaqs[id] = !openFaqs[id];
  }

  function selectCategory(cat: typeof activeCategory) {
    activeCategory = cat;
  }
</script>

<div class="faq-page-container animate-fade-in">
  <!-- Header -->
  <div class="faq-header">
    <span class="faq-badge">❓ Info & Support</span>
    <h1 class="faq-title">
      Frequently Asked <span class="gradient-text">Questions</span>
    </h1>
    <p class="faq-subtitle">
      Understand how Transport for London (TfL) calculates fares, caps, and
      discounts, and learn how to maximize your savings.
    </p>
  </div>

  <!-- Search & Category Filters -->
  <div class="faq-controls glass-card">
    <div class="search-wrapper">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search questions, keywords, or fares..."
        class="input-field search-input"
        id="faq-search-bar"
      />
      {#if searchQuery}
        <button
          class="btn-clear"
          onclick={() => (searchQuery = "")}
          aria-label="Clear search">✕</button
        >
      {/if}
    </div>

    <div class="categories-tabs">
      {#each categories as cat}
        <button
          class="category-tab"
          class:active={activeCategory === cat.id}
          onclick={() => selectCategory(cat.id)}
        >
          {cat.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- FAQ Accordion List -->
  <div class="faq-list">
    {#if filteredFaqs.length > 0}
      {#each filteredFaqs as faq (faq.id)}
        <div class="faq-item glass-card" class:is-open={openFaqs[faq.id]}>
          <button
            class="faq-trigger"
            onclick={() => toggleFaq(faq.id)}
            aria-expanded={openFaqs[faq.id]}
          >
            <span class="faq-question">{faq.question}</span>
            <span class="faq-arrow-icon" class:rotated={openFaqs[faq.id]}
              >▼</span
            >
          </button>

          {#if openFaqs[faq.id]}
            <div class="faq-panel" transition:slide={{ duration: 250 }}>
              <div class="faq-content">
                {@html faq.answerHtml}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {:else}
      <div class="no-results glass-card">
        <span class="no-results-icon">🤷‍♂️</span>
        <h3>No matching questions found</h3>
        <p>
          Try searching for other terms like "capping", "railcard", "peak", or
          "privacy".
        </p>
        <button
          class="btn-secondary"
          onclick={() => {
            searchQuery = "";
            activeCategory = "all";
          }}
        >
          Reset Filters
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .faq-page-container {
    max-width: 900px;
    margin: 0 auto;
    padding-bottom: 3rem;
  }

  .faq-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .faq-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 1rem;
    background: rgba(0, 159, 227, 0.08);
    border: 1px solid rgba(0, 159, 227, 0.15);
    border-radius: 999px;
    font-size: 0.75rem;
    color: var(--color-oyster-blue);
    font-weight: 500;
    margin-bottom: 1rem;
  }

  .faq-title {
    font-size: 2.75rem;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: -0.03em;
    margin-bottom: 0.75rem;
  }

  .gradient-text {
    background: linear-gradient(135deg, #009fe3 0%, #6950a1 50%, #ef7b10 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .faq-subtitle {
    font-size: 1.05rem;
    color: var(--color-text-secondary);
    max-width: 650px;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* Controls Grid */
  .faq-controls {
    padding: 1.5rem;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-bottom: 2rem;
  }

  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    color: var(--color-text-muted);
    pointer-events: none;
    font-size: 1rem;
  }

  .search-input {
    padding-left: 2.75rem;
    padding-right: 2.5rem;
    height: 48px;
    font-size: 0.95rem;
    border-radius: 12px;
  }

  .btn-clear {
    position: absolute;
    right: 1rem;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease;
  }

  .btn-clear:hover {
    color: var(--color-text-primary);
  }

  .categories-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .category-tab {
    padding: 0.5rem 1rem;
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--color-border);
    cursor: pointer;
    transition: all 0.25s ease;
  }

  .category-tab:hover {
    color: var(--color-text-primary);
    border-color: var(--color-border-accent);
    background: rgba(255, 255, 255, 0.04);
  }

  .category-tab.active {
    color: white;
    background: linear-gradient(135deg, #009fe3 0%, #0078ab 100%);
    border-color: #009fe3;
    box-shadow: 0 2px 10px rgba(0, 159, 227, 0.25);
  }

  /* FAQ Accordion List */
  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .faq-item {
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.3s ease;
    border: 1px solid var(--color-border);
  }

  .faq-item:hover {
    border-color: var(--color-border-accent);
    box-shadow: 0 4px 20px rgba(0, 159, 227, 0.05);
  }

  .faq-item.is-open {
    border-color: var(--color-border-accent);
    background: rgba(17, 24, 39, 0.85);
  }

  .faq-trigger {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font-size: 1rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    gap: 1.5rem;
  }

  .faq-question {
    line-height: 1.4;
  }

  .faq-arrow-icon {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .faq-arrow-icon.rotated {
    transform: rotate(180deg);
    color: var(--color-oyster-blue);
  }

  .faq-panel {
    border-top: 1px solid rgba(255, 255, 255, 0.03);
  }

  .faq-content {
    padding: 1.25rem 1.5rem;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  /* Styles for target items inside answer HTML */
  .faq-content :global(p) {
    margin-bottom: 0.75rem;
  }

  .faq-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .faq-content :global(ul),
  .faq-content :global(ol) {
    margin-top: 0.5rem;
    margin-bottom: 0.75rem;
    padding-left: 1.25rem;
  }

  .faq-content :global(li) {
    margin-bottom: 0.4rem;
  }

  .faq-content :global(li:last-child) {
    margin-bottom: 0;
  }

  .faq-content :global(strong) {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  .faq-content :global(.text-accent) {
    color: var(--color-oyster-blue);
  }

  .faq-content :global(a) {
    color: var(--color-oyster-blue);
    text-decoration: none;
    font-weight: 500;
  }

  .faq-content :global(a:hover) {
    text-decoration: underline;
  }

  /* No results state */
  .no-results {
    padding: 3rem 2rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .no-results-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  .no-results h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .no-results p {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    max-width: 320px;
    margin-bottom: 0.75rem;
    line-height: 1.4;
  }

  @media (max-width: 768px) {
    .faq-title {
      font-size: 2rem;
    }

    .faq-controls {
      padding: 1rem;
      gap: 1rem;
    }

    .search-input {
      height: 44px;
    }

    .category-tab {
      padding: 0.4rem 0.8rem;
      font-size: 0.75rem;
    }

    .faq-trigger {
      padding: 1rem 1.2rem;
      font-size: 0.9rem;
    }

    .faq-content {
      padding: 1rem 1.2rem;
      font-size: 0.85rem;
    }
  }
</style>

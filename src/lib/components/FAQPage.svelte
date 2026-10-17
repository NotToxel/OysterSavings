<script lang="ts">
  import { TFL_FARES_LAST_ROSE } from "$lib/data/fareData";

  interface FAQItem {
    id: string;
    category: "getting-started" | "troubleshooting" | "results" | "capping" | "peak" | "discounts" | "privacy";
    question: string;
    answerHtml: string;
  }

  // FAQ static database
  const faqs: FAQItem[] = [
    {
      id: "download-history",
      category: "getting-started",
      question: "How do I download my journey history from TfL?",
      answerHtml: `
        <ol>
          <li>Sign in to your <a href="https://contactless.tfl.gov.uk/" target="_blank" rel="noopener noreferrer">TfL contactless and Oyster account</a> in a browser.</li>
          <li>Select the Oyster or contactless card whose journeys you want to review, then open its journey history.</li>
          <li>Choose a date range containing your travel and download the history in CSV format, rather than PDF.</li>
          <li>Return to OysterSavings and choose the CSV file in the upload area on Overview. Review the import summary, then open your results.</li>
        </ol>
        <p>The importer needs a journey-level CSV with Date, Start Time, Journey/Action and Charge columns. If your export uses a different layout, choose Troubleshooting in the topic list. OysterSavings does not need your TfL password or bank details.</p>
      `,
    },
    {
      id: "which-page",
      category: "getting-started",
      question: "What is the difference between Analysis, Compare and Planner?",
      answerHtml: `
        <ul>
          <li><strong>Analysis</strong> reviews your imported journeys, spending and caps, and lets you explore discount scenarios.</li>
          <li><strong>Compare</strong> uses your imported travel to compare PAYG, Travelcards and Bus &amp; Tram Passes across weekly, monthly and annual periods.</li>
          <li><strong>Planner</strong> estimates future travel costs from the journeys, dates and recurring routines you enter. You can use it without importing a CSV.</li>
        </ul>
        <p>Analysis and Compare become available after you load journey data. If you want to look around first, try the sample data on Overview.</p>
      `,
    },
    {
      id: "history-length",
      category: "getting-started",
      question: "How much journey history should I import?",
      answerHtml: `
        <p>Start with several complete weeks that reflect your usual travel. Include both commuting and any regular evening or weekend journeys.</p>
        <p>A few days can help you inspect individual fares, but give a weaker basis for monthly or annual comparisons. Partial weeks, holidays, working from home and one-off trips can change the average. Longer projections assume your sample remains representative; they are not a prediction of every future journey.</p>
        <p>If your routine is about to change, use Planner to enter the dates and journeys you actually expect instead.</p>
      `,
    },
    {
      id: "multiple-cards",
      category: "getting-started",
      question: "Can I compare multiple cards or import more history?",
      answerHtml: `
        <p>Yes. After your first import, choose <strong>Add Data</strong> to load another CSV. Add exports from a different card or payment device as a separate card. For more history from the same card, choose the merge option and review any overlap warnings.</p>
        <p>Use the card selector to inspect each card, or <strong>Combined</strong> for an overview. A combined view does not give separate cards a shared TfL cap: the app calculates caps per imported card before combining the totals.</p>
        <p>Keep phone, watch and physical bank-card journeys separate, even when they use the same bank account. Exit demo mode before adding your own data.</p>
      `,
    },
    {
      id: "csv-troubleshooting",
      category: "troubleshooting",
      question: "My CSV will not load, or no journeys were found. What should I check?",
      answerHtml: `
        <ul>
          <li><strong>File type:</strong> use the original .csv export from TfL. Renaming a PDF or spreadsheet to .csv does not convert it.</li>
          <li><strong>Columns:</strong> the file must contain Date, Start Time, Journey/Action and Charge. A bank statement or an export with different headings will not work with this importer.</li>
          <li><strong>Dates:</strong> the parser expects TfL dates such as 11-May-2025. Opening and re-saving the file in a spreadsheet can change that format; try a fresh, unedited download.</li>
          <li><strong>Travel:</strong> choose a date range with completed journeys. Top-ups, administrative entries and incomplete journeys are excluded from the fare comparisons.</li>
        </ul>
        <p>Read the import message for the missing column or affected row. If the file contains only excluded entries, download a different date range. If TfL supplies a different CSV layout, the importer may not support it yet.</p>
      `,
    },
    {
      id: "estimate-mismatch",
      category: "troubleshooting",
      question: "Why does an estimate differ from what TfL charged me?",
      answerHtml: `
        <p>The charge in your CSV records what you paid. A calculated fare or comparison models what the app expects under its fare rules and selected settings.</p>
        <ul>
          <li>Check the selected discount, journey time, stations, zones and any alternative-route setting.</li>
          <li>Older journeys may have been charged under different fares. The bundled fare tables are dated <strong>${TFL_FARES_LAST_ROSE}</strong>; station-pair lookups use live TfL fare data.</li>
          <li>Incomplete journeys, refunds and top-ups are excluded from fare comparisons, so a comparison total need not match every transaction in your statement.</li>
          <li>Special routes and fares can have different capping or Travelcard rules. Unrecognised stations or an unavailable live fare can also limit the estimate.</li>
        </ul>
        <p>Check the journey against <a href="https://tfl.gov.uk/fares/find-fares/tube-and-rail-fares/single-fare-finder" target="_blank" rel="noopener noreferrer">TfL's single fare finder</a>. A difference in OysterSavings is not confirmation of an overcharge or refund entitlement.</p>
      `,
    },
    {
      id: "included-costs",
      category: "results",
      question: "Do the savings include buying a Railcard or Travelcard?",
      answerHtml: `
        <p>It depends on the comparison and the cost options you select.</p>
        <ul>
          <li><strong>Analysis:</strong> discount simulations start with fares only. Use <strong>Include card cost</strong> where available to account for buying the discount card, and check any separate Oyster-card cost option.</li>
          <li><strong>Compare:</strong> Travelcard and Bus &amp; Tram Pass options include the ticket price. The National Railcard PAYG comparison does not include the Railcard membership price; the optional Oyster-card fee is a separate cost.</li>
          <li><strong>Planner:</strong> review the selected fare type, cost settings and ticket breakdown for the period you have entered.</li>
        </ul>
        <p>If you already own a valid card, avoid counting its purchase cost again. If you need to buy one, check that cost before treating a fares-only saving as money left over.</p>
      `,
    },
    {
      id: "remove-data",
      category: "privacy",
      question: "How do I remove my data or reset the app?",
      answerHtml: `
        <p>Imported journey history is held in memory for the current page session. Reload the page to clear the imported cards and results. Your original CSV remains in your downloads unless you delete it yourself.</p>
        <p>Planner routines, a saved home station and some preferences are stored separately in this browser and can remain after a reload. To remove those too, use your browser's site settings to clear this site's stored data. This removes saved plans and preferences, so keep a copy of anything you need first.</p>
        <p>Clearing OysterSavings does not change your TfL account or its journey history.</p>
      `,
    },
    {
      id: "weekly-cap-reset",
      category: "capping",
      question: "Does the weekly cap reset on Monday?",
      answerHtml: `
        <p>Yes. Weekly PAYG capping covers a fixed <strong>Monday-to-Sunday</strong> week, rather than any seven days from your first journey. Travel after midnight still follows TfL's travel day, which ends at 04:29 the following morning.</p>
        <p>If you start travelling on Wednesday, that week's cap covers your travel through Sunday; a new capping week starts on Monday. A 7-Day Travelcard is a different product and can start on another day.</p>
        <p>See <a href="https://tfl.gov.uk/fares/find-fares/tube-and-rail-fares/pay-as-you-go-caps" target="_blank" rel="noopener noreferrer">TfL's daily and weekly capping guidance</a>.</p>
      `,
    },
    {
      id: "phone-card-caps",
      category: "capping",
      question: "Do my phone and physical bank card share a cap?",
      answerHtml: `
        <p>No. TfL treats a physical contactless card, a phone and a watch as separate payment devices, even if they are linked to the same bank account. Their journeys do not combine towards one daily or weekly cap.</p>
        <p>Use the same card or device throughout the week to build towards its cap, and always use the same one to touch in and out of a journey.</p>
        <p>See <a href="https://tfl.gov.uk/fares/ways-to-pay/pay-as-you-go" target="_blank" rel="noopener noreferrer">TfL's guidance on contactless and mobile payments</a>.</p>
      `,
    },
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
        "Does capping work differently on Oyster and contactless?",
      answerHtml: `
        <p>Both physical Oyster cards and Contactless bank cards support daily and Monday-to-Sunday weekly capping. However, there are crucial differences:</p>
        <ul>
          <li><strong>Rolling Weekly Capping:</strong> Contactless cards feature Monday-to-Sunday capping automatically. Oyster cards also support Monday-to-Sunday weekly capping but require pre-loading pay-as-you-go credit.</li>
          <li><strong>Railcard Discounts:</strong> You can link National Railcard discounts (e.g., 16-25, 26-30, Senior) to a physical Oyster card, which saves you 1/3 on off-peak single fares and off-peak daily caps. <strong>You cannot link Railcards to Contactless payment cards.</strong></li>
        </ul>
      `,
    },
    {
      id: "peak-offpeak-times",
      category: "peak",
      question: "When are peak and off-peak fares charged?",
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
      question: "How do I add a Railcard to my Oyster card?",
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
        <p>Your CSV is processed in your browser:</p>
        <ul>
          <li><strong>Direct TfL Queries:</strong> To retrieve accurate, real-time fare pricing, the app queries official TfL APIs directly from your browser.</li>
          <li><strong>No Third-Party Servers:</strong> Your travel history CSV files and transit logs are never sent to our servers, nor are they shared with any third-party tracking, ads, or analytics services.</li>
          <li><strong>Local Configuration:</strong> Any custom planner routines or settings you save are stored on your device using standard local browser storage.</li>
        </ul>
      `,
    },
    {
      id: "tfl-network-requests",
      category: "privacy",
      question: "What network requests does OysterSavings make?",
      answerHtml: `
        <p>OysterSavings only makes network requests to the official <strong>Transport for London (TfL) API</strong> (specifically <code>api.tfl.gov.uk</code>) to fetch live fare details for the station-to-station journeys detected in your travel history or plan.</p>
        <p>Specifically:</p>
        <ul>
          <li>Only station IDs (NaPTAN codes) are sent to TfL to look up the peak and off-peak fares.</li>
          <li>Your personal details, card numbers, or full travel logs are <strong>never</strong> transmitted.</li>
          <li>No other network requests are made, and no tracking scripts, advertising pixels, or third-party analytics are loaded.</li>
        </ul>
      `,
    },
    {
      id: "student-apprentice-oyster",
      category: "discounts",
      question:
        "Do Student and Apprentice Oyster cards discount PAYG?",
      answerHtml: `
        <p>No, 18+ Student and Apprentice Oyster cards <strong>do not offer discounts on standard pay-as-you-go (PAYG) single fares</strong> natively.</p>
        <p>Instead, they give you a <strong>30% discount on 7-Day, Monthly, and Annual Travelcards</strong>, as well as Bus & Tram Passes. If you commute daily, buying a discounted Monthly/Annual Travelcard is highly cost-effective.</p>
        <p><strong>Using PAYG?</strong> If you use PAYG and do not travel enough to justify a Travelcard, you can link a National Railcard (like a 16-25 Railcard) to your Student Oyster card to get 1/3 off off-peak pay-as-you-go fares and off-peak daily caps.</p>
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
          <li><strong>Day Travelcards:</strong> Printed Day Travelcards are significantly more expensive than the equivalent daily cap. For example, a Zone 1-6 Day Travelcard costs £15-£23+, while the PAYG daily cap is £16.30 (Peak) or £10.85 (Off-Peak).</li>
          <li><strong>Weekly Travelcards:</strong> The Monday-to-Sunday weekly cap on Oyster/Contactless is priced <strong>exactly the same</strong> as a 7-Day Travelcard. With PAYG, you only pay for what you actually use. If you travel less than expected, you pay less, whereas a 7-Day Travelcard requires a full upfront financial commitment.</li>
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
        <p><strong>Is it always the best option?</strong> Not necessarily. If you have many extra days (e.g., 26 extra days), it can sometimes be cheaper to buy another full monthly Travelcard or cover the remaining period using weekly Travelcards or Pay-As-You-Go. OysterSavings automatically performs these multi-product combinations in the <strong>Planner</strong> tab to compare ticket combinations for your exact travel dates.</p>
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
      category: "results",
      question:
        "How does OysterSavings compare my options?",
      answerHtml: `
        <p>OysterSavings simulates your exact travel history using fare calculations and live TfL API data:</p>
        <ul>
          <li><strong>Daily/Weekly Cap Engine:</strong> Groups your journeys by day and calendar week, recreating TfL capping boundaries to see where you reached the caps.</li>
          <li><strong>Live TfL Fare Integration:</strong> Fetches exact, real-time fares for your station pairs from TfL to ensure precise calculations.</li>
          <li><strong>Railcard Simulator:</strong> Recalculates eligible off-peak fares and caps with a Railcard discount. Purchase costs depend on the comparison and selected cost options; see the question about included costs.</li>
          <li><strong>Travelcard Comparator:</strong> Identifies your most travelled zones and checks if buying a weekly, monthly, or annual Travelcard for those zones would have been cheaper than what you paid via PAYG.</li>
        </ul>
      `,
    },
    {
      id: "dlr-overground-elizabeth",
      category: "capping",
      question: "Do the DLR, London Overground, and Elizabeth line count as Tube fares?",
      answerHtml: `
        <p>Journeys on the DLR, London Overground, and Elizabeth line are fully integrated into London's transit fare system:</p>
        <ul>
          <li><strong>Seamless Transfers:</strong> When you transfer between the Tube, DLR, London Overground, or Elizabeth line, it is treated as a single continuous journey, and your zones are calculated across the entire trip. You do not pay a new starting fare as long as you tap out and in at interchange stations within standard transfer times.</li>
          <li><strong>Shared Daily & Weekly Caps:</strong> All daily and weekly caps apply collectively across these modes. For instance, you can take a Tube train, switch to the Overground, and then take the DLR, and your total fare will still be capped at the daily/weekly cap limit for the zones you traveled through.</li>
        </ul>
      `,
    },
    {
      id: "cable-car",
      category: "capping",
      question: "Does the cable car count towards the cap?",
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
      question: "Do river bus journeys count towards the cap?",
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

  let searchQuery = $state("");
  let activeCategory = $state("all");

  const categories = [
    { id: "all", label: "All topics" },
    { id: "getting-started", label: "Getting started", description: "Download your history, choose a page and add your cards." },
    { id: "troubleshooting", label: "Troubleshooting", description: "Fix an import or understand a difference in fares." },
    { id: "results", label: "Understanding results", description: "How comparisons work and which costs they include." },
    { id: "capping", label: "Fares & capping", description: "Daily limits, Travelcards and journeys beyond your zones." },
    { id: "peak", label: "Times & missed taps", description: "When you travel, and what happens when a journey is incomplete." },
    { id: "discounts", label: "Railcards & discounts", description: "Linking a Railcard and using Student or Apprentice Oyster cards." },
    { id: "privacy", label: "Your data & privacy", description: "What stays on your device and how to clear it." },
  ];

  const searchableFaqs = faqs.map((faq) => ({
    ...faq,
    searchText: (faq.question + " " + faq.answerHtml.replace(/<[^>]*>/g, " ")).toLowerCase(),
  }));
  const query = $derived(searchQuery.trim().toLowerCase());
  const filteredFaqs = $derived(searchableFaqs.filter((faq) =>
    (activeCategory === "all" || faq.category === activeCategory) &&
    query.split(/\s+/).every((word) => faq.searchText.includes(word))
  ));
  const visibleGroups = $derived(categories.slice(1).map((category) => ({
    ...category,
    items: filteredFaqs.filter((faq) => faq.category === category.id),
  })).filter((group) => group.items.length));

  function resetFilters() {
    searchQuery = "";
    activeCategory = "all";
  }
</script>

<div class="help-page">
  <header class="help-header">
    <h1>Help with your travel costs.</h1>
    <p>Make sense of fares, find the right discount and understand your results.</p>
  </header>

  <div class="help-layout">
    <aside class="topic-sidebar">
      <nav aria-label="Help topics">
        <h2>Browse by topic</h2>
        {#each categories as category}
          <button
            class="topic-button"
            class:active={activeCategory === category.id}
            aria-pressed={activeCategory === category.id}
            onclick={() => { activeCategory = category.id; }}
          >
            <span>{category.label}</span>
            <span class="topic-count">{category.id === "all" ? faqs.length : faqs.filter((faq) => faq.category === category.id).length}</span>
          </button>
        {/each}
      </nav>
      <div class="privacy-note">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <p>Your history stays yours.</p>
        <span>Travel history is processed locally in your browser.</span>
      </div>
    </aside>

    <div class="help-main">
      <div class="search-area">
        <label for="faq-search-bar">Search help</label>
        <div class="search-wrapper">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" />
          </svg>
          <input id="faq-search-bar" type="search" bind:value={searchQuery} placeholder="Try “weekly cap” or “Railcard”" />
          {#if searchQuery}
            <button class="clear-search" onclick={() => { searchQuery = ""; }} aria-label="Clear search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
            </button>
          {/if}
        </div>
        <p class="result-summary" role="status">
          {#if query}
            {filteredFaqs.length} {filteredFaqs.length === 1 ? "answer" : "answers"} matching “{searchQuery.trim()}”{activeCategory !== "all" ? " in this topic" : ""}
          {:else}
            {filteredFaqs.length} questions{activeCategory === "all" ? ` across ${categories.length - 1} topics` : " in this topic"}
          {/if}
        </p>
      </div>

      {#each visibleGroups as group (group.id)}
        <section class="question-group" aria-labelledby={"heading-" + group.id}>
          <header class="group-header">
            <h2 id={"heading-" + group.id}>{group.label}</h2>
            <p>{group.description}</p>
          </header>
          <div class="question-list">
            {#each group.items as faq (faq.id)}
              <details class="faq-item">
                <summary>
                  <span>{faq.question}</span>
                  <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <div class="faq-content">{@html faq.answerHtml}</div>
              </details>
            {/each}
          </div>
        </section>
      {:else}
        <section class="no-results">
          <h2>No answers found</h2>
          <p>Try a shorter search, or clear the filters to browse every topic.</p>
          <button onclick={resetFilters}>Clear search and filters</button>
        </section>
      {/each}

      <div class="help-footer">
        <p>Need to query a charge or request a refund?</p>
        <a href="https://tfl.gov.uk/fares/" target="_blank" rel="noopener noreferrer">Visit TfL fares and payments
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
        </a>
      </div>
    </div>
  </div>
</div>

<style>
  .help-page { max-width: 1120px; margin: 0 auto; padding: 2rem 0 3rem; }
  .help-header { padding-bottom: 2.5rem; margin-bottom: 2.5rem; border-bottom: 1px solid var(--color-border); }
  .help-header h1 { font-size: clamp(2rem, 4vw, 3.25rem); font-weight: 650; line-height: 1.15; letter-spacing: -0.035em; text-wrap: balance; }
  .help-header > p { color: var(--color-text-secondary); margin-top: 1rem; font-size: 1.05rem; line-height: 1.65; max-width: 60ch; }
  .help-layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 4rem; align-items: start; }
  .topic-sidebar { position: sticky; top: 7rem; }
  .topic-sidebar h2 { font-size: 0.8rem; font-weight: 600; color: var(--color-text-secondary); margin: 0 0 0.9rem 0.75rem; }
  .topic-button { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%; padding: 0.8rem 0.75rem; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-secondary); text-align: left; font-size: 0.875rem; cursor: pointer; min-height: 44px; }
  .topic-button + .topic-button { margin-top: 0.2rem; }
  .topic-button:hover { background: var(--color-bg-glass-hover); color: var(--color-text-primary); }
  .topic-button.active { background: var(--color-bg-elevated); color: var(--color-oyster-blue-light); }
  .topic-count { font-size: 0.75rem; font-variant-numeric: tabular-nums; }
  .privacy-note { margin: 2rem 0.75rem 0; padding-top: 1.5rem; border-top: 1px solid var(--color-border); color: var(--color-text-secondary); }
  .privacy-note svg { color: var(--color-oyster-blue-light); margin-bottom: 0.65rem; }
  .privacy-note p { font-size: 0.85rem; color: var(--color-text-primary); margin-bottom: 0.4rem; }
  .privacy-note span { display: block; font-size: 0.8rem; line-height: 1.65; max-width: 24ch; }
  .help-main { min-width: 0; }
  .search-area label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.65rem; }
  .search-wrapper { position: relative; display: flex; align-items: center; }
  .search-icon { position: absolute; left: 1rem; pointer-events: none; color: var(--color-text-secondary); }
  input { width: 100%; min-height: 52px; border: 1px solid var(--color-border); border-radius: 10px; padding: 0.8rem 3rem; font-size: 1rem; background: var(--color-bg-card); color: var(--color-text-primary); caret-color: var(--color-oyster-blue-light); }
  input::placeholder { color: var(--color-text-secondary); }
  input::-webkit-search-cancel-button { appearance: none; }
  input:focus-visible { outline: 2px solid var(--color-oyster-blue-light); outline-offset: 3px; }
  .clear-search { position: absolute; right: 4px; width: 44px; height: 44px; display: grid; place-items: center; background: transparent; border: 0; border-radius: 6px; color: var(--color-text-secondary); cursor: pointer; }
  .clear-search:hover { color: var(--color-text-primary); background: var(--color-bg-glass-hover); }
  .result-summary { color: var(--color-text-secondary); font-size: 0.78rem; margin-top: 0.75rem; line-height: 1.5; overflow-wrap: anywhere; }
  .question-group { margin-top: 2.75rem; }
  .group-header { margin-bottom: 1rem; }
  .group-header h2 { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.02em; }
  .group-header p { color: var(--color-text-secondary); font-size: 0.875rem; line-height: 1.6; margin-top: 0.4rem; }
  .question-list { border-top: 1px solid var(--color-border); }
  .faq-item { border-bottom: 1px solid var(--color-border); }
  summary { display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; padding: 1.2rem 0.25rem; min-height: 60px; cursor: pointer; list-style: none; font-size: 0.95rem; line-height: 1.55; font-weight: 500; border-radius: 3px; }
  summary::-webkit-details-marker { display: none; }
  summary:hover { color: var(--color-oyster-blue-light); }
  .chevron { flex-shrink: 0; color: var(--color-text-secondary); transition: transform 160ms ease-out; }
  details[open] .chevron { transform: rotate(180deg); color: var(--color-oyster-blue-light); }
  details[open] summary { color: var(--color-oyster-blue-light); }
  .faq-content { padding: 0 1.75rem 1.5rem 0.25rem; color: var(--color-text-secondary); font-size: 0.925rem; line-height: 1.8; max-width: 75ch; overflow-wrap: anywhere; }
  .faq-content :global(p + p), .faq-content :global(ul), .faq-content :global(ol) { margin-top: 0.85rem; }
  .faq-content :global(ul), .faq-content :global(ol) { padding-left: 1.25rem; margin-bottom: 0.85rem; }
  .faq-content :global(ul) { list-style: disc; }
  .faq-content :global(ol) { list-style: decimal; }
  .faq-content :global(li + li) { margin-top: 0.5rem; }
  .faq-content :global(strong) { color: var(--color-text-primary); font-weight: 550; }
  .faq-content :global(a), .help-footer a { color: var(--color-oyster-blue-light); text-decoration: underline; text-underline-offset: 4px; }
  .faq-content :global(a:hover), .help-footer a:hover { color: var(--color-text-primary); }
  .no-results { padding: 3rem 0; }
  .no-results h2 { font-size: 1.25rem; font-weight: 600; }
  .no-results p { color: var(--color-text-secondary); line-height: 1.7; margin-top: 0.75rem; }
  .no-results button { color: var(--color-oyster-blue-light); min-height: 44px; margin-top: 1rem; cursor: pointer; text-decoration: underline; text-underline-offset: 4px; }
  .no-results button:hover { color: var(--color-text-primary); }
  .help-footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border); font-size: 0.85rem; line-height: 1.65; }
  .help-footer p { color: var(--color-text-secondary); margin-bottom: 0.4rem; }
  .help-footer a { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 44px; }
  @media (max-width: 900px) {
    .help-layout { grid-template-columns: 200px minmax(0, 1fr); gap: 2rem; }
  }
  @media (max-width: 640px) {
    .help-page { padding-top: 1rem; }
    .help-header { padding-bottom: 1.75rem; margin-bottom: 1.75rem; }
    .help-header > p { font-size: 0.95rem; }
    .help-layout { grid-template-columns: minmax(0, 1fr); gap: 1.75rem; }
    .topic-sidebar { position: static; }
    .topic-sidebar h2 { margin-left: 0; }
    .topic-sidebar nav { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .topic-sidebar h2 { width: 100%; margin-bottom: 0.35rem; }
    .topic-button { width: auto; padding: 0.6rem 0.75rem; background: var(--color-bg-glass); font-size: 0.8rem; }
    .topic-button + .topic-button { margin-top: 0; }
    .topic-count, .privacy-note { display: none; }
    .question-group { margin-top: 2rem; }
    summary { padding-block: 1rem; font-size: 0.9rem; }
    .faq-content { padding-right: 0.25rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    .chevron { transition: none; }
  }
</style>

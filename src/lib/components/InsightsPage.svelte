<script lang="ts">
  import {
    classifiedJourneys,
    weeklyCapResults,
    dailyCapResults,
    capSummary,
    selectedFareType,
    detectedDiscount,
  } from "$lib/stores/stores";
  import {
    FARE_TYPES,
    isUKBankHoliday,
    TRAVELCARD_WEEKLY,
    TRAVELCARD_MONTHLY,
    TRAVELCARD_ANNUAL,
    STUDENT_TRAVELCARD_WEEKLY,
    STUDENT_TRAVELCARD_MONTHLY,
    STUDENT_TRAVELCARD_ANNUAL,
    BUS_PASS_WEEKLY,
    STUDENT_BUS_PASS_WEEKLY,
    STUDENT_BUS_PASS_MONTHLY,
    calculateTravelcardPeriodCost,
  } from "$lib/data/fareData";
  import { getZoneColor } from "$lib/data/stationService";
  import {
    calculateExpectedFare,
    calculateFareTypeFare,
  } from "$lib/engine/fareCalculator";
  import { calculateFareTypeSavings } from "$lib/engine/savingsEngine";

  // State for student rates toggle
  let forceStudentView = $state(false);

  // Helper: Parse time string "HH:MM" to minutes of day
  function timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(":");
    if (parts.length !== 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return isNaN(h) || isNaN(m) ? 0 : h * 60 + m;
  }

  // Helper: Categorize start time into standard TfL and day periods
  function getTimePeriod(timeStr: string): string {
    const mins = timeToMinutes(timeStr);
    if (mins >= 270 && mins < 390) return "early_morning"; // 04:30 - 06:30
    if (mins >= 390 && mins < 570) return "morning_peak"; // 06:30 - 09:30
    if (mins >= 570 && mins < 960) return "midday"; // 09:30 - 16:00
    if (mins >= 960 && mins < 1140) return "evening_peak"; // 16:00 - 19:00
    if (mins >= 1140 && mins < 1320) return "evening_offpeak"; // 19:00 - 22:00
    return "late_night"; // 22:00 - 04:30
  }

  // University stations list for student comparison checking
  const UNIVERSITY_STATIONS = [
    "warren street",
    "euston square",
    "euston",
    "russell square",
    "goodge street",
    "temple",
    "covent garden",
    "holborn",
    "waterloo",
    "london bridge",
    "south kensington",
    "gloucester road",
    "mile end",
    "stepney green",
    "whitechapel",
    "angel",
    "barbican",
    "farringdon",
    "moorgate",
    "oxford circus",
    "regent's park",
    "great portland street",
    "marylebone",
    "baker street",
    "new cross",
    "new cross gate",
    "cutty sark",
    "greenwich",
    "holloway road",
    "highbury & islington",
    "uxbridge",
    "tooting broadway",
    "kingston",
    "surbiton",
    "aldgate",
    "aldgate east",
    "tottenham court road",
    "elephant & castle",
    "hendon central",
    "north greenwich",
    "chiswick park",
    "gunnersbury",
    "sidcup",
    "battersea park",
    "swiss cottage",
    "egham",
    "king's cross st pancras",
    "camden town",
    "strawberry hill",
    "cyprus",
    "stratford",
    "barnes",
    "south ealing",
    "ealing broadway",
    "pimlico",
    "vauxhall",
    "denmark hill",
    "oval",
    "kennington",
    "wimbledon",
    "wimbledon chase",
    "archway",
    "lambeth north",
    "white city",
    "wood lane",
    "east acton",
    "barons court",
    "charing cross",
    "tower hill",
    "tower gateway",
    "monument",
    "bank",
    "deptford",
  ];

  // Traveler Persona Derivation (multiple simultaneously)
  let personas = $derived.by(() => {
    const j = $classifiedJourneys;
    if (j.length === 0) {
      return {
        active: [
          {
            title: "Mysterious Traveler",
            desc: "Upload your Oyster history to discover your commuting persona and unlock travel statistics.",
            badge: "❓",
            class: "persona-mysterious",
          },
        ],
        timeOfDayTag: "",
      };
    }

    const total = j.length;
    let weekendCount = 0;
    let busCount = 0;
    let railCount = 0;
    let elizabethCount = 0;

    let earlyMorning = 0;
    let peak = 0;
    let midday = 0;
    let eveningOffpeak = 0;
    let lateNight = 0;

    const uniqueZones = new Set<number>();
    const activeDays = new Set<string>();

    for (const jj of j) {
      if (jj.isWeekend) weekendCount++;
      if (jj.isBus) {
        busCount++;
      } else {
        if (jj.mode === "national_rail" || jj.mode === "nr_tube") railCount++;
        if (jj.mode === "elizabeth") elizabethCount++;

        if (jj.originZone !== null) uniqueZones.add(jj.originZone);
        if (jj.destinationZone !== null) uniqueZones.add(jj.destinationZone);
      }

      const period = getTimePeriod(jj.raw.startTime);
      if (period === "early_morning") earlyMorning++;
      else if (period === "morning_peak" || period === "evening_peak") peak++;
      else if (period === "midday") midday++;
      else if (period === "evening_offpeak") eveningOffpeak++;
      else if (period === "late_night") lateNight++;

      if (jj.raw.dateStr) {
        activeDays.add(jj.raw.dateStr);
      }
    }

    const activeList = [];

    // 1. Weekend Wanderer
    if (total >= 3 && weekendCount / total > 0.65) {
      activeList.push({
        title: "Weekend Wanderer",
        desc: `You do most of your exploring on Saturdays and Sundays. With ${Math.round((weekendCount / total) * 100)}% of your journeys on weekends, you enjoy off-peak weekend adventures.`,
        badge: "🧭",
        class: "persona-weekend",
      });
    }

    // 2. Bus Commuter
    if (total >= 3 && busCount / total > 0.6) {
      activeList.push({
        title: "Bus Commuter",
        desc: `You rely heavily on London's red buses and trams. With ${Math.round((busCount / total) * 100)}% of your journeys on the road network, you make excellent use of the Hopper fare.`,
        badge: "🚌",
        class: "persona-bus",
      });
    }

    // 3. Rail Rover
    const nonBusCount = total - busCount;
    if (railCount >= 3 && nonBusCount > 0 && railCount / nonBusCount > 0.4) {
      activeList.push({
        title: "Rail Rover",
        desc: `You travel frequently on National Rail lines, utilizing suburban routes and commuter trains alongside the London Underground.`,
        badge: "🚆",
        class: "persona-rail",
      });
    }

    // 4. Elizabeth Line Regular
    if (
      elizabethCount >= 3 &&
      nonBusCount > 0 &&
      elizabethCount / nonBusCount > 0.4
    ) {
      activeList.push({
        title: "Elizabeth Line Regular",
        desc: `You are a frequent rider of the purple line, enjoying fast cross-London travel on the state-of-the-art Elizabeth Line.`,
        badge: "💜",
        class: "persona-elizabeth",
      });
    }

    // 5. Zone Explorer
    if (uniqueZones.size >= 4) {
      activeList.push({
        title: "Zone Explorer",
        desc: `You don't stick to one place! Your travel history spans ${uniqueZones.size} distinct zones across the London network.`,
        badge: "🗺️",
        class: "persona-zones",
      });
    }

    // 6. Frequent Flyer
    const avgJourneys = activeDays.size > 0 ? total / activeDays.size : 0;
    if (activeDays.size >= 2 && avgJourneys >= 4.5) {
      activeList.push({
        title: "Frequent Flyer",
        desc: `You make multiple trips a day on a regular basis. Averaging ${avgJourneys.toFixed(1)} journeys per active travel day, you keep on the move.`,
        badge: "⚡",
        class: "persona-frequent",
      });
    }

    // 7. Cap Hunter
    const totalDays = $dailyCapResults.length;
    const cappedDaysCount = $dailyCapResults.filter((d) => d.capHit).length;
    if (totalDays >= 3 && cappedDaysCount / totalDays > 0.5) {
      activeList.push({
        title: "Cap Hunter",
        desc: `You know how to get the most value out of your travel. Over ${Math.round((cappedDaysCount / totalDays) * 100)}% of your travel days reached a daily cap, giving you free journeys.`,
        badge: "🎯",
        class: "persona-capper",
      });
    }

    // Dominant time of day tag
    const peakPct = (peak / total) * 100;
    const maxVal = Math.max(
      earlyMorning,
      peak,
      midday,
      eveningOffpeak + lateNight,
    );

    let timeOfDayTag = "";
    let timeOfDayPersona = { title: "", desc: "", badge: "", class: "" };

    if (maxVal === peak) {
      timeOfDayTag = "Rush Hour Commuter";
      timeOfDayPersona = {
        title: "Rush Hour Commuter",
        desc: `You brave the peak crowds to keep London running. With ${Math.round(peakPct)}% of your journeys during morning or evening peak, your routines strongly mirror the standard 9-to-5 commute.`,
        badge: "🚇",
        class: "persona-commuter",
      };
    } else if (maxVal === earlyMorning) {
      timeOfDayTag = "Early Bird";
      timeOfDayPersona = {
        title: "Early Bird",
        desc: `You are on the platforms before London fully wakes up. With ${earlyMorning} early starts, you benefit from off-peak rates and quiet train services.`,
        badge: "🌅",
        class: "persona-early",
      };
    } else if (maxVal === midday) {
      timeOfDayTag = "Mid-Day Explorer";
      timeOfDayPersona = {
        title: "Mid-Day Explorer",
        desc: `You take travel in your stride. With ${midday} daytime off-peak journeys, you enjoy cheaper fares, less crowded carriages, and flexible travel hours.`,
        badge: "🌍",
        class: "persona-explorer",
      };
    } else {
      timeOfDayTag = "Night Owl";
      timeOfDayPersona = {
        title: "Night Owl",
        desc: `You navigate London after dark. With ${eveningOffpeak + lateNight} late evening and night journeys, you rely on the Night Tube, buses, and off-peak rail services.`,
        badge: "🦉",
        class: "persona-owl",
      };
    }

    if (activeList.length === 0) {
      activeList.push(timeOfDayPersona);
    }

    return {
      active: activeList,
      timeOfDayTag,
    };
  });

  // Find the overall start and end dates of the travel history
  let analysisDates = $derived.by(() => {
    const j = $classifiedJourneys;
    if (j.length === 0) return null;
    let minDate = new Date(j[0].raw.date);
    let maxDate = new Date(j[0].raw.date);

    for (const jj of j) {
      const d = new Date(jj.raw.date);
      if (d < minDate) minDate = d;
      if (d > maxDate) maxDate = d;
    }
    return { minDate, maxDate };
  });

  // Calculate simulated PAYG spend under the detected active discount
  let detectedPaygSpend = $derived.by(() => {
    const j = $classifiedJourneys;
    if (j.length === 0) return 0;
    const detected = $detectedDiscount;
    if (detected === 'none') {
      const res = calculateFareTypeSavings(j, 'none', 0, false);
      return res.totalExpectedSpend;
    } else {
      const res = calculateFareTypeSavings(j, detected, 0, false);
      return res.totalFareTypeSpend;
    }
  });

  // Check if any student travelcard or bus pass options save money vs the detected PAYG spend
  let hasStudentSavings = $derived.by(() => {
    if (!travelProfile || !analysisDates) return false;
    const baseline = detectedPaygSpend;
    const zone = travelProfile.topZone;
    const weeks = travelProfile.weeks || 1;
    const months = Math.ceil(travelProfile.weeks / 4.33) || 1;

    // Student Weekly Travelcard
    const weeklyRate = STUDENT_TRAVELCARD_WEEKLY[zone] || 0;
    const weeklyCost = weeklyRate > 0 ? weeklyRate * weeks : Infinity;

    // Student Monthly Travelcard
    const monthlyRate = STUDENT_TRAVELCARD_MONTHLY[zone] || 0;
    const monthlyCost = monthlyRate > 0 ? monthlyRate * months : Infinity;

    // Student Odd-Period Travelcard
    const oddPeriodResult = calculateTravelcardPeriodCost(
      analysisDates.minDate,
      analysisDates.maxDate,
      STUDENT_TRAVELCARD_WEEKLY[zone] || 0,
      STUDENT_TRAVELCARD_MONTHLY[zone] || 0,
      STUDENT_TRAVELCARD_ANNUAL[zone] || 0
    );
    const oddPeriodCost = oddPeriodResult.cost > 0 ? oddPeriodResult.cost : Infinity;

    // Student Bus Pass
    const weeklyBusCost = STUDENT_BUS_PASS_WEEKLY * weeks;
    const monthlyBusCost = STUDENT_BUS_PASS_MONTHLY * months;

    return (
      weeklyCost < baseline ||
      monthlyCost < baseline ||
      oddPeriodCost < baseline ||
      weeklyBusCost < baseline ||
      monthlyBusCost < baseline
    );
  });

  // Check if they commute to university stations
  let hasUniversityCommute = $derived.by(() => {
    const j = $classifiedJourneys;
    if (j.length === 0) return false;
    let count = 0;
    for (const jj of j) {
      if (jj.isBus || !jj.origin || !jj.destination) continue;
      const o = jj.origin.toLowerCase();
      const d = jj.destination.toLowerCase();
      const originMatch = UNIVERSITY_STATIONS.some((st) => o.includes(st));
      const destMatch = UNIVERSITY_STATIONS.some((st) => d.includes(st));
      if (originMatch || destMatch) {
        count++;
      }
    }
    return count >= 3;
  });

  // Derived saving tips
  let savingTips = $derived.by(() => {
    const j = $classifiedJourneys;
    if (j.length === 0) return [];

    const tips = [];

    // 1. Near-peak touch-ins
    let nearPeakCount = 0;
    let nearPeakSavings = 0;
    const nearPeakJourneys: any[] = [];

    const formatDate = (date: Date) => {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    for (const jj of j) {
      if (jj.isBus || !jj.isPeak || jj.raw.charge <= 0) continue;

      const dayOfWeek = jj.dayOfWeek;
      const date = jj.raw.date;
      const startTime = jj.raw.startTime;

      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isUKBankHoliday(date)) {
        const mins = timeToMinutes(startTime);
        const isNearBoundary =
          (mins >= 390 && mins <= 404) || // 06:30-06:44
          (mins >= 556 && mins <= 570) || // 09:16-09:30
          (mins >= 960 && mins <= 974) || // 16:00-16:14
          (mins >= 1126 && mins <= 1140); // 18:46-19:00

        if (isNearBoundary) {
          const currentConcession = calculateFareTypeFare(
            jj,
            $selectedFareType,
          );
          const offPeakConcession = calculateFareTypeFare(
            { ...jj, isPeak: false },
            $selectedFareType,
          );
          const saving = Math.max(0, currentConcession - offPeakConcession);

          if (saving > 0) {
            nearPeakCount++;
            nearPeakSavings += saving;
            nearPeakJourneys.push({
              dateStr: jj.raw.dateStr || formatDate(date),
              startTime: jj.raw.startTime,
              origin: jj.origin || "Unknown",
              destination: jj.destination || "Unknown",
              saving: saving,
              actualCharge: jj.raw.charge,
              offPeakFare: offPeakConcession,
            });
          }
        }
      }
    }

    if (nearPeakCount > 0 && nearPeakSavings > 0) {
      tips.push({
        id: "near_peak",
        title: "Shift Near-Peak Journeys",
        desc: `You touched in ${nearPeakCount} times within 15 minutes of a peak off-peak boundary. Shifting these journeys by just 15 minutes would have saved you approximately £${nearPeakSavings.toFixed(2)}.`,
        saving: nearPeakSavings,
        severity:
          nearPeakSavings > 15
            ? "high"
            : nearPeakSavings > 5
              ? "medium"
              : "low",
        badge: "⏰",
        journeys: nearPeakJourneys,
      });
    }

    // 2. Travelcard vs PAYG recommendation
    const weeks = $weeklyCapResults?.length ?? 0;
    const totalSpend = j.reduce((s, jj) => s + jj.raw.charge, 0);
    const profile = travelProfile;
    const zone = profile ? profile.topZone : "Z1-2";

    const isStudentRate = $selectedFareType === "student" || forceStudentView;
    const weeklyRate = isStudentRate
      ? STUDENT_TRAVELCARD_WEEKLY[zone] || 0
      : TRAVELCARD_WEEKLY[zone] || 0;
    const monthlyRate = isStudentRate
      ? STUDENT_TRAVELCARD_MONTHLY[zone] || 0
      : TRAVELCARD_MONTHLY[zone] || 0;

    if (weeks > 0 && weeklyRate > 0) {
      let totalWeeklyTcCost = 0;
      let totalPaygSpend = 0;

      for (const w of $weeklyCapResults) {
        const weekZone = w.maxZoneRange || zone;
        const rate = isStudentRate
          ? STUDENT_TRAVELCARD_WEEKLY[weekZone] || 0
          : TRAVELCARD_WEEKLY[weekZone] || 0;
        totalWeeklyTcCost += rate;
        totalPaygSpend += w.totalSpend;
      }

      const tcSaving = totalPaygSpend - totalWeeklyTcCost;
      if (tcSaving > 0) {
        tips.push({
          id: "travelcard",
          title: `Get a Weekly Travelcard (${zone})`,
          desc: `Your weekly travel patterns are dense enough that a Weekly Travelcard for ${zone} would have saved you £${tcSaving.toFixed(2)} over ${weeks} weeks compared to pay-as-you-go.`,
          saving: tcSaving,
          severity: tcSaving > 20 ? "high" : "medium",
          badge: "🎫",
        });
      }

      if (weeks >= 4 && monthlyRate > 0) {
        const months = weeks / 4.33;
        const totalMonthlyTcCost = monthlyRate * Math.ceil(months);
        const monthlyTcSaving = totalSpend - totalMonthlyTcCost;

        if (monthlyTcSaving > 0) {
          tips.push({
            id: "travelcard_monthly",
            title: `Get a Monthly Travelcard (${zone})`,
            desc: `Based on your ${weeks} weeks of history, buying a Monthly Travelcard for ${zone} would have saved you £${monthlyTcSaving.toFixed(2)} in total.`,
            saving: monthlyTcSaving,
            severity: monthlyTcSaving > 30 ? "high" : "medium",
            badge: "💳",
          });
        }
      }
    }

    // 3. Bus Pass candidate
    let totalBusSpend = 0;
    for (const jj of j) {
      if (jj.isBus) {
        totalBusSpend += jj.raw.charge;
      }
    }
    const weeklyBusSpend = weeks > 0 ? totalBusSpend / weeks : totalBusSpend;
    const busPassRate = isStudentRate
      ? STUDENT_BUS_PASS_WEEKLY
      : BUS_PASS_WEEKLY;

    if (weeklyBusSpend > busPassRate) {
      const busSaving = (weeklyBusSpend - busPassRate) * weeks;
      tips.push({
        id: "bus_pass",
        title: "Switch to a Bus & Tram Pass",
        desc: `You spend an average of £${weeklyBusSpend.toFixed(2)} per week on buses. A Weekly Bus & Tram Pass (${isStudentRate ? "Student rate: " : ""}£${busPassRate.toFixed(2)}) would save you £${busSaving.toFixed(2)} over your travel period.`,
        saving: busSaving,
        severity: busSaving > 10 ? "high" : "medium",
        badge: "🚌",
      });
    }

    // 4. Pink Reader Tip
    let hasOuterRailJourney = false;
    for (const jj of j) {
      if (
        !jj.isBus &&
        (jj.mode === "national_rail" ||
          jj.mode === "overground" ||
          jj.mode === "nr_tube")
      ) {
        if (
          jj.originZone !== null &&
          jj.destinationZone !== null &&
          jj.originZone >= 2 &&
          jj.destinationZone >= 2
        ) {
          hasOuterRailJourney = true;
          break;
        }
      }
    }

    if (hasOuterRailJourney) {
      tips.push({
        id: "pink_reader",
        title: "Use Pink Card Readers",
        desc: `We noticed you make journeys between outer zones (avoiding Zone 1). Remember to touch the pink card readers when transferring trains at key interchange stations (like Clapham Junction, Stratford, or Canada Water) to pay a significantly cheaper fare!`,
        saving: 0,
        severity: "low",
        badge: "🔴",
      });
    }

    return tips.sort((a, b) => b.saving - a.saving);
  });

  // Top 5 Most Common Journeys
  let topJourneys = $derived.by(() => {
    const j = $classifiedJourneys;
    const counts = new Map<
      string,
      {
        origin: string;
        destination: string;
        isBus: boolean;
        mode: string;
        route: string;
        count: number;
      }
    >();

    for (const jj of j) {
      let key = "";
      let originName = "";
      let destName = "";
      let isBus = jj.isBus;
      let route = jj.busRoute || "";

      if (isBus) {
        originName = jj.raw.journeyAction;
        key = `bus-${originName}`;
      } else {
        if (!jj.origin || !jj.destination) continue;
        originName = jj.origin.replace(/\s*\[.*?\]/g, "").trim();
        destName = jj.destination.replace(/\s*\[.*?\]/g, "").trim();
        key = `${originName.toLowerCase()} to ${destName.toLowerCase()}`;
      }

      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, {
          origin: originName,
          destination: destName,
          isBus,
          mode: jj.mode,
          route,
          count: 1,
        });
      }
    }

    const total = j.length || 1;
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        percentage: (item.count / total) * 100,
      }));
  });

  // Mode Share Statistics
  let modeShareStats = $derived.by(() => {
    const j = $classifiedJourneys;
    const counts = new Map<string, number>();
    for (const jj of j) {
      let m = jj.mode as string;
      if (jj.isBus) m = "bus";
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    const total = j.length || 1;
    return Array.from(counts.entries())
      .map(([mode, c]) => {
        let label = mode;
        let emoji = "🚈";
        if (mode === "underground") {
          label = "Underground";
          emoji = "🚇";
        } else if (mode === "national_rail") {
          label = "National Rail";
          emoji = "🚆";
        } else if (mode === "elizabeth") {
          label = "Elizabeth line";
          emoji = "💜";
        } else if (mode === "overground") {
          label = "Overground";
          emoji = "🧡";
        } else if (mode === "dlr") {
          label = "DLR";
          emoji = "🔴";
        } else if (mode === "bus") {
          label = "Bus & Tram";
          emoji = "🚌";
        } else if (mode === "nr_tube") {
          label = "NR / Tube connection";
          emoji = "🔄";
        }

        return {
          mode,
          label,
          emoji,
          count: c,
          percentage: (c / total) * 100,
        };
      })
      .sort((a, b) => b.count - a.count);
  });

  // Time of Day distribution stats
  let timeOfDayStats = $derived.by(() => {
    const j = $classifiedJourneys;
    const counts = {
      early_morning: 0,
      morning_peak: 0,
      midday: 0,
      evening_peak: 0,
      evening_offpeak: 0,
      late_night: 0,
    };

    for (const jj of j) {
      const p = getTimePeriod(jj.raw.startTime);
      if (p in counts) {
        counts[p as keyof typeof counts]++;
      }
    }

    const total = j.length || 1;
    return Object.entries(counts).map(([key, val]) => {
      let label = "";
      let icon = "🕐";
      if (key === "early_morning") {
        label = "Early Morning (04:30 - 06:30)";
        icon = "🌅";
      } else if (key === "morning_peak") {
        label = "Morning Peak (06:30 - 09:30)";
        icon = "🌆";
      } else if (key === "midday") {
        label = "Mid-day Off-Peak (09:30 - 16:00)";
        icon = "☀️";
      } else if (key === "evening_peak") {
        label = "Evening Peak (16:00 - 19:00)";
        icon = "🌇";
      } else if (key === "evening_offpeak") {
        label = "Evening Off-Peak (19:00 - 22:00)";
        icon = "🌃";
      } else if (key === "late_night") {
        label = "Late Night (22:00 - 04:30)";
        icon = "🌙";
      }

      return {
        key,
        label,
        icon,
        count: val,
        percentage: (val / total) * 100,
      };
    });
  });

  // Day of Week frequency stats
  let dayOfWeekStats = $derived.by(() => {
    const j = $classifiedJourneys;
    const counts = Array(7).fill(0);
    for (const jj of j) {
      const d = jj.dayOfWeek;
      if (d >= 0 && d <= 6) {
        counts[d]++;
      }
    }
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const total = j.length || 1;

    // Shift arrays to start with Monday (1) to Sunday (0)
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((idx) => ({
      name: days[idx],
      count: counts[idx],
      percentage: (counts[idx] / total) * 100,
    }));
  });

  // Penalty fares and same-station exit anomalies
  let anomalies = $derived.by(() => {
    const j = $classifiedJourneys;
    const list: {
      date: string;
      time: string;
      description: string;
      charge: number;
      type: "same_station" | "no_touch";
    }[] = [];
    let totalPenaltySpend = 0;

    for (const jj of j) {
      const action = (jj.raw.journeyAction || "").toLowerCase();
      const note = (jj.raw.note || "").toLowerCase();

      // Same station exit
      if (
        jj.origin &&
        jj.destination &&
        jj.origin.toLowerCase().trim() === jj.destination.toLowerCase().trim()
      ) {
        list.push({
          date: jj.raw.dateStr,
          time: jj.raw.startTime || "—",
          description: `Entered & exited ${jj.origin.replace(/\s*\[.*?\]/g, "")}`,
          charge: jj.raw.charge,
          type: "same_station",
        });
        totalPenaltySpend += jj.raw.charge;
      }
      // Maximum fare / did not touch
      else if (
        action.includes("did not touch") ||
        action.includes("unstarted") ||
        action.includes("incomplete") ||
        note.includes("maximum fare") ||
        note.includes("did not touch")
      ) {
        list.push({
          date: jj.raw.dateStr,
          time: jj.raw.startTime || "—",
          description: `Incomplete tap-out / maximum charge`,
          charge: jj.raw.charge,
          type: "no_touch",
        });
        totalPenaltySpend += jj.raw.charge;
      }
    }

    return {
      list: list.sort((a, b) => b.date.localeCompare(a.date)),
      totalPenaltySpend,
      count: list.length,
    };
  });

  // Primary Travel Profile Stats Card
  let travelProfile = $derived.by(() => {
    const j = $classifiedJourneys;
    if (j.length === 0) return null;

    const weeks = $weeklyCapResults?.length ?? 0;
    const totalSpend = j.reduce((s, jj) => s + jj.raw.charge, 0);
    const avgWeekly = weeks > 0 ? totalSpend / weeks : totalSpend;

    // Find most common zone range
    const zoneCounts = new Map<string, number>();
    for (const jj of j) {
      if (jj.zoneRange) {
        zoneCounts.set(jj.zoneRange, (zoneCounts.get(jj.zoneRange) ?? 0) + 1);
      }
    }
    let topZone = "Z1-2";
    let topCount = 0;
    for (const [z, c] of zoneCounts) {
      if (c > topCount) {
        topZone = z;
        topCount = c;
      }
    }

    return {
      journeys: j.length,
      weeks,
      avgWeekly: Math.round(avgWeekly * 100) / 100,
      totalSpend: Math.round(totalSpend * 100) / 100,
      projectedMonthly: Math.round(avgWeekly * 4.33 * 100) / 100,
      projectedAnnual: Math.round(avgWeekly * 52),
      topZone,
    };
  });

  function getModeBadgeClass(m: string): string {
    if (m === "bus") return "badge-bus";
    if (m === "underground") return "badge-underground";
    if (m === "overground") return "badge-overground";
    if (m === "elizabeth") return "badge-elizabeth";
    if (m === "dlr") return "badge-dlr";
    if (m === "tram") return "badge-tram";
    return "badge-rail";
  }

  function getModeLabel(mode: string): string {
    if (mode === "underground") return "Tube";
    if (mode === "overground") return "Overground";
    if (mode === "elizabeth") return "Elizabeth";
    if (mode === "dlr") return "DLR";
    if (mode === "national_rail") return "Rail";
    if (mode === "nr_tube") return "NR/Tube";
    if (mode === "bus") return "Bus";
    return mode;
  }
</script>

<div class="insights-page">
  <h1 class="page-title">Travel Insights</h1>
  <p class="page-subtitle">
    Personalized commutes analysis, traveler profiling, mode shares, and anomaly
    cost estimation
  </p>

  {#if !travelProfile}
    <!-- Empty State -->
    <div class="glass-card empty-state">
      <div class="empty-icon">💡</div>
      <h2>No Travel Data Uploaded</h2>
      <p>
        Please go to the Upload page and load your TfL Oyster CSV history to
        view comprehensive insights.
      </p>
    </div>
  {:else}
    <!-- Active Insights Grid -->
    <div class="insights-grid">
      <!-- Column 1: Traveler Profile & Top Journeys -->
      <div class="column">
        <!-- Traveler Persona Card -->
        <div class="glass-card personas-container-card">
          <div class="personas-header-bar">
            <div class="p-header-title">
              <span class="p-header-tag">Commuter Profile</span>
              <h3 class="card-title" style="margin: 0;">
                👤 Your Traveler Personas
              </h3>
            </div>
            {#if personas.timeOfDayTag}
              <span class="tag-badge time-tag">{personas.timeOfDayTag}</span>
            {/if}
          </div>

          <div class="personas-stack">
            {#each personas.active as p}
              <div class="persona-item-row {p.class}">
                <div class="p-badge-col">
                  <span class="p-item-badge">{p.badge}</span>
                </div>
                <div class="p-text-col">
                  <h4 class="p-item-title">{p.title}</h4>
                  <p class="p-item-desc">{p.desc}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Travel Profile Card -->
        <div class="glass-card stats-card-large">
          <h3 class="card-title">📊 Travel Profile</h3>
          <div class="grid-stats">
            <div class="metric">
              <span class="metric-val">{travelProfile.journeys}</span>
              <span class="metric-label">Total Journeys</span>
            </div>
            <div class="metric">
              <span class="metric-val">{travelProfile.weeks}</span>
              <span class="metric-label">Active Weeks</span>
            </div>
            <div class="metric">
              <span class="metric-val" style="color: var(--color-oyster-blue);"
                >£{travelProfile.avgWeekly.toFixed(2)}</span
              >
              <span class="metric-label">Avg Weekly Spend</span>
            </div>
            <div class="metric">
              <span
                class="metric-val"
                style="color: {getZoneColor(travelProfile.topZone)}"
                >{travelProfile.topZone}</span
              >
              <span class="metric-label">Primary Zone Range</span>
            </div>
          </div>
          <div class="projections-bar">
            <div class="projection">
              <span class="proj-label">Projected Monthly</span>
              <span class="proj-val"
                >£{travelProfile.projectedMonthly.toFixed(2)}</span
              >
            </div>
            <div class="projection">
              <span class="proj-label">Projected Annual</span>
              <span class="proj-val"
                >£{travelProfile.projectedAnnual.toLocaleString()}</span
              >
            </div>
          </div>
        </div>

        <!-- Top 5 Most Common Journeys -->
        <div class="glass-card journeys-card">
          <h3 class="card-title">🏆 Top 5 Most Common Routes</h3>
          <div class="journeys-list">
            {#each topJourneys as route, i}
              <div class="journey-item">
                <span class="rank-badge">#{i + 1}</span>
                <div class="journey-details">
                  {#if route.isBus}
                    <span class="route-names">{route.origin}</span>
                  {:else}
                    <span class="route-names">
                      {route.origin} <span class="arrow">→</span>
                      {route.destination}
                    </span>
                  {/if}
                  <span class="route-meta">
                    <span class="badge {getModeBadgeClass(route.mode)}"
                      >{getModeLabel(route.mode)}</span
                    >
                    • {route.count} times ({Math.round(route.percentage)}% of
                    travel)
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Potential Savings Card -->
        <div class="glass-card savings-tips-card">
          <h3 class="card-title">💡 Potential Savings</h3>

          {#if savingTips.length === 0}
            <div class="no-tips">
              <span class="tip-success-icon">✨</span>
              <p>
                Your travel patterns are already highly optimized! No additional
                savings found.
              </p>
            </div>
          {:else}
            <div class="tips-stack">
              {#each savingTips as tip}
                <div class="tip-item-row severity-{tip.severity}">
                  <span class="tip-badge">{tip.badge}</span>
                  <div class="tip-content">
                    <h4 class="tip-title">{tip.title}</h4>
                    <p class="tip-desc">{tip.desc}</p>

                    {#if tip.id === "near_peak" && tip.journeys && tip.journeys.length > 0}
                      <div class="near-peak-list-wrapper">
                        <details class="near-peak-details">
                          <summary class="near-peak-summary"
                            >🔍 View {tip.journeys.length} near-peak journeys</summary
                          >
                          <div class="near-peak-items">
                            {#each tip.journeys as npJ}
                              <div class="near-peak-item">
                                <div class="np-time-route">
                                  <span class="np-date"
                                    >{npJ.dateStr} @ {npJ.startTime}</span
                                  >
                                  <span class="np-route"
                                    >{npJ.origin} → {npJ.destination}</span
                                  >
                                </div>
                                <div class="np-savings">
                                  <span class="np-saving-val"
                                    >Save £{npJ.saving.toFixed(2)}</span
                                  >
                                  <span class="np-compare"
                                    >(Paid £{npJ.actualCharge.toFixed(2)} vs £{npJ.offPeakFare.toFixed(
                                      2,
                                    )} off-peak)</span
                                  >
                                </div>
                              </div>
                            {/each}
                          </div>
                        </details>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          {#if hasUniversityCommute && hasStudentSavings}
            <div class="student-prompt-section">
              <div class="student-prompt-header">
                <span class="student-icon">🎓</span>
                <div class="student-text">
                  <span class="student-title">Are you a Student?</span>
                  <span class="student-sub"
                    >We detected regular travel to university campuses.</span
                  >
                </div>
                <button
                  class="student-btn {forceStudentView ? 'active' : ''}"
                  onclick={() => (forceStudentView = !forceStudentView)}
                >
                  {forceStudentView
                    ? "Hide Student Rates"
                    : "Compare Student Rates"}
                </button>
              </div>

              {#if forceStudentView}
                <div class="student-comparison-table-container">
                  <table class="student-table">
                    <thead>
                      <tr>
                        <th>Ticket Option ({travelProfile.topZone})</th>
                        <th>Rate</th>
                        <th>Simulated Cost</th>
                        <th>Saving vs PAYG</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Historical PAYG Spend</td>
                        <td>—</td>
                        <td>£{travelProfile.totalSpend.toFixed(2)}</td>
                        <td>—</td>
                      </tr>
                      {#if STUDENT_TRAVELCARD_WEEKLY[travelProfile.topZone]}
                        {@const weeks = travelProfile.weeks || 1}
                        {@const weeklyCost =
                          STUDENT_TRAVELCARD_WEEKLY[travelProfile.topZone] *
                          weeks}
                        {@const saving = travelProfile.totalSpend - weeklyCost}
                        <tr>
                          <td>Student Weekly Travelcard</td>
                          <td
                            >£{STUDENT_TRAVELCARD_WEEKLY[
                              travelProfile.topZone
                            ].toFixed(2)}/wk</td
                          >
                          <td>£{weeklyCost.toFixed(2)}</td>
                          <td class={saving > 0 ? "text-green" : "text-red"}>
                            {saving > 0
                              ? `Saved £${saving.toFixed(2)}`
                              : `Lost £${Math.abs(saving).toFixed(2)}`}
                          </td>
                        </tr>
                      {/if}
                      {#if STUDENT_TRAVELCARD_MONTHLY[travelProfile.topZone]}
                        {@const months =
                          Math.ceil(travelProfile.weeks / 4.33) || 1}
                        {@const monthlyCost =
                          STUDENT_TRAVELCARD_MONTHLY[travelProfile.topZone] *
                          months}
                        {@const saving = travelProfile.totalSpend - monthlyCost}
                        <tr>
                          <td>Student Monthly Travelcard</td>
                          <td
                            >£{STUDENT_TRAVELCARD_MONTHLY[
                              travelProfile.topZone
                            ].toFixed(2)}/mo</td
                          >
                          <td>£{monthlyCost.toFixed(2)}</td>
                          <td class={saving > 0 ? "text-green" : "text-red"}>
                            {saving > 0
                              ? `Saved £${saving.toFixed(2)}`
                              : `Lost £${Math.abs(saving).toFixed(2)}`}
                          </td>
                        </tr>
                      {/if}
                      {#if STUDENT_TRAVELCARD_WEEKLY[travelProfile.topZone] && analysisDates}
                        {@const oddPeriodResult = calculateTravelcardPeriodCost(
                          analysisDates.minDate,
                          analysisDates.maxDate,
                          STUDENT_TRAVELCARD_WEEKLY[travelProfile.topZone],
                          STUDENT_TRAVELCARD_MONTHLY[travelProfile.topZone],
                          STUDENT_TRAVELCARD_ANNUAL[travelProfile.topZone] || 0
                        )}
                        {@const oddPeriodCost = oddPeriodResult.cost}
                        {@const saving = travelProfile.totalSpend - oddPeriodCost}
                        {#if oddPeriodCost > 0}
                          <tr>
                            <td>Student Odd-Period Travelcard ({oddPeriodResult.label})</td>
                            <td>—</td>
                            <td>£{oddPeriodCost.toFixed(2)}</td>
                            <td class={saving > 0 ? "text-green" : "text-red"}>
                              {saving > 0
                                ? `Saved £${saving.toFixed(2)}`
                                : `Lost £${Math.abs(saving).toFixed(2)}`}
                            </td>
                          </tr>
                        {/if}
                      {/if}
                    </tbody>
                  </table>
                  <p class="student-disclaimer">
                    Prices exclude any Oyster card/photocard application fees.
                    Boundary fares may apply outside {travelProfile.topZone}.
                  </p>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Column 2: Heatmaps, Mode Shares, & Anomalies -->
      <div class="column">
        <!-- Network Mode Share -->
        <div class="glass-card share-card">
          <h3 class="card-title">🚇 Network Mode Share</h3>
          <div class="bar-chart-list">
            {#each modeShareStats as stat}
              <div class="bar-row">
                <div class="bar-labels">
                  <span>{stat.emoji} {stat.label}</span>
                  <span class="bar-val"
                    >{stat.count} ({Math.round(stat.percentage)}%)</span
                  >
                </div>
                <div class="progress-bar-container">
                  <div
                    class="progress-bar-fill"
                    style="width: {stat.percentage}%; background: var(--color-oyster-blue);"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Time of Day Heatmap -->
        <div class="glass-card share-card">
          <h3 class="card-title">🕒 Time of Day Activity</h3>
          <div class="bar-chart-list">
            {#each timeOfDayStats as stat}
              <div class="bar-row">
                <div class="bar-labels">
                  <span>{stat.icon} {stat.label}</span>
                  <span class="bar-val"
                    >{stat.count} ({Math.round(stat.percentage)}%)</span
                  >
                </div>
                <div class="progress-bar-container">
                  <div
                    class="progress-bar-fill"
                    style="width: {stat.percentage}%; background: var(--color-elizabeth-purple);"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Day of Week Frequency -->
        <div class="glass-card share-card">
          <h3 class="card-title">📅 Day of Week Frequency</h3>
          <div class="bar-chart-list">
            {#each dayOfWeekStats as stat}
              <div class="bar-row">
                <div class="bar-labels">
                  <span>{stat.name}</span>
                  <span class="bar-val"
                    >{stat.count} ({Math.round(stat.percentage)}%)</span
                  >
                </div>
                <div class="progress-bar-container">
                  <div
                    class="progress-bar-fill"
                    style="width: {stat.percentage}%; background: var(--color-overground-orange);"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Penalty Fares & Anomalies Tracker -->
        <div
          class="glass-card penalty-card"
          class:anomalies-found={anomalies.count > 0}
        >
          <div class="card-header-flex">
            <h3 class="card-title">⚠️ Penalty Fares & Anomalies</h3>
            {#if anomalies.count > 0}
              <span class="anomaly-alert"
                >Estimate: £{anomalies.totalPenaltySpend.toFixed(2)} Lost</span
              >
            {/if}
          </div>

          {#if anomalies.count === 0}
            <div class="no-anomalies">
              <span class="success-icon">💚</span>
              <p>
                No anomalies or maximum fares detected in your history. You
                always tap in and out correctly!
              </p>
            </div>
          {:else}
            <p class="penalty-intro">
              We detected <strong>{anomalies.count}</strong> maximum fares or same-station
              exits. Ensure you request refund claims on the TfL website.
            </p>
            <div class="anomaly-scroll">
              {#each anomalies.list as err}
                <div class="anomaly-row">
                  <div class="anomaly-left">
                    <span class="anomaly-date">{err.date} {err.time}</span>
                    <span class="anomaly-desc">{err.description}</span>
                  </div>
                  <span class="anomaly-charge">£{err.charge.toFixed(2)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .insights-page {
    max-width: 1100px;
    margin: 0 auto;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .page-subtitle {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  /* Empty state */
  .empty-state {
    padding: 3rem;
    text-align: center;
    max-width: 600px;
    margin: 4rem auto;
  }
  .empty-icon {
    font-size: 3.5rem;
    margin-bottom: 1rem;
  }
  .empty-state h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  .empty-state p {
    color: var(--color-text-secondary);
    line-height: 1.6;
    font-size: 0.95rem;
  }

  /* Grid Layout */
  .insights-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .card-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  /* Persona Card Containers and Headers */
  .personas-container-card {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .personas-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .p-header-title {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .p-header-tag {
    font-size: 0.7rem;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }
  .tag-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.725rem;
    font-weight: 700;
  }
  .time-tag {
    background: rgba(0, 159, 227, 0.1);
    border: 1px solid rgba(0, 159, 227, 0.3);
    color: var(--color-oyster-blue);
  }
  .personas-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .persona-item-row {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(255, 255, 255, 0.01);
  }
  .p-badge-col {
    flex-shrink: 0;
  }
  .p-item-badge {
    font-size: 1.75rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .p-text-col {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .p-item-title {
    font-size: 0.95rem;
    font-weight: 700;
    margin: 0;
  }
  .p-item-desc {
    font-size: 0.8rem;
    line-height: 1.4;
    margin: 0;
    color: var(--color-text-secondary);
  }

  /* Persona Background and Color Variants */
  .persona-commuter {
    background: linear-gradient(
      135deg,
      rgba(0, 159, 227, 0.12),
      rgba(0, 159, 227, 0.03)
    );
    border-color: rgba(0, 159, 227, 0.3);
  }
  .persona-commuter .p-item-title {
    color: var(--color-oyster-blue);
  }

  .persona-early {
    background: linear-gradient(
      135deg,
      rgba(239, 123, 16, 0.12),
      rgba(239, 123, 16, 0.03)
    );
    border-color: rgba(239, 123, 16, 0.3);
  }
  .persona-early .p-item-title {
    color: var(--color-overground-orange);
  }

  .persona-explorer {
    background: linear-gradient(
      135deg,
      rgba(16, 185, 129, 0.12),
      rgba(16, 185, 129, 0.03)
    );
    border-color: rgba(16, 185, 129, 0.3);
  }
  .persona-explorer .p-item-title {
    color: var(--color-success);
  }

  .persona-owl {
    background: linear-gradient(
      135deg,
      rgba(105, 80, 161, 0.12),
      rgba(105, 80, 161, 0.03)
    );
    border-color: rgba(105, 80, 161, 0.3);
  }
  .persona-owl .p-item-title {
    color: var(--color-elizabeth-light);
  }

  .persona-weekend {
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.12),
      rgba(245, 158, 11, 0.03)
    );
    border-color: rgba(245, 158, 11, 0.3);
  }
  .persona-weekend .p-item-title {
    color: #fbbf24;
  }

  .persona-bus {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.12),
      rgba(239, 68, 68, 0.03)
    );
    border-color: rgba(239, 68, 68, 0.3);
  }
  .persona-bus .p-item-title {
    color: #f87171;
  }

  .persona-rail {
    background: linear-gradient(
      135deg,
      rgba(56, 189, 248, 0.12),
      rgba(56, 189, 248, 0.03)
    );
    border-color: rgba(56, 189, 248, 0.3);
  }
  .persona-rail .p-item-title {
    color: #38bdf8;
  }

  .persona-elizabeth {
    background: linear-gradient(
      135deg,
      rgba(168, 85, 247, 0.12),
      rgba(168, 85, 247, 0.03)
    );
    border-color: rgba(168, 85, 247, 0.3);
  }
  .persona-elizabeth .p-item-title {
    color: #c084fc;
  }

  .persona-zones {
    background: linear-gradient(
      135deg,
      rgba(34, 197, 94, 0.12),
      rgba(34, 197, 94, 0.03)
    );
    border-color: rgba(34, 197, 94, 0.3);
  }
  .persona-zones .p-item-title {
    color: #4ade80;
  }

  .persona-frequent {
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.12),
      rgba(99, 102, 241, 0.03)
    );
    border-color: rgba(99, 102, 241, 0.3);
  }
  .persona-frequent .p-item-title {
    color: #818cf8;
  }

  .persona-capper {
    background: linear-gradient(
      135deg,
      rgba(234, 179, 8, 0.12),
      rgba(234, 179, 8, 0.03)
    );
    border-color: rgba(234, 179, 8, 0.3);
  }
  .persona-capper .p-item-title {
    color: #facc15;
  }

  /* Savings Tips Card */
  .savings-tips-card {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .no-tips {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(16, 185, 129, 0.04);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: 12px;
  }
  .tip-success-icon {
    font-size: 1.25rem;
  }
  .no-tips p {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.4;
  }
  .tips-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .tip-item-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(255, 255, 255, 0.01);
  }
  .tip-item-row.severity-high {
    border-color: rgba(245, 158, 11, 0.3);
    background: linear-gradient(
      135deg,
      rgba(245, 158, 11, 0.05),
      rgba(245, 158, 11, 0.01)
    );
  }
  .tip-item-row.severity-medium {
    border-color: rgba(59, 130, 246, 0.3);
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.05),
      rgba(59, 130, 246, 0.01)
    );
  }
  .tip-item-row.severity-low {
    border-color: rgba(255, 255, 255, 0.08);
  }
  .tip-badge {
    font-size: 1.25rem;
    flex-shrink: 0;
  }
  .tip-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .tip-title {
    font-size: 0.85rem;
    font-weight: 700;
    margin: 0;
  }
  .tip-desc {
    font-size: 0.775rem;
    line-height: 1.4;
    margin: 0;
    color: var(--color-text-secondary);
  }

  /* Student Section */
  .student-prompt-section {
    margin-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .student-prompt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .student-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }
  .student-text {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }
  .student-title {
    font-size: 0.85rem;
    font-weight: 700;
  }
  .student-sub {
    font-size: 0.725rem;
    color: var(--color-text-muted);
  }
  .student-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .student-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }
  .student-btn.active {
    background: var(--color-oyster-blue);
    border-color: var(--color-oyster-blue);
    color: white;
  }

  /* Student Comparison Table */
  .student-comparison-table-container {
    background: rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .student-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
  }
  .student-table th {
    text-align: left;
    color: var(--color-text-muted);
    font-weight: 600;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .student-table td {
    padding: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
  .student-table tr:last-child td {
    border-bottom: none;
  }
  .text-green {
    color: var(--color-success);
    font-weight: 600;
  }
  .text-red {
    color: var(--color-danger);
    font-weight: 600;
  }
  .student-disclaimer {
    font-size: 0.65rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.3;
  }

  /* Stats Card */
  .stats-card-large {
    padding: 1.5rem;
  }

  .grid-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .metric {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    padding: 1rem;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metric-val {
    font-size: 1.5rem;
    font-weight: 800;
  }

  .metric-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .projections-bar {
    display: flex;
    gap: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding-top: 1rem;
  }

  .projection {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .proj-label {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    font-weight: 600;
    margin-bottom: 0.15rem;
  }

  .proj-val {
    font-size: 1.1rem;
    font-weight: 700;
  }

  /* Routes / Journeys List */
  .journeys-card {
    padding: 1.5rem;
  }

  .journeys-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .journey-item {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding-bottom: 0.875rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .journey-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .rank-badge {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.75rem;
    font-weight: 700;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .journey-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .route-names {
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .arrow {
    color: var(--color-text-muted);
    margin: 0 0.2rem;
  }

  .route-meta {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .badge {
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  /* Mode / Share Bars */
  .share-card {
    padding: 1.5rem;
  }

  .bar-chart-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .bar-row {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .bar-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  .bar-val {
    font-weight: 500;
    font-family: monospace;
    font-size: 0.8rem;
  }

  .progress-bar-container {
    height: 8px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 99px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Penalty / Anomalies */
  .penalty-card {
    padding: 1.5rem;
  }

  .card-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .anomaly-alert {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--color-danger);
    font-size: 0.725rem;
    font-weight: 700;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
  }

  .no-anomalies {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(16, 185, 129, 0.04);
    border: 1px solid rgba(16, 185, 129, 0.15);
    border-radius: 12px;
  }

  .no-anomalies p {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.4;
  }

  .penalty-intro {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0 0 1rem 0;
    line-height: 1.4;
  }

  .anomaly-scroll {
    max-height: 250px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-right: 0.25rem;
  }

  .anomaly-row {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    padding: 0.75rem;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .anomaly-left {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .anomaly-date {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .anomaly-desc {
    font-size: 0.775rem;
    font-weight: 500;
    line-height: 1.3;
  }

  .anomaly-charge {
    font-weight: 700;
    color: var(--color-danger);
    font-family: monospace;
    font-size: 0.85rem;
  }

  .near-peak-list-wrapper {
    margin-top: 0.75rem;
    width: 100%;
  }

  .near-peak-details {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    overflow: hidden;
  }

  .near-peak-summary {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    cursor: pointer;
    user-select: none;
    transition: background 0.2s ease;
  }

  .near-peak-summary:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-primary);
  }

  .near-peak-items {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 250px;
    overflow-y: auto;
  }

  .near-peak-item {
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.15);
    border-radius: 6px;
    padding: 0.625rem 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    transition:
      transform 0.2s ease,
      border-color 0.2s ease;
  }

  .near-peak-item:hover {
    transform: translateY(-1px);
    border-color: rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.09);
  }

  .np-time-route {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    text-align: left;
  }

  .np-date {
    font-size: 0.75rem;
    font-weight: 700;
    color: #f59e0b;
  }

  .np-route {
    font-size: 0.8rem;
    color: var(--color-text-primary);
  }

  .np-savings {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.15rem;
  }

  .np-saving-val {
    font-size: 0.8rem;
    font-weight: 800;
    color: #10b981;
  }

  .np-compare {
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }

  @media (max-width: 768px) {
    .insights-grid {
      grid-template-columns: 1fr;
    }
    .grid-stats {
      grid-template-columns: repeat(2, 1fr);
    }
    .projections-bar {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>

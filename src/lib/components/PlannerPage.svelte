<script lang="ts">
  import { untrack } from 'svelte';
  import {
    classifiedJourneys,
    detectedPatterns,
    recurrenceRules,
    plannedJourneys,
    forecastResult,
    selectedFareType,
    fareTypeCost,
    globalAdvancedMode,
    useAlternativeFares,
    apiRetryStatus,
    cards,
  } from "$lib/stores/stores";
  import {
    type RecurrenceRule,
    type PlannedJourney,
    generatePlannedJourneys,
    patternToRule,
  } from "$lib/engine/recurrenceEngine";
  import {
    runForecast,
    simulatePlannedJourneysSpend,
    simulateHybridPlannedJourneysSpend,
  } from "$lib/engine/forecastEngine";
  import {
    getZoneRange,
    lookupFare,
    BUS_SINGLE_FARE,
    FARE_TYPES,
    calculateDiscountedFare,
    type FareType,
    isPeakJourney,
    getRepresentativeTime,
    formatLocalDate,
    parseLocalDate,
    TRAVELCARD_WEEKLY,
    TRAVELCARD_MONTHLY,
    TRAVELCARD_ANNUAL,
    STUDENT_TRAVELCARD_WEEKLY,
    STUDENT_TRAVELCARD_MONTHLY,
    STUDENT_TRAVELCARD_ANNUAL,
    BUS_PASS_MONTHLY,
    STUDENT_BUS_PASS_MONTHLY,
    calculateTravelcardPeriodCost,
    advanceByMonths,
    daysBetween,
    getOutsideZoneDailyCap,
    getOutsideZoneWeeklyCap,
    getDailyBusCap,
    getWeeklyBusCap,
    lookupWeeklyCap,
    getTravelcardJourneyFare,
  } from "$lib/data/fareData";
  import {
    searchStations,
    getModeBadges,
    formatZoneDisplay,
    getZoneColor,
    getStationByNaptan,
    getStationInfo,
    type StationSearchResult,
    type StationInfo,
  } from "$lib/data/stationService";
  import {
    lookupStationFare,
    type FareResult as ApiFareResult,
  } from "$lib/engine/tflApi";

  // Calendar state
  let calendarDate = $state(new Date());
  let plannerCardId = $state<string>('');
  
  $effect(() => {
    if ($cards.length > 0) {
      if (!plannerCardId || !$cards.some(c => c.id === plannerCardId)) {
        plannerCardId = $cards[0].id;
      }
    }
  });

  let plannerCard = $derived($cards.find(c => c.id === plannerCardId) || $cards[0]);
  let currentDetectedPatterns = $derived(plannerCard ? plannerCard.detectedPatterns : []);

  let showRecurrenceModal = $state(false);
  let showActiveRoutines = $state(true);
  let showOneOffJourneys = $state(true);
  let showStudentComparisonTable = $state(false);
  let showWeeklyCapColumn = $state(true);
  let activeMobileTab = $state("calendar");

  // Tooltip hover state for advanced fares
  let fareTooltipData = $state<{
    visible: boolean;
    x: number;
    y: number;
    peakBase: number;
    peakDiscounted: number;
    offPeakBase: number;
    offPeakDiscounted: number;
    cardName: string;
    isApi: boolean;
  } | null>(null);

  // A helper to safely position tooltips within screen bounds
  function calculateTooltipX(target: HTMLElement, tooltipWidth: number): number {
    const rect = target.getBoundingClientRect();
    const targetCenterX = rect.left + rect.width / 2;
    const padding = 12; // Safety margin from viewport edges
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 375;
    
    // If viewport is narrower than tooltip width + padding, center it on screen
    if (screenWidth <= tooltipWidth + padding * 2) {
      return screenWidth / 2;
    }
    
    const halfWidth = tooltipWidth / 2;
    const minX = halfWidth + padding;
    const maxX = screenWidth - halfWidth - padding;
    return Math.max(minX, Math.min(maxX, targetCenterX));
  }

  function showFareTooltip(
    target: HTMLElement,
    isApi: boolean,
    peakBase: number,
    peakDiscounted: number,
    offPeakBase: number,
    offPeakDiscounted: number,
  ) {
    const rect = target.getBoundingClientRect();
    const x = calculateTooltipX(target, 320);
    fareTooltipData = {
      visible: true,
      x,
      y: rect.top,
      peakBase,
      peakDiscounted,
      offPeakBase,
      offPeakDiscounted,
      cardName: FARE_TYPES[$selectedFareType].name,
      isApi,
    };
  }

  function hideFareTooltip() {
    if (fareTooltipData) {
      fareTooltipData.visible = false;
    }
  }

  // Warning tooltip state for contactless-only journeys in discount modes
  let warningTooltipData = $state<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
    title?: string;
    type?: 'concession-disabled';
  } | null>(null);

  // Weekly cap details tooltip state
  let weeklyCapTooltipData = $state<{
    visible: boolean;
    x: number;
    y: number;
    week: any;
  } | null>(null);

  // Odd-period travelcard explanation tooltip state
  let oddPeriodTooltipData = $state<{
    visible: boolean;
    x: number;
    y: number;
  } | null>(null);

  function showOddPeriodTooltip(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const x = calculateTooltipX(target, 320);
    oddPeriodTooltipData = {
      visible: true,
      x,
      y: rect.top
    };
  }

  function hideOddPeriodTooltip() {
    if (oddPeriodTooltipData) {
      oddPeriodTooltipData.visible = false;
    }
  }

  const activeRetryInfo = $derived.by(() => {
    if (!selectedOriginStation?.info?.naptanId || !selectedDestStation?.info?.naptanId) return null;
    const fromNaptan = selectedOriginStation.info.naptanId;
    const toNaptan = selectedDestStation.info.naptanId;
    const keys = Object.keys($apiRetryStatus).filter(k => k.startsWith(`${fromNaptan}-${toNaptan}`));
    if (keys.length === 0) return null;
    return $apiRetryStatus[keys[0]];
  });

  function getRuleRetryInfo(rule: RecurrenceRule) {
    if (!rule.originStation || !rule.destinationStation) return null;
    const keys = Object.keys($apiRetryStatus).filter(k => k.startsWith(`${rule.originStation}-${rule.destinationStation}`));
    if (keys.length === 0) return null;
    return $apiRetryStatus[keys[0]];
  }

  function showWarningTooltip(
    target: HTMLElement,
    text: string,
    title?: string,
    type?: 'concession-disabled'
  ) {
    const rect = target.getBoundingClientRect();
    const x = calculateTooltipX(target, 300);
    warningTooltipData = {
      visible: true,
      x,
      y: rect.top,
      text,
      title,
      type,
    };
  }

  function hideWarningTooltip() {
    if (warningTooltipData) {
      warningTooltipData.visible = false;
    }
  }

  function getMonday(d: Date): Date {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  function getForecastWeekForDate(date: Date) {
    if (!$forecastResult) return null;
    const monday = getMonday(date);
    const key = formatLocalDate(monday);
    return $forecastResult.weeklyBreakdown.find(w => formatLocalDate(w.weekStart) === key);
  }

  function getRuleFares(rule: RecurrenceRule) {
    if (rule.mode === 'bus') {
      const baseBus = BUS_SINGLE_FARE;
      const discBus = calculateDiscountedFare(baseBus, $selectedFareType, false, true);
      return {
        peakBase: baseBus,
        peakDiscounted: discBus,
        offPeakBase: baseBus,
        offPeakDiscounted: discBus,
      };
    }
    
    // For Tube/Rail
    if (rule.isAdvancedMode && rule.exactFarePeak !== undefined && rule.exactFareOffPeak !== undefined) {
      // It is a live fare
      const peakBase = rule.exactBaseFarePeak ?? rule.exactFarePeak;
      const peakDiscounted = rule.exactFarePeak;
      const offPeakBase = rule.exactBaseFareOffPeak ?? rule.exactFareOffPeak;
      const offPeakDiscounted = rule.exactFareOffPeak;
      return {
        peakBase,
        peakDiscounted,
        offPeakBase,
        offPeakDiscounted,
      };
    } else {
      // It is an estimate (zone-based fallback)
      const zoneRange = getZoneRange(rule.originZone, rule.destinationZone);
      const peakBase = lookupFare(zoneRange, true, rule.mode);
      const peakDiscounted = calculateDiscountedFare(peakBase, $selectedFareType, true, false, rule.originZone, rule.destinationZone, rule.mode, rule.originStation, rule.destinationStation);
      const offPeakBase = lookupFare(zoneRange, false, rule.mode);
      const offPeakDiscounted = calculateDiscountedFare(offPeakBase, $selectedFareType, false, false, rule.originZone, rule.destinationZone, rule.mode, rule.originStation, rule.destinationStation);
      return {
        peakBase,
        peakDiscounted,
        offPeakBase,
        offPeakDiscounted,
      };
    }
  }

  function showWeeklyCapTooltip(target: HTMLElement, week: any, isHover: boolean) {
    if (!week) return;

    // Bypassing synthetic mouseenter on touch/mobile devices to prevent click race conditions
    if (isHover && !window.matchMedia('(hover: hover)').matches) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const x = calculateTooltipX(target, 320);
    weeklyCapTooltipData = {
      visible: true,
      x,
      y: rect.top,
      week,
    };
  }

  function hideWeeklyCapTooltip(event?: MouseEvent) {
    // Bypassing synthetic mouseleave on touch/mobile devices to prevent click race conditions
    if (event && event.type === 'mouseleave' && !window.matchMedia('(hover: hover)').matches) {
      return;
    }
    if (weeklyCapTooltipData) {
      weeklyCapTooltipData.visible = false;
    }
  }

  function handleWeeklyCapClick(target: HTMLElement, week: any) {
    if (weeklyCapTooltipData && weeklyCapTooltipData.visible) {
      hideWeeklyCapTooltip();
    } else {
      showWeeklyCapTooltip(target, week, false);
    }
  }

  function isRuleDisabledForFareType(rule: RecurrenceRule, fareType: string): boolean {
    if (!rule.isAdvancedMode || fareType === 'none') return false;
    
    const checkContactlessOnly = (val: string | null | undefined) => {
      if (!val) return false;
      const byNaptan = getStationByNaptan(val);
      if (byNaptan?.info.contactlessOnly) return true;
      const byName = getStationInfo(val);
      if (byName?.contactlessOnly) return true;
      return false;
    };

    return checkContactlessOnly(rule.originStation) || checkContactlessOnly(rule.destinationStation);
  }

  $effect(() => {
    if (!showRecurrenceModal) {
      untrack(() => {
        hideFareTooltip();
        hideWarningTooltip();
        hideWeeklyCapTooltip();
      });
    }
  });

  $effect(() => {
    if (showRecurrenceModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  });

  // Background task to automatically update saved rules with actual TfL API fares if they were estimated/unavailable before
  async function syncRuleFaresWithApi() {
    let updatedAny = false;
    const currentRules = [...$recurrenceRules];

    for (let i = 0; i < currentRules.length; i++) {
      const rule = currentRules[i];
      if (rule.isAdvancedMode && rule.originStation && rule.destinationStation) {
        try {
          const zoneRange = getZoneRange(rule.originZone, rule.destinationZone);
          const fallback = {
            peak: lookupFare(zoneRange, true, rule.mode),
            offPeak: lookupFare(zoneRange, false, rule.mode)
          };
          
          const result = await lookupStationFare(rule.originStation, rule.destinationStation, fallback, $useAlternativeFares, rule.mode, $selectedFareType);
          
          if (result.isFromApi) {
            let targetPeak = result.peak;
            let targetOffPeak = result.offPeak;
            let targetBasePeak = result.basePeak;
            let targetBaseOffPeak = result.baseOffPeak;
            let targetDesc = result.routeDescription;

            // If the rule already has a route description, try to match it in result.options
            if (rule.routeDescription && result.options) {
              const matchedOpt = result.options.find(o => o.routeDescription === rule.routeDescription);
              if (matchedOpt) {
                targetPeak = matchedOpt.peak;
                targetOffPeak = matchedOpt.offPeak;
                targetDesc = matchedOpt.routeDescription;
                
                if (result.baseOptions) {
                  const matchedBase = result.baseOptions.find(o => o.routeDescription === rule.routeDescription);
                  if (matchedBase) {
                    targetBasePeak = matchedBase.peak;
                    targetBaseOffPeak = matchedBase.offPeak;
                  }
                }
              }
            }

            // Check if exact fare is missing or different
            if (
              rule.exactFarePeak !== targetPeak || 
              rule.exactFareOffPeak !== targetOffPeak ||
              rule.exactBaseFarePeak !== targetBasePeak ||
              rule.exactBaseFareOffPeak !== targetBaseOffPeak ||
              rule.routeDescription !== targetDesc
            ) {
              currentRules[i] = {
                ...rule,
                exactFarePeak: targetPeak,
                exactFareOffPeak: targetOffPeak,
                exactBaseFarePeak: targetBasePeak,
                exactBaseFareOffPeak: targetBaseOffPeak,
                routeDescription: targetDesc
              };
              updatedAny = true;
            }
          }
        } catch (e) {
          console.error(`Failed to background sync fare for rule: ${rule.name}`, e);
        }
      }
    }

    if (updatedAny) {
      $recurrenceRules = currentRules;
      regenerate(); // regenerate planned journeys and forecast spend
    }
  }

  $effect(() => {
    // Re-run advanced fare query and background sync when setting toggles
    const cheapestOption = $useAlternativeFares;
    if (showRecurrenceModal) {
      fetchAdvancedFare();
    }
    syncRuleFaresWithApi();
  });



  $effect(() => {
    if ($globalAdvancedMode) {
      if (defMode === "national_rail" || defMode === "nr_tube") {
        defMode = "underground";
      }
    }
  });

  $effect(() => {
    if (syncWithPlanEnd) {
      newRuleEndDate = planEnd;
    }
  });

  $effect(() => {
    if (syncWithPlanStart) {
      newRuleDate = planStart;
    }
  });

  // Default fallback values to avoid state_referenced_locally warning and maintain single reference
  const DEFAULT_SETTINGS = {
    originZone: 3,
    destZone: 1,
    mode: "underground" as const,
    timePeriod: "06:30-09:30",
  };

  // Default Settings for Quick Add
  let defOriginZone = $state(DEFAULT_SETTINGS.originZone);
  let defDestZone = $state(DEFAULT_SETTINGS.destZone);
  let defMode = $state<"underground" | "national_rail" | "nr_tube" | "bus">(
    DEFAULT_SETTINGS.mode,
  );
  let defTimePeriod = $state(DEFAULT_SETTINGS.timePeriod);

  // New rule form
  let newRuleName = $state("");
  let newOriginZone = $state(DEFAULT_SETTINGS.originZone);
  let newDestZone = $state(DEFAULT_SETTINGS.destZone);
  let newMode = $state<"underground" | "national_rail" | "nr_tube" | "bus">(
    DEFAULT_SETTINGS.mode,
  );
  let newTimePeriod = $state(DEFAULT_SETTINGS.timePeriod);
  let newIsReturn = $state(false);
  let newReturnTimePeriod = $state("16:00-19:00");
  let newDays = $state<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  let newIntervalType = $state<"days" | "weeks" | "months" | "years" | "none">(
    "weeks",
  );
  let newIntervalValue = $state(1);
  let editRuleId = $state<string | null>(null);
  let newRuleDate = $state("");
  let newRuleEndDate = $state("");
  let syncWithPlanEnd = $state(true);
  let syncWithPlanStart = $state(true);

  // Advanced Mode state
  let advancedMode = $state($globalAdvancedMode);
  let originStationQuery = $state("");
  let destStationQuery = $state("");
  let originStationResults = $state<StationSearchResult[]>([]);
  let destStationResults = $state<StationSearchResult[]>([]);
  let selectedOriginStation = $state<{ key: string; info: StationInfo } | null>(
    null,
  );
  let selectedDestStation = $state<{ key: string; info: StationInfo } | null>(
    null,
  );
  let showOriginDropdown = $state(false);
  let showDestDropdown = $state(false);
  let advancedFareLoading = $state(false);
  let advancedFareResult = $state<ApiFareResult | null>(null);

  let outsideZoneCapDetails = $derived.by(() => {
    let oNaptan = selectedOriginStation?.info.naptanId;
    let dNaptan = selectedDestStation?.info.naptanId;
    
    let result: {
      peak: { cap: number; stationName: string } | null;
      offPeak: { cap: number; stationName: string } | null;
      weekly: { cap: number; stationName: string } | null;
    } = {
      peak: null,
      offPeak: null,
      weekly: null
    };
    
    const checkStation = (naptan: string, name: string) => {
      const p = getOutsideZoneDailyCap(naptan, $selectedFareType, true);
      const op = getOutsideZoneDailyCap(naptan, $selectedFareType, false);
      const w = getOutsideZoneWeeklyCap(naptan, $selectedFareType);
      
      if (p !== null) {
        if (result.peak === null || p > result.peak.cap) {
          result.peak = { cap: p, stationName: name };
        }
      }
      if (op !== null) {
        if (result.offPeak === null || op > result.offPeak.cap) {
          result.offPeak = { cap: op, stationName: name };
        }
      }
      if (w !== null) {
        if (result.weekly === null || w > result.weekly.cap) {
          result.weekly = { cap: w, stationName: name };
        }
      }
    };
    
    if (oNaptan) {
      checkStation(oNaptan, selectedOriginStation!.info.name);
    }
    if (dNaptan) {
      checkStation(dNaptan, selectedDestStation!.info.name);
    }
    
    return result;
  });

  let selectedRouteIndex = $state<number>(0);
  let selectedPeakFare = $state<number>(0);
  let selectedOffPeakFare = $state<number>(0);
  let selectedRouteDescription = $state<string>("");

  let selectedBasePeakFare = $derived.by(() => {
    if (advancedFareResult && advancedFareResult.isFromApi && 'baseOptions' in advancedFareResult && advancedFareResult.baseOptions) {
      const selectedOpt = advancedFareResult.options?.[selectedRouteIndex];
      if (selectedOpt) {
        const matchedBase = advancedFareResult.baseOptions.find(o => o.routeDescription === selectedOpt.routeDescription);
        if (matchedBase) return matchedBase.peak;
      }
      return advancedFareResult.basePeak;
    }
    if (advancedFareResult && 'basePeak' in advancedFareResult) {
      return advancedFareResult.basePeak;
    }
    return selectedPeakFare;
  });

  let selectedBaseOffPeakFare = $derived.by(() => {
    if (advancedFareResult && advancedFareResult.isFromApi && 'baseOptions' in advancedFareResult && advancedFareResult.baseOptions) {
      const selectedOpt = advancedFareResult.options?.[selectedRouteIndex];
      if (selectedOpt) {
        const matchedBase = advancedFareResult.baseOptions.find(o => o.routeDescription === selectedOpt.routeDescription);
        if (matchedBase) return matchedBase.offPeak;
      }
      return advancedFareResult.baseOffPeak;
    }
    if (advancedFareResult && 'baseOffPeak' in advancedFareResult) {
      return advancedFareResult.baseOffPeak;
    }
    return selectedOffPeakFare;
  });

  // Default Home Station state
  let useDefaultHomeStation = $state(
    typeof window !== "undefined" && localStorage.getItem("oystersavings_use_default_home_station") === "true"
  );
  let defaultHomeStation = $state<{ key: string; info: StationInfo } | null>(null);
  let sidebarHomeQuery = $state("");
  let sidebarHomeResults = $state<StationSearchResult[]>([]);
  let showSidebarHomeDropdown = $state(false);

  // Restore defaultHomeStation from localStorage if available
  $effect(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("oystersavings_default_home_station");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.key && parsed.info) {
            defaultHomeStation = parsed;
          }
        } catch (e) {
          console.error("Failed to parse defaultHomeStation", e);
        }
      }
    }
  });

  // Watch for changes to persist
  $effect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("oystersavings_use_default_home_station", String(useDefaultHomeStation));
      if (defaultHomeStation) {
        localStorage.setItem("oystersavings_default_home_station", JSON.stringify(defaultHomeStation));
      } else {
        localStorage.removeItem("oystersavings_default_home_station");
      }
    }
  });

  function handleSidebarHomeSearch(query: string) {
    sidebarHomeQuery = query;
    if (query.trim().length >= 1) {
      sidebarHomeResults = searchStations(query, 5);
      showSidebarHomeDropdown = true;
    } else {
      sidebarHomeResults = [];
      showSidebarHomeDropdown = false;
    }
  }

  // Effect to reactively update selected fare options when advancedFareResult or useAlternativeFares changes
  $effect(() => {
    if (advancedFareResult && advancedFareResult.isFromApi && advancedFareResult.options) {
      // If we are editing an existing rule, try to pre-select based on the saved routeDescription
      const savedDesc = editRuleId ? $recurrenceRules.find(r => r.id === editRuleId)?.routeDescription : null;
      let targetIndex = -1;

      if (savedDesc) {
        targetIndex = advancedFareResult.options.findIndex(o => o.routeDescription === savedDesc);
      }

      if (targetIndex === -1) {
        // Fallback: match by cheapest if useAlternativeFares is true, else default
        if ($useAlternativeFares) {
          let cheapestIdx = 0;
          let minCost = Infinity;
          advancedFareResult.options.forEach((opt, idx) => {
            const cost = opt.peak + opt.offPeak;
            if (cost < minCost) {
              minCost = cost;
              cheapestIdx = idx;
            }
          });
          targetIndex = cheapestIdx;
        } else {
          const defIdx = advancedFareResult.options.findIndex(o => o.routeDescription === 'Default Route');
          targetIndex = defIdx !== -1 ? defIdx : 0;
        }
      }

      selectedRouteIndex = targetIndex;
      const selectedOpt = advancedFareResult.options[targetIndex] || advancedFareResult.options[0];
      if (selectedOpt) {
        selectedPeakFare = selectedOpt.peak;
        selectedOffPeakFare = selectedOpt.offPeak;
        selectedRouteDescription = selectedOpt.routeDescription;
      }
    } else if (advancedFareResult) {
      selectedRouteIndex = 0;
      selectedPeakFare = advancedFareResult.peak;
      selectedOffPeakFare = advancedFareResult.offPeak;
      selectedRouteDescription = "";
    } else {
      selectedRouteIndex = 0;
      selectedPeakFare = 0;
      selectedOffPeakFare = 0;
      selectedRouteDescription = "";
    }
  });

  function handleRouteChoiceChange() {
    if (advancedFareResult && advancedFareResult.isFromApi && advancedFareResult.options) {
      const selectedOpt = advancedFareResult.options[selectedRouteIndex];
      if (selectedOpt) {
        selectedPeakFare = selectedOpt.peak;
        selectedOffPeakFare = selectedOpt.offPeak;
        selectedRouteDescription = selectedOpt.routeDescription;
      }
    }
  }

  // Transition Overlay state
  let showTransition = $state(false);
  let transitionText = $state("");
  let lastMode = $globalAdvancedMode;

  $effect(() => {
    const isAdvanced = $globalAdvancedMode;
    if (isAdvanced !== lastMode) {
      showTransition = true;
      transitionText = isAdvanced 
        ? "🚇 Loading TfL Live Station Finder..." 
        : "📊 Restoring Local Zone Estimator...";
      
      const timer = setTimeout(() => {
        showTransition = false;
      }, 400);
      
      lastMode = isAdvanced;
      return () => clearTimeout(timer);
    }
  });

  function handleOriginSearch(query: string) {
    originStationQuery = query;
    selectedOriginStation = null;
    advancedFareResult = null;
    if (query.length >= 1) {
      originStationResults = searchStations(query, 8);
      showOriginDropdown = true;
    } else {
      originStationResults = [];
      showOriginDropdown = false;
    }
  }

  function handleDestSearch(query: string) {
    destStationQuery = query;
    selectedDestStation = null;
    advancedFareResult = null;
    if (query.length >= 1) {
      destStationResults = searchStations(query, 8);
      showDestDropdown = true;
    } else {
      destStationResults = [];
      showDestDropdown = false;
    }
  }

  function selectOriginStation(result: StationSearchResult) {
    selectedOriginStation = { key: result.key, info: result.info };
    originStationQuery = result.info.name;
    showOriginDropdown = false;
    originStationResults = [];
    // Auto-fill zone
    newOriginZone = result.info.zone;
    // Auto-detect mode
    if (
      result.info.modes.includes("elizabeth") ||
      result.info.modes.includes("underground") ||
      result.info.modes.includes("dlr")
    ) {
      newMode = "underground";
    } else if (result.info.modes.includes("overground")) {
      newMode = "underground";
    } else if (result.info.modes.includes("national_rail")) {
      newMode = "national_rail";
    }
    fetchAdvancedFare();
  }

  function selectDestStation(result: StationSearchResult) {
    selectedDestStation = { key: result.key, info: result.info };
    destStationQuery = result.info.name;
    showDestDropdown = false;
    destStationResults = [];
    // Auto-fill zone
    newDestZone = result.info.zone;
    fetchAdvancedFare();
  }

  function swapStations() {
    if (advancedMode) {
      const tempSelected = selectedOriginStation;
      selectedOriginStation = selectedDestStation;
      selectedDestStation = tempSelected;

      const tempQuery = originStationQuery;
      originStationQuery = destStationQuery;
      destStationQuery = tempQuery;

      const tempResults = originStationResults;
      originStationResults = destStationResults;
      destStationResults = tempResults;

      const tempShow = showOriginDropdown;
      showOriginDropdown = showDestDropdown;
      showDestDropdown = tempShow;

      const tempZone = newOriginZone;
      newOriginZone = newDestZone;
      newDestZone = tempZone;

      fetchAdvancedFare();
    } else {
      const tempZone = newOriginZone;
      newOriginZone = newDestZone;
      newDestZone = tempZone;
    }
  }

  async function fetchAdvancedFare() {
    if (
      !selectedOriginStation?.info.naptanId ||
      !selectedDestStation?.info.naptanId
    ) {
      advancedFareResult = null;
      return;
    }
    advancedFareLoading = true;
    const resolvedMode = determineModeFromStations(
      selectedOriginStation,
      selectedDestStation,
    );
    const fallback = {
      peak: lookupFare(
        getZoneRange(newOriginZone, newDestZone),
        true,
        resolvedMode
      ),
      offPeak: lookupFare(
        getZoneRange(newOriginZone, newDestZone),
        false,
        resolvedMode
      ),
    };
    advancedFareLoading = true;
    advancedFareResult = await lookupStationFare(
      selectedOriginStation.info.naptanId,
      selectedDestStation.info.naptanId,
      fallback,
      $useAlternativeFares,
      resolvedMode,
      $selectedFareType,
    );
    advancedFareLoading = false;
  }

  function getEstimatedFare(
    origin: number,
    dest: number,
    timePeriod: string,
    mode: string,
    discount: string,
    referenceDate?: Date,
  ): number {
    const dateObj = referenceDate || parseLocalDate(planStart);
    const repTime = getRepresentativeTime(timePeriod);
    const isPeakFare = isPeakJourney(dateObj, repTime, origin, dest);
    const zoneRange = getZoneRange(origin, dest);
    const rawFare =
      mode === "bus"
        ? BUS_SINGLE_FARE
        : lookupFare(zoneRange, isPeakFare, mode);
    return calculateDiscountedFare(
      rawFare,
      discount as FareType,
      isPeakFare,
      mode === "bus",
      origin,
      dest,
      mode,
    );
  }

  const TIME_PERIODS = [
    { value: "04:30-06:29", label: "04:30 - 06:29" },
    { value: "06:30-09:30", label: "06:30 - 09:30" },
    { value: "09:31-15:59", label: "09:31 - 15:59" },
    { value: "16:00-19:00", label: "16:00 - 19:00" },
    { value: "19:01-04:29", label: "19:01 - 04:29" },
  ];
  let returnTimePeriodOptions = $derived(
    TIME_PERIODS.filter(
      (_, i) => i >= TIME_PERIODS.findIndex((t) => t.value === newTimePeriod),
    ),
  );

  $effect(() => {
    const validValues = returnTimePeriodOptions.map((t) => t.value);
    if (!validValues.includes(newReturnTimePeriod)) {
      newReturnTimePeriod = validValues[0];
    }
  });
  $effect(() => {
    // Automatically regenerate planned journeys and forecast when dates, rules, or selected fare type change
    planStart;
    planEnd;
    $recurrenceRules;
    $selectedFareType;
    regenerate();
  });

  let modalReferenceDate = $derived.by(() => {
    let refDate = parseLocalDate(newRuleDate || planStart);
    if (newIntervalType !== "none" && newDays.length > 0) {
      // Find the first date on or after refDate that is in newDays
      let safetyCounter = 0;
      while (!newDays.includes(refDate.getDay()) && safetyCounter < 7) {
        refDate.setDate(refDate.getDate() + 1);
        safetyCounter++;
      }
    }
    return refDate;
  });

  let estimatedTotalFare = $derived.by(() => {
    const outbound = getEstimatedFare(
      newOriginZone,
      newDestZone,
      newTimePeriod,
      newMode,
      $selectedFareType,
      modalReferenceDate,
    );
    if (newIsReturn) {
      const ret = getEstimatedFare(
        newDestZone,
        newOriginZone,
        newReturnTimePeriod,
        newMode,
        $selectedFareType,
        modalReferenceDate,
      );
      return outbound + ret;
    }
    return outbound;
  });

  let advancedTotalFare = $derived.by(() => {
    if (!selectedOriginStation || !selectedDestStation || !advancedFareResult) return 0;
    const dateObj = modalReferenceDate || parseLocalDate(planStart);
    
    // Outbound
    const outboundRepTime = getRepresentativeTime(newTimePeriod);
    const isOutboundPeak = isPeakJourney(dateObj, outboundRepTime, newOriginZone, newDestZone);
    const outboundFare = isOutboundPeak ? selectedPeakFare : selectedOffPeakFare;
    
    if (!newIsReturn) return outboundFare;
    
    // Return
    const returnRepTime = getRepresentativeTime(newReturnTimePeriod);
    const isReturnPeak = isPeakJourney(dateObj, returnRepTime, newOriginZone, newDestZone);
    const returnFare = isReturnPeak ? selectedPeakFare : selectedOffPeakFare;
    
    return outboundFare + returnFare;
  });

  // Date range for planning
  let planStart = $state(formatInputDate(new Date()));
  let planEnd = $state(formatInputDate(addMonths(new Date(), 1)));
  const maxYear = new Date().getFullYear() + 2;
  const maxDateStr = `${maxYear}-12-31`;
  const minYear = new Date().getFullYear() - 2;
  const minDateStr = `${minYear}-01-01`;

  let calendarMonth = $derived(calendarDate.getMonth());
  let calendarYear = $derived(calendarDate.getFullYear());

  // Generate calendar grid
  let calendarDays = $derived.by(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);

    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month fill
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - i - 1);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({
        date: new Date(calendarYear, calendarMonth, d),
        isCurrentMonth: true,
      });
    }

    // Next month fill
    while (days.length < 42) {
      const d = new Date(lastDay);
      d.setDate(
        d.getDate() + days.length - (startOffset + lastDay.getDate()) + 1,
      );
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  });

  // Map planned journeys to calendar
  let journeysByDate = $derived.by(() => {
    const map = new Map<string, typeof $plannedJourneys>();
    for (const j of $plannedJourneys) {
      const key = formatLocalDate(j.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    }
    return map;
  });

  // Forecast day data by date
  let forecastByDate = $derived.by(() => {
    const map = new Map<
      string,
      NonNullable<typeof $forecastResult>["days"][0]
    >();
    if ($forecastResult) {
      for (const day of $forecastResult.days) {
        const key = formatLocalDate(day.date);
        map.set(key, day);
      }
    }
    return map;
  });

  // Filter detected patterns to show only those not yet imported
  let visiblePatterns = $derived.by(() => {
    return currentDetectedPatterns.filter((pattern) => {
      return !$recurrenceRules.some((rule) => {
        return (
          rule.originZone === pattern.originZone &&
          rule.destinationZone === pattern.destinationZone &&
          rule.mode === pattern.mode &&
          rule.timePeriod === pattern.timePeriod
        );
      });
    });
  });

  // Derived student comparison stats
  let studentComparison = $derived.by(() => {
    if (!$forecastResult) return null;

    const startDate = parseLocalDate(planStart);
    const endDate = parseLocalDate(planEnd);
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return null;
    }
    if (endDate < startDate) {
      return null;
    }
    const durationMs = Math.abs(endDate.getTime() - startDate.getTime());
    const durationDays = Math.max(
      1,
      Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1,
    );
    if (isNaN(durationDays) || durationDays <= 0) {
      return null;
    }

    let wholeMonths = 0;
    let cursor = new Date(startDate);
    while (wholeMonths < 100) {
      const nextMonth = advanceByMonths(startDate, wholeMonths + 1);
      if (daysBetween(startDate, nextMonth) > durationDays) break;
      wholeMonths++;
      cursor = nextMonth;
    }

    const coveredDays = daysBetween(startDate, cursor);
    const extraDays = durationDays - coveredDays;

    const nextMonthBoundary = advanceByMonths(cursor, 1);
    const nextMonthLength = daysBetween(cursor, nextMonthBoundary) || 30;
    const semanticMonthsInPeriod = wholeMonths + extraDays / nextMonthLength;

    const monthsInPeriodText = extraDays === 0
      ? (wholeMonths === 1 ? '1 month' : `${wholeMonths} months`)
      : `${semanticMonthsInPeriod.toFixed(2)} months`;

    // Monthly conversion factor based on 30.31 days per month (avg matching weekly * 4.33)
    const monthsInPeriod = durationDays / 30.31;

    const totalPayg = $forecastResult.totalPaygCapped;

    // Scale monthly PAYG for the table display
    const monthlyPayg = totalPayg / (monthsInPeriod || 1);

    // Calculate max/min zone traveled in planned journeys (minimum fallback of Zone 2)
    let minZoneTraveled = 9;
    let maxZoneTraveled = 2;
    let hasRailOrTube = false;
    for (const j of $plannedJourneys) {
      if (j.mode !== 'bus' && (j.mode as string) !== 'tram') {
        if (j.originZone) {
          minZoneTraveled = Math.min(minZoneTraveled, j.originZone);
          maxZoneTraveled = Math.max(maxZoneTraveled, j.originZone);
          hasRailOrTube = true;
        }
        if (j.destinationZone) {
          minZoneTraveled = Math.min(minZoneTraveled, j.destinationZone);
          maxZoneTraveled = Math.max(maxZoneTraveled, j.destinationZone);
          hasRailOrTube = true;
        }
      }
    }
    const zoneRanges: string[] = [];
    for (let z = 2; z <= maxZoneTraveled; z++) {
      if (z <= 9) {
        zoneRanges.push(`Z1-${z}`);
      }
    }
    // Specific outer zone range if traveler stays outside Zone 1
    if (hasRailOrTube && minZoneTraveled > 1 && maxZoneTraveled >= minZoneTraveled) {
      const rangeKey = minZoneTraveled === maxZoneTraveled ? `Z${minZoneTraveled}` : `Z${minZoneTraveled}-${maxZoneTraveled}`;
      if (!zoneRanges.includes(rangeKey)) {
        zoneRanges.push(rangeKey);
      }
    }
    if (zoneRanges.length === 0) {
      zoneRanges.push("Z1-2");
    }

    const hasBusJourneys = $plannedJourneys.some((j) => j.mode === "bus");

    // Generalize pricing logic based on selected fare type
    const tcFareType = $selectedFareType;
    const isZip = tcFareType === 'zip_11_15' || tcFareType === 'zip_16_17';
    
    // Pass fare type: 'student' if student, Zip if zip, else standard adult 'none'
    const passFareType = (tcFareType === 'student') ? 'student' : (isZip ? tcFareType : 'none');
    const paygFareType = tcFareType;

    // Bus Pass Rates
    let activeBusMonthly = BUS_PASS_MONTHLY;
    let strikeThroughBusMonthly = null;
    let busPassLabel = "Adult Bus & Tram Pass";
    
    if (tcFareType === 'student') {
      activeBusMonthly = STUDENT_BUS_PASS_MONTHLY;
      strikeThroughBusMonthly = BUS_PASS_MONTHLY;
      busPassLabel = "Student Bus & Tram Pass";
    } else if (isZip) {
      activeBusMonthly = BUS_PASS_MONTHLY * 0.5;
      strikeThroughBusMonthly = BUS_PASS_MONTHLY;
      busPassLabel = `${tcFareType === 'zip_11_15' ? '11-15' : '16+'} Zip Bus & Tram Pass`;
    }

    const uncoveredBusPassSpend = simulatePlannedJourneysSpend(
      $plannedJourneys,
      passFareType,
      "bus_pass",
      "Z1-2",
      $selectedFareType
    );

    // Bus passes are purchased in whole months — ceil to whole months
    const wholeMonthsBus = Math.max(1, Math.ceil(durationDays / 30));
    const busPeriodCost = activeBusMonthly * wholeMonthsBus + uncoveredBusPassSpend;

    const railcardForecast = runForecast($plannedJourneys, "railcard", 0, $selectedFareType);
    const railcardPeriodCost = railcardForecast
      ? railcardForecast.totalPaygFareTypeCapped
      : totalPayg;

    const rawOptions: any[] = [];

    // 1. National Railcard PAYG (if not already using a railcard/disabled discount which is similar/better)
    if (tcFareType !== 'railcard' && tcFareType !== 'disabled') {
      rawOptions.push({
        id: "railcard",
        label: "National Railcard PAYG",
        monthlyRate: null,
        periodCost: railcardPeriodCost,
        color: "#6f4390",
        strikeThroughRate: null,
        isPass: false,
      });
    }

    // 2. Bus & Tram Pass (only if hasBusJourneys)
    if (hasBusJourneys) {
      rawOptions.push({
        id: "bus_pass",
        label: busPassLabel,
        monthlyRate: activeBusMonthly,
        strikeThroughRate: strikeThroughBusMonthly,
        periodCost: busPeriodCost,
        color: "#10b981",
        isPass: true,
      });
    }

    // Date formatting helper for unique travel dates
    const dateMap = new Map<string, Date>();
    for (const j of $plannedJourneys) {
      dateMap.set(j.dateStr, j.date);
    }

    function getMonday(date: Date): Date {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    // Collect unique travel dates (normalized to midnight) sorted chronologically
    const uniqueTravelDates: Date[] = [];
    const travelDatesSet = new Set<number>();
    
    for (const j of $plannedJourneys) {
      const d = new Date(j.date.getFullYear(), j.date.getMonth(), j.date.getDate());
      const timeVal = d.getTime();
      if (!travelDatesSet.has(timeVal) && timeVal >= startDate.getTime() && timeVal <= endDate.getTime()) {
        travelDatesSet.add(timeVal);
        uniqueTravelDates.push(d);
      }
    }
    uniqueTravelDates.sort((a, b) => a.getTime() - b.getTime());

    // Helper for base fare calculations
    function getJourneyBaseFare(j: PlannedJourney, activeFareType: FareType) {
      const repTime = getRepresentativeTime(j.timePeriod);
      const isPeakFare = isPeakJourney(j.date, repTime, j.originZone, j.destinationZone);
      const zoneRange = getZoneRange(j.originZone, j.destinationZone);
      
      if (j.isAdvancedMode && j.exactFarePeak !== undefined && j.exactFareOffPeak !== undefined) {
        if ($selectedFareType !== undefined && activeFareType === $selectedFareType) {
          return isPeakFare ? j.exactFarePeak : j.exactFareOffPeak;
        } else {
          const rawFare = isPeakFare ? (j.exactBaseFarePeak ?? j.exactFarePeak) : (j.exactBaseFareOffPeak ?? j.exactFareOffPeak);
          return calculateDiscountedFare(
            rawFare,
            activeFareType,
            isPeakFare,
            j.mode === 'bus',
            j.originZone,
            j.destinationZone,
            j.mode,
            j.originStationName,
            j.destinationStationName
          );
        }
      } else {
        const rawFare = j.mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, j.mode);
        return calculateDiscountedFare(
          rawFare,
          activeFareType,
          isPeakFare,
          j.mode === 'bus',
          j.originZone,
          j.destinationZone,
          j.mode,
          j.originStationName,
          j.destinationStationName
        );
      }
    }

    // Precompute weekly caps for each week under paygFareType and passFareType
    const dayJourneysMap = new Map<string, PlannedJourney[]>();
    for (const j of $plannedJourneys) {
      const key = j.dateStr;
      if (!dayJourneysMap.has(key)) dayJourneysMap.set(key, []);
      dayJourneysMap.get(key)!.push(j);
    }

    const weekMap = new Map<string, string[]>();
    for (const key of dayJourneysMap.keys()) {
      const dDate = dateMap.get(key)!;
      const monday = getMonday(dDate);
      const weekKey = formatLocalDate(monday);
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
      weekMap.get(weekKey)!.push(key);
    }

    const weeksList = Array.from(weekMap.keys());
    const weeklyCapCachePayg = new Map<string, number>();
    const weeklyCapCacheTc = new Map<string, number>();

    for (const weekKey of weeksList) {
      const weekStart = parseLocalDate(weekKey);
      const mondayDate = new Date(weekStart);
      const sundayDate = new Date(mondayDate);
      sundayDate.setDate(sundayDate.getDate() + 6);

      const weekJourneys = $plannedJourneys.filter(j => {
        const jTime = j.date.getTime();
        return jTime >= mondayDate.getTime() && jTime <= sundayDate.getTime() + 86399999;
      });

      // Compute weekly cap for paygFareType
      {
        let maxSpread = 0;
        let maxRange = 'Z1';
        let hasWeeklyRail = false;
        for (const j of weekJourneys) {
          const zr = getZoneRange(j.originZone, j.destinationZone);
          const parts = zr.replace('Z', '').split('-');
          const spread = parts.length > 1 ? parseInt(parts[1]) - parseInt(parts[0]) : 0;
          if (spread > maxSpread) { maxSpread = spread; maxRange = zr; }
          if (j.mode !== 'bus') hasWeeklyRail = true;
        }
        if (maxRange === 'Z1' || maxRange === 'Z2') {
          maxRange = 'Z1-2';
        }
        const activeWeeklyBusCap = getWeeklyBusCap(paygFareType);
        let weeklyCap = hasWeeklyRail ? lookupWeeklyCap(maxRange, paygFareType) : activeWeeklyBusCap;

        let outsideZoneCap: number | null = null;
        for (const j of weekJourneys) {
          if (j.mode === 'bus') continue;
          if (j.originStationName) {
            const oInfo = getStationInfo(j.originStationName);
            if (oInfo && oInfo.naptanId) {
              const cap = getOutsideZoneWeeklyCap(oInfo.naptanId, paygFareType);
              if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
                outsideZoneCap = cap;
              }
            }
          }
          if (j.destinationStationName) {
            const dInfo = getStationInfo(j.destinationStationName);
            if (dInfo && dInfo.naptanId) {
              const cap = getOutsideZoneWeeklyCap(dInfo.naptanId, paygFareType);
              if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
                outsideZoneCap = cap;
              }
            }
          }
        }
        if (outsideZoneCap !== null) weeklyCap = outsideZoneCap;
        weeklyCapCachePayg.set(weekKey, weeklyCap);
      }

      // Compute weekly cap for passFareType
      {
        let maxSpread = 0;
        let maxRange = 'Z1';
        let hasWeeklyRail = false;
        for (const j of weekJourneys) {
          const zr = getZoneRange(j.originZone, j.destinationZone);
          const parts = zr.replace('Z', '').split('-');
          const spread = parts.length > 1 ? parseInt(parts[1]) - parseInt(parts[0]) : 0;
          if (spread > maxSpread) { maxSpread = spread; maxRange = zr; }
          if (j.mode !== 'bus') hasWeeklyRail = true;
        }
        if (maxRange === 'Z1' || maxRange === 'Z2') {
          maxRange = 'Z1-2';
        }
        const activeWeeklyBusCap = getWeeklyBusCap(passFareType);
        let weeklyCap = hasWeeklyRail ? lookupWeeklyCap(maxRange, passFareType) : activeWeeklyBusCap;

        let outsideZoneCap: number | null = null;
        for (const j of weekJourneys) {
          if (j.mode === 'bus') continue;
          if (j.originStationName) {
            const oInfo = getStationInfo(j.originStationName);
            if (oInfo && oInfo.naptanId) {
              const cap = getOutsideZoneWeeklyCap(oInfo.naptanId, passFareType);
              if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
                outsideZoneCap = cap;
              }
            }
          }
          if (j.destinationStationName) {
            const dInfo = getStationInfo(j.destinationStationName);
            if (dInfo && dInfo.naptanId) {
              const cap = getOutsideZoneWeeklyCap(dInfo.naptanId, passFareType);
              if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
                outsideZoneCap = cap;
              }
            }
          }
        }
        if (outsideZoneCap !== null) weeklyCap = outsideZoneCap;
        weeklyCapCacheTc.set(weekKey, weeklyCap);
      }
    }

    // Exact calendar days of the month starting from startDate
    const oneMonthDays = daysBetween(startDate, advanceByMonths(startDate, 1));
    const isUnderOneMonth = durationDays < oneMonthDays;

    // 3. Travelcards
    for (const zone of zoneRanges) {
      const stdWeekly = TRAVELCARD_WEEKLY[zone] || 0;
      const stdMonthly = TRAVELCARD_MONTHLY[zone] || 0;
      const stdAnnual = TRAVELCARD_ANNUAL[zone] || 0;

      let tcWeekly = stdWeekly;
      let tcMonthly = stdMonthly;
      let tcAnnual = stdAnnual;
      let strikeThroughWeekly = null;
      let strikeThroughMonthly = null;
      let strikeThroughAnnual = null;
      let tcLabelPrefix = "Adult";

      if (tcFareType === 'student') {
        tcWeekly = STUDENT_TRAVELCARD_WEEKLY[zone] || 0;
        tcMonthly = STUDENT_TRAVELCARD_MONTHLY[zone] || 0;
        tcAnnual = STUDENT_TRAVELCARD_ANNUAL[zone] || 0;
        strikeThroughWeekly = stdWeekly;
        strikeThroughMonthly = stdMonthly;
        strikeThroughAnnual = stdAnnual;
        tcLabelPrefix = "Student";
      } else if (isZip) {
        tcWeekly = stdWeekly * 0.5;
        tcMonthly = stdMonthly * 0.5;
        tcAnnual = stdAnnual * 0.5;
        strikeThroughWeekly = stdWeekly;
        strikeThroughMonthly = stdMonthly;
        strikeThroughAnnual = stdAnnual;
        tcLabelPrefix = tcFareType === 'zip_11_15' ? "11-15 Zip" : "16+ Zip";
      }

      const uncoveredTcSpend = simulatePlannedJourneysSpend(
        $plannedJourneys,
        passFareType,
        "travelcard",
        zone,
        $selectedFareType
      );

      // Precompute daily cached spends for this zone
      const daysList: { dateStr: string; paygRail: number; paygBus: number; tcRail: number; tcBus: number }[] = [];
      for (const [dateStr, journeys] of dayJourneysMap) {
        let paygRail = 0;
        let paygBus = 0;
        let tcRail = 0;
        let tcBus = 0;

        for (const j of journeys) {
          const paygFare = getJourneyBaseFare(j, paygFareType);
          const tcBaseFare = getJourneyBaseFare(j, passFareType);
          
          const mockJourneyForPass = {
            mode: j.mode,
            originZone: j.originZone,
            destinationZone: j.destinationZone,
            isPeak: isPeakJourney(j.date, getRepresentativeTime(j.timePeriod), j.originZone, j.destinationZone)
          };
          const tcFare = getTravelcardJourneyFare(mockJourneyForPass, zone, tcBaseFare, passFareType);

          if (j.mode === 'bus') {
            paygBus += paygFare;
            tcBus += tcFare;
          } else {
            paygRail += paygFare;
            tcRail += tcFare;
          }
        }

        const paygDailyBusCap = getDailyBusCap(paygFareType);
        const tcDailyBusCap = getDailyBusCap(passFareType);

        daysList.push({
          dateStr,
          paygRail,
          paygBus: Math.min(paygBus, paygDailyBusCap),
          tcRail,
          tcBus: Math.min(tcBus, tcDailyBusCap)
        });
      }
      daysList.sort((a, b) => dateMap.get(a.dateStr)!.getTime() - dateMap.get(b.dateStr)!.getTime());

      // Helper function for sub-millisecond evaluation
      function evaluateHybrid(
        tcStartDate: Date | null,
        tcEndDate: Date | null
      ): number {
        const tcStartTime = tcStartDate ? new Date(tcStartDate.getFullYear(), tcStartDate.getMonth(), tcStartDate.getDate()).getTime() : -1;
        const tcEndTime = tcEndDate ? new Date(tcEndDate.getFullYear(), tcEndDate.getMonth(), tcEndDate.getDate()).getTime() : -1;

        const weekDataMap = new Map<string, { rail: number; bus: number; hasTc: boolean }>();

        for (const d of daysList) {
          const dDate = dateMap.get(d.dateStr)!;
          const dTime = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate()).getTime();
          const isTcActive = tcStartTime !== -1 && dTime >= tcStartTime && dTime <= tcEndTime;

          const monday = getMonday(dDate);
          const weekKey = formatLocalDate(monday);

          if (!weekDataMap.has(weekKey)) {
            weekDataMap.set(weekKey, { rail: 0, bus: 0, hasTc: false });
          }

          const wData = weekDataMap.get(weekKey)!;
          if (isTcActive) {
            wData.rail += d.tcRail;
            wData.bus += d.tcBus;
            wData.hasTc = true;
          } else {
            wData.rail += d.paygRail;
            wData.bus += d.paygBus;
          }
        }

        let totalCappedSpend = 0;

        for (const [weekKey, wData] of weekDataMap) {
          const weekFareType = wData.hasTc ? passFareType : paygFareType;
          const activeWeeklyBusCap = getWeeklyBusCap(weekFareType);
          const cappedWeeklyBusSpend = Math.min(wData.bus, activeWeeklyBusCap);

          const weeklyCap = wData.hasTc 
            ? (weeklyCapCacheTc.get(weekKey) ?? activeWeeklyBusCap)
            : (weeklyCapCachePayg.get(weekKey) ?? activeWeeklyBusCap);

          const totalWeeklySpendBeforeMixedCap = wData.rail + cappedWeeklyBusSpend;
          totalCappedSpend += Math.min(totalWeeklySpendBeforeMixedCap, weeklyCap);
        }

        return totalCappedSpend;
      }

      // Determine standard travelcard costs
      let tcPeriodCost = 0;

      if (isUnderOneMonth) {
        // Pinned Weekly Travelcard
        const weeksNeeded = Math.ceil(durationDays / 7);
        const weeklyTcPeriodCost = weeksNeeded * tcWeekly + uncoveredTcSpend;

        rawOptions.push({
          id: `travelcard_weekly_${zone}`,
          label: `${tcLabelPrefix} Weekly Travelcard (${zone}) — ${weeksNeeded}× Weekly`,
          monthlyRate: tcWeekly,
          strikeThroughRate: strikeThroughWeekly,
          periodCost: weeklyTcPeriodCost,
          color: "#e7710d",
          isPass: true,
          isWeeklyRate: true,
          category: 'travelcard_weekly'
        });

        // Pinned Monthly Travelcard (always shown)
        const monthlyTcPeriodCost = 1 * tcMonthly + uncoveredTcSpend;
        rawOptions.push({
          id: `travelcard_monthly_${zone}`,
          label: `${tcLabelPrefix} Monthly Travelcard (${zone}) — 1 Month`,
          monthlyRate: tcMonthly,
          strikeThroughRate: strikeThroughMonthly,
          periodCost: monthlyTcPeriodCost,
          color: "#e7710d",
          isPass: true,
          category: 'travelcard_monthly'
        });

        tcPeriodCost = weeklyTcPeriodCost; // use weekly as reference for hybrid filtering
      } else {
        // 1 calendar month or more
        const tcEndDate = new Date(cursor);
        tcEndDate.setDate(tcEndDate.getDate() - 1);

        const monthlyTcCost = wholeMonths * tcMonthly;

        const hybridPAYGSpend = evaluateHybrid(startDate, tcEndDate);
        tcPeriodCost = monthlyTcCost + hybridPAYGSpend;

        rawOptions.push({
          id: `travelcard_monthly_${zone}`,
          label: `${tcLabelPrefix} Monthly Travelcard (${zone}) — ${wholeMonths === 1 ? '1 Month' : `${wholeMonths} Months`}`,
          monthlyRate: tcMonthly,
          strikeThroughRate: strikeThroughMonthly,
          periodCost: tcPeriodCost,
          color: "#e7710d",
          isPass: true,
          category: 'travelcard_monthly'
        });

        // Odd-Period Travelcard
        const tcPeriodResult = calculateTravelcardPeriodCost(startDate, endDate, tcWeekly, tcMonthly, tcAnnual);
        const oddPeriodCost = tcPeriodResult.cost + uncoveredTcSpend;

        rawOptions.push({
          id: `travelcard_odd_${zone}`,
          label: `${tcLabelPrefix} Odd-Period Travelcard (${zone}) — ${tcPeriodResult.label}`,
          monthlyRate: tcMonthly,
          strikeThroughRate: strikeThroughMonthly,
          periodCost: oddPeriodCost,
          color: "#b45309",
          isPass: true,
          category: 'travelcard_odd'
        });

        if (durationDays >= 300 && tcAnnual > 0) {
          const annualTcPeriodCost = tcAnnual + uncoveredTcSpend;
          rawOptions.push({
            id: `travelcard_annual_${zone}`,
            label: `${tcLabelPrefix} Annual Travelcard (${zone})`,
            monthlyRate: tcAnnual / 12,
            strikeThroughRate: strikeThroughAnnual ? strikeThroughAnnual / 12 : null,
            periodCost: annualTcPeriodCost,
            color: "#d97706",
            isPass: true,
            isAnnual: true,
            annualTotalRate: tcAnnual,
            stdAnnualTotalRate: stdAnnual,
            category: 'travelcard_annual'
          });

          if (annualTcPeriodCost < tcPeriodCost) {
            tcPeriodCost = annualTcPeriodCost;
          }
        }
      }

      // Hybrid calculations: only if a travelcard was valid
      if (tcPeriodCost > 0) {
        // --- Monthly Hybrid Options ---
        if (wholeMonths >= 1 && extraDays > 0) {
          const tcEndDate = new Date(cursor);
          tcEndDate.setDate(tcEndDate.getDate() - 1);

          const monthlyTcCost = wholeMonths * tcMonthly;

          // PAYG Hybrid
          const monthlyPaygSpend = evaluateHybrid(startDate, tcEndDate);
          const monthlyPaygHybridCost = monthlyTcCost + monthlyPaygSpend;
          if (monthlyPaygHybridCost < tcPeriodCost) {
            const monthsLabel = wholeMonths === 1 ? '1 Month' : `${wholeMonths} Months`;
            rawOptions.push({
              id: `hybrid_monthly_payg_${zone}`,
              label: `${tcLabelPrefix} Travelcard + PAYG (${zone}) — ${monthsLabel} Travelcard + ${extraDays} Days PAYG`,
              monthlyRate: null,
              strikeThroughRate: null,
              periodCost: monthlyPaygHybridCost,
              color: "#8b5cf6",
              isPass: true,
              category: 'hybrid_monthly_payg'
            });
          }

          // Railcard Hybrid
          if (tcFareType !== 'railcard' && tcFareType !== 'disabled') {
            const railcardWeeklyCapCache = new Map<string, number>();
            for (const weekKey of weeksList) {
              const weekStart = parseLocalDate(weekKey);
              const mondayDate = new Date(weekStart);
              const sundayDate = new Date(mondayDate);
              sundayDate.setDate(sundayDate.getDate() + 6);
              const weekJourneys = $plannedJourneys.filter(j => j.date >= mondayDate && j.date <= sundayDate);
              
              let maxSpread = 0;
              let maxRange = 'Z1';
              let hasWeeklyRail = false;
              for (const j of weekJourneys) {
                const zr = getZoneRange(j.originZone, j.destinationZone);
                const parts = zr.replace('Z', '').split('-');
                const spread = parts.length > 1 ? parseInt(parts[1]) - parseInt(parts[0]) : 0;
                if (spread > maxSpread) { maxSpread = spread; maxRange = zr; }
                if (j.mode !== 'bus') hasWeeklyRail = true;
              }
              if (maxRange === 'Z1' || maxRange === 'Z2') {
                maxRange = 'Z1-2';
              }
              const activeWeeklyBusCap = getWeeklyBusCap('railcard');
              let weeklyCap = hasWeeklyRail ? lookupWeeklyCap(maxRange, 'railcard') : activeWeeklyBusCap;

              let outsideZoneCap: number | null = null;
              for (const j of weekJourneys) {
                if (j.mode === 'bus') continue;
                if (j.originStationName) {
                  const oInfo = getStationInfo(j.originStationName);
                  if (oInfo && oInfo.naptanId) {
                    const cap = getOutsideZoneWeeklyCap(oInfo.naptanId, 'railcard');
                    if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
                      outsideZoneCap = cap;
                    }
                  }
                }
                if (j.destinationStationName) {
                  const dInfo = getStationInfo(j.destinationStationName);
                  if (dInfo && dInfo.naptanId) {
                    const cap = getOutsideZoneWeeklyCap(dInfo.naptanId, 'railcard');
                    if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
                      outsideZoneCap = cap;
                    }
                  }
                }
              }
              if (outsideZoneCap !== null) weeklyCap = outsideZoneCap;
              railcardWeeklyCapCache.set(weekKey, weeklyCap);
            }

            function evaluateHybridRailcard(tcStartDate: Date | null, tcEndDate: Date | null): number {
              const tcStartTime = tcStartDate ? new Date(tcStartDate.getFullYear(), tcStartDate.getMonth(), tcStartDate.getDate()).getTime() : -1;
              const tcEndTime = tcEndDate ? new Date(tcEndDate.getFullYear(), tcEndDate.getMonth(), tcEndDate.getDate()).getTime() : -1;

              const weekDataMap = new Map<string, { rail: number; bus: number; hasTc: boolean }>();

              for (const d of daysList) {
                const dDate = dateMap.get(d.dateStr)!;
                const dTime = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate()).getTime();
                const isTcActive = tcStartTime !== -1 && dTime >= tcStartTime && dTime <= tcEndTime;

                const monday = getMonday(dDate);
                const weekKey = formatLocalDate(monday);

                if (!weekDataMap.has(weekKey)) {
                  weekDataMap.set(weekKey, { rail: 0, bus: 0, hasTc: false });
                }

                const wData = weekDataMap.get(weekKey)!;
                if (isTcActive) {
                  wData.rail += d.tcRail;
                  wData.bus += d.tcBus;
                  wData.hasTc = true;
                } else {
                  let paygRail = 0;
                  let paygBus = 0;
                  for (const j of dayJourneysMap.get(d.dateStr) || []) {
                    const fare = getJourneyBaseFare(j, 'railcard');
                    if (j.mode === 'bus') paygBus += fare;
                    else paygRail += fare;
                  }
                  wData.rail += paygRail;
                  wData.bus += Math.min(paygBus, getDailyBusCap('railcard'));
                }
              }

              let totalCappedSpend = 0;

              for (const [weekKey, wData] of weekDataMap) {
                const weekFareType = wData.hasTc ? passFareType : 'railcard';
                const activeWeeklyBusCap = getWeeklyBusCap(weekFareType);
                const cappedWeeklyBusSpend = Math.min(wData.bus, activeWeeklyBusCap);

                const weeklyCap = wData.hasTc 
                  ? (weeklyCapCacheTc.get(weekKey) ?? activeWeeklyBusCap)
                  : (railcardWeeklyCapCache.get(weekKey) ?? activeWeeklyBusCap);

                const totalWeeklySpendBeforeMixedCap = wData.rail + cappedWeeklyBusSpend;
                totalCappedSpend += Math.min(totalWeeklySpendBeforeMixedCap, weeklyCap);
              }

              return totalCappedSpend;
            }

            const monthlyRailcardSpend = evaluateHybridRailcard(startDate, tcEndDate);
            const monthlyRailcardHybridCost = monthlyTcCost + monthlyRailcardSpend;
            if (monthlyRailcardHybridCost < tcPeriodCost) {
              const monthsLabel = wholeMonths === 1 ? '1 Month' : `${wholeMonths} Months`;
              rawOptions.push({
                id: `hybrid_monthly_railcard_${zone}`,
                label: `${tcLabelPrefix} Travelcard + Railcard PAYG (${zone}) — ${monthsLabel} Travelcard + ${extraDays} Days Railcard PAYG`,
                monthlyRate: null,
                strikeThroughRate: null,
                periodCost: monthlyRailcardHybridCost,
                color: "#a78bfa",
                isPass: true,
                category: 'hybrid_monthly_railcard'
              });
            }
          }
        }

        // --- Weekly Hybrid Options ---
        let bestWeeklyPaygCost = Infinity;
        let bestWeeklyPaygW = 0;

        let bestWeeklyRailcardCost = Infinity;
        let bestWeeklyRailcardW = 0;

        const maxWeeks = Math.floor(durationDays / 7);
        for (let w = 1; w <= maxWeeks; w++) {
          if (durationDays > w * 7) {
            const tcEndDate = new Date(startDate);
            tcEndDate.setDate(startDate.getDate() + w * 7 - 1);
            
            const tcCost = w * tcWeekly;

            const standardPAYGSpend = evaluateHybrid(startDate, tcEndDate);
            const paygTotal = tcCost + standardPAYGSpend;
            if (paygTotal < bestWeeklyPaygCost) {
              bestWeeklyPaygCost = paygTotal;
              bestWeeklyPaygW = w;
            }

            if (tcFareType !== 'railcard' && tcFareType !== 'disabled') {
              let railcardSpend = evaluateHybrid(startDate, tcEndDate); // fallback estimation
              const railcardTotal = tcCost + railcardSpend;
              if (railcardTotal < bestWeeklyRailcardCost) {
                bestWeeklyRailcardCost = railcardTotal;
                bestWeeklyRailcardW = w;
              }
            }
          }
        }

        // Push Weekly PAYG Hybrid if viable
        if (bestWeeklyPaygCost < tcPeriodCost) {
          const weeksLabel = bestWeeklyPaygW === 1 ? '1 Week' : `${bestWeeklyPaygW} Weeks`;
          const extraDaysWeekly = durationDays - bestWeeklyPaygW * 7;
          rawOptions.push({
            id: `hybrid_weekly_payg_${zone}`,
            label: `${tcLabelPrefix} Travelcard + PAYG (${zone}) — ${weeksLabel} Travelcard + ${extraDaysWeekly} Days PAYG`,
            monthlyRate: null,
            strikeThroughRate: null,
            periodCost: bestWeeklyPaygCost,
            color: "#8b5cf6",
            isPass: true,
            category: 'hybrid_weekly_payg'
          });
        }

        // Push Weekly Railcard Hybrid if viable
        if (bestWeeklyRailcardCost < tcPeriodCost && tcFareType !== 'railcard' && tcFareType !== 'disabled') {
          const weeksLabel = bestWeeklyRailcardW === 1 ? '1 Week' : `${bestWeeklyRailcardW} Weeks`;
          const extraDaysWeekly = durationDays - bestWeeklyRailcardW * 7;
          rawOptions.push({
            id: `hybrid_weekly_railcard_${zone}`,
            label: `${tcLabelPrefix} Travelcard + Railcard PAYG (${zone}) — ${weeksLabel} Travelcard + ${extraDaysWeekly} Days Railcard PAYG`,
            monthlyRate: null,
            strikeThroughRate: null,
            periodCost: bestWeeklyRailcardCost,
            color: "#a78bfa",
            isPass: true,
            category: 'hybrid_weekly_railcard'
          });
        }

        // --- Mid-Planning Period Travelcard Options (Optimized) ---
        let bestMidWeeklyCost = Infinity;
        let bestMidWeeklyStart: Date | null = null;
        let bestMidWeeklyWeeks = 1;
        let bestMidWeeklyEnd: Date | null = null;

        for (let w = 1; w <= maxWeeks; w++) {
          for (const tcStart of uniqueTravelDates) {
            const startDayIndex = daysBetween(startDate, tcStart);
            if (startDayIndex <= 0) continue; // must start after planning period begins
            if (startDayIndex > durationDays - w * 7) continue; // must fit

            const tcEnd = new Date(tcStart);
            tcEnd.setDate(tcStart.getDate() + w * 7 - 1);

            const tcCost = w * tcWeekly;
            const hybridSpend = evaluateHybrid(tcStart, tcEnd);
            
            const totalCost = tcCost + hybridSpend;
            if (totalCost < bestMidWeeklyCost) {
              bestMidWeeklyCost = totalCost;
              bestMidWeeklyStart = tcStart;
              bestMidWeeklyEnd = tcEnd;
              bestMidWeeklyWeeks = w;
            }
          }
        }

        // If the best weekly mid-period start is found and is cheaper than total PAYG, push it as a special option
        if (bestMidWeeklyStart && bestMidWeeklyCost < totalPayg) {
          const formattedStart = bestMidWeeklyStart.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short"
          });
          const weeksLabel = bestMidWeeklyWeeks === 1 ? '1 Week' : `${bestMidWeeklyWeeks} Weeks`;
          rawOptions.push({
            id: `mid_period_weekly_${zone}`,
            label: `🔑 Mid-Period Travelcard (${zone}) — Start on ${formattedStart} (${weeksLabel})`,
            monthlyRate: null,
            strikeThroughRate: null,
            periodCost: bestMidWeeklyCost,
            color: "#e11d48", // Rose accent color
            isPass: true,
            category: 'mid_period_weekly',
            startDateStr: formattedStart
          });
        }

        // Monthly Mid-Period Search
        let bestMidMonthlyCost = Infinity;
        let bestMidMonthlyStart: Date | null = null;
        let bestMidMonthlyMonths = 1;
        let bestMidMonthlyEnd: Date | null = null;

        const maxMonthsSearch = Math.max(1, wholeMonths);
        for (let m = 1; m <= maxMonthsSearch; m++) {
          for (const tcStart of uniqueTravelDates) {
            const startDayIndex = daysBetween(startDate, tcStart);
            if (startDayIndex <= 0) continue;
            
            const tcEnd = advanceByMonths(tcStart, m);
            tcEnd.setDate(tcEnd.getDate() - 1);

            if (tcStart > endDate) continue;

            const tcCost = m * tcMonthly;
            const hybridSpend = evaluateHybrid(tcStart, tcEnd);

            const totalCost = tcCost + hybridSpend;
            if (totalCost < bestMidMonthlyCost) {
              bestMidMonthlyCost = totalCost;
              bestMidMonthlyStart = tcStart;
              bestMidMonthlyEnd = tcEnd;
              bestMidMonthlyMonths = m;
            }
          }
        }

        // If the best monthly mid-period start is found and is cheaper than total PAYG, push it as a special option
        if (bestMidMonthlyStart && bestMidMonthlyCost < totalPayg) {
          const formattedStart = bestMidMonthlyStart.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short"
          });
          const monthsLabel = bestMidMonthlyMonths === 1 ? '1 Month' : `${bestMidMonthlyMonths} Months`;
          rawOptions.push({
            id: `mid_period_monthly_${zone}`,
            label: `🔑 Mid-Period Travelcard (${zone}) — Start on ${formattedStart} (${monthsLabel})`,
            monthlyRate: null,
            strikeThroughRate: null,
            periodCost: bestMidMonthlyCost,
            color: "#db2777", // Pink accent color
            isPass: true,
            category: 'mid_period_monthly',
            startDateStr: formattedStart
          });
        }
      }
    }

    // Deduplicate options by category (keeping only the cheapest zone range for each category)
    const cheapestByCategory = new Map<string, any>();
    for (const opt of rawOptions) {
      const cat = opt.category || opt.id;
      const existing = cheapestByCategory.get(cat);
      if (!existing || opt.periodCost < existing.periodCost) {
        cheapestByCategory.set(cat, opt);
      }
    }
    const options = Array.from(cheapestByCategory.values());

    // Sort options by periodCost ascending (cheapest first)
    options.sort((a, b) => a.periodCost - b.periodCost);

    // Identify cheapest option
    let cheapestCost = totalPayg;
    let cheapestId = "payg";
    for (const opt of options) {
      if (opt.periodCost < cheapestCost) {
        cheapestCost = opt.periodCost;
        cheapestId = opt.id;
      }
    }

    // Dynamic PAYG Label
    let paygLabel = "PAYG (Standard)";
    if (tcFareType === "student") {
      paygLabel = "PAYG (18+ Student / Standard)";
    } else if (tcFareType !== "none") {
      paygLabel = `PAYG (${fareTypeShortName})`;
    }

    const paygOption = {
      id: "payg",
      label: paygLabel,
      monthlyRate: null as number | null,
      periodCost: totalPayg,
      color: "#009FE3",
      strikeThroughRate: null,
      isPass: false,
      isCheapest: cheapestId === "payg",
    };

    // Mark isCheapest and calculate savings
    for (const opt of options) {
      opt.isCheapest = opt.id === cheapestId;
      opt.saving = totalPayg - opt.periodCost;
    }

    return {
      durationDays,
      monthsInPeriod,
      monthsInPeriodText,
      totalPayg,
      monthlyPayg,
      paygOption,
      options,
    };
  });

  function prevMonth() {
    calendarDate = new Date(calendarYear, calendarMonth - 1, 1);
  }

  function nextMonth() {
    calendarDate = new Date(calendarYear, calendarMonth + 1, 1);
  }

  function toggleDay(day: number) {
    if (newDays.includes(day)) {
      newDays = newDays.filter((d) => d !== day);
    } else {
      newDays = [...newDays, day].sort();
    }
  }

  function determineModeFromStations(
    origin: typeof selectedOriginStation,
    dest: typeof selectedDestStation,
  ): "underground" | "national_rail" | "nr_tube" {
    if (!origin || !dest) return "underground";
    const originModes = origin.info.modes || [];
    const destModes = dest.info.modes || [];

    const originHasTfl =
      originModes.includes("underground") ||
      originModes.includes("dlr") ||
      originModes.includes("elizabeth") ||
      originModes.includes("overground");
    const destHasTfl =
      destModes.includes("underground") ||
      destModes.includes("dlr") ||
      destModes.includes("elizabeth") ||
      destModes.includes("overground");

    // TfL boundary rule: both stations on TfL network → standard Tube fares
    if (originHasTfl && destHasTfl) {
      return "underground";
    }

    const originHasNr = originModes.includes("national_rail");
    const destHasNr = destModes.includes("national_rail");

    // One TfL + one NR → mixed fare
    if ((originHasTfl && destHasNr) || (destHasTfl && originHasNr)) {
      return "nr_tube";
    }

    // Both NR-only
    if (originHasNr && destHasNr) {
      return "national_rail";
    }

    // Single NR station with no TfL counterpart
    if (originHasNr || destHasNr) {
      return "national_rail";
    }

    return "underground";
  }

  function saveRule() {
    clampModalDates();
    if (
      advancedMode &&
      newMode !== "bus" &&
      (!selectedOriginStation ||
        !selectedDestStation ||
        selectedOriginStation.info.naptanId === selectedDestStation.info.naptanId)
    ) {
      return;
    }

    if (newIntervalType === "none") {
      newDays = [parseLocalDate(newRuleDate).getDay()];
    }

    const ruleStartStr = newRuleDate;
    const ruleEndStr =
      newIntervalType === "none" ? newRuleDate : newRuleEndDate;
    if (ruleStartStr < planStart) {
      planStart = ruleStartStr;
    }
    if (ruleEndStr > planEnd) {
      planEnd = ruleEndStr;
    }

    const isOneOff = newIntervalType === "none";
    const journeyDate = parseLocalDate(newRuleDate);
    const isWeekend =
      isOneOff && (journeyDate.getDay() === 0 || journeyDate.getDay() === 6);

    let defaultName = "";
    let modeLabel = "";
    if (newMode === "underground") modeLabel = "Tube";
    else if (newMode === "national_rail") modeLabel = "Rail";
    else if (newMode === "nr_tube") modeLabel = "Rail/Tube";
    else modeLabel = "Bus/Tram";

    let timeLabel = "";
    if (isWeekend) {
      timeLabel = newIsReturn ? "Weekend Off-Peak Return" : "Weekend Off-Peak";
    } else {
      if (newTimePeriod === "06:30-09:30") {
        timeLabel = "Morning Peak";
      } else if (newTimePeriod === "16:00-19:00") {
        timeLabel = "Evening Peak";
      } else if (newTimePeriod === "04:30-06:29") {
        timeLabel = "Early Off-Peak";
      } else if (newTimePeriod === "09:31-15:59") {
        timeLabel = "Day Off-Peak";
      } else {
        timeLabel = "Night Off-Peak";
      }

      if (newIsReturn) {
        if (
          newTimePeriod === "06:30-09:30" &&
          newReturnTimePeriod === "16:00-19:00"
        ) {
          timeLabel = "Peak Return";
        } else {
          timeLabel = `${timeLabel} Return`;
        }
      }
    }

    const journeyType = isOneOff ? "Journey" : "Commute";

    if (
      advancedMode &&
      selectedOriginStation &&
      selectedDestStation &&
      newMode !== "bus"
    ) {
      const originName = selectedOriginStation.info.name;
      const destName = selectedDestStation.info.name;
      const stationStr = newIsReturn
        ? `${originName} ↔ ${destName}`
        : `${originName} → ${destName}`;
      defaultName = `${timeLabel} Commute (${stationStr})`;
    } else if (newMode === "bus") {
      defaultName = `${timeLabel} ${modeLabel} ${journeyType}`;
    } else {
      const zoneStr = newIsReturn
        ? `Z${newOriginZone}↔Z${newDestZone}`
        : `Z${newOriginZone}→Z${newDestZone}`;
      defaultName = `${timeLabel} ${modeLabel} ${journeyType} (${zoneStr})`;
    }

    const finalMode =
      advancedMode && newMode !== "bus"
        ? determineModeFromStations(selectedOriginStation, selectedDestStation)
        : newMode;

    const rule: RecurrenceRule = {
      id: editRuleId || crypto.randomUUID(),
      name: newRuleName || defaultName,
      originZone: newOriginZone,
      destinationZone: newDestZone,
      mode: finalMode,
      timePeriod: newTimePeriod,
      isReturn: newIsReturn,
      returnTimePeriod: newReturnTimePeriod,
      daysOfWeek: newDays,
      intervalType: newIntervalType,
      intervalValue: newIntervalValue,
      startDate: parseLocalDate(newRuleDate),
      endDate:
        newIntervalType === "none"
          ? parseLocalDate(newRuleDate)
          : parseLocalDate(newRuleEndDate),
      // Advanced Mode fields
      ...(advancedMode && {
        isAdvancedMode: true,
        ...(newMode !== "bus" &&
          selectedOriginStation &&
          selectedDestStation && {
            originStation: selectedOriginStation.info.naptanId,
            destinationStation: selectedDestStation.info.naptanId,
            originStationName: selectedOriginStation.info.name,
            destinationStationName: selectedDestStation.info.name,
            ...(advancedFareResult &&
              advancedFareResult.isFromApi && {
                exactFarePeak: selectedPeakFare,
                exactFareOffPeak: selectedOffPeakFare,
                exactBaseFarePeak: selectedBasePeakFare,
                exactBaseFareOffPeak: selectedBaseOffPeakFare,
                routeDescription: selectedRouteDescription,
              }),
          }),
      }),
    };

    if (editRuleId) {
      $recurrenceRules = $recurrenceRules.map((r) =>
        r.id === editRuleId ? rule : r,
      );
    } else {
      $recurrenceRules = [...$recurrenceRules, rule];
    }

    regenerate();
    showRecurrenceModal = false;
    resetForm();

    // Background sync rules with API
    syncRuleFaresWithApi();
  }

  function editRule(rule: RecurrenceRule) {
    editRuleId = rule.id;
    newRuleName = rule.name;
    newOriginZone = rule.originZone;
    newDestZone = rule.destinationZone;
    newMode = rule.mode;
    newTimePeriod = rule.timePeriod || "06:30-09:30";
    newIsReturn = rule.isReturn || false;
    newReturnTimePeriod = rule.returnTimePeriod || "16:00-19:00";
    newDays = [...rule.daysOfWeek];
    newIntervalType = rule.intervalType;
    newIntervalValue = rule.intervalValue;
    newRuleDate = formatInputDate(rule.startDate);
    newRuleEndDate = formatInputDate(rule.endDate);
    syncWithPlanEnd = (newRuleEndDate === planEnd);
    syncWithPlanStart = (newRuleDate === planStart);
    // Restore Advanced Mode state
    advancedMode = rule.isAdvancedMode || false;
    if (
      rule.isAdvancedMode &&
      rule.originStationName &&
      rule.destinationStationName
    ) {
      originStationQuery = rule.originStationName;
      destStationQuery = rule.destinationStationName;
      // Reconstruct station info for display
      const oResults = searchStations(rule.originStationName, 1);
      const dResults = searchStations(rule.destinationStationName, 1);
      selectedOriginStation =
        oResults.length > 0
          ? { key: oResults[0].key, info: oResults[0].info }
          : null;
      selectedDestStation =
        dResults.length > 0
          ? { key: dResults[0].key, info: dResults[0].info }
          : null;
      if (
        rule.exactFarePeak !== undefined &&
        rule.exactFareOffPeak !== undefined
      ) {
        advancedFareResult = {
          peak: rule.exactFarePeak,
          offPeak: rule.exactFareOffPeak,
          basePeak: rule.exactBaseFarePeak ?? rule.exactFarePeak,
          baseOffPeak: rule.exactBaseFareOffPeak ?? rule.exactFareOffPeak,
          isFromApi: true,
          routeDescription: rule.routeDescription,
        } as ApiFareResult;
      }
    }
    showRecurrenceModal = true;
  }

  function quickAddOnDate(d: Date) {
    resetForm();
    newIntervalType = "none";
    newRuleDate = formatInputDate(d);
    newRuleEndDate = formatInputDate(d);
    showRecurrenceModal = true;
  }

  function removeRule(id: string) {
    $recurrenceRules = $recurrenceRules.filter((r) => r.id !== id);
    regenerate();
  }

  function clearJourneysForDate(dateKey: string) {
    const dayJourneys = journeysByDate.get(dateKey) || [];
    if (dayJourneys.length === 0) return;

    const ruleIdsToAffect = new Set(
      dayJourneys.map((j) => j.ruleId.replace("-return", "")),
    );

    $recurrenceRules = $recurrenceRules
      .map((rule) => {
        if (ruleIdsToAffect.has(rule.id)) {
          if (rule.intervalType === "none") {
            return null;
          } else {
            const currentExcludes = rule.excludeDates || [];
            if (!currentExcludes.includes(dateKey)) {
              return {
                ...rule,
                excludeDates: [...currentExcludes, dateKey],
              };
            }
          }
        }
        return rule;
      })
      .filter((rule): rule is RecurrenceRule => rule !== null);

    regenerate();
  }

  function importPattern(patternIndex: number) {
    const pattern = visiblePatterns[patternIndex];
    let rule = patternToRule(
      pattern,
      parseLocalDate(planStart),
      parseLocalDate(planEnd),
    );

    // If in advanced mode, set advanced mode properties
    if ($globalAdvancedMode) {
      rule = {
        ...rule,
        isAdvancedMode: true,
      };
      if (pattern.mode !== "bus") {
        const originInfo = getStationInfo(pattern.origin);
        const destInfo = getStationInfo(pattern.destination);
        if (originInfo?.naptanId && destInfo?.naptanId) {
          rule.originStation = originInfo.naptanId;
          rule.destinationStation = destInfo.naptanId;
          rule.originStationName = originInfo.name;
          rule.destinationStationName = destInfo.name;
          // Fares will be fetched in the background by syncRuleFaresWithApi
        }
      }
    }

    $recurrenceRules = [...$recurrenceRules, rule];
    regenerate();
  }

  function regenerate() {
    const activeRules = $recurrenceRules.filter(r => !isRuleDisabledForFareType(r, $selectedFareType));
    const journeys = generatePlannedJourneys(activeRules);
    $plannedJourneys = journeys;
    if (journeys.length > 0) {
      $forecastResult = runForecast(journeys, $selectedFareType, $fareTypeCost, $selectedFareType);
    } else {
      $forecastResult = null;
    }
  }

  function clampDates() {
    if (planStart && planStart < minDateStr) {
      planStart = minDateStr;
    }
    if (planStart && planStart > maxDateStr) {
      planStart = maxDateStr;
    }
    if (planEnd && planEnd < minDateStr) {
      planEnd = minDateStr;
    }
    if (planEnd && planEnd > maxDateStr) {
      planEnd = maxDateStr;
    }
    if (planStart && planEnd && planEnd < planStart) {
      planEnd = planStart;
    }
    regenerate();
  }

  function handleBlur(e: FocusEvent) {
    const target = e.target as HTMLInputElement;
    if (!target.value) {
      if (target.id === "plan-start") {
        target.value = planStart;
      } else if (target.id === "plan-end") {
        target.value = planEnd;
      }
    }
    clampDates();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  }

  function clampModalDates() {
    if (newRuleDate && newRuleDate < minDateStr) {
      newRuleDate = minDateStr;
    }
    if (newRuleDate && newRuleDate > maxDateStr) {
      newRuleDate = maxDateStr;
    }
    if (newRuleEndDate && newRuleEndDate < minDateStr) {
      newRuleEndDate = minDateStr;
    }
    if (newRuleEndDate && newRuleEndDate > maxDateStr) {
      newRuleEndDate = maxDateStr;
    }
    if (newRuleDate && newRuleEndDate && newRuleEndDate < newRuleDate) {
      newRuleEndDate = newRuleDate;
    }
  }

  function handleModalBlur(e: FocusEvent) {
    const target = e.target as HTMLInputElement;
    if (!target.value) {
      if (target.id === "modal-start-date" || target.id === "modal-journey-date") {
        newRuleDate = planStart;
        target.value = planStart;
      } else if (target.id === "modal-end-date") {
        newRuleEndDate = planEnd;
        target.value = planEnd;
      }
    }
    clampModalDates();
  }

  function handleStartChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    if (val) {
      planStart = val;
      clampDates();
    }
  }

  function handleEndChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    if (val) {
      planEnd = val;
      clampDates();
    }
  }

  function resetForm() {
    editRuleId = null;
    newRuleName = "";
    newOriginZone = defOriginZone;
    newDestZone = defDestZone;
    newMode = defMode;
    newTimePeriod = defTimePeriod;
    newIsReturn = false;
    newReturnTimePeriod = "16:00-19:00";
    newDays = [1, 2, 3, 4, 5];
    newIntervalType = "weeks";
    newIntervalValue = 1;
    newRuleDate = planStart;
    newRuleEndDate = planEnd;
    syncWithPlanEnd = true;
    syncWithPlanStart = true;
    // Reset Advanced Mode
    advancedMode = $globalAdvancedMode;
    originStationResults = [];
    destStationResults = [];
    showOriginDropdown = false;
    showDestDropdown = false;
    advancedFareResult = null;
    advancedFareLoading = false;

    if (advancedMode && useDefaultHomeStation && defaultHomeStation) {
      selectedOriginStation = { ...defaultHomeStation };
      originStationQuery = defaultHomeStation.info.name;
    } else {
      selectedOriginStation = null;
      originStationQuery = "";
    }
    destStationQuery = "";
    selectedDestStation = null;
  }

  function clearOriginStation() {
    selectedOriginStation = null;
    originStationQuery = "";
    originStationResults = [];
    showOriginDropdown = false;
    advancedFareResult = null;
  }

  function clearDestStation() {
    selectedDestStation = null;
    destStationQuery = "";
    destStationResults = [];
    showDestDropdown = false;
    advancedFareResult = null;
  }

  function getCapColor(progress: number): string {
    if (progress >= 1) return "#10b981";
    if (progress >= 0.7) return "#f59e0b";
    return "#009FE3";
  }

  let fareTypeShortName = $derived.by(() => {
    const rc = FARE_TYPES[$selectedFareType];
    if ($selectedFareType === "none") return "";
    if ($selectedFareType === "railcard") return "National Railcard";
    if ($selectedFareType === "disabled") return "Disabled Persons";
    if ($selectedFareType === "jobcentre") return "Jobcentre Plus";
    if ($selectedFareType === "zip_11_15") return "11-15 Zip";
    if ($selectedFareType === "zip_16_17") return "16+ Zip";
    if ($selectedFareType === "student") return "18+ Student";
    return rc.name;
  });

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayValues = [1, 2, 3, 4, 5, 6, 0]; // JS day values for Mon-Sun

  function formatInputDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addMonths(d: Date, months: number): Date {
    const result = new Date(d);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  function setPlanningPeriod(preset: '1w' | '1m' | '3m' | '6m' | '1y') {
    const start = parseLocalDate(planStart) || new Date();
    let end = new Date(start);
    if (preset === '1w') {
      end.setDate(start.getDate() + 6);
    } else if (preset === '1m') {
      end = addMonths(start, 1);
      end.setDate(end.getDate() - 1);
    } else if (preset === '3m') {
      end = addMonths(start, 3);
      end.setDate(end.getDate() - 1);
    } else if (preset === '6m') {
      end = addMonths(start, 6);
      end.setDate(end.getDate() - 1);
    } else if (preset === '1y') {
      end = addMonths(start, 12);
      end.setDate(end.getDate() - 1);
    }
    planEnd = formatInputDate(end);
    clampDates();
  }
</script>

{#if showTransition}
  <div class="mode-transition-overlay">
    <div class="transition-card glass-card">
      <div class="transition-roundel">
        <div class="roundel-ring"></div>
        <div class="roundel-bar"></div>
      </div>
      <div class="transition-title">{transitionText}</div>
      <div class="transition-subtitle">
        Adapting your travel planner settings...
      </div>
    </div>
  </div>
{/if}

<div class="planner-page">
  <div class="planner-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
    <h1 class="page-title" style="margin-bottom: 0;">Journey Planner</h1>
    
    {#if $cards.length > 1}
      <div class="planner-card-selector" style="display: flex; align-items: center; gap: 0.5rem;">
        <label for="planner-card-select" style="font-size: 0.85rem; font-weight: 500; color: var(--color-text-secondary);">Select Card:</label>
        <select
          id="planner-card-select"
          class="input-field"
          style="padding: 0.4rem 0.75rem; font-size: 0.85rem; border-radius: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--color-border); color: var(--color-text-primary); cursor: pointer;"
          bind:value={plannerCardId}
        >
          {#each $cards as card}
            <option value={card.id}>{card.name}</option>
          {/each}
        </select>
      </div>
    {/if}
  </div>

  <!-- Mobile Tab Switcher -->
  <div class="mobile-tabs-container hidden max-xl:flex">
    <button
      type="button"
      class="mobile-tab"
      class:active={activeMobileTab === "calendar"}
      onclick={() => (activeMobileTab = "calendar")}
    >
      📅 Calendar
    </button>
    <button
      type="button"
      class="mobile-tab"
      class:active={activeMobileTab === "schedules"}
      onclick={() => (activeMobileTab = "schedules")}
    >
      🚇 Journeys
    </button>
    <button
      type="button"
      class="mobile-tab"
      class:active={activeMobileTab === "settings"}
      onclick={() => (activeMobileTab = "settings")}
    >
      ⚙️ Settings
    </button>
  </div>

  <div class="planner-layout active-tab-{activeMobileTab} grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-6 items-start">
    <!-- Sidebar: Rules & patterns -->
    <div class="planner-sidebar" class:max-xl:hidden={activeMobileTab !== "schedules"} class:max-xl:block={activeMobileTab === "schedules"}>
      <!-- Date range -->
      <div class="glass-card sidebar-section">
        <h3 class="sidebar-title">📅 Planning Period</h3>
        <div class="date-inputs">
          <label class="setting-label" for="plan-start">Start</label>
          <input
            type="date"
            class="input-field"
            id="plan-start"
            value={planStart}
            onchange={handleStartChange}
            onblur={handleBlur}
            onkeydown={handleKeyDown}
            min={minDateStr}
            max={maxDateStr}
          />
          <label
            class="setting-label"
            for="plan-end"
            style="margin-top: 0.5rem;">End</label
          >
          <input
            type="date"
            class="input-field"
            id="plan-end"
            value={planEnd}
            onchange={handleEndChange}
            onblur={handleBlur}
            onkeydown={handleKeyDown}
            min={minDateStr}
            max={maxDateStr}
          />
          <div class="preset-buttons">
            <button type="button" class="btn-preset" onclick={() => setPlanningPeriod('1w')}>+1W</button>
            <button type="button" class="btn-preset" onclick={() => setPlanningPeriod('1m')}>+1M</button>
            <button type="button" class="btn-preset" onclick={() => setPlanningPeriod('3m')}>+3M</button>
            <button type="button" class="btn-preset" onclick={() => setPlanningPeriod('6m')}>+6M</button>
            <button type="button" class="btn-preset" onclick={() => setPlanningPeriod('1y')}>+1Y</button>
          </div>
        </div>
      </div>

      <div class="glass-card sidebar-section">
        <div
          style="display: flex; justify-content: space-between; align-items: center;"
        >
          <button
            type="button"
            style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer; background: none; border: none; padding: 0; text-align: left; font-family: inherit; color: inherit;"
            onclick={() => (showActiveRoutines = !showActiveRoutines)}
          >
            <h3 class="sidebar-title" style="margin: 0;">🔄 Travel Routines</h3>
            <span style="font-size: 0.8rem; color: var(--color-text-muted);"
              >{showActiveRoutines ? "▼" : "▶"}</span
            >
          </button>
          <button
            type="button"
            class="btn-primary"
            style="padding: 0.25rem 0.5rem; font-size: 0.7rem; border-radius: 6px;"
            onclick={() => {
              resetForm();
              showRecurrenceModal = true;
            }}
          >
            + Add
          </button>
        </div>
        {#if showActiveRoutines}
          <div style="margin-top: 1rem; max-height: 400px; overflow-y: auto;">
            {#if $recurrenceRules.filter((r) => r.intervalType !== "none").length === 0}
              <p class="empty-text">No travel routines configured yet.</p>
            {:else}
              {#each $recurrenceRules.filter((r) => r.intervalType !== "none") as rule}
                {@const isDisabled = isRuleDisabledForFareType(rule, $selectedFareType)}
                <div class="rule-card" class:disabled={isDisabled}>
                  <div class="rule-info">
                    <div class="rule-name" style="{isDisabled ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                      {rule.name}
                    </div>
                    <div class="rule-detail">
                      {#if rule.isAdvancedMode && rule.originStationName && rule.destinationStationName}
                        {rule.originStationName}
                        {rule.isReturn ? " ↔ " : " → "}
                        {rule.destinationStationName} •
                        {#if rule.routeDescription && rule.routeDescription !== 'Default Route'}
                          <div class="route-path-desc" style="color: var(--color-text-secondary); font-size: 0.75rem; font-style: italic; margin-top: 0.15rem; margin-bottom: 0.1rem; word-break: break-word;">
                            ↳ {rule.routeDescription}
                          </div>
                        {/if}
                      {:else if rule.mode === "bus"}
                        Bus •
                      {:else}
                        Z{rule.originZone}{rule.isReturn
                          ? "↔"
                          : "→"}Z{rule.destinationZone} •
                      {/if}
                      {rule.timePeriod}{rule.isReturn
                        ? ` (+${rule.returnTimePeriod})`
                        : ""} •
                      {rule.daysOfWeek
                        .map(
                          (d) => ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d],
                        )
                        .join(",")}
                    </div>
                    <div style="display: flex; gap: 0.35rem; align-items: center; margin-top: 0.3rem; flex-wrap: wrap;">
                      {#if isDisabled}
                        <span 
                          class="disabled-status-badge"
                          style="cursor: help;"
                          role="status"
                          onmouseenter={(e) => showWarningTooltip(
                            e.currentTarget,
                            "This route includes contactless-only stations that do not support concession or discount fares.",
                            "Concession Disabled",
                            "concession-disabled"
                          )}
                          onmouseleave={hideWarningTooltip}
                        >
                          🚫 Concession Disabled
                        </span>
                      {:else}
                        {@const isEstimate = !rule.isAdvancedMode || rule.exactFarePeak === undefined || rule.exactFareOffPeak === undefined}
                        {@const retryInfo = getRuleRetryInfo(rule)}
                        {#if retryInfo}
                          <span class="rule-syncing-indicator" title="Currently fetching live fare from TfL API...">
                            {#if retryInfo.status === 'timeout'}
                              ⏱️ Timeout, retrying...
                            {:else if retryInfo.status === 'retrying'}
                              🔄 Retrying ({retryInfo.attempt}/{retryInfo.maxRetries})...
                            {:else}
                              🔄 Fetching fare...
                            {/if}
                          </span>
                        {:else if isEstimate && rule.mode !== 'bus'}
                          <span 
                            class="fare-source-badge estimate" 
                            style="cursor: help;"
                            role="status"
                            onmouseenter={(e) => {
                              const fares = getRuleFares(rule);
                              showFareTooltip(e.currentTarget, false, fares.peakBase, fares.peakDiscounted, fares.offPeakBase, fares.offPeakDiscounted);
                            }}
                            onmouseleave={hideFareTooltip}
                          >
                            ⚙️ Zone Estimate
                          </span>
                        {:else if rule.mode !== 'bus'}
                          <span 
                            class="fare-source-badge live" 
                            style="cursor: help;"
                            role="status"
                            onmouseenter={(e) => {
                              const fares = getRuleFares(rule);
                              showFareTooltip(e.currentTarget, true, fares.peakBase, fares.peakDiscounted, fares.offPeakBase, fares.offPeakDiscounted);
                            }}
                            onmouseleave={hideFareTooltip}
                          >
                            ✓ Live Fare
                          </span>
                        {/if}
                      {/if}
                    </div>
                  </div>
                  <div class="rule-actions">
                    <button
                      class="rule-edit"
                      onclick={() => editRule(rule)}
                      title="Edit Routine"
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button
                      class="rule-remove"
                      onclick={() => removeRule(rule.id)}
                      title="Delete Routine"
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <!-- One-off rules -->
      <div class="glass-card sidebar-section">
        <div
          style="display: flex; justify-content: space-between; align-items: center;"
        >
          <button
            type="button"
            style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer; background: none; border: none; padding: 0; text-align: left; font-family: inherit; color: inherit;"
            onclick={() => (showOneOffJourneys = !showOneOffJourneys)}
          >
            <h3 class="sidebar-title" style="margin: 0;">
              📌 One-off Journeys
            </h3>
            <span style="font-size: 0.8rem; color: var(--color-text-muted);"
              >{showOneOffJourneys ? "▼" : "▶"}</span
            >
          </button>
          <button
            type="button"
            class="btn-primary"
            style="padding: 0.25rem 0.5rem; font-size: 0.7rem; border-radius: 6px;"
            onclick={() => {
              resetForm();
              newIntervalType = "none";
              showRecurrenceModal = true;
            }}
          >
            + Add
          </button>
        </div>
        {#if showOneOffJourneys}
          <div style="margin-top: 1rem; max-height: 400px; overflow-y: auto;">
            {#each $recurrenceRules.filter((r) => r.intervalType === "none") as rule}
              {@const isDisabled = isRuleDisabledForFareType(rule, $selectedFareType)}
              <div class="rule-card" class:disabled={isDisabled}>
                <div class="rule-info">
                  <div class="rule-name" style="{isDisabled ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                    {rule.name}
                  </div>
                  <div class="rule-detail">
                    {rule.startDate.toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })} •
                    {#if rule.isAdvancedMode && rule.originStationName && rule.destinationStationName}
                      {rule.originStationName}
                      {rule.isReturn ? " ↔ " : " → "}
                      {rule.destinationStationName}
                      {#if rule.routeDescription && rule.routeDescription !== 'Default Route'}
                        <div class="route-path-desc" style="color: var(--color-text-secondary); font-size: 0.75rem; font-style: italic; margin-top: 0.15rem; margin-bottom: 0.1rem; word-break: break-word;">
                          ↳ {rule.routeDescription}
                        </div>
                      {/if}
                    {:else if rule.mode === "bus"}
                      Bus
                    {:else}
                      Z{rule.originZone}{rule.isReturn
                        ? "↔"
                        : "→"}Z{rule.destinationZone}
                    {/if}
                    • {rule.timePeriod}{rule.isReturn
                      ? ` (+${rule.returnTimePeriod})`
                      : ""}
                  </div>
                    <div style="display: flex; gap: 0.35rem; align-items: center; margin-top: 0.3rem; flex-wrap: wrap;">
                      {#if isDisabled}
                        <span 
                          class="disabled-status-badge"
                          style="cursor: help;"
                          role="status"
                          onmouseenter={(e) => showWarningTooltip(
                            e.currentTarget,
                            "This route includes contactless-only stations that do not support concession or discount fares.",
                            "Concession Disabled",
                            "concession-disabled"
                          )}
                          onmouseleave={hideWarningTooltip}
                        >
                          🚫 Concession Disabled
                        </span>
                      {:else}
                        {@const isEstimate = !rule.isAdvancedMode || rule.exactFarePeak === undefined || rule.exactFareOffPeak === undefined}
                        {@const retryInfo = getRuleRetryInfo(rule)}
                        {#if retryInfo}
                          <span class="rule-syncing-indicator" title="Currently fetching live fare from TfL API...">
                            {#if retryInfo.status === 'timeout'}
                              ⏱️ Timeout, retrying...
                            {:else if retryInfo.status === 'retrying'}
                              🔄 Retrying ({retryInfo.attempt}/{retryInfo.maxRetries})...
                            {:else}
                              🔄 Fetching fare...
                            {/if}
                          </span>
                        {:else if isEstimate && rule.mode !== 'bus'}
                          <span 
                            class="fare-source-badge estimate" 
                            style="cursor: help;"
                            role="status"
                            onmouseenter={(e) => {
                              const fares = getRuleFares(rule);
                              showFareTooltip(e.currentTarget, false, fares.peakBase, fares.peakDiscounted, fares.offPeakBase, fares.offPeakDiscounted);
                            }}
                            onmouseleave={hideFareTooltip}
                          >
                            ⚙️ Zone Estimate
                          </span>
                        {:else if rule.mode !== 'bus'}
                          <span 
                            class="fare-source-badge live" 
                            style="cursor: help;"
                            role="status"
                            onmouseenter={(e) => {
                              const fares = getRuleFares(rule);
                              showFareTooltip(e.currentTarget, true, fares.peakBase, fares.peakDiscounted, fares.offPeakBase, fares.offPeakDiscounted);
                            }}
                            onmouseleave={hideFareTooltip}
                          >
                            ✓ Live Fare
                          </span>
                        {/if}
                      {/if}
                    </div>
                </div>
                <div class="rule-actions">
                  <button
                    class="rule-edit"
                    onclick={() => editRule(rule)}
                    title="Edit Journey"
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    class="rule-remove"
                    onclick={() => removeRule(rule.id)}
                    title="Delete Journey"
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Detected patterns -->
      {#if visiblePatterns.length > 0}
        <div class="glass-card sidebar-section">
          <h3 class="sidebar-title">🔍 Detected from CSV</h3>
          {#each visiblePatterns.slice(0, 5) as pattern, i}
            <div class="pattern-card">
              <div class="pattern-info">
                <div class="pattern-route">
                  {pattern.origin.replace(/\s*\[.*?\]/g, "")} → {pattern.destination.replace(
                    /\s*\[.*?\]/g,
                    "",
                  )}
                </div>
                <div class="pattern-detail">
                  {pattern.frequency}x/week •
                  {pattern.timePeriod.includes("06:30") ||
                  pattern.timePeriod.includes("16:00")
                    ? "Peak"
                    : "Off-Peak"} •
                  {Math.round(pattern.confidence * 100)}% confidence
                </div>
              </div>
              <button
                class="btn-secondary"
                style="padding: 0.25rem 0.5rem; font-size: 0.7rem;"
                onclick={() => importPattern(i)}
              >
                Import
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Calendar and Settings -->
    <div class="calendar-area" class:max-xl:hidden={activeMobileTab !== "calendar"} class:max-xl:block={activeMobileTab === "calendar"}>
      <!-- Forecast summary -->
      {#if $forecastResult}
        <div class="glass-card forecast-summary flex justify-around gap-4 p-5 max-xl:grid max-xl:grid-cols-2 max-xl:gap-5 max-xl:p-4">
          <div class="forecast-stat">
            <span class="forecast-label max-xl:whitespace-normal max-xl:text-[0.75rem]">Standard PAYG</span>
            <span class="forecast-value max-xl:text-[1.75rem]"
              >£{$forecastResult.totalPaygCapped.toFixed(2)}</span
            >
          </div>
          <div class="forecast-stat">
            <span class="forecast-label max-xl:whitespace-normal max-xl:text-[0.75rem]"
              >{#if $selectedFareType === "none"}Adult / Contactless{:else}With {fareTypeShortName}
                Discount{/if}</span
            >
            <span class="forecast-value green max-xl:text-[1.75rem]"
              >£{$forecastResult.totalPaygFareTypeCapped.toFixed(2)}</span
            >
          </div>
          <div class="forecast-stat highlight max-xl:col-span-2 max-xl:border-t max-xl:border-[rgba(255,255,255,0.08)] max-xl:pt-3">
            <span class="forecast-label max-xl:whitespace-normal max-xl:text-[0.75rem]">Potential Saving</span>
            <span class="forecast-value green large max-xl:text-[2.25rem]">
              £{(
                $forecastResult.totalPaygCapped -
                $forecastResult.totalPaygFareTypeCapped
              ).toFixed(2)}
            </span>
          </div>
        </div>

        {#if studentComparison}
          <div
            class="glass-card student-comparison-card animate-slide-up"
            style="margin-top: 1rem; padding: 1.25rem; margin-bottom: 1rem;"
          >
            <h3 class="comparison-card-title">
              {#if $selectedFareType === "student"}
                🎓 18+ Student Oyster Cost Comparison
              {:else if $selectedFareType === "none"}
                💳 Adult Oyster / Contactless Cost Comparison
              {:else}
                🎫 {fareTypeShortName} Cost Comparison
              {/if}
            </h3>
            <p class="comparison-card-subtitle">
              {#if $selectedFareType === "student"}
                The 18+ Student Oyster card offers <strong>30% off weekly, monthly & annual Travelcards/Bus Passes</strong>, but does not discount single PAYG fares.
              {:else if $selectedFareType === "zip_16_17" || $selectedFareType === "zip_11_15"}
                Zip Oyster photocard offers <strong>50% off weekly, monthly & annual Travelcards/Bus Passes</strong>.
              {:else if $selectedFareType === "none"}
                Compare standard PAYG rates against weekly, monthly, and annual Travelcards and Bus Passes to find the cheapest option.
              {:else}
                Your concession/railcard discount applies to single PAYG fares, but not to Travelcards/Bus Passes. Compare your discounted PAYG spend against standard passes.
              {/if}
              Here is how your simulated PAYG cost of
              <strong>£{studentComparison.totalPayg.toFixed(2)}</strong>
              compares to alternative passes for your
              <strong>{studentComparison.durationDays}-day</strong>
              period ({studentComparison.monthsInPeriodText}):
            </p>

            <div
              style="display: flex; justify-content: center; margin-top: 0.75rem; margin-bottom: 0.25rem;"
            >
              <button
                type="button"
                class="btn-primary"
                style="display: flex; align-items: center; gap: 0.5rem; background: var(--color-oyster-blue); border-color: var(--color-oyster-blue); font-size: 0.8rem; padding: 0.5rem 1rem;"
                onclick={() =>
                  (showStudentComparisonTable = !showStudentComparisonTable)}
              >
                <span
                  >{showStudentComparisonTable
                    ? "🙈 Hide Comparison Details"
                    : "📊 Compare Options"}</span
                >
              </button>
            </div>

            {#if showStudentComparisonTable}
              <div class="comparison-table-wrapper" style="margin-top: 1rem;">
                <table class="comparison-table">
                  <thead>
                    <tr>
                      <th>Product Option</th>
                      <th class="text-right">Monthly Rate</th>
                      <th class="text-right font-semibold">Cost for Period</th>
                      <th>Comparison vs PAYG</th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- Pinned PAYG Baseline -->
                    <tr
                      class:cheapest-highlight={studentComparison.paygOption
                        .isCheapest}
                    >
                      <td class="font-medium">
                        <span
                          class="dot-indicator"
                          style="background: {studentComparison.paygOption
                            .color};"
                        ></span>
                        {studentComparison.paygOption.label}
                        {#if studentComparison.paygOption.isCheapest}
                          <span class="best-value-badge">Best Value</span>
                        {/if}
                      </td>
                      <td class="text-right font-mono">
                        {#if studentComparison.paygOption.monthlyRate === null || studentComparison.paygOption.monthlyRate === undefined}
                          —
                        {:else}
                          £{studentComparison.paygOption.monthlyRate.toFixed(2)}/mo
                        {/if}
                      </td>
                      <td class="text-right font-mono font-semibold"
                        >£{studentComparison.paygOption.periodCost.toFixed(
                          2,
                        )}</td
                      >
                      <td class="text-muted">— (Baseline)</td>
                    </tr>

                    <!-- Sorted options -->
                    {#each studentComparison.options as opt}
                      <tr class:cheapest-highlight={opt.isCheapest}>
                        <td class="font-medium">
                          <span
                            class="dot-indicator"
                            style="background: {opt.color};"
                          ></span>
                          {opt.label}
                          {#if opt.category === 'travelcard_odd'}
                            <button
                              type="button"
                              class="info-badge-btn"
                              onmouseenter={(e) => showOddPeriodTooltip(e.currentTarget)}
                              onmouseleave={hideOddPeriodTooltip}
                              onclick={(e) => {
                                e.stopPropagation();
                                if (oddPeriodTooltipData && oddPeriodTooltipData.visible) {
                                  hideOddPeriodTooltip();
                                } else {
                                  showOddPeriodTooltip(e.currentTarget);
                                }
                              }}
                              aria-label="Odd-period travelcard explanation"
                            >
                              i
                            </button>
                          {/if}
                          {#if opt.isCheapest}
                            <span class="best-value-badge">Best Value</span>
                          {/if}
                        </td>
                        <td class="text-right font-mono">
                          {#if opt.monthlyRate === null || opt.monthlyRate === undefined}
                            —
                          {:else if opt.isAnnual}
                            £{opt.monthlyRate.toFixed(2)}/mo
                            <span
                              class="annual-upfront"
                              style="display: block; font-size: 0.7rem; color: var(--color-text-muted);"
                            >
                              (£{opt.annualTotalRate} upfront)
                            </span>
                          {:else if opt.isWeeklyRate}
                            £{opt.monthlyRate.toFixed(2)}/wk
                            {#if opt.strikeThroughRate}
                              <span class="strike-through"
                                >£{opt.strikeThroughRate.toFixed(2)}/wk</span
                              >
                            {/if}
                          {:else}
                            £{opt.monthlyRate.toFixed(2)}/mo
                            {#if opt.strikeThroughRate}
                              <span class="strike-through"
                                >£{opt.strikeThroughRate.toFixed(2)}/mo</span
                              >
                            {/if}
                          {/if}
                        </td>
                        <td class="text-right font-mono font-semibold"
                          >£{opt.periodCost.toFixed(2)}</td
                        >
                        <td>
                          {#if opt.saving > 0}
                            <span class="save-tag"
                              >Saves £{opt.saving.toFixed(2)}</span
                            >
                          {:else}
                            <span class="extra-tag"
                              >+£{Math.abs(opt.saving).toFixed(2)}</span
                            >
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>


            {/if}
          </div>
        {/if}
      {/if}

      <div class="glass-card" style="padding: 1.25rem;">
        <!-- Calendar header -->
        <div
          class="calendar-nav"
          style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;"
        >
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button
              type="button"
              class="btn-secondary"
              style="padding: 0.375rem 0.75rem;"
              onclick={prevMonth}>←</button
            >
            <h2
              class="calendar-month-label"
              style="margin: 0; min-width: 120px; text-align: center;"
            >
              {calendarDate.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              type="button"
              class="btn-secondary"
              style="padding: 0.375rem 0.75rem;"
              onclick={nextMonth}>→</button
            >
          </div>

          <button
            type="button"
            class="btn-primary mobile-layout-add-btn hidden max-xl:inline-flex max-xl:items-center max-xl:gap-1"
            style="font-size: 0.8rem; padding: 0.45rem 0.9rem;"
            onclick={() => {
              resetForm();
              showRecurrenceModal = true;
            }}
          >
            + Add Routine / Journey
          </button>
        </div>

        <!-- Calendar grid -->
        <div class="calendar-grid max-md:[--cap-col-width:36px]" class:hide-cap-column={!showWeeklyCapColumn}>
          {#each (showWeeklyCapColumn ? [...dayLabels, "Cap"] : dayLabels) as label}
            <div class="calendar-header" style="{label === 'Cap' ? 'color: var(--color-oyster-blue); font-weight: 700;' : ''}">{label}</div>
          {/each}

          {#each calendarDays as day, idx}
            {@const dateKey = formatLocalDate(day.date)}
            {@const dayJourneys = journeysByDate.get(dateKey) || []}
            {@const forecast = forecastByDate.get(dateKey)}
            <div
              class="calendar-cell max-xl:!min-h-[65px] max-xl:!p-1"
              class:other-month={!day.isCurrentMonth}
              class:cap-hit={forecast?.capHitFareType}
              class:has-journeys={dayJourneys.length > 0}
              class:in-planning-period={dateKey >= planStart &&
                dateKey <= planEnd}
              role="button"
              tabindex="0"
              onclick={() => quickAddOnDate(day.date)}
              onkeydown={(e) => {
                if (e.key === "Enter") quickAddOnDate(day.date);
              }}
              style="cursor: pointer;"
            >
              <div class="day-number">{day.date.getDate()}</div>
              {#if dayJourneys.length > 0}
                <button
                  class="clear-day-btn max-xl:!opacity-100 max-xl:!top-[2px] max-xl:!right-[2px] max-xl:!w-4 max-xl:!h-4 max-xl:!text-[0.5rem]"
                  onclick={(e) => {
                    e.stopPropagation();
                    clearJourneysForDate(dateKey);
                  }}
                  aria-label="Clear journeys for this day"
                >
                  ✕
                </button>
                <div class="day-journey-count max-xl:text-[0.6rem]">
                  {dayJourneys.length} trip{dayJourneys.length > 1 ? "s" : ""}
                </div>
                {#if forecast}
                  <div class="day-spend max-xl:text-[0.65rem]">
                    £{forecast.cappedFareFareType.toFixed(2)}
                  </div>
                  <div class="mini-cap-bar" style="display: flex; gap: 0; background: rgba(255, 255, 255, 0.1); overflow: hidden; border-radius: 2px; height: 4px; margin-top: 0.25rem;">
                    {#if forecast.busProgressFareType && forecast.busProgressFareType > 0}
                      <div
                        class="mini-cap-fill-bus"
                        style="width: {forecast.busProgressFareType * 100}%; background: {forecast.isBusCapHitFareType || forecast.capHitFareType ? '#10b981' : '#e0311a'}; height: 100%; transition: width 0.3s ease;"
                        title="Bus Spend: £{forecast.cappedBusFareFareType?.toFixed(2)}"
                      ></div>
                    {/if}
                    {#if forecast.railProgressFareType && forecast.railProgressFareType > 0}
                      <div
                        class="mini-cap-fill-rail"
                        style="width: {forecast.railProgressFareType * 100}%; background: {getCapColor(forecast.capProgressFareType)}; height: 100%; transition: width 0.3s ease;"
                        title="Rail/Tube Spend: £{forecast.cappedRailFareFareType?.toFixed(2)}"
                      ></div>
                    {/if}
                  </div>
                  {#if forecast.isTotalCapHitFareType}
                    <div class="cap-hit-label max-xl:text-[0.5rem]">Cap Hit ✓</div>
                  {:else if forecast.isBusCapHitFareType}
                    <div class="cap-hit-label bus max-xl:text-[0.5rem]">Bus Cap ✓</div>
                  {/if}
                {/if}
              {/if}
            </div>

            {#if showWeeklyCapColumn && idx % 7 === 6}
              {@const weekForecast = getForecastWeekForDate(day.date)}
              <div
                class="calendar-weekly-cap-cell max-md:!min-h-[65px] max-md:!py-[0.2rem] max-md:!px-[0.05rem]"
                role="button"
                tabindex="0"
                onmouseenter={(e) => showWeeklyCapTooltip(e.currentTarget, weekForecast, true)}
                onmouseleave={hideWeeklyCapTooltip}
                onclick={(e) => { e.stopPropagation(); handleWeeklyCapClick(e.currentTarget, weekForecast); }}
                onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleWeeklyCapClick(e.currentTarget, weekForecast); } }}
              >
                {#if weekForecast}
                  {@const progress = weekForecast.capProgress}
                  <div class="weekly-spend-label max-md:text-[0.52rem] max-md:mb-[0.15rem]">
                    £{weekForecast.totalFareFareType.toFixed(2)}
                  </div>
                  <div class="weekly-progress-container max-md:!w-1 max-md:!h-6" title="Weekly Cap Progress: {Math.round(progress * 100)}%">
                    <div class="weekly-progress-fill" style="height: {progress * 100}%; background: {progress >= 1 ? '#10b981' : progress >= 0.7 ? '#f59e0b' : '#009FE3'};"></div>
                  </div>
                  {#if weekForecast.capHit}
                    <div class="weekly-cap-hit-tag max-md:text-[0.42rem] max-md:mt-[0.15rem]">Capped</div>
                  {/if}
                {:else}
                  <span style="opacity: 0.2; font-size: 0.6rem;">-</span>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </div>
    </div>

    <!-- Right Sidebar for Settings -->
    <div class="planner-sidebar" class:max-xl:hidden={activeMobileTab !== "settings"} class:max-xl:block={activeMobileTab === "settings"}>
      <!-- Default Settings -->
      <div class="glass-card sidebar-section" style="position: relative; z-index: 10;">
        <h3 class="sidebar-title">⚙️ Default Journey Settings</h3>
        <p
          style="font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.75rem;"
        >
          These settings apply when adding one-off journeys from the calendar.
        </p>
        <div class="date-inputs">
          {#if $globalAdvancedMode}
            <div
              class="advanced-sidebar-notice"
              style="margin-bottom: 0.75rem; padding: 0.5rem 0.75rem; background: rgba(0, 114, 206, 0.1); border: 1px dashed rgba(0, 114, 206, 0.35); border-radius: 6px; font-size: 0.7rem; color: var(--color-oyster-blue); line-height: 1.4;"
            >
              🚇 Station fares will be queried using the selected mode & time.
            </div>
          {/if}

          <div class="default-settings-inputs">
            <span class="setting-label" style="display: block; margin-bottom: 0.25rem;">Default Mode</span>
            {#if $globalAdvancedMode}
              <div class="segmented-control" style="margin-bottom: 0.5rem;">
                <button
                  type="button"
                  class="segment-btn"
                  class:active={defMode !== "bus"}
                  onclick={() => {
                    defMode = "underground";
                  }}
                  style="padding: 0.35rem 0.5rem; font-size: 0.75rem;"
                >
                  <span class="btn-icon">🚇</span> Tube/Rail
                </button>
                <button
                  type="button"
                  class="segment-btn"
                  class:active={defMode === "bus"}
                  onclick={() => {
                    defMode = "bus";
                  }}
                  style="padding: 0.35rem 0.5rem; font-size: 0.75rem;"
                >
                  <span class="btn-icon">🚌</span> Bus/Tram
                </button>
              </div>
            {:else}
              <select class="input-field" id="def-mode" bind:value={defMode} style="margin-bottom: 0.5rem;">
                <option value="underground">Tube</option>
                <option value="national_rail">National Rail</option>
                <option value="nr_tube">NR + Tube / Mixed</option>
                <option value="bus">Bus / Tram</option>
              </select>
            {/if}

            {#if defMode !== "bus"}
              <label
                class="setting-label"
                for="def-time-period"
                style="margin-top: 0.25rem;">Default Time</label
              >
              <select
                class="input-field"
                id="def-time-period"
                bind:value={defTimePeriod}
              >
                {#each TIME_PERIODS as t}
                  <option value={t.value}>{t.label}</option>
                {/each}
              </select>
            {/if}

            {#if !$globalAdvancedMode}
              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <div style="flex: 1;">
                  <label class="setting-label" for="def-origin-zone"
                    >Origin Zone</label
                  >
                  <select
                    class="input-field"
                    id="def-origin-zone"
                    bind:value={defOriginZone}
                  >
                    {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as z}
                      <option value={z}>Zone {z}</option>
                    {/each}
                  </select>
                </div>
                <div style="flex: 1;">
                  <label class="setting-label" for="def-dest-zone"
                    >Dest. Zone</label
                  >
                  <select
                    class="input-field"
                    id="def-dest-zone"
                    bind:value={defDestZone}
                  >
                    {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as z}
                      <option value={z}>Zone {z}</option>
                    {/each}
                  </select>
                </div>
              </div>
            {/if}
          </div>

          <div class="form-group" style="margin-top: 0.75rem; margin-bottom: 0.25rem;">
            <label class="checkbox-field" class:active={showWeeklyCapColumn} for="sidebar-show-weekly-cap">
              <input
                type="checkbox"
                id="sidebar-show-weekly-cap"
                bind:checked={showWeeklyCapColumn}
              />
              <span class="checkmark"></span>
              <span class="checkbox-text">📊 Show Weekly Cap Column</span>
            </label>
          </div>

          {#if $globalAdvancedMode}
            <div class="form-group" style="margin-top: 0.75rem; margin-bottom: 0.25rem;">
              <label class="checkbox-field" class:active={useDefaultHomeStation} for="sidebar-use-home-station">
                <input
                  type="checkbox"
                  id="sidebar-use-home-station"
                  bind:checked={useDefaultHomeStation}
                />
                <span class="checkmark"></span>
                <span class="checkbox-text">🏠 Set Default Home Station</span>
              </label>
            </div>

            {#if useDefaultHomeStation}
              <div class="form-group station-autocomplete" style="margin-top: 0.5rem; position: relative;">
                <label class="setting-label" for="sidebar-home-station">Home Station</label>
                <div class="station-input-wrapper">
                  {#if defaultHomeStation && !showSidebarHomeDropdown}
                    <div
                      class="station-selected-display"
                      onclick={() => {
                        sidebarHomeQuery = defaultHomeStation?.info.name ?? '';
                        showSidebarHomeDropdown = true;
                        const el = document.getElementById('sidebar-home-station');
                        if (el) el.focus();
                      }}
                      onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          sidebarHomeQuery = defaultHomeStation?.info.name ?? '';
                          showSidebarHomeDropdown = true;
                          const el = document.getElementById('sidebar-home-station');
                          if (el) el.focus();
                        }
                      }}
                      role="button"
                      tabindex="-1"
                    >
                      <span class="station-display-name">{defaultHomeStation.info.name}</span>
                      {#each defaultHomeStation.info.modes as mode}
                        <img src="/images/{mode}.svg" alt={mode} class="mode-icon-inline small" title={mode} />
                      {/each}
                      <span class="station-zone-badge small" style="color: {getZoneColor(defaultHomeStation.info.zone)}; border-color: {getZoneColor(defaultHomeStation.info.zone)}40; background: {getZoneColor(defaultHomeStation.info.zone)}15;"
                        >{formatZoneDisplay(defaultHomeStation.info)}</span
                      >
                    </div>
                  {:else}
                    <input
                      type="text"
                      class="input-field"
                      id="sidebar-home-station"
                      value={sidebarHomeQuery}
                      oninput={(e) => handleSidebarHomeSearch(e.currentTarget.value)}
                      onfocus={() => {
                        if (sidebarHomeQuery.length >= 1)
                          showSidebarHomeDropdown = true;
                      }}
                      onkeydown={(e) => {
                        if (e.key === "Enter") {
                          if (sidebarHomeResults.length > 0) {
                            e.preventDefault();
                            const result = sidebarHomeResults[0];
                            defaultHomeStation = { key: result.key, info: result.info };
                            sidebarHomeQuery = result.info.name;
                            showSidebarHomeDropdown = false;
                            sidebarHomeResults = [];
                          }
                        }
                      }}
                      placeholder="Type a station name..."
                      autocomplete="off"
                    />
                    {#if sidebarHomeQuery}
                      <button
                        type="button"
                        class="clear-input-btn"
                        style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 0.8rem;"
                        onclick={() => {
                          defaultHomeStation = null;
                          sidebarHomeQuery = "";
                          sidebarHomeResults = [];
                          showSidebarHomeDropdown = false;
                        }}
                      >
                        ✕
                      </button>
                    {/if}
                  {/if}
                </div>

                {#if showSidebarHomeDropdown && sidebarHomeResults.length > 0}
                  <ul class="station-dropdown">
                    {#each sidebarHomeResults as result}
                      <li>
                        <button
                          type="button"
                          class="station-option"
                          onclick={() => {
                            defaultHomeStation = { key: result.key, info: result.info };
                            sidebarHomeQuery = result.info.name;
                            showSidebarHomeDropdown = false;
                            sidebarHomeResults = [];
                          }}
                        >
                          <span class="station-name">{result.info.name}</span>
                          <span class="station-option-meta">
                            {#each result.info.modes as mode}
                              <img src="/images/{mode}.svg" alt={mode} class="mode-icon-inline small" title={mode} />
                            {/each}
                            <span class="station-zone-badge small" style="color: {getZoneColor(result.info.zone)}; border-color: {getZoneColor(result.info.zone)}40; background: {getZoneColor(result.info.zone)}15;"
                              >{formatZoneDisplay(result.info)}</span
                            >
                          </span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}
          {/if}

          <!-- Always Use Cheapest Route Toggle -->
          {#if $globalAdvancedMode}
            <div
              class="form-group"
              style="margin-top: 0.5rem; margin-bottom: 0;"
            >
              <label
                class="checkbox-field"
                class:active={$useAlternativeFares}
                for="sidebar-cheapest-tfl-route"
              >
                <input
                  type="checkbox"
                  id="sidebar-cheapest-tfl-route"
                  bind:checked={$useAlternativeFares}
                />
                <span class="checkmark"></span>
                <span class="checkbox-text"
                  >🪙 Always Use Cheapest Route</span
                >
              </label>
            </div>
          {/if}
        </div>
      </div>

      <!-- Fare Type Discount -->
      <div class="glass-card sidebar-section">
        <h3 class="sidebar-title">🏷️ Fare Type</h3>
        <div class="date-inputs">
          <label class="setting-label" for="sel-fare-type"
            >Fare Type Applied to Planner</label
          >
          <select
            class="input-field"
            id="sel-fare-type"
            bind:value={$selectedFareType}
            onchange={regenerate}
          >
            <option value="none">Adult / Contactless</option>
            <option value="student">Apprentice / 18+ Student Oyster</option>
            <option value="zip_11_15">11-15 Zip Oyster Card</option>
            <option value="zip_16_17">16+ Zip Oyster Card</option>
            <option value="jobcentre">Jobcentre Plus Travel Discount</option>
            <option value="disabled">Disabled Persons Railcard</option>
            <option value="railcard">National Railcard / Gold Card</option>
          </select>
        </div>
      </div>

      <!-- Basic Mode (Offline) Box -->
      <div class="glass-card sidebar-section">
        <h3 class="sidebar-title">💾 Planner Mode</h3>
        <div class="date-inputs">
          <div class="form-group" style="margin-top: 0.25rem; margin-bottom: 0;">
            <label
              class="checkbox-field"
              class:active={!$globalAdvancedMode}
              for="sidebar-basic-mode"
            >
              <input
                type="checkbox"
                id="sidebar-basic-mode"
                checked={!$globalAdvancedMode}
                onchange={(e) => {
                  $globalAdvancedMode = !e.currentTarget.checked;
                }}
              />
              <span class="checkmark"></span>
              <span class="checkbox-text"
                >Basic Mode (Offline)</span
              >
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Recurrence Modal -->
  {#if showRecurrenceModal}
    <div
      class="modal-overlay"
      onclick={(e) => {
        if (e.target === e.currentTarget) showRecurrenceModal = false;
      }}
      onkeydown={(e) => {
        if (e.key === "Escape") showRecurrenceModal = false;
      }}
      role="dialog"
      tabindex="-1"
      aria-label="Add recurring routine"
    >
      <div class="modal-content glass-card">
        <div class="modal-header">
          <h2>
            {#if editRuleId}
              {newIntervalType === "none"
                ? "Edit One-off Journey"
                : "Edit Travel Routine"}
            {:else}
              {newIntervalType === "none"
                ? "Add One-off Journey"
                : "Add Travel Routine"}
            {/if}
          </h2>
          <button
            class="modal-close"
            onclick={() => (showRecurrenceModal = false)}>✕</button
          >
        </div>

        <div class="modal-body">
          <div class="form-row grid grid-cols-1 xl:grid-cols-2 max-xl:gap-3">
            <div class="form-group">
              <label class="setting-label" for="modal-journey-type"
                >Journey Type</label
              >
              <select
                class="input-field"
                id="modal-journey-type"
                value={newIntervalType === "none" ? "none" : "recurring"}
                onchange={(e) => {
                  const val = e.currentTarget.value;
                  if (val === "none") {
                    newIntervalType = "none";
                  } else {
                    newIntervalType = "weeks";
                    newRuleEndDate = planEnd;
                  }
                }}
              >
                <option value="recurring">🔄 Recurring Routine</option>
                <option value="none">📌 One-off Journey</option>
              </select>
            </div>
          </div>

          <div class="form-row grid grid-cols-1 xl:grid-cols-2 max-xl:gap-3">
            <div class="form-group">
              <label class="setting-label" for="modal-rule-name"
                >{newIntervalType === "none"
                  ? "Journey Name"
                  : "Routine Name"}</label
              >
              <input
                type="text"
                class="input-field"
                id="modal-rule-name"
                bind:value={newRuleName}
                placeholder="e.g., Morning Commute"
              />
            </div>
            {#if newIntervalType === "none"}
              <div class="form-group">
                <label class="setting-label" for="modal-journey-date"
                  >Journey Date</label
                >
                <input
                  type="date"
                  class="input-field"
                  id="modal-journey-date"
                  bind:value={newRuleDate}
                  onblur={handleModalBlur}
                  min={minDateStr}
                  max={maxDateStr}
                />
              </div>
            {/if}
          </div>

          {#if newIntervalType !== "none"}
            <div class="form-row grid grid-cols-1 xl:grid-cols-2 max-xl:gap-3">
              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 0.25rem;">
                  <label class="setting-label" for="modal-start-date" style="margin-bottom: 0;">Start Date</label>
                  <button
                    type="button"
                    class="mini-sync-toggle"
                    class:active={syncWithPlanStart}
                    onclick={() => syncWithPlanStart = !syncWithPlanStart}
                  >
                    <span class="sync-icon">{syncWithPlanStart ? '🔗' : '🔓'}</span>
                    {syncWithPlanStart ? 'Synced' : 'Custom'}
                  </button>
                </div>
                {#if syncWithPlanStart}
                  <div class="input-field-placeholder" style="padding: 0.5rem 0.75rem; border-radius: 8px; background: rgba(255, 255, 255, 0.01); border: 1px dashed var(--color-border); color: var(--color-text-muted); font-size: 0.85rem; height: 38px; display: flex; align-items: center; gap: 0.35rem; box-sizing: border-box; cursor: not-allowed;">
                    <span style="opacity: 0.7;">📅</span> {planStart ? new Date(planStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} (Synced)
                  </div>
                {:else}
                  <input
                    type="date"
                    class="input-field"
                    id="modal-start-date"
                    bind:value={newRuleDate}
                    onblur={handleModalBlur}
                    min={minDateStr}
                    max={maxDateStr}
                  />
                {/if}
              </div>
              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 0.25rem;">
                  <label class="setting-label" for="modal-end-date" style="margin-bottom: 0;">End Date</label>
                  <button
                    type="button"
                    class="mini-sync-toggle"
                    class:active={syncWithPlanEnd}
                    onclick={() => syncWithPlanEnd = !syncWithPlanEnd}
                  >
                    <span class="sync-icon">{syncWithPlanEnd ? '🔗' : '🔓'}</span>
                    {syncWithPlanEnd ? 'Synced' : 'Custom'}
                  </button>
                </div>
                {#if syncWithPlanEnd}
                  <div class="input-field-placeholder" style="padding: 0.5rem 0.75rem; border-radius: 8px; background: rgba(255, 255, 255, 0.01); border: 1px dashed var(--color-border); color: var(--color-text-muted); font-size: 0.85rem; height: 38px; display: flex; align-items: center; gap: 0.35rem; box-sizing: border-box; cursor: not-allowed;">
                    <span style="opacity: 0.7;">📅</span> {planEnd ? new Date(planEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} (Synced)
                  </div>
                {:else}
                  <input
                    type="date"
                    class="input-field"
                    id="modal-end-date"
                    bind:value={newRuleEndDate}
                    onblur={handleModalBlur}
                    min={minDateStr}
                    max={maxDateStr}
                  />
                {/if}
              </div>
            </div>
          {/if}

          {#if advancedMode}
            <!-- Segmented Control binary toggle for Advanced Mode -->
            <div class="form-group" style="margin-bottom: 1rem;">
              <span class="setting-label">Transport Type</span>
              <div class="segmented-control">
                <button
                  type="button"
                  class="segment-btn"
                  class:active={newMode !== "bus"}
                  onclick={() => {
                    newMode = "underground";
                    fetchAdvancedFare();
                  }}
                >
                  <span class="btn-icon">🚇</span> Tube / Rail
                </button>
                <button
                  type="button"
                  class="segment-btn"
                  class:active={newMode === "bus"}
                  onclick={() => {
                    newMode = "bus";
                  }}
                >
                  <span class="btn-icon">🚌</span> Bus / Tram (Flat Fare)
                </button>
              </div>
            </div>
            {#if newMode !== "bus"}
              <div class="form-row grid grid-cols-1 xl:grid-cols-2 max-xl:gap-3">
                <div class="form-group">
                  <label class="setting-label" for="modal-time-period"
                    >Time Period</label
                  >
                  <select
                    class="input-field"
                    id="modal-time-period"
                    bind:value={newTimePeriod}
                  >
                    {#each TIME_PERIODS as t}
                      <option value={t.value}>{t.label}</option>
                    {/each}
                  </select>
                </div>
              </div>
            {/if}
          {:else}
            <!-- Standard dropdown mode selection for Simple Mode -->
            <div class="form-row grid grid-cols-1 xl:grid-cols-2 max-xl:gap-3">
              <div class="form-group">
                <label class="setting-label" for="modal-transport-mode"
                  >Transport Mode</label
                >
                <select
                  class="input-field"
                  id="modal-transport-mode"
                  bind:value={newMode}
                >
                  <option value="underground">Tube</option>
                  <option value="national_rail">National Rail</option>
                  <option value="nr_tube">National Rail & Tube</option>
                  <option value="bus">Bus / Tram</option>
                </select>
              </div>
              {#if newMode !== "bus"}
                <div class="form-group">
                  <label class="setting-label" for="modal-time-period"
                    >Time Period</label
                  >
                  <select
                    class="input-field"
                    id="modal-time-period"
                    bind:value={newTimePeriod}
                  >
                    {#each TIME_PERIODS as t}
                      <option value={t.value}>{t.label}</option>
                    {/each}
                  </select>
                </div>
              {/if}
            </div>
          {/if}

          <div
            class="form-row return-journey-row grid grid-cols-1 xl:grid-cols-2 max-xl:gap-3"
            style="margin-top: 0.5rem; align-items: flex-end;"
          >
            <div class="form-group checkbox-group" style="margin-bottom: 0;">
              <div
                class="setting-label"
                style="margin-bottom: 0.5rem; display: block;"
              >
                Return Trip
              </div>
              <label
                class="checkbox-field"
                class:active={newIsReturn}
                for="modal-is-return"
              >
                <input
                  type="checkbox"
                  id="modal-is-return"
                  bind:checked={newIsReturn}
                />
                <span class="checkmark"></span>
                <span class="checkbox-text">Add Return Journey</span>
              </label>
            </div>
            {#if newMode !== "bus"}
              <div
                class="form-group"
                style="margin-bottom: 0;"
                class:hidden-field={!newIsReturn}
              >
                <label class="setting-label" for="modal-return-time-period"
                  >Return Time</label
                >
                <select
                  class="input-field"
                  id="modal-return-time-period"
                  bind:value={newReturnTimePeriod}
                  disabled={!newIsReturn}
                >
                  {#each returnTimePeriodOptions as t}
                    <option value={t.value}>{t.label}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>

          {#if newMode !== "bus"}
            {#if advancedMode}
              <!-- Station Autocomplete -->
              <div class="form-group station-autocomplete">
                <label class="setting-label" for="modal-origin-station"
                  >Origin Station</label
                >
                <div class="station-input-wrapper">
                  {#if selectedOriginStation && !showOriginDropdown}
                    <div class="station-selected-display" onclick={() => { originStationQuery = selectedOriginStation?.info.name ?? ''; showOriginDropdown = false; const el = document.getElementById('modal-origin-station'); if (el) el.focus(); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { originStationQuery = selectedOriginStation?.info.name ?? ''; showOriginDropdown = false; const el = document.getElementById('modal-origin-station'); if (el) el.focus(); } }} role="button" tabindex="-1">
                      <span class="station-display-name">{selectedOriginStation.info.name}</span>
                      {#each selectedOriginStation.info.modes as mode}
                        <img src="/images/{mode}.svg" alt={mode} class="mode-icon-inline small" title={mode} />
                      {/each}
                      {#if selectedOriginStation.info.outsideZone}
                        <span class="station-zone-badge small outside-zone-badge" style="color: #ec4899; border-color: rgba(236, 72, 153, 0.4); background: rgba(236, 72, 153, 0.15);"
                          >Outside Zones 1-9</span>
                      {:else}
                        <span class="station-zone-badge small" style="color: {getZoneColor(selectedOriginStation.info.zone)}; border-color: {getZoneColor(selectedOriginStation.info.zone)}40; background: {getZoneColor(selectedOriginStation.info.zone)}15;"
                          >{formatZoneDisplay(selectedOriginStation.info)}</span>
                      {/if}
                      {#if selectedOriginStation.info.contactlessOnly}
                        <span class="station-zone-badge small contactless-only-badge" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.15);"
                          >Contactless Only</span>
                      {/if}
                    </div>
                  {:else}
                    <input
                      type="text"
                      class="input-field"
                      id="modal-origin-station"
                      value={originStationQuery}
                      oninput={(e) => handleOriginSearch(e.currentTarget.value)}
                      onfocus={() => {
                        if (originStationQuery.length >= 1)
                          showOriginDropdown = true;
                      }}
                      onkeydown={(e) => {
                        if (e.key === "Enter") {
                          if (originStationResults.length > 0) {
                            e.preventDefault();
                            selectOriginStation(originStationResults[0]);
                          }
                        }
                      }}
                      placeholder="Type a station name..."
                      autocomplete="off"
                    />
                  {/if}
                  {#if originStationQuery.length > 0 || selectedOriginStation}
                    <button
                      class="station-clear-btn"
                      onclick={clearOriginStation}
                      aria-label="Clear origin station"
                      type="button"
                    >✕</button>
                  {/if}
                </div>
                {#if showOriginDropdown && originStationResults.length > 0}
                  <ul class="station-dropdown">
                    {#each originStationResults as result}
                      <li>
                        <button
                          class="station-option"
                          onclick={() => selectOriginStation(result)}
                        >
                          <span class="station-name">{result.info.name}</span>
                          <span class="station-option-meta">
                            {#each result.info.modes as mode}
                              <img src="/images/{mode}.svg" alt={mode} class="mode-icon-inline small" title={mode} />
                            {/each}
                            {#if result.info.outsideZone}
                              <span class="station-zone-badge small outside-zone-badge" style="color: #ec4899; border-color: rgba(236, 72, 153, 0.4); background: rgba(236, 72, 153, 0.15);"
                                >Outside Zones 1-9</span>
                            {:else}
                              <span class="station-zone-badge small" style="color: {getZoneColor(result.info.zone)}; border-color: {getZoneColor(result.info.zone)}40; background: {getZoneColor(result.info.zone)}15;"
                                >{formatZoneDisplay(result.info)}</span>
                            {/if}
                            {#if result.info.contactlessOnly}
                              <span class="station-zone-badge small contactless-only-badge" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.15);"
                                >Contactless Only</span>
                            {/if}
                          </span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>

              <div class="swap-stations-container">
                <button
                  type="button"
                  class="swap-stations-btn"
                  onclick={swapStations}
                  title="Swap Origin & Destination Stations"
                  aria-label="Swap Origin & Destination Stations"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="17 1 21 5 17 9"></polyline>
                    <line x1="3" y1="5" x2="21" y2="5"></line>
                    <polyline points="7 23 3 19 7 15"></polyline>
                    <line x1="21" y1="19" x2="3" y2="19"></line>
                  </svg>
                </button>
              </div>

              <div class="form-group station-autocomplete">
                <label class="setting-label" for="modal-dest-station"
                  >Destination Station</label
                >
                <div class="station-input-wrapper">
                  {#if selectedDestStation && !showDestDropdown}
                    <div class="station-selected-display" onclick={() => { destStationQuery = selectedDestStation?.info.name ?? ''; showDestDropdown = false; const el = document.getElementById('modal-dest-station'); if (el) el.focus(); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { destStationQuery = selectedDestStation?.info.name ?? ''; showDestDropdown = false; const el = document.getElementById('modal-dest-station'); if (el) el.focus(); } }} role="button" tabindex="-1">
                      <span class="station-display-name">{selectedDestStation.info.name}</span>
                      {#each selectedDestStation.info.modes as mode}
                        <img src="/images/{mode}.svg" alt={mode} class="mode-icon-inline small" title={mode} />
                      {/each}
                      {#if selectedDestStation.info.outsideZone}
                        <span class="station-zone-badge small outside-zone-badge" style="color: #ec4899; border-color: rgba(236, 72, 153, 0.4); background: rgba(236, 72, 153, 0.15);"
                          >Outside Zones 1-9</span>
                      {:else}
                        <span class="station-zone-badge small" style="color: {getZoneColor(selectedDestStation.info.zone)}; border-color: {getZoneColor(selectedDestStation.info.zone)}40; background: {getZoneColor(selectedDestStation.info.zone)}15;"
                          >{formatZoneDisplay(selectedDestStation.info)}</span>
                      {/if}
                      {#if selectedDestStation.info.contactlessOnly}
                        <span class="station-zone-badge small contactless-only-badge" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.15);"
                          >Contactless Only</span>
                      {/if}
                    </div>
                  {:else}
                    <input
                      type="text"
                      class="input-field"
                      id="modal-dest-station"
                      value={destStationQuery}
                      oninput={(e) => handleDestSearch(e.currentTarget.value)}
                      onfocus={() => {
                        if (destStationQuery.length >= 1) showDestDropdown = true;
                      }}
                      onkeydown={(e) => {
                        if (e.key === "Enter") {
                          if (destStationResults.length > 0) {
                            e.preventDefault();
                            selectDestStation(destStationResults[0]);
                          }
                        }
                      }}
                      placeholder="Type a station name..."
                      autocomplete="off"
                    />
                  {/if}
                  {#if destStationQuery.length > 0 || selectedDestStation}
                    <button
                      class="station-clear-btn"
                      onclick={clearDestStation}
                      aria-label="Clear destination station"
                      type="button"
                    >✕</button>
                  {/if}
                </div>
                {#if showDestDropdown && destStationResults.length > 0}
                  <ul class="station-dropdown">
                    {#each destStationResults as result}
                      <li>
                        <button
                          class="station-option"
                          onclick={() => selectDestStation(result)}
                        >
                          <span class="station-name">{result.info.name}</span>
                          <span class="station-option-meta">
                            {#each result.info.modes as mode}
                              <img src="/images/{mode}.svg" alt={mode} class="mode-icon-inline small" title={mode} />
                            {/each}
                            {#if result.info.outsideZone}
                              <span class="station-zone-badge small outside-zone-badge" style="color: #ec4899; border-color: rgba(236, 72, 153, 0.4); background: rgba(236, 72, 153, 0.15);"
                                >Outside Zones 1-9</span>
                            {:else}
                              <span class="station-zone-badge small" style="color: {getZoneColor(result.info.zone)}; border-color: {getZoneColor(result.info.zone)}40; background: {getZoneColor(result.info.zone)}15;"
                                >{formatZoneDisplay(result.info)}</span>
                            {/if}
                            {#if result.info.contactlessOnly}
                              <span class="station-zone-badge small contactless-only-badge" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.15);"
                                >Contactless Only</span>
                            {/if}
                          </span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>

              {#if advancedMode && selectedOriginStation && selectedDestStation && selectedOriginStation.info.naptanId === selectedDestStation.info.naptanId}
                <div class="station-validation-error" style="color: var(--color-danger); font-size: 0.75rem; margin-top: -0.5rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.25rem;">
                  <span>⚠️ Origin and Destination stations cannot be the same.</span>
                </div>
              {/if}
            {:else}
              <!-- Standard Zone Selectors -->
              <div class="form-row grid grid-cols-1 xl:grid-cols-2 max-xl:gap-3">
                <div class="form-group">
                  <label class="setting-label" for="modal-origin-zone"
                    >Origin Zone</label
                  >
                  <select
                    class="input-field"
                    id="modal-origin-zone"
                    bind:value={newOriginZone}
                  >
                    {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as z}
                      <option value={z}>Zone {z}</option>
                    {/each}
                  </select>
                </div>
                <div class="form-group">
                  <label class="setting-label" for="modal-dest-zone"
                    >Destination Zone</label
                  >
                  <select
                    class="input-field"
                    id="modal-dest-zone"
                    bind:value={newDestZone}
                  >
                    {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as z}
                      <option value={z}>Zone {z}</option>
                    {/each}
                  </select>
                </div>
              </div>

              <div class="swap-stations-container" style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
                <button
                  type="button"
                  class="swap-stations-btn"
                  onclick={swapStations}
                  title="Swap Origin & Destination Zones"
                  aria-label="Swap Origin & Destination Zones"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="17 1 21 5 17 9"></polyline>
                    <line x1="3" y1="5" x2="21" y2="5"></line>
                    <polyline points="7 23 3 19 7 15"></polyline>
                    <line x1="21" y1="19" x2="3" y2="19"></line>
                  </svg>
                </button>
              </div>
            {/if}
          {/if}

          {#if newIntervalType !== "none"}
            <div class="form-group">
              <div class="setting-label">Days of Week</div>
              <div class="day-selector">
                {#each dayLabels as label, i}
                  <button
                    class="day-btn"
                    class:selected={newDays.includes(dayValues[i])}
                    onclick={() => toggleDay(dayValues[i])}
                  >
                    {label}
                  </button>
                {/each}
              </div>
            </div>

            <div class="form-row grid grid-cols-1 xl:grid-cols-2 max-xl:gap-3">
              <div class="form-group">
                <label class="setting-label" for="modal-interval-value"
                  >Repeat Every</label
                >
                <input
                  type="number"
                  class="input-field"
                  id="modal-interval-value"
                  bind:value={newIntervalValue}
                  min="1"
                  max="52"
                />
              </div>
              <div class="form-group">
                <label class="setting-label" for="modal-interval-type"
                  >Interval Type</label
                >
                <select
                  class="input-field"
                  id="modal-interval-type"
                  bind:value={newIntervalType}
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          {/if}

          <div class="form-group" style="margin-top: 0.5rem;">
            <div class="zone-preview">
              {#if newMode === "bus"}
                Flat Fare: <strong>£{estimatedTotalFare.toFixed(2)}</strong>
              {:else if !advancedMode}
                Fare zone: <strong
                  >{getZoneRange(newOriginZone, newDestZone)}</strong
                >
                <span style="margin: 0 0.5rem;">•</span>
                Estimated Fare:
                <strong>£{estimatedTotalFare.toFixed(2)}</strong>
              {:else if advancedFareLoading}
                <span class="fare-loading">
                  {#if activeRetryInfo}
                    {#if activeRetryInfo.status === 'timeout'}
                      ⏱️ Request timed out. Retrying attempt {activeRetryInfo.attempt + 1}/{activeRetryInfo.maxRetries}...
                    {:else if activeRetryInfo.status === 'retrying'}
                      🔄 Slow connection. Retrying TfL API (Attempt {activeRetryInfo.attempt}/{activeRetryInfo.maxRetries})...
                    {:else}
                      🔍 Querying TfL Live API (Attempt {activeRetryInfo.attempt}/{activeRetryInfo.maxRetries})...
                    {/if}
                  {:else}
                    🔍 Querying TfL Live API...
                  {/if}
                </span>
              {:else if selectedOriginStation && selectedDestStation && selectedOriginStation.info.naptanId !== selectedDestStation.info.naptanId && advancedFareResult}
                {@const fareResult = advancedFareResult}
                <div class="advanced-fare-preview-layout" style="display: flex; flex-direction: column; gap: 0.35rem; width: 100%;">
                  <div class="retrieved-fares-row" style="display: flex; align-items: center; gap: 0.3rem;">
                    {#if fareResult.isFromApi}
                      <span
                        class="fare-api-badge"
                        style="cursor: help;"
                        role="status"
                        onmouseenter={(e) => showFareTooltip(e.currentTarget, true, selectedBasePeakFare, selectedPeakFare, selectedBaseOffPeakFare, selectedOffPeakFare)}
                        onmouseleave={hideFareTooltip}
                      >✓ TfL API</span>
                    {:else}
                      <span
                        class="fare-fallback-badge"
                        style="cursor: help; background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.35); color: #f59e0b;"
                        role="status"
                        onmouseenter={(e) => showFareTooltip(e.currentTarget, false, selectedBasePeakFare, selectedPeakFare, selectedBaseOffPeakFare, selectedOffPeakFare)}
                        onmouseleave={hideFareTooltip}
                      >⚠️ Estimated</span>
                    {/if}
                    Peak: <strong>£{selectedPeakFare.toFixed(2)}</strong>
                    <span style="margin: 0 0.3rem; color: var(--color-text-muted);">|</span>
                    Off-Peak: <strong>£{selectedOffPeakFare.toFixed(2)}</strong>
                  </div>

                  {#if !fareResult.isFromApi && fareResult.reason}
                    <div class="fare-fallback-reason" style="font-size: 0.72rem; color: var(--color-danger); margin-top: 0.15rem; display: flex; align-items: center; gap: 0.2rem;">
                      {#if fareResult.reason === 'offline'}
                        <span>🔌 Network Offline — using local zone estimation.</span>
                      {:else if fareResult.reason === 'timeout'}
                        <span>⏱️ TfL request timed out — using local zone estimation.</span>
                      {:else if fareResult.reason === 'no_route'}
                        <span>🗺️ No direct TfL fares found — using local zone estimation.</span>
                      {:else}
                        <span>⚠️ TfL API lookup failed — using local zone estimation.</span>
                      {/if}
                    </div>
                  {/if}

                  {#if fareResult.isFromApi && fareResult.options && fareResult.options.length > 1}
                    <div class="route-select-wrapper" style="margin-top: 0.35rem;">
                      <span style="font-size: 0.8rem; color: var(--color-text-muted); display: block; margin-bottom: 0.25rem;">
                        Select Route / Alternative Fare:
                      </span>
                      <div class="route-options-list" style="display: flex; flex-direction: column; gap: 0.4rem; max-height: 180px; overflow-y: auto; padding-right: 0.25rem;">
                        {#each fareResult.options as opt, idx}
                          <button
                            type="button"
                            class="route-option-card"
                            style="display: flex; align-items: flex-start; text-align: left; width: 100%; padding: 0.5rem 0.65rem; border-radius: 8px; background: {selectedRouteIndex === idx ? 'rgba(0, 114, 206, 0.12)' : 'rgba(255, 255, 255, 0.02)'}; border: 1px solid {selectedRouteIndex === idx ? 'var(--color-oyster-blue)' : 'rgba(255, 255, 255, 0.08)'}; color: var(--color-text); cursor: pointer; transition: all 0.2s ease; gap: 0.5rem;"
                            onclick={() => {
                              selectedRouteIndex = idx;
                              handleRouteChoiceChange();
                            }}
                          >
                            <!-- Styled Radio indicator -->
                            <div style="width: 14px; height: 14px; border-radius: 50%; border: 1px solid {selectedRouteIndex === idx ? 'var(--color-oyster-blue)' : 'rgba(255, 255, 255, 0.25)'}; margin-top: 0.1rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: {selectedRouteIndex === idx ? 'var(--color-oyster-blue)' : 'transparent'};">
                              {#if selectedRouteIndex === idx}
                                <div style="width: 6px; height: 6px; border-radius: 50%; background: #fff;"></div>
                              {/if}
                            </div>
                            <!-- Route details -->
                            <div style="display: flex; flex-direction: column; gap: 0.1rem; flex: 1; min-width: 0;">
                              <div style="font-size: 0.78rem; font-weight: 500; line-height: 1.25; color: {selectedRouteIndex === idx ? '#fff' : 'var(--color-text-secondary)'}; word-break: break-word; overflow-wrap: break-word;">
                                {opt.routeDescription}
                              </div>
                              <div style="font-size: 0.72rem; color: var(--color-text-muted);">
                                Peak: <strong style="color: {selectedRouteIndex === idx ? '#fff' : 'var(--color-text)'};">£{opt.peak.toFixed(2)}</strong> <span style="margin: 0 0.15rem; opacity: 0.5;">•</span> Off-Peak: <strong style="color: {selectedRouteIndex === idx ? '#fff' : 'var(--color-text)'};">£{opt.offPeak.toFixed(2)}</strong>
                              </div>
                            </div>
                          </button>
                        {/each}
                      </div>
                    </div>
                  {:else if fareResult.isFromApi && fareResult.routeDescription && fareResult.routeDescription !== 'Default Route'}
                    <div class="route-desc-display" style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.25rem;">
                      Route: <span style="color: var(--color-text); font-style: italic;">{fareResult.routeDescription}</span>
                    </div>
                  {/if}

                  <div class="estimated-total-row" style="font-size: 0.9rem; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 0.35rem; margin-top: 0.15rem;">
                    {fareResult.isFromApi ? "Actual Fare" : "Estimated Fare"}: <strong>£{advancedTotalFare.toFixed(2)}</strong>
                  </div>
                </div>
              {:else if !selectedOriginStation || !selectedDestStation}
                <span
                  style="font-size: 0.75rem; color: var(--color-text-muted);"
                >
                  👉 Select origin and destination stations to retrieve live TfL
                  fare
                </span>
              {/if}
              {#if newIsReturn}
                <span
                  style="font-size: 0.75rem; color: var(--color-text-muted);"
                >
                  (includes return)</span
                >
              {/if}

              {#if advancedMode && newMode !== "bus" && (outsideZoneCapDetails.peak !== null || outsideZoneCapDetails.weekly !== null)}
                <div class="outside-zone-caps-preview">
                  <div class="outside-zone-caps-preview-title">
                    Outside Zone Station Caps ({FARE_TYPES[$selectedFareType].name})
                  </div>
                  <div class="outside-zone-caps-preview-grid">
                    {#if outsideZoneCapDetails.peak !== null}
                      <div class="outside-zone-caps-preview-item">
                        <span>Daily Peak Cap: <strong>£{outsideZoneCapDetails.peak.cap.toFixed(2)}</strong></span>
                        <span class="outside-zone-caps-station">({outsideZoneCapDetails.peak.stationName})</span>
                      </div>
                    {/if}
                    {#if outsideZoneCapDetails.offPeak !== null}
                      <div class="outside-zone-caps-preview-item">
                        <span>Daily Off-Peak Cap: <strong>£{outsideZoneCapDetails.offPeak.cap.toFixed(2)}</strong></span>
                        <span class="outside-zone-caps-station">({outsideZoneCapDetails.offPeak.stationName})</span>
                      </div>
                    {/if}
                    {#if outsideZoneCapDetails.weekly !== null}
                      <div class="outside-zone-caps-preview-item">
                        <span>Weekly Cap: <strong>£{outsideZoneCapDetails.weekly.cap.toFixed(2)}</strong></span>
                        <span class="outside-zone-caps-station">({outsideZoneCapDetails.weekly.stationName})</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}

              {#if advancedMode && newMode !== "bus" && $selectedFareType !== 'none' && ((selectedOriginStation?.info.contactlessOnly) || (selectedDestStation?.info.contactlessOnly))}
                <div class="warning-box" style="margin-top: 0.65rem; padding: 0.65rem; border-radius: 8px; background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.25); font-size: 0.78rem; color: #ef4444; line-height: 1.4;">
                  ⚠️ Elizabeth line stations west of Shenfield are contactless-only and do not accept concession/discount fares. Please change the fare type to Contactless (Adult) to use this station.
                </div>
              {/if}

              {#if advancedMode && newMode !== "bus" && (selectedOriginStation?.info.naptanId === '920GLGW0' || selectedDestStation?.info.naptanId === '920GLGW0')}
                <div class="warning-box" style="margin-top: 0.65rem; padding: 0.65rem; border-radius: 8px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); font-size: 0.78rem; color: #f59e0b; line-height: 1.4;">
                  ℹ️ Gatwick Airport fares calculated using standard Southern / Thameslink rates. Gatwick Express services are excluded from capping and this planner.
                </div>
              {/if}
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            class="btn-secondary"
            onclick={() => (showRecurrenceModal = false)}>Cancel</button
          >
          <button
            class="btn-primary"
            onclick={saveRule}
            disabled={(newIntervalType !== "none" && newDays.length === 0) || (advancedMode && newMode !== "bus" && (!selectedOriginStation || !selectedDestStation || selectedOriginStation.info.naptanId === selectedDestStation.info.naptanId || ($selectedFareType !== 'none' && (selectedOriginStation.info.contactlessOnly || selectedDestStation.info.contactlessOnly))))}
            >{editRuleId ? "Save Routine" : "Add Routine"}</button
          >
        </div>
      </div>
    </div>
  {/if}
</div>

{#if fareTooltipData && fareTooltipData.visible}
  <div
    class="fare-hovercard"
    style="position: fixed; left: {fareTooltipData.x}px; top: {fareTooltipData.y}px; transform: translate(-50%, -100%) translateY(-10px); z-index: 99999;"
    class:api-theme={fareTooltipData.isApi}
    class:estimate-theme={!fareTooltipData.isApi}
  >
    <div class="hovercard-header">
      <span class="hovercard-title">Fare Details</span>
      <span class="hovercard-source" class:api={fareTooltipData.isApi}>
        {fareTooltipData.isApi ? "TfL Live" : "Estimated"}
      </span>
    </div>
    
    <div class="hovercard-divider"></div>
    
    <div class="hovercard-grid">
      <div class="hovercard-row">
        <span class="hovercard-label">Peak:</span>
        <span class="hovercard-value">
          {#if fareTooltipData.peakDiscounted !== fareTooltipData.peakBase}
            <span class="base-val">£{fareTooltipData.peakBase.toFixed(2)}</span>
            <span class="arrow-icon">→</span>
            <span class="disc-val">£{fareTooltipData.peakDiscounted.toFixed(2)}</span>
          {:else}
            <span class="disc-val">£{fareTooltipData.peakBase.toFixed(2)}</span>
          {/if}
        </span>
      </div>
      
      <div class="hovercard-row">
        <span class="hovercard-label">Off-Peak:</span>
        <span class="hovercard-value">
          {#if fareTooltipData.offPeakDiscounted !== fareTooltipData.offPeakBase}
            <span class="base-val">£{fareTooltipData.offPeakBase.toFixed(2)}</span>
            <span class="arrow-icon">→</span>
            <span class="disc-val">£{fareTooltipData.offPeakDiscounted.toFixed(2)}</span>
          {:else}
            <span class="disc-val">£{fareTooltipData.offPeakBase.toFixed(2)}</span>
          {/if}
        </span>
      </div>
      
      <div class="hovercard-row">
        <span class="hovercard-label">Card/Discount:</span>
        <span class="hovercard-value text-highlight">{fareTooltipData.cardName}</span>
      </div>
    </div>
  </div>
{/if}

<svelte:window onclick={() => { hideWarningTooltip(); hideWeeklyCapTooltip(); hideFareTooltip(); hideOddPeriodTooltip(); }} />

{#if oddPeriodTooltipData && oddPeriodTooltipData.visible}
  <div
    class="odd-period-hovercard warning-hovercard"
    style="position: fixed; left: {oddPeriodTooltipData.x}px; top: {oddPeriodTooltipData.y}px; transform: translate(-50%, -100%) translateY(-10px); z-index: 99999; border-top-color: #fb923c;"
  >
    <div class="warning-header">
      <span class="warning-title-wrapper" style="color: #fb923c;">
        <span class="warning-icon">ℹ️</span>
        <span class="warning-title" style="color: #fb923c;">What is an Odd-Period Travelcard?</span>
      </span>
    </div>
    <div class="hovercard-divider warning-divider" style="border-top-color: rgba(251, 146, 60, 0.2);"></div>
    <div class="warning-body" style="font-size: 0.8rem; line-height: 1.45; color: var(--color-text-secondary);">
      <p style="margin: 0 0 0.5rem 0;">
        TfL allows purchasing Travelcards for any custom duration between 1 month and 1 year (e.g., 1 month + 10 days). It is priced at the standard monthly rate for the whole months, plus a daily rate of 1/30th of the monthly cost for each additional day, rounded up to the nearest 10p.
      </p>
      <p style="margin: 0; font-size: 0.725rem; color: var(--color-text-muted);">
        OysterSavings automatically compares this custom odd-period ticket against alternative weekly combinations and PAYG options to ensure you get the absolute cheapest projection.
      </p>
    </div>
  </div>
{/if}

{#if weeklyCapTooltipData && weeklyCapTooltipData.visible}
  {@const week = weeklyCapTooltipData.week}
  {@const progress = Math.min(week.totalFareFareType / (week.fareTypeWeeklyCap || week.weeklyCap), 1)}
  <div
    class="weekly-cap-hovercard"
    style="position: fixed; left: {weeklyCapTooltipData.x}px; top: {weeklyCapTooltipData.y}px; transform: translate(-50%, -100%) translateY(-10px); z-index: 99999;"
  >
    <div class="hovercard-header">
      <span class="hovercard-title">Weekly Cap Details</span>
      {#if week.capHit}
        <span class="hovercard-status-badge capped">Capped ✓</span>
      {:else}
        <span class="hovercard-status-badge progress">In Progress</span>
      {/if}
    </div>
    
    <div class="hovercard-divider"></div>
    
    <div class="hovercard-body">
      <div class="weekly-metric-row">
        <div class="weekly-metric">
          <span class="metric-label">Cap Limit</span>
          <span class="metric-value">£{(week.fareTypeWeeklyCap || week.weeklyCap).toFixed(2)}</span>
        </div>
        <div class="weekly-metric">
          <span class="metric-label">Current Spend</span>
          <span class="metric-value text-highlight">£{week.totalFareFareType.toFixed(2)}</span>
        </div>
      </div>

      <div class="progress-track-wrapper">
        <div class="progress-track-bar">
          <div 
            class="progress-track-fill" 
            style="width: {progress * 100}%; background: {week.capHit ? 'var(--color-success)' : progress >= 0.7 ? 'var(--color-warning)' : 'var(--color-oyster-blue)'};"
          ></div>
        </div>
        <span class="progress-percentage">{Math.round(progress * 100)}%</span>
      </div>

      <div class="hovercard-info-section">
        {#if week.widestCapStation}
          <div class="info-row">
            <span class="info-label">Determining Station:</span>
            <span class="info-value oz-station">📍 {week.widestCapStation} (Outside Zone)</span>
          </div>
        {:else}
          <div class="info-row">
            <span class="info-label">Active Zones:</span>
            <span class="info-value" style="color: {week.maxRange ? getZoneColor(week.maxRange) : 'var(--color-text-secondary)'};">
              🚇 {week.maxRange ? 'Zone ' + week.maxRange.replaceAll('Z', '') : 'Bus Only'}
            </span>
          </div>
        {/if}
      </div>

      <div class="stations-visited-section">
        <span class="section-title">Stations Visited</span>
        <div class="stations-pills-list">
          {#if week.stationsVisited && week.stationsVisited.length > 0}
            {#each week.stationsVisited as name}
              {@const isOz = week.outsideZoneStations?.includes(name)}
              <span class="station-pill" class:outside-zone={isOz}>
                {name}
                {#if isOz}
                  <span class="oz-badge">OZ</span>
                {/if}
              </span>
            {/each}
          {:else}
            <span class="no-stations">No rail stations visited</span>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

{#if warningTooltipData && warningTooltipData.visible}
  <div
    class="warning-hovercard"
    style="position: fixed; left: {warningTooltipData.x}px; top: {warningTooltipData.y}px; transform: translate(-50%, -100%) translateY(-10px); z-index: 99999;"
  >
    {#if warningTooltipData.type === 'concession-disabled'}
      <div class="warning-header">
        <span class="warning-title-wrapper">
          <span class="warning-icon">🚫</span>
          <span class="warning-title">{warningTooltipData.title || "Concession Disabled"}</span>
        </span>
        <span class="warning-tag">Restriction</span>
      </div>
      <div class="hovercard-divider warning-divider"></div>
      <div class="warning-body">
        <p class="warning-desc">{warningTooltipData.text}</p>
        <div class="warning-notice-box">
          <span class="notice-bullet">💡</span>
          <span class="notice-text">TfL concession rates do not apply on contactless-only station terminals. Switch to <strong>Adult</strong> to enable.</span>
        </div>
      </div>
    {:else}
      <div style="font-size: 0.72rem; line-height: 1.35; color: #fff; font-weight: 500; font-family: var(--font-sans);">
        {@html warningTooltipData.text}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Weekly cap premium hovercard */
  .weekly-cap-hovercard {
    background: linear-gradient(135deg, rgba(10, 14, 26, 0.99), rgba(17, 24, 39, 0.99));
    border: 1px solid var(--color-border);
    border-top: 3px solid var(--color-oyster-blue);
    border-radius: 12px;
    padding: 1rem 1.2rem;
    width: 320px;
    max-width: 380px;
    box-shadow: 0 12px 35px -8px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    pointer-events: none;
    transition: opacity 0.15s ease, transform 0.15s ease;
    font-family: var(--font-sans);
    color: #fff;
  }

  .weekly-cap-hovercard::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px;
    border-style: solid;
    border-color: rgba(17, 24, 39, 0.99) transparent transparent transparent;
  }

  .hovercard-status-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .hovercard-status-badge.capped {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }
  .hovercard-status-badge.progress {
    background: rgba(0, 159, 227, 0.15);
    border: 1px solid rgba(0, 159, 227, 0.3);
    color: #009FE3;
  }

  .weekly-metric-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin: 0.8rem 0;
  }
  .weekly-metric {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .metric-label {
    font-size: 0.65rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin-bottom: 0.15rem;
  }
  .metric-value {
    font-size: 1.1rem;
    font-weight: 800;
  }

  .progress-track-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
  }
  .progress-track-bar {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-track-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .progress-percentage {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    min-width: 28px;
    text-align: right;
  }

  .hovercard-info-section {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 0.5rem 0.7rem;
    margin-bottom: 0.8rem;
  }
  .info-row {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .info-label {
    font-size: 0.65rem;
    color: var(--color-text-muted);
  }
  .info-value {
    font-size: 0.75rem;
    font-weight: 600;
  }
  .info-value.oz-station {
    color: #fbbf24;
  }

  .stations-visited-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .stations-visited-section .section-title {
    font-size: 0.65rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .stations-pills-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    max-height: 95px;
    overflow-y: auto;
    padding-right: 0.2rem;
  }
  .station-pill {
    font-size: 0.68rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.15rem 0.4rem;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.9);
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .station-pill.outside-zone {
    border-color: rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.05);
    color: #fbbf24;
  }
  .oz-badge {
    font-size: 0.5rem;
    font-weight: 800;
    background: #f59e0b;
    color: #000;
    padding: 0 0.2rem;
    border-radius: 3px;
  }
  .no-stations {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* Student Oyster Comparison Styles */
  .student-comparison-card {
    border: 1px dashed rgba(0, 159, 227, 0.3);
  }

  .comparison-card-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #f1f5f9;
    margin-bottom: 0.5rem;
  }

  .comparison-card-subtitle {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin-bottom: 1rem;
  }

  .comparison-table-wrapper {
    overflow-x: auto;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  .comparison-table th,
  .comparison-table td {
    padding: 0.625rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .comparison-table th {
    font-weight: 600;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.02);
  }

  .comparison-table tr:hover td {
    background: rgba(255, 255, 255, 0.01);
  }

  .text-right {
    text-align: right;
  }

  .font-mono {
    font-family: monospace;
  }

  .font-semibold {
    font-weight: 600;
  }

  .font-medium {
    font-weight: 500;
  }

  .text-muted {
    color: var(--color-text-muted);
  }

  .strike-through {
    text-decoration: line-through;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-left: 0.25rem;
  }

  .save-tag {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-block;
  }

  .extra-tag {
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text-secondary);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    display: inline-block;
  }

  .cheapest-highlight td {
    background: rgba(16, 185, 129, 0.05) !important;
  }

  .cheapest-highlight {
    border-left: 3px solid #10b981;
  }

  .best-value-badge {
    background: #10b981;
    color: #064e3b;
    padding: 0.125rem 0.35rem;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    margin-left: 0.5rem;
    display: inline-block;
    text-transform: uppercase;
  }

  .dot-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 0.375rem;
  }

  .planner-page {
    max-width: 100%;
    margin: 0 auto;
  }

  .planner-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }



  .station-selected-display {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.75rem;
    padding-right: 2rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--color-border-accent);
    border-radius: 8px;
    cursor: pointer;
    min-height: 2.35rem;
    font-size: 0.85rem;
    color: #f1f5f9;
    transition: border-color 0.15s ease;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .station-selected-display:hover {
    border-color: var(--color-oyster-blue);
  }

  .station-display-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
    min-width: 0;
  }

  .station-option-meta {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
    margin-left: 0.25rem;
  }

  /* Sidebar */
  .sidebar-section {
    padding: 1.25rem;
    margin-bottom: 1rem;
  }
  .sidebar-title {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .date-inputs {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .setting-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .empty-text {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .rule-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .rule-name {
    font-size: 0.8rem;
    font-weight: 600;
  }
  .rule-detail {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    margin-top: 0.125rem;
  }

  .rule-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .rule-edit,
  .rule-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .rule-edit {
    border: 1px solid rgba(0, 159, 227, 0.3);
    background: rgba(0, 159, 227, 0.08);
    color: var(--color-oyster-blue);
  }

  .rule-edit:hover {
    background: var(--color-oyster-blue);
    border-color: var(--color-oyster-blue);
    color: #ffffff;
    transform: scale(1.1) translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 159, 227, 0.4);
  }

  .rule-remove {
    border: 1px solid rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.08);
    color: var(--color-danger);
  }

  .rule-remove:hover {
    background: var(--color-danger);
    border-color: var(--color-danger);
    color: #ffffff;
    transform: scale(1.1) translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  }

  /* Station Swap Container & Button */
  .swap-stations-container {
    display: flex;
    justify-content: center;
    margin: -0.4rem 0 -0.4rem 0;
    position: relative;
    z-index: 2;
  }
  .swap-stations-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .swap-stations-btn:hover {
    background: rgba(0, 159, 227, 0.12);
    border-color: rgba(0, 159, 227, 0.35);
    color: var(--color-oyster-blue);
    transform: translateY(-1px) scale(1.05);
  }
  .swap-stations-btn svg {
    transition: transform 0.3s ease;
  }
  .swap-stations-btn:hover svg {
    transform: rotate(180deg);
  }

  .pattern-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    gap: 0.5rem;
  }

  .pattern-route {
    font-size: 0.75rem;
    font-weight: 600;
  }
  .pattern-detail {
    font-size: 0.65rem;
    color: var(--color-text-muted);
    margin-top: 0.125rem;
  }

  .forecast-summary {
    border-color: rgba(16, 185, 129, 0.2);
    margin-bottom: 1.25rem;
  }
  .forecast-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: none;
    padding: 0;
    margin: 0;
    text-align: center;
  }
  .forecast-stat.highlight {
    background: transparent;
  }
  .forecast-label {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    font-weight: 600;
    white-space: nowrap;
  }
  .forecast-value {
    font-weight: 600;
    font-family: monospace;
    font-size: 2rem;
  }
  .forecast-value.green {
    color: #34d399;
  }
  .forecast-value.large {
    font-size: 2.5rem;
    font-weight: 900;
  }

  /* Calendar area */
  .calendar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .calendar-month-label {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .calendar-cell.has-journeys {
    background: rgba(0, 159, 227, 0.04);
    border-color: rgba(0, 159, 227, 0.15);
  }

  .calendar-cell.in-planning-period {
    background: rgba(0, 159, 227, 0.05) !important;
    border: 1.5px dashed rgba(0, 159, 227, 0.35) !important;
  }

  .day-journey-count {
    font-size: 0.65rem;
    color: var(--color-oyster-blue);
    font-weight: 500;
  }

  .day-spend {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-top: 0.125rem;
  }

  .mini-cap-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 0.25rem;
  }

  .mini-cap-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .cap-hit-label {
    font-size: 0.55rem;
    color: #34d399;
    font-weight: 700;
    margin-top: 0.125rem;
    text-transform: uppercase;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 1rem;
  }

  .modal-content {
    max-width: 650px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .modal-close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
  }

  .modal-body {
    padding: 1.5rem;
  }
  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .form-group {
    margin-bottom: 1rem;
  }


  .day-selector {
    display: flex;
    gap: 0.375rem;
  }
  .day-btn {
    flex: 1;
    padding: 0.5rem 0;
    border-radius: 8px;
    font-size: 0.7rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .day-btn:hover {
    border-color: var(--color-border-accent);
  }
  .day-btn.selected {
    background: rgba(0, 159, 227, 0.15);
    border-color: rgba(0, 159, 227, 0.4);
    color: var(--color-oyster-blue);
  }

  .zone-preview {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.03);
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
  }

  /* Advanced Mode: Station Autocomplete */
  .station-autocomplete {
    position: relative;
    max-width: 480px;
  }

  .station-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 100;
    list-style: none;
    padding: 0;
    margin: 2px 0 0 0;
    background: rgba(20, 24, 35, 0.98);
    border: 1px solid var(--color-border-accent);
    border-radius: 8px;
    max-height: 240px;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(12px);
  }

  .station-dropdown li {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .station-dropdown li:last-child {
    border-bottom: none;
  }

  .station-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    color: #f1f5f9;
    cursor: pointer;
    font-size: 0.82rem;
    text-align: left;
    transition: background 0.15s ease;
  }

  .station-option:hover {
    background: rgba(0, 159, 227, 0.12);
  }

  .station-name {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
    min-width: 0;
  }

  .station-meta {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    flex-shrink: 0;
    margin-left: 0.5rem;
  }

  .station-selected-info {
    display: flex;
    gap: 0.3rem;
    margin-top: 0.35rem;
    flex-wrap: wrap;
  }

  .station-zone-badge {
    font-size: 0.7rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: rgba(0, 159, 227, 0.15);
    color: var(--color-oyster-blue);
    font-weight: 600;
    white-space: nowrap;
  }

  .station-zone-badge.small {
    font-size: 0.65rem;
    padding: 0.1rem 0.3rem;
  }

  .station-mode-badge {
    font-size: 0.65rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .station-mode-badge.small {
    font-size: 0.6rem;
    padding: 0.1rem 0.3rem;
  }

  /* Station input wrapper for clear button positioning */
  .station-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .station-input-wrapper .input-field {
    padding-right: 2rem;
  }

  .station-clear-btn {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: var(--color-text-muted);
    font-size: 0.7rem;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    line-height: 1;
    padding: 0;
  }

  .station-clear-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  /* Inline transport mode roundel SVG icons */
  .mode-icon-inline {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    vertical-align: middle;
    opacity: 0.9;
    transition: opacity 0.15s ease;
  }

  .mode-icon-inline:hover {
    opacity: 1;
  }

  .mode-icon-inline.small {
    width: 14px;
    height: 14px;
  }

  .mini-sync-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 700;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .mini-sync-toggle:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: var(--color-border-accent);
    color: white;
  }

  .mini-sync-toggle.active {
    background: rgba(0, 159, 227, 0.12);
    border-color: rgba(0, 159, 227, 0.35);
    color: var(--color-oyster-blue);
  }

  .mini-sync-toggle.active:hover {
    background: rgba(0, 159, 227, 0.2);
    border-color: rgba(0, 159, 227, 0.5);
    color: #38bdf8;
    box-shadow: 0 0 8px rgba(0, 159, 227, 0.15);
  }

  .mini-sync-toggle .sync-icon {
    font-size: 0.65rem;
  }

  .mini-sync-toggle:active {
    transform: scale(0.95);
  }

  /* Custom premium fare hovercard tooltip */
  .fare-hovercard {
    background: linear-gradient(135deg, rgba(10, 14, 26, 0.98), rgba(17, 24, 39, 0.98));
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 0.85rem 1.15rem;
    min-width: 320px;
    max-width: 420px;
    width: max-content;
    box-shadow: 0 12px 30px -8px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    pointer-events: none; /* so mouse doesn't get stuck */
    transition: opacity 0.15s ease, transform 0.15s ease;
    font-family: var(--font-sans);
  }

  .warning-hovercard {
    background: linear-gradient(135deg, rgba(30, 10, 10, 0.99), rgba(17, 24, 39, 0.99));
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-top: 3px solid #ef4444; /* Red warning accent */
    border-radius: 12px;
    padding: 0.9rem 1.1rem;
    width: 300px;
    max-width: 350px;
    box-shadow: 0 12px 35px -8px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    pointer-events: none;
    transition: opacity 0.15s ease, transform 0.15s ease;
    font-family: var(--font-sans);
    color: #fff;
  }

  .warning-hovercard::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px;
    border-style: solid;
    border-color: rgba(17, 24, 39, 0.99) transparent transparent transparent;
  }

  .info-badge-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--color-text-secondary);
    font-size: 0.65rem;
    font-weight: 700;
    font-family: serif;
    cursor: pointer;
    margin-left: 0.35rem;
    vertical-align: middle;
    transition: all 0.2s ease;
    padding: 0;
    line-height: 1;
  }

  .info-badge-btn:hover {
    background: var(--color-oyster-blue);
    border-color: var(--color-oyster-blue);
    color: white;
  }

  .odd-period-hovercard {
    background: linear-gradient(135deg, rgba(24, 15, 10, 0.99), rgba(17, 24, 39, 0.99)) !important;
    border: 1px solid rgba(251, 146, 60, 0.25) !important;
    border-top: 3px solid #fb923c !important;
  }

  .odd-period-hovercard::after {
    border-color: rgba(17, 24, 39, 0.99) transparent transparent transparent !important;
  }

  .warning-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }
  .warning-title-wrapper {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .warning-icon {
    font-size: 0.85rem;
  }
  .warning-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #f87171;
  }
  .warning-tag {
    font-size: 0.55rem;
    font-weight: 800;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    text-transform: uppercase;
  }

  .warning-divider {
    background: rgba(239, 68, 68, 0.15) !important;
    margin: 0.5rem 0 !important;
  }

  .warning-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .warning-desc {
    font-size: 0.7rem;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
  }
  .warning-notice-box {
    display: flex;
    gap: 0.35rem;
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.12);
    border-radius: 8px;
    padding: 0.45rem 0.6rem;
  }
  .notice-bullet {
    font-size: 0.7rem;
  }
  .notice-text {
    font-size: 0.65rem;
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.75);
  }

  .rule-card.disabled {
    opacity: 0.75;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.25) !important;
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    margin: 0.5rem 0;
    box-shadow: inset 0 0 10px rgba(239, 68, 68, 0.03);
  }

  .disabled-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #f87171;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    width: max-content;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  }

  .fare-source-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    width: max-content;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  }

  .fare-source-badge.live {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34d399;
  }

  .fare-source-badge.estimate {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .rule-syncing-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
    background: rgba(0, 159, 227, 0.08);
    border: 1px solid rgba(0, 159, 227, 0.2);
    color: #60a5fa;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    width: max-content;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  }

  .cap-hit-label.bus {
    color: #f87171;
  }

  .rule-card .fare-source-badge {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease-in-out;
  }

  .rule-card:hover .fare-source-badge {
    opacity: 1;
    pointer-events: auto;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr) var(--cap-col-width, 52px) !important;
    gap: 2px;
  }
  .calendar-grid.hide-cap-column {
    grid-template-columns: repeat(7, 1fr) !important;
  }

  .calendar-weekly-cap-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.015);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.35rem 0.15rem;
    min-height: 80px;
    position: relative;
    cursor: help;
    transition: all 0.2s ease;
  }

  .calendar-weekly-cap-cell:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.18);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .weekly-spend-label {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    margin-bottom: 0.25rem;
    text-align: center;
  }

  .weekly-progress-container {
    width: 6px;
    height: 36px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .weekly-progress-fill {
    width: 100%;
    border-radius: 3px;
    transition: height 0.3s ease;
  }

  .weekly-cap-hit-tag {
    font-size: 0.5rem;
    color: #10b981;
    font-weight: 700;
    margin-top: 0.25rem;
    text-transform: uppercase;
    text-align: center;
  }

  @media (max-width: 768px) {
    .fare-hovercard, .weekly-cap-hovercard, .warning-hovercard, .odd-period-hovercard {
      width: calc(100vw - 24px) !important;
      max-width: 340px !important;
    }
    .fare-hovercard::after, .weekly-cap-hovercard::after, .warning-hovercard::after, .odd-period-hovercard::after {
      display: none !important;
    }
  }

  /* Theme borders */
  .fare-hovercard.api-theme {
    border-top: 3px solid var(--color-success); /* TfL API Emerald accent */
  }

  .fare-hovercard.estimate-theme {
    border-top: 3px solid var(--color-warning); /* Zone Estimate Amber accent */
  }

  .hovercard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .hovercard-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
  }

  .hovercard-source {
    font-size: 0.6rem;
    font-weight: 600;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    background: rgba(245, 158, 11, 0.15);
    color: var(--color-warning);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .hovercard-source.api {
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
  }

  .hovercard-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0.4rem 0;
  }

  .hovercard-grid {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .hovercard-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.775rem;
    gap: 1.5rem;
  }

  .hovercard-label {
    color: var(--color-text-secondary);
    font-weight: 500;
    flex-shrink: 0;
  }

  .hovercard-value {
    color: var(--color-text-primary);
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .base-val {
    color: var(--color-text-muted);
    text-decoration: line-through;
    opacity: 0.8;
  }

  .arrow-icon {
    color: var(--color-text-muted);
    font-size: 0.7rem;
  }

  .disc-val {
    color: var(--color-text-primary);
    font-weight: 700;
  }

  .api-theme .disc-val {
    color: #34d399; /* lighter green for readability */
  }

  .estimate-theme .disc-val {
    color: #fbbf24; /* lighter yellow for readability */
  }

  .text-highlight {
    font-weight: 600;
    font-size: 0.75rem;
    color: var(--color-text-primary);
    max-width: 240px;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Downward arrow indicator */
  .fare-hovercard::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px;
    border-style: solid;
    border-color: rgba(17, 24, 39, 0.98) transparent transparent transparent;
  }

  .fare-loading {
    color: var(--color-text-muted);
    font-style: italic;
    animation: pulse-fade 1.5s ease-in-out infinite;
  }

  @keyframes pulse-fade {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }

  .fare-api-badge {
    display: inline-block;
    font-size: 0.65rem;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    font-weight: 600;
    margin-right: 0.3rem;
  }

  .fare-fallback-badge {
    display: inline-block;
    font-size: 0.65rem;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    font-weight: 600;
    margin-right: 0.3rem;
  }

  /* Segmented control for Advanced Mode binary toggle */
  .segmented-control {
    display: flex;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 3px;
    gap: 4px;
    margin-top: 0.25rem;
  }

  .segment-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    border-radius: 7px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .segment-btn:hover:not(.active) {
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.03);
  }

  .segment-btn.active {
    color: white;
    background: linear-gradient(135deg, #009fe3 0%, #0078ab 100%);
    box-shadow: 0 2px 10px rgba(0, 159, 227, 0.25);
  }

  .segment-btn .btn-icon {
    font-size: 1rem;
  }

  /* Checkbox and field alignments */
  .checkbox-field {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    min-height: 38px;
    height: auto;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    width: 100%;
  }

  .checkbox-field:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .checkbox-field.active {
    border-color: var(--color-oyster-blue);
    background: rgba(0, 159, 227, 0.05);
  }

  .checkbox-field input {
    display: none;
  }

  .checkbox-field .checkmark {
    width: 1.125rem;
    height: 1.125rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.02);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    position: relative;
    flex-shrink: 0;
  }

  .checkbox-field:hover .checkmark {
    border-color: rgba(0, 159, 227, 0.5);
  }

  .checkbox-field input:checked + .checkmark {
    background: var(--color-oyster-blue);
    border-color: var(--color-oyster-blue);
    box-shadow: 0 0 8px rgba(0, 159, 227, 0.4);
  }

  .checkbox-field input:checked + .checkmark::after {
    content: "";
    width: 0.25rem;
    height: 0.45rem;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    position: absolute;
    top: 3px;
    left: 6px;
  }

  .checkbox-text {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    transition: color 0.2s ease;
    line-height: 1.35;
  }

  .checkbox-field.active .checkbox-text {
    color: var(--color-text-primary);
  }

  .input-field:disabled {
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.04);
    color: var(--color-text-muted);
  }
  .hidden-field {
    opacity: 0.35;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }
  .calendar-cell {
    position: relative;
  }

  .clear-day-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 0.55rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s ease;
    z-index: 5;
    padding: 0;
    line-height: 1;
  }

  .calendar-cell:hover .clear-day-btn {
    opacity: 1;
  }

  .clear-day-btn:hover {
    background: rgba(239, 68, 68, 0.35);
    border-color: rgba(239, 68, 68, 0.6);
    color: #ffffff;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
    transform: scale(1.1);
  }

  .mobile-layout-add-btn {
    display: none !important;
  }

  .mobile-tabs-container {
    gap: 0.5rem;
    padding: 0.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    margin-bottom: 1.25rem;
    backdrop-filter: blur(12px);
  }
  .mobile-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.6rem;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s ease;
    font-family: inherit;
  }
  .mobile-tab:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.05);
  }
  .mobile-tab.active {
    background: var(--color-oyster-blue);
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(0, 159, 227, 0.3);
  }

  /* Transition overlay styling */
  .mode-transition-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(10, 14, 26, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .transition-card {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.5rem 2rem;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.3);
    max-width: 320px;
    width: 85%;
    animation: zoomIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .transition-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: white;
    margin-top: 1rem;
    letter-spacing: -0.01em;
  }

  .transition-subtitle {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-top: 0.35rem;
  }

  /* TfL Roundel Animation */
  .transition-roundel {
    position: relative;
    width: 48px;
    height: 48px;
    margin: 0 auto;
    animation: pulseScale 1.2s ease-in-out infinite;
  }

  .roundel-ring {
    width: 100%;
    height: 100%;
    border: 6px solid var(--color-oyster-blue);
    border-radius: 50%;
    box-sizing: border-box;
  }

  .roundel-bar {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 120%;
    height: 8px;
    background: #e62227; /* TfL Red bar */
    border-radius: 1px;
    box-shadow: 0 0 6px rgba(230, 34, 39, 0.4);
  }

  @keyframes zoomIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes pulseScale {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
      opacity: 0.95;
    }
  }

  /* Preset Date Buttons */
  .preset-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.65rem;
    width: 100%;
  }

  .btn-preset {
    flex: 1 0 calc(20% - 0.35rem);
    min-width: 42px;
    padding: 0.35rem 0.25rem;
    border-radius: 6px;
    font-size: 0.675rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--color-border);
    cursor: pointer;
    text-align: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .btn-preset:hover {
    color: white;
    background: rgba(0, 159, 227, 0.1);
    border-color: rgba(0, 159, 227, 0.4);
    box-shadow: 0 0 10px rgba(0, 159, 227, 0.15);
  }

  .btn-preset:active {
    transform: scale(0.95);
  }

  .outside-zone-caps-preview {
    font-size: 0.8rem;
    background: var(--color-bg-glass);
    border: 1px solid var(--color-border);
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    margin-top: 0.65rem;
  }

  .outside-zone-caps-preview-title {
    font-weight: 600;
    color: white;
    margin-bottom: 0.35rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    padding-bottom: 0.25rem;
  }

  .outside-zone-caps-preview-grid {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .outside-zone-caps-preview-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--color-text-secondary);
  }

  .outside-zone-caps-station {
    color: var(--color-text-muted);
    font-size: 0.72rem;
  }
</style>

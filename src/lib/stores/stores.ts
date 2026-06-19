import { writable, derived, get } from 'svelte/store';
import type { CapSummary, DayCapResult, WeekCapResult } from '../engine/capEngine';
import type { ParsedJourney } from '../engine/csvParser';
import type { FareResult } from '../engine/fareCalculator';
import type { ForecastResult } from '../engine/forecastEngine';
import type { ClassifiedJourney } from '../engine/journeyClassifier';
import type { ExcludedJourney } from '../engine/journeyFilter';
import type { DetectedPattern, PlannedJourney, RecurrenceRule } from '../engine/recurrenceEngine';
import { calculateProductComparison, calculateFareTypeSavings, detectActiveDiscount, type ProductComparisonResult, type FareTypeSavingsResult } from '../engine/savingsEngine';
import type { FareType } from '../data/fareData';
import type { CardState, MultiCardClassifiedJourney } from './cardTypes';
import { CARD_COLORS, MAX_CARDS, generateCardId, generateCardName } from './cardTypes';
import { filterJourneys, getFilterSummary } from '../engine/journeyFilter';
import { classifyAll } from '../engine/journeyClassifier';
import { calculateAllFares } from '../engine/fareCalculator';
import { calculateDailyCaps, calculateWeeklyCaps, getCapSummary } from '../engine/capEngine';
import { detectCommutePatterns } from '../engine/recurrenceEngine';

// ──────────────────────────────────────────────────────────────
// Multi-card core stores
// ──────────────────────────────────────────────────────────────

/** All loaded cards */
export const cards = writable<CardState[]>([]);

/** Active card ID — 'combined' shows aggregated data */
export const activeCardId = writable<string>('combined');

/** "What-If" fare type override for Combined view */
export const combinedFareTypeOverride = writable<FareType>('none');

/** Re-export multi-card types and constants */
export { CARD_COLORS, MAX_CARDS, generateCardId, generateCardName };
export type { CardState, MultiCardClassifiedJourney };

// ──────────────────────────────────────────────────────────────
// Card CRUD helpers
// ──────────────────────────────────────────────────────────────

/** Add a new card to the deck */
export function addCard(card: CardState): void {
  cards.update(c => [...c, card]);
  activeCardId.set(card.id);
}

/** Remove a card by ID */
export function removeCard(cardId: string): void {
  cards.update(c => {
    const filtered = c.filter(card => card.id !== cardId);
    return filtered;
  });
  // If the removed card was active, switch to combined or first remaining
  const currentActive = get(activeCardId);
  if (currentActive === cardId) {
    const remaining = get(cards);
    if (remaining.length === 0) {
      activeCardId.set('combined');
    } else if (remaining.length === 1) {
      activeCardId.set(remaining[0].id);
    } else {
      activeCardId.set('combined');
    }
  }
}

/** Update a specific card's properties */
export function updateCard(cardId: string, updates: Partial<CardState>): void {
  cards.update(c => c.map(card =>
    card.id === cardId ? { ...card, ...updates } : card
  ));
}

/** Merge new journeys into an existing card, deduplicate, and re-run the pipeline.
 *  Returns the number of duplicates removed. */
export function mergeIntoCard(cardId: string, newRawJourneys: ParsedJourney[]): number {
  const allCards = get(cards);
  const card = allCards.find(c => c.id === cardId);
  if (!card) return 0;

  // Combine old + new raw journeys
  const combined = [...card.rawJourneys, ...newRawJourneys];

  // Deduplicate: same date string, start time, journey/action, and charge
  const seen = new Set<string>();
  const deduped: ParsedJourney[] = [];
  for (const j of combined) {
    const key = `${j.dateStr}|${j.startTime}|${j.journeyAction}|${j.charge}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(j);
    }
  }
  const duplicatesRemoved = combined.length - deduped.length;

  // Re-run filter → classify → fares → caps pipeline
  const filtered = filterJourneys(deduped);
  const classified = classifyAll(filtered.valid);
  const fares = calculateAllFares(classified);
  const dailyCaps = calculateDailyCaps(fares);
  const weeklyCaps = calculateWeeklyCaps(dailyCaps);
  const capSummaryResult = getCapSummary(dailyCaps, weeklyCaps);
  const patterns = detectCommutePatterns(classified);
  const detectedDiscount = detectActiveDiscount(classified);

  updateCard(cardId, {
    rawJourneys: deduped,
    validJourneys: filtered.valid,
    excludedJourneys: filtered.excluded,
    classifiedJourneys: classified,
    fareResults: fares,
    dailyCapResults: dailyCaps,
    weeklyCapResults: weeklyCaps,
    capSummary: capSummaryResult,
    detectedPatterns: patterns,
    detectedDiscount,
    duplicatesRemoved: card.duplicatesRemoved + duplicatesRemoved,
  });

  return duplicatesRemoved;
}

// ──────────────────────────────────────────────────────────────
// Derived stores — dual-mode (per-card or combined)
// ──────────────────────────────────────────────────────────────

/** Helper: get the active card object, or null if combined */
const activeCard = derived(
  [cards, activeCardId],
  ([$cards, $activeCardId]) => {
    if ($activeCardId === 'combined') return null;
    return $cards.find(c => c.id === $activeCardId) ?? null;
  }
);

// File info
export const fileName = derived(
  [cards, activeCard],
  ([$cards, $activeCard]) => {
    if ($cards.length === 0) return '';
    if ($activeCard) return $activeCard.fileName;
    if ($cards.length === 1) return $cards[0].fileName;
    return `${$cards.length} cards loaded`;
  }
);

export const fileLoaded = derived(cards, ($cards) => $cards.length > 0);

export const parseErrors = derived(
  [cards, activeCard],
  ([$cards, $activeCard]) => {
    if ($activeCard) return $activeCard.parseErrors;
    // Combined: merge all errors
    return $cards.flatMap(c => c.parseErrors);
  }
);

export const isDemoMode = derived(cards, ($cards) =>
  $cards.length > 0 && $cards.some(c => c.isDemoCard)
);

export const reportGeneratedAt = writable<string>('');

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  fileLoaded.subscribe(loaded => {
    if (loaded) {
      reportGeneratedAt.set(new Date().toISOString());
    } else {
      reportGeneratedAt.set('');
    }
  });
}

// Journey data — dual-mode
export const rawJourneys = derived(
  [cards, activeCard],
  ([$cards, $activeCard]) => {
    if ($activeCard) return $activeCard.rawJourneys;
    return $cards.flatMap(c => c.rawJourneys);
  }
);

export const validJourneys = derived(
  [cards, activeCard],
  ([$cards, $activeCard]) => {
    if ($activeCard) return $activeCard.validJourneys;
    return $cards.flatMap(c => c.validJourneys);
  }
);

export const excludedJourneys = derived(
  [cards, activeCard],
  ([$cards, $activeCard]) => {
    if ($activeCard) return $activeCard.excludedJourneys;
    return $cards.flatMap(c => c.excludedJourneys);
  }
);

/** Classified journeys — in combined mode, attaches card metadata to each journey */
export const classifiedJourneys = derived(
  [cards, activeCard],
  ([$cards, $activeCard]): ClassifiedJourney[] => {
    if ($activeCard) return $activeCard.classifiedJourneys;
    // Combined: merge all cards' journeys with card metadata, sort chronologically
    const all: MultiCardClassifiedJourney[] = [];
    for (const card of $cards) {
      for (const j of card.classifiedJourneys) {
        all.push({
          ...j,
          cardId: card.id,
          cardName: card.name,
          cardColor: card.color,
        });
      }
    }
    all.sort((a, b) => a.raw.date.getTime() - b.raw.date.getTime());
    return all;
  }
);

export const fareResults = derived(
  [cards, activeCard],
  ([$cards, $activeCard]) => {
    if ($activeCard) return $activeCard.fareResults;
    return $cards.flatMap(c => c.fareResults);
  }
);

// Cap analysis — in combined mode, sum per-card independent caps by date
export const dailyCapResults = derived(
  [cards, activeCard],
  ([$cards, $activeCard]) => {
    if ($activeCard) return $activeCard.dailyCapResults;
    if ($cards.length === 0) return [];
    if ($cards.length === 1) return $cards[0].dailyCapResults;

    // Merge by date — sum totalSpend and savedByCap across cards
    const dayMap = new Map<string, DayCapResult>();
    for (const card of $cards) {
      for (const day of card.dailyCapResults) {
        const existing = dayMap.get(day.date);
        if (existing) {
          dayMap.set(day.date, {
            ...existing,
            journeys: [...existing.journeys, ...day.journeys],
            totalSpend: existing.totalSpend + day.totalSpend,
            railJourneySpend: existing.railJourneySpend + day.railJourneySpend,
            busSpend: existing.busSpend + day.busSpend,
            capHit: existing.capHit || day.capHit,
            savedByCap: existing.savedByCap + day.savedByCap,
            capProgress: Math.max(existing.capProgress, day.capProgress),
          });
        } else {
          dayMap.set(day.date, { ...day, journeys: [...day.journeys] });
        }
      }
    }
    return Array.from(dayMap.values()).sort(
      (a, b) => a.dateObj.getTime() - b.dateObj.getTime()
    );
  }
);

export const weeklyCapResults = derived(
  [cards, activeCard],
  ([$cards, $activeCard]) => {
    if ($activeCard) return $activeCard.weeklyCapResults;
    if ($cards.length === 0) return [];
    if ($cards.length === 1) return $cards[0].weeklyCapResults;

    // Merge by week start — sum across cards
    const weekMap = new Map<number, WeekCapResult>();
    for (const card of $cards) {
      for (const week of card.weeklyCapResults) {
        const key = week.weekStart.getTime();
        const existing = weekMap.get(key);
        if (existing) {
          weekMap.set(key, {
            ...existing,
            days: [...existing.days, ...week.days],
            totalSpend: existing.totalSpend + week.totalSpend,
            capHit: existing.capHit || week.capHit,
            savedByCap: existing.savedByCap + week.savedByCap,
            capProgress: Math.max(existing.capProgress, week.capProgress),
          });
        } else {
          weekMap.set(key, { ...week, days: [...week.days] });
        }
      }
    }
    return Array.from(weekMap.values()).sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
    );
  }
);

export const capSummary = derived(
  [cards, activeCard, dailyCapResults, weeklyCapResults],
  ([$cards, $activeCard, $dailyCapResults, $weeklyCapResults]) => {
    if ($activeCard) return $activeCard.capSummary;
    if ($cards.length === 0) return null;
    if ($cards.length === 1) return $cards[0].capSummary;

    // Aggregate cap summaries
    let totalSavedByDailyCap = 0;
    let totalSavedByWeeklyCap = 0;
    let daysCapHit = 0;
    let weeksCapHit = 0;
    let totalDays = 0;
    let totalWeeks = 0;
    for (const card of $cards) {
      if (card.capSummary) {
        totalSavedByDailyCap += card.capSummary.totalSavedByDailyCap;
        totalSavedByWeeklyCap += card.capSummary.totalSavedByWeeklyCap;
        daysCapHit += card.capSummary.daysCapHit;
        weeksCapHit += card.capSummary.weeksCapHit;
        totalDays = Math.max(totalDays, card.capSummary.totalDays);
        totalWeeks = Math.max(totalWeeks, card.capSummary.totalWeeks);
      }
    }

    const averageDailySpend = $dailyCapResults.length > 0
      ? Math.round(($dailyCapResults.reduce((sum, d) => sum + d.totalSpend, 0) / $dailyCapResults.length) * 100) / 100
      : 0;

    const averageWeeklySpend = $weeklyCapResults.length > 0
      ? Math.round(($weeklyCapResults.reduce((sum, w) => sum + w.totalSpend, 0) / $weeklyCapResults.length) * 100) / 100
      : 0;

    return {
      totalSavedByDailyCap,
      totalSavedByWeeklyCap,
      daysCapHit,
      weeksCapHit,
      totalDays,
      totalWeeks,
      averageDailySpend,
      averageWeeklySpend,
    } as CapSummary;
  }
);

// Detected patterns
export const detectedPatterns = derived(
  [cards, activeCard, classifiedJourneys],
  ([$cards, $activeCard, $classifiedJourneys]) => {
    if ($activeCard) return $activeCard.detectedPatterns;
    if ($cards.length === 0) return [];
    // Combined: re-detect patterns on merged journey set
    return detectCommutePatterns($classifiedJourneys);
  }
);

// ──────────────────────────────────────────────────────────────
// Fare type — dual-mode: per-card or "What-If" override
// ──────────────────────────────────────────────────────────────

const initialFareType = isBrowser && localStorage.getItem('oystersavings_selected_fare_type')
  ? localStorage.getItem('oystersavings_selected_fare_type') as FareType
  : 'none';

// Internal writable for combined mode override
combinedFareTypeOverride.set(initialFareType);

/** The selected fare type — reads/writes per-card or combined override */
export const selectedFareType = {
  subscribe: derived(
    [activeCard, combinedFareTypeOverride],
    ([$activeCard, $override]) => {
      if ($activeCard) return $activeCard.selectedFareType;
      return $override;
    }
  ).subscribe,

  set(value: FareType) {
    const currentActiveCard = get(activeCard);
    if (currentActiveCard) {
      updateCard(currentActiveCard.id, { selectedFareType: value });
    } else {
      combinedFareTypeOverride.set(value);
    }
    if (isBrowser) {
      localStorage.setItem('oystersavings_selected_fare_type', value);
    }
  },

  update(fn: (value: FareType) => FareType) {
    const currentActiveCard = get(activeCard);
    if (currentActiveCard) {
      const newVal = fn(currentActiveCard.selectedFareType);
      updateCard(currentActiveCard.id, { selectedFareType: newVal });
    } else {
      combinedFareTypeOverride.update(fn);
    }
  }
};

export const fareTypeCost = writable<number>(0);
export const includeOysterCost = writable<boolean>(false);
export const includeStudentPhotocardFee = writable<boolean>(false);

const initialAdvancedMode = isBrowser && localStorage.getItem('oystersavings_global_advanced_mode') !== 'false';
export const globalAdvancedMode = writable<boolean>(initialAdvancedMode);
if (isBrowser) {
  globalAdvancedMode.subscribe(value => {
    localStorage.setItem('oystersavings_global_advanced_mode', String(value));
  });
}

const initialUseAlternativeFares = isBrowser && (
  localStorage.getItem('oystersavings_use_alternative_fares') === 'true' ||
  localStorage.getItem('oystersavings_use_cheapest_tfl_route') === 'true'
);
export const useAlternativeFares = writable<boolean>(initialUseAlternativeFares);

if (isBrowser) {
  useAlternativeFares.subscribe(value => {
    localStorage.setItem('oystersavings_use_alternative_fares', String(value));
  });
}

// ──────────────────────────────────────────────────────────────
// Savings & comparison — derived
// ──────────────────────────────────────────────────────────────

export const savingsResult = derived(
  [classifiedJourneys, selectedFareType, fareTypeCost, includeOysterCost, useAlternativeFares],
  ([$classifiedJourneys, $selectedFareType, $fareTypeCost, $includeOysterCost, $useAlternativeFares]) => {
    if ($classifiedJourneys.length === 0) return null;
    return calculateFareTypeSavings($classifiedJourneys, $selectedFareType, $fareTypeCost, $includeOysterCost, $useAlternativeFares);
  }
);

export const combinedSimulation = derived(
  [cards, dailyCapResults, weeklyCapResults, useAlternativeFares],
  ([$cards, $dailyCapResults, $weeklyCapResults, $useAlternativeFares]) => {
    if ($cards.length <= 1) return null;

    // 1. Determine best discount in order of priority:
    // zip_11_15 -> zip_16_17 -> jobcentre -> disabled -> railcard -> none
    const DISCOUNT_PRIORITY: FareType[] = ['zip_11_15', 'zip_16_17', 'jobcentre', 'disabled', 'railcard', 'none'];
    let bestDiscount: FareType = 'none';
    for (const discount of DISCOUNT_PRIORITY) {
      if ($cards.some(c => c.detectedDiscount === discount || c.selectedFareType === discount)) {
        bestDiscount = discount;
        break;
      }
    }

    const discountNames: Record<FareType, string> = {
      none: 'Adult PAYG',
      student: 'Student Photocard',
      zip_11_15: '11-15 Zip',
      zip_16_17: '16+ Zip',
      jobcentre: 'Jobcentre Plus',
      disabled: 'Disabled Persons',
      railcard: 'National Railcard',
    };
    const bestDiscountName = discountNames[bestDiscount] || 'Adult PAYG';

    // 2. Combine and sort all valid journeys chronologically
    const allValid = $cards.flatMap(c => c.validJourneys);
    const sortedValid = [...allValid].sort((a, b) => {
      const cmp = a.date.getTime() - b.date.getTime();
      if (cmp !== 0) return cmp;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    const classified = classifyAll(sortedValid);

    // 3. Calculate simulated standard (Adult) split spend
    let standardSplitSpend = 0;
    for (const card of $cards) {
      const stdFares = calculateAllFares(card.classifiedJourneys, 'none', $useAlternativeFares);
      const stdFaresForCap = stdFares.map(f => ({ ...f, actualCharge: f.expectedFare }));
      const stdCaps = calculateDailyCaps(stdFaresForCap, 'none');
      const stdWeekly = calculateWeeklyCaps(stdCaps, 'none');
      standardSplitSpend += stdWeekly.reduce((sum, w) => sum + w.totalSpend, 0);
    }

    // 4. Calculate simulated standard (Adult) combined spend
    const stdFaresCombined = calculateAllFares(classified, 'none', $useAlternativeFares);
    const stdFaresCombinedForCap = stdFaresCombined.map(f => ({ ...f, actualCharge: f.expectedFare }));
    const stdCapsCombined = calculateDailyCaps(stdFaresCombinedForCap, 'none');
    const stdWeeklyCombined = calculateWeeklyCaps(stdCapsCombined, 'none');
    const standardCombinedSpend = stdWeeklyCombined.reduce((sum, w) => sum + w.totalSpend, 0);

    // 5. Calculate simulated best discount combined spend
    const bestFaresCombined = calculateAllFares(classified, bestDiscount, $useAlternativeFares);
    const bestFaresCombinedForCap = bestFaresCombined.map(f => ({ ...f, actualCharge: f.fareTypeFare ?? f.expectedFare }));
    const bestCapsCombined = calculateDailyCaps(bestFaresCombinedForCap, bestDiscount);
    const bestWeeklyCombined = calculateWeeklyCaps(bestCapsCombined, bestDiscount);
    
    const simulatedTotalSpend = bestWeeklyCombined.reduce((sum, w) => sum + w.totalSpend, 0);
    const actualTotalSpend = $weeklyCapResults.reduce((sum, w) => sum + w.totalSpend, 0);
    const netDifference = Math.max(0, Math.round((actualTotalSpend - simulatedTotalSpend) * 100) / 100);

    const consolidationBenefit = Math.max(0, Math.round((standardSplitSpend - standardCombinedSpend) * 100) / 100);
    const discountUpgradeBenefit = Math.max(0, Math.round((standardCombinedSpend - simulatedTotalSpend) * 100) / 100);

    const simulatedCapSummary = getCapSummary(bestCapsCombined, bestWeeklyCombined);

    // 6. Find missed daily caps
    const missedDailyCaps: Array<{
      date: string;
      dateObj: Date;
      simulatedSpend: number;
      actualSpend: number;
      capLimit: number;
      zoneRange: string;
      saving: number;
    }> = [];

    for (const simDay of bestCapsCombined) {
      if (simDay.capHit) {
        const actualDay = $dailyCapResults.find(d => d.date === simDay.date);
        if (actualDay && !actualDay.capHit) {
          const saving = Math.round((actualDay.totalSpend - simDay.totalSpend) * 100) / 100;
          if (saving > 0) {
            missedDailyCaps.push({
              date: simDay.date,
              dateObj: simDay.dateObj,
              simulatedSpend: simDay.totalSpend,
              actualSpend: actualDay.totalSpend,
              capLimit: simDay.dailyCap,
              zoneRange: simDay.maxZoneRange,
              saving,
            });
          }
        }
      }
    }

    // 7. Find missed weekly caps
    const missedWeeklyCaps: Array<{
      weekStart: Date;
      weekEnd: Date;
      simulatedSpend: number;
      actualSpend: number;
      capLimit: number;
      zoneRange: string;
      saving: number;
    }> = [];

    for (const simWeek of bestWeeklyCombined) {
      if (simWeek.capHit) {
        const actualWeek = $weeklyCapResults.find(w => w.weekStart.getTime() === simWeek.weekStart.getTime());
        if (actualWeek && !actualWeek.capHit) {
          const saving = Math.round((actualWeek.totalSpend - simWeek.totalSpend) * 100) / 100;
          if (saving > 0) {
            missedWeeklyCaps.push({
              weekStart: simWeek.weekStart,
              weekEnd: simWeek.weekEnd,
              simulatedSpend: simWeek.totalSpend,
              actualSpend: actualWeek.totalSpend,
              capLimit: simWeek.weeklyCap,
              zoneRange: simWeek.maxZoneRange,
              saving,
            });
          }
        }
      }
    }

    return {
      bestDiscount,
      bestDiscountName,
      simulatedDailyCaps: bestCapsCombined,
      simulatedWeeklyCaps: bestWeeklyCombined,
      simulatedCapSummary,
      simulatedTotalSpend: Math.round(simulatedTotalSpend * 100) / 100,
      actualTotalSpend: Math.round(actualTotalSpend * 100) / 100,
      netDifference,
      consolidationBenefit,
      discountUpgradeBenefit,
      missedDailyCaps,
      missedWeeklyCaps,
    };
  }
);


export const detectedDiscount = derived(
  [cards, activeCard, classifiedJourneys, useAlternativeFares],
  ([$cards, $activeCard, $classifiedJourneys, $useAlternativeFares]) => {
    if ($activeCard) return $activeCard.detectedDiscount;
    if ($cards.length === 0) return 'none';
    if ($classifiedJourneys.length === 0) return 'none';
    // Combined mode: return 'none' since different cards may have different discounts
    return 'none' as FareType;
  }
);

export const productComparison = derived(
  [classifiedJourneys, selectedFareType, fareTypeCost, includeStudentPhotocardFee, useAlternativeFares],
  ([$classifiedJourneys, $selectedFareType, $fareTypeCost, $includeStudentPhotocardFee, $useAlternativeFares]) => {
    if ($classifiedJourneys.length === 0) return [];
    return calculateProductComparison($classifiedJourneys, $selectedFareType, $fareTypeCost, $includeStudentPhotocardFee, $useAlternativeFares);
  }
);

export const analysisPeriodText = derived(
  classifiedJourneys,
  ($classifiedJourneys) => {
    if ($classifiedJourneys.length === 0) return '';
    let minDate = new Date($classifiedJourneys[0].raw.date);
    let maxDate = new Date($classifiedJourneys[0].raw.date);

    for (const j of $classifiedJourneys) {
      const d = new Date(j.raw.date);
      if (d < minDate) minDate = d;
      if (d > maxDate) maxDate = d;
    }

    const formatDate = (date: Date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    return `${formatDate(minDate)} to ${formatDate(maxDate)}`;
  }
);

// ──────────────────────────────────────────────────────────────
// Planner stores (unchanged — single-card with card selector)
// ──────────────────────────────────────────────────────────────

function parseStoredRules(jsonStr: string): RecurrenceRule[] {
  try {
    const rules = JSON.parse(jsonStr) as RecurrenceRule[];
    return rules.map(rule => ({
      ...rule,
      startDate: new Date(rule.startDate),
      endDate: new Date(rule.endDate)
    }));
  } catch (e) {
    console.error('Failed to parse stored recurrence rules:', e);
    return [];
  }
}

const initialRules = isBrowser && localStorage.getItem('oystersavings_recurrence_rules')
  ? parseStoredRules(localStorage.getItem('oystersavings_recurrence_rules')!)
  : [];

const initialAdvancedRules = isBrowser && localStorage.getItem('oystersavings_advanced_recurrence_rules')
  ? parseStoredRules(localStorage.getItem('oystersavings_advanced_recurrence_rules')!)
  : [];

export const simpleRecurrenceRules = writable<RecurrenceRule[]>(initialRules);
export const advancedRecurrenceRules = writable<RecurrenceRule[]>(initialAdvancedRules);

export const recurrenceRules = writable<RecurrenceRule[]>(
  initialAdvancedMode ? initialAdvancedRules : initialRules
);

if (isBrowser) {
  simpleRecurrenceRules.subscribe(value => {
    localStorage.setItem('oystersavings_recurrence_rules', JSON.stringify(value));
  });

  advancedRecurrenceRules.subscribe(value => {
    localStorage.setItem('oystersavings_advanced_recurrence_rules', JSON.stringify(value));
  });

  let isSyncing = false;

  globalAdvancedMode.subscribe(isAdvanced => {
    if (isSyncing) return;
    isSyncing = true;
    if (isAdvanced) {
      recurrenceRules.set(get(advancedRecurrenceRules));
    } else {
      recurrenceRules.set(get(simpleRecurrenceRules));
    }
    isSyncing = false;
  });

  recurrenceRules.subscribe(value => {
    if (isSyncing) return;
    isSyncing = true;
    const isAdvanced = get(globalAdvancedMode);
    if (isAdvanced) {
      advancedRecurrenceRules.set(value);
    } else {
      simpleRecurrenceRules.set(value);
    }
    isSyncing = false;
  });
}

export const plannedJourneys = writable<PlannedJourney[]>([]);
export const forecastResult = writable<ForecastResult | null>(null);

export interface ApiRetryInfo {
  attempt: number;
  maxRetries: number;
  status: 'loading' | 'retrying' | 'timeout';
}
export const apiRetryStatus = writable<Record<string, ApiRetryInfo>>({});

// ──────────────────────────────────────────────────────────────
// Navigation
// ──────────────────────────────────────────────────────────────

export const currentPage = writable<'home' | 'analysis' | 'planner' | 'compare' | 'faq'>('home');

// ──────────────────────────────────────────────────────────────
// Derived convenience stores
// ──────────────────────────────────────────────────────────────

export const hasData = derived(fileLoaded, ($fileLoaded) => $fileLoaded);

export const totalSpend = derived(fareResults, ($fareResults) =>
  Math.round($fareResults.reduce((sum, r) => sum + r.actualCharge, 0) * 100) / 100
);

export const totalJourneys = derived(classifiedJourneys, ($j) => $j.length);

// ──────────────────────────────────────────────────────────────
// Reset
// ──────────────────────────────────────────────────────────────

export function resetData() {
  cards.set([]);
  activeCardId.set('combined');
  combinedFareTypeOverride.set('none');
  fareTypeCost.set(0);
  includeOysterCost.set(false);
  simpleRecurrenceRules.set([]);
  advancedRecurrenceRules.set([]);
  recurrenceRules.set([]);
  plannedJourneys.set([]);
  forecastResult.set(null);
  reportGeneratedAt.set('');
  currentPage.set('home');
}

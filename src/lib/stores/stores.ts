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

// Journey data store
export const rawJourneys = writable<ParsedJourney[]>([]);
export const validJourneys = writable<ParsedJourney[]>([]);
export const excludedJourneys = writable<ExcludedJourney[]>([]);
export const classifiedJourneys = writable<ClassifiedJourney[]>([]);
export const fareResults = writable<FareResult[]>([]);

// File info
export const fileName = writable<string>('');
export const fileLoaded = writable<boolean>(false);
export const parseErrors = writable<string[]>([]);
export const reportGeneratedAt = writable<string>('');

// Cap analysis
export const dailyCapResults = writable<DayCapResult[]>([]);
export const weeklyCapResults = writable<WeekCapResult[]>([]);
export const capSummary = writable<CapSummary | null>(null);

// Settings
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

const initialFareType = isBrowser && localStorage.getItem('oystersavings_selected_fare_type')
  ? localStorage.getItem('oystersavings_selected_fare_type') as FareType
  : 'none';

export const selectedFareType = writable<FareType>(initialFareType);

if (isBrowser) {
  selectedFareType.subscribe(value => {
    localStorage.setItem('oystersavings_selected_fare_type', value);
  });
}

export const fareTypeCost = writable<number>(0);
export const includeOysterCost = writable<boolean>(false);
export const includeStudentPhotocardFee = writable<boolean>(false);
export const isDemoMode = writable<boolean>(false);
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


// Savings results
export const savingsResult = derived(
  [classifiedJourneys, selectedFareType, fareTypeCost, includeOysterCost, useAlternativeFares],
  ([$classifiedJourneys, $selectedFareType, $fareTypeCost, $includeOysterCost, $useAlternativeFares]) => {
    if ($classifiedJourneys.length === 0) return null;
    return calculateFareTypeSavings($classifiedJourneys, $selectedFareType, $fareTypeCost, $includeOysterCost, $useAlternativeFares);
  }
);

export const detectedDiscount = derived(
  [classifiedJourneys, useAlternativeFares],
  ([$classifiedJourneys, $useAlternativeFares]) => {
    if ($classifiedJourneys.length === 0) return 'none';
    return detectActiveDiscount($classifiedJourneys, $useAlternativeFares);
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

// Planner
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
export const detectedPatterns = writable<DetectedPattern[]>([]);
export const forecastResult = writable<ForecastResult | null>(null);

export interface ApiRetryInfo {
  attempt: number;
  maxRetries: number;
  status: 'loading' | 'retrying' | 'timeout';
}
export const apiRetryStatus = writable<Record<string, ApiRetryInfo>>({});


// Navigation
export const currentPage = writable<'home' | 'analysis' | 'planner' | 'compare' | 'faq'>('home');

// Derived: has data loaded
export const hasData = derived(fileLoaded, ($fileLoaded) => $fileLoaded);

// Derived: total spend
export const totalSpend = derived(fareResults, ($fareResults) =>
  Math.round($fareResults.reduce((sum, r) => sum + r.actualCharge, 0) * 100) / 100
);

// Derived: total journeys
export const totalJourneys = derived(classifiedJourneys, ($j) => $j.length);

// Reset all data
export function resetData() {
  rawJourneys.set([]);
  validJourneys.set([]);
  excludedJourneys.set([]);
  classifiedJourneys.set([]);
  fareResults.set([]);
  fileName.set('');
  fileLoaded.set(false);
  parseErrors.set([]);
  dailyCapResults.set([]);
  weeklyCapResults.set([]);
  capSummary.set(null);
  simpleRecurrenceRules.set([]);
  advancedRecurrenceRules.set([]);
  recurrenceRules.set([]);
  plannedJourneys.set([]);
  detectedPatterns.set([]);
  forecastResult.set(null);
  isDemoMode.set(false);
  reportGeneratedAt.set('');
  currentPage.set('home');
}

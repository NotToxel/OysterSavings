import { writable, derived } from 'svelte/store';
import type { CapSummary, DayCapResult, WeekCapResult } from '../engine/capEngine';
import type { ParsedJourney } from '../engine/csvParser';
import type { FareResult } from '../engine/fareCalculator';
import type { ForecastResult } from '../engine/forecastEngine';
import type { ClassifiedJourney } from '../engine/journeyClassifier';
import type { ExcludedJourney } from '../engine/journeyFilter';
import type { DetectedPattern, PlannedJourney, RecurrenceRule } from '../engine/recurrenceEngine';
import { calculateProductComparison, calculateFareTypeSavings, type ProductComparisonResult, type FareTypeSavingsResult } from '../engine/savingsEngine';
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
export const includeOysterCost = writable<boolean>(true);
export const includeStudentPhotocardFee = writable<boolean>(true);
export const isDemoMode = writable<boolean>(false);

// Savings results
export const savingsResult = derived(
  [classifiedJourneys, selectedFareType, fareTypeCost, includeOysterCost],
  ([$classifiedJourneys, $selectedFareType, $fareTypeCost, $includeOysterCost]) => {
    if ($classifiedJourneys.length === 0) return null;
    return calculateFareTypeSavings($classifiedJourneys, $selectedFareType, $fareTypeCost, $includeOysterCost);
  }
);

export const productComparison = derived(
  [classifiedJourneys, selectedFareType, fareTypeCost, includeStudentPhotocardFee],
  ([$classifiedJourneys, $selectedFareType, $fareTypeCost, $includeStudentPhotocardFee]) => {
    if ($classifiedJourneys.length === 0) return [];
    return calculateProductComparison($classifiedJourneys, $selectedFareType, $fareTypeCost, $includeStudentPhotocardFee);
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

export const recurrenceRules = writable<RecurrenceRule[]>(initialRules);

if (isBrowser) {
  recurrenceRules.subscribe(value => {
    localStorage.setItem('oystersavings_recurrence_rules', JSON.stringify(value));
  });
}

export const plannedJourneys = writable<PlannedJourney[]>([]);
export const detectedPatterns = writable<DetectedPattern[]>([]);
export const forecastResult = writable<ForecastResult | null>(null);

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
  recurrenceRules.set([]);
  plannedJourneys.set([]);
  detectedPatterns.set([]);
  forecastResult.set(null);
  isDemoMode.set(false);
  reportGeneratedAt.set('');
  currentPage.set('home');
}

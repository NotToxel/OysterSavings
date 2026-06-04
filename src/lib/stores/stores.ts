import { writable, derived } from 'svelte/store';
import type { CapSummary, DayCapResult, WeekCapResult } from '../engine/capEngine';
import type { ParsedJourney } from '../engine/csvParser';
import type { FareResult } from '../engine/fareCalculator';
import type { ForecastResult } from '../engine/forecastEngine';
import type { ClassifiedJourney } from '../engine/journeyClassifier';
import type { ExcludedJourney } from '../engine/journeyFilter';
import type { DetectedPattern, PlannedJourney, RecurrenceRule } from '../engine/recurrenceEngine';
import { calculateProductComparison, calculateRailcardSavings, type ProductComparisonResult, type RailcardSavingsResult } from '../engine/savingsEngine';
import type { RailcardType } from '../data/fareData';

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

// Cap analysis
export const dailyCapResults = writable<DayCapResult[]>([]);
export const weeklyCapResults = writable<WeekCapResult[]>([]);
export const capSummary = writable<CapSummary | null>(null);

// Settings
export const selectedRailcard = writable<RailcardType>('16-25');
export const railcardCost = writable<number>(30);
export const includeOysterCost = writable<boolean>(false);
export const studentPhotocardCost = writable<number>(30);

// Savings results
export const savingsResult = derived(
  [classifiedJourneys, selectedRailcard, railcardCost, includeOysterCost],
  ([$classifiedJourneys, $selectedRailcard, $railcardCost, $includeOysterCost]) => {
    if ($classifiedJourneys.length === 0) return null;
    return calculateRailcardSavings($classifiedJourneys, $selectedRailcard, $railcardCost, $includeOysterCost);
  }
);

export const productComparison = derived(
  [classifiedJourneys, selectedRailcard, railcardCost, studentPhotocardCost],
  ([$classifiedJourneys, $selectedRailcard, $railcardCost, $studentPhotocardCost]) => {
    if ($classifiedJourneys.length === 0) return [];
    return calculateProductComparison($classifiedJourneys, $selectedRailcard, $railcardCost, $studentPhotocardCost);
  }
);

// Planner
export const recurrenceRules = writable<RecurrenceRule[]>([]);
export const plannedJourneys = writable<PlannedJourney[]>([]);
export const detectedPatterns = writable<DetectedPattern[]>([]);
export const forecastResult = writable<ForecastResult | null>(null);

// Navigation
export const currentPage = writable<'home' | 'analysis' | 'planner' | 'compare'>('home');

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
}

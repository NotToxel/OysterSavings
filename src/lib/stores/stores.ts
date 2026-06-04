// Svelte Stores — reactive state management
import { writable, derived } from 'svelte/store';
import type { ParsedJourney } from '../engine/csvParser';
import type { ClassifiedJourney } from '../engine/journeyClassifier';
import type { ExcludedJourney } from '../engine/journeyFilter';
import type { FareResult } from '../engine/fareCalculator';
import type { DayCapResult, WeekCapResult, CapSummary } from '../engine/capEngine';
import type { RailcardSavingsResult } from '../engine/savingsEngine';
import type { RecurrenceRule, PlannedJourney, DetectedPattern } from '../engine/recurrenceEngine';
import type { ForecastResult } from '../engine/forecastEngine';
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

// Savings results
export const savingsResult = writable<RailcardSavingsResult | null>(null);

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
  savingsResult.set(null);
  recurrenceRules.set([]);
  plannedJourneys.set([]);
  detectedPatterns.set([]);
  forecastResult.set(null);
}

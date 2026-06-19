// Multi-card types and constants
import type { ParsedJourney } from '../engine/csvParser';
import type { ExcludedJourney } from '../engine/journeyFilter';
import type { ClassifiedJourney } from '../engine/journeyClassifier';
import type { FareResult } from '../engine/fareCalculator';
import type { CapSummary, DayCapResult, WeekCapResult } from '../engine/capEngine';
import type { DetectedPattern } from '../engine/recurrenceEngine';
import type { FareType } from '../data/fareData';

export interface CardState {
  id: string;
  name: string;
  color: string;
  fileName: string;
  isDemoCard: boolean;

  // Per-card journey data
  rawJourneys: ParsedJourney[];
  validJourneys: ParsedJourney[];
  excludedJourneys: ExcludedJourney[];
  classifiedJourneys: ClassifiedJourney[];
  fareResults: FareResult[];
  dailyCapResults: DayCapResult[];
  weeklyCapResults: WeekCapResult[];
  capSummary: CapSummary | null;
  detectedPatterns: DetectedPattern[];
  parseErrors: string[];

  // Per-card settings
  selectedFareType: FareType;
  fareTypeCost: number;
  includeOysterCost: boolean;
  detectedDiscount: FareType;

  // Deduplication tracking
  duplicatesRemoved: number;
}

/** Extended journey type that includes card provenance info */
export interface MultiCardClassifiedJourney extends ClassifiedJourney {
  cardId: string;
  cardName: string;
  cardColor: string;
}

/** Curated palette for visual card differentiation (max 3 cards) */
export const CARD_COLORS = ['#009FE3', '#e7710d', '#6f4390'] as const;

/** Maximum number of cards that can be loaded simultaneously */
export const MAX_CARDS = 3;

/** Generate a unique card ID */
export function generateCardId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate auto-name from detected discount and card index */
export function generateCardName(index: number, detectedDiscount: FareType): string {
  const discountLabels: Record<FareType, string> = {
    none: 'Adult/Contactless',
    railcard: 'Railcard',
    disabled: 'Disabled Persons',
    student: 'Student',
    jobcentre: 'Jobcentre Plus',
    zip_11_15: '11-15 Zip',
    zip_16_17: '16+ Zip',
  };
  const label = discountLabels[detectedDiscount] || 'Standard';
  return `Card ${index + 1} (${label})`;
}

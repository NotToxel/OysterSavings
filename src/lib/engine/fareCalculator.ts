// Fare Calculator — computes expected fares, railcard discounts, hopper logic
import type { ClassifiedJourney } from './journeyClassifier';
import {
  lookupFare,
  BUS_SINGLE_FARE,
  HOPPER_WINDOW_MINUTES,
  roundToNearest10p,
  type RailcardType,
  RAILCARDS,
} from '../data/fareData';

export interface FareResult {
  journey: ClassifiedJourney;
  expectedFare: number;
  actualCharge: number;
  difference: number; // positive = overpaid, negative = underpaid
  railcardFare: number | null; // fare with railcard discount
  railcardSaving: number; // saving from railcard for this journey
  isHopperFree: boolean;
}

// Calculate the expected fare for a single journey
export function calculateExpectedFare(journey: ClassifiedJourney): number {
  // Bus/tram: flat fare
  if (journey.isBus) {
    if (journey.isHopperFree) return 0;
    return BUS_SINGLE_FARE;
  }

  // Rail/tube: zone-based
  if (journey.zoneRange) {
    return lookupFare(journey.zoneRange, journey.isPeak, journey.mode);
  }

  // Unknown zone — use actual charge as fallback
  return journey.raw.charge;
}

// Calculate fare with railcard discount
export function calculateRailcardFare(
  journey: ClassifiedJourney,
  railcardType: RailcardType
): number {
  const railcard = RAILCARDS[railcardType];

  // Bus fares are not discounted by railcards
  if (journey.isBus) {
    if (journey.isHopperFree) return 0;
    return BUS_SINGLE_FARE;
  }

  const baseFare = calculateExpectedFare(journey);

  // Check if railcard applies to this journey type
  if (journey.isPeak && !railcard.appliesToPeak) {
    // Railcard doesn't apply to peak journeys (except Disabled Persons)
    return baseFare;
  }

  // Apply 1/3 discount and round to nearest 10p
  const discountedFare = baseFare * (1 - railcard.discount);
  return roundToNearest10p(discountedFare);
}

// Process hopper fare logic for a day's bus journeys
// Hopper: unlimited bus/tram connections within 60 minutes of first tap
export function applyHopperFares(journeys: ClassifiedJourney[]): ClassifiedJourney[] {
  const busJourneys = journeys.filter((j) => j.isBus);
  if (busJourneys.length <= 1) return journeys;

  // Sort bus journeys by time
  const sorted = [...busJourneys].sort((a, b) => {
    const timeA = a.raw.startTime || '00:00';
    const timeB = b.raw.startTime || '00:00';
    return timeA.localeCompare(timeB);
  });

  // Group into hopper windows
  let windowStart: string | null = null;

  for (const bus of sorted) {
    const busTime = bus.raw.startTime || '00:00';

    if (!windowStart) {
      windowStart = busTime;
      continue;
    }

    // Check if within 60 minutes of window start
    const startMinutes = timeToMinutes(windowStart);
    const currentMinutes = timeToMinutes(busTime);
    const diff = currentMinutes - startMinutes;

    if (diff >= 0 && diff <= HOPPER_WINDOW_MINUTES) {
      // Within hopper window — this should be free
      bus.isHopperFree = true;
    } else {
      // New hopper window
      windowStart = busTime;
    }
  }

  return journeys;
}

function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// Calculate fares for all journeys
export function calculateAllFares(
  journeys: ClassifiedJourney[],
  railcardType?: RailcardType
): FareResult[] {
  return journeys.map((journey) => {
    const expectedFare = calculateExpectedFare(journey);
    const actualCharge = journey.raw.charge;

    let railcardFare: number | null = null;
    let railcardSaving = 0;

    if (railcardType) {
      railcardFare = calculateRailcardFare(journey, railcardType);
      railcardSaving = Math.max(0, expectedFare - railcardFare);
    }

    return {
      journey,
      expectedFare,
      actualCharge,
      difference: actualCharge - expectedFare,
      railcardFare,
      railcardSaving,
      isHopperFree: journey.isHopperFree,
    };
  });
}

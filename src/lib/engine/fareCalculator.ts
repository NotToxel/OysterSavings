// Fare Calculator — computes expected fares, fare type discounts, hopper logic
import type { ClassifiedJourney } from './journeyClassifier';
import {
  lookupFare,
  BUS_SINGLE_FARE,
  HOPPER_WINDOW_MINUTES,
  calculateDiscountedFare,
  type FareType,
  FARE_TYPES,
} from '../data/fareData';

export interface FareResult {
  journey: ClassifiedJourney;
  expectedFare: number;
  actualCharge: number;
  difference: number; // positive = overpaid, negative = underpaid
  fareTypeFare: number | null; // fare with fare type discount
  fareTypeSaving: number; // saving from fare type for this journey
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

// Calculate fare with fare type discount
export function calculateFareTypeFare(
  journey: ClassifiedJourney,
  fareType: FareType
): number {
  if (journey.isBus && journey.isHopperFree) return 0;
  const baseFare = calculateExpectedFare(journey);
  return calculateDiscountedFare(
    baseFare,
    fareType,
    journey.isPeak,
    journey.isBus,
    journey.originZone ?? undefined,
    journey.destinationZone ?? undefined,
    journey.mode
  );
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
  fareType?: FareType
): FareResult[] {
  return journeys.map((journey) => {
    const expectedFare = calculateExpectedFare(journey);
    const actualCharge = journey.raw.charge;

    let fareTypeFare: number | null = null;
    let fareTypeSaving = 0;

    if (fareType) {
      fareTypeFare = calculateFareTypeFare(journey, fareType);
      fareTypeSaving = Math.max(0, expectedFare - fareTypeFare);
    }

    return {
      journey,
      expectedFare,
      actualCharge,
      difference: actualCharge - expectedFare,
      fareTypeFare,
      fareTypeSaving,
      isHopperFree: journey.isHopperFree,
    };
  });
}

import {
  BUS_DAILY_CAP,
  BUS_SINGLE_FARE,
  DAILY_CAPS,
  DAILY_CAPS_OFFPEAK,
  PAYG_FARES,
  STUDENT_TRAVELCARD_MONTHLY,
  STUDENT_TRAVELCARD_WEEKLY,
  TRAVELCARD_MONTHLY,
  TRAVELCARD_WEEKLY,
  WEEKLY_CAPS,
} from "./fareRates";
import { calculateDiscountedFare } from "./fareData";

export type SampleScenarioId = "travelcard" | "railcard" | "student";
export type SamplePatternId = "flexible" | "offpeak" | "mixed";

type SampleJourney = {
  day: number;
  dayLabel: string;
  time: string;
  origin: string;
  destination: string;
  mode: "tube" | "bus";
  peak: boolean;
  anytimeCap: boolean;
};

export type SampleTransaction = SampleJourney & {
  index: number;
  farePence: number;
  adultChargedPence: number;
  railcardChargedPence: number;
  adultCap: "daily" | "weekly" | null;
  railcardCap: "daily" | "weekly" | null;
};

const ZONE_RANGE = "Z1-2";
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// A deliberately small, local illustration of Zone 1–2 journeys. The full
// analysis engine remains the source of truth for uploaded travel histories.

function commute(day: number): SampleJourney[] {
  return [
    { day, dayLabel: days[day % 7], time: "08:15", origin: "Finsbury Park", destination: "King's Cross", mode: "tube", peak: true, anytimeCap: true },
    { day, dayLabel: days[day % 7], time: "17:45", origin: "King's Cross", destination: "Finsbury Park", mode: "tube", peak: true, anytimeCap: true },
  ];
}

function offPeakPair(day: number): SampleJourney[] {
  return [
    { day, dayLabel: days[day % 7], time: "11:20", origin: "Finsbury Park", destination: "King's Cross", mode: "tube", peak: false, anytimeCap: false },
    { day, dayLabel: days[day % 7], time: "15:10", origin: "King's Cross", destination: "Finsbury Park", mode: "tube", peak: false, anytimeCap: false },
  ];
}

function bus(day: number, time: string, origin: string, destination: string, anytimeCap: boolean): SampleJourney {
  return { day, dayLabel: days[day % 7], time, origin, destination, mode: "bus", peak: false, anytimeCap };
}

const flexibleThursday = [commute(3)[0], { ...commute(3)[1], time: "15:10", peak: false }];
const sampleJourneysByPattern: Record<SamplePatternId, SampleJourney[]> = {
  // A midweek off-peak day and an early Thursday return make the Railcard
  // benefit visible without changing the journeys when a fare tab is switched.
  flexible: [...commute(0), ...commute(1), ...offPeakPair(2), ...flexibleThursday, ...commute(4), ...offPeakPair(5)],
  offpeak: [0, 1, 2, 3, 4, 5].flatMap(offPeakPair),
  mixed: [
    ...commute(0),
    commute(1)[0],
    bus(1, "12:20", "King's Cross", "Camden Town", true),
    commute(1)[1],
    ...commute(2),
    commute(3)[0],
    bus(3, "12:20", "King's Cross", "Camden Town", true),
    commute(3)[1],
    ...commute(4),
    ...offPeakPair(5),
    bus(6, "11:10", "Finsbury Park", "Crouch End", false),
    bus(6, "16:30", "Crouch End", "Finsbury Park", false),
  ],
};

function priceJourneys(journeys: SampleJourney[], railcard: boolean): { chargePence: number; cap: SampleTransaction['adultCap'] }[] {
  let weeklySpend = 0;
  let dailySpend = 0;
  let dailyBusSpend = 0;
  let hasAnytimeRail = false;
  let currentDay = -1;

  return journeys.map((journey) => {
    if (journey.day !== currentDay && journey.day % 7 === 0) weeklySpend = 0;
    if (journey.day !== currentDay) {
      currentDay = journey.day;
      dailySpend = 0;
      dailyBusSpend = 0;
      hasAnytimeRail = false;
    }

    if (journey.mode === "tube" && journey.anytimeCap) hasAnytimeRail = true;
    const baseFare = journey.mode === "bus"
      ? BUS_SINGLE_FARE
      : journey.peak ? PAYG_FARES.tfl[ZONE_RANGE].peak : PAYG_FARES.tfl[ZONE_RANGE].offPeak;
    const fare = railcard && journey.mode === "tube"
      ? calculateDiscountedFare(baseFare, "railcard", journey.peak, false, 2, 1, "tfl", journey.origin, journey.destination)
      : baseFare;
    const offPeakCap = railcard
      ? Math.floor(DAILY_CAPS_OFFPEAK[ZONE_RANGE] * 0.666 * 20) / 20
      : DAILY_CAPS_OFFPEAK[ZONE_RANGE];
    const dailyCap = hasAnytimeRail ? DAILY_CAPS[ZONE_RANGE] : offPeakCap;
    const farePence = Math.round(fare * 100);
    const dailyRemaining = Math.max(0, Math.round((dailyCap - dailySpend) * 100));
    const weeklyRemaining = Math.max(0, Math.round((WEEKLY_CAPS[ZONE_RANGE] - weeklySpend) * 100));
    const busRemaining = journey.mode === "bus" ? Math.max(0, Math.round((BUS_DAILY_CAP - dailyBusSpend) * 100)) : farePence;
    const chargePence = Math.min(farePence, busRemaining, dailyRemaining, weeklyRemaining);
    const cap = chargePence === farePence ? null : weeklyRemaining <= dailyRemaining && weeklyRemaining <= busRemaining ? "weekly" : "daily";

    dailySpend += chargePence / 100;
    if (journey.mode === "bus") dailyBusSpend += chargePence / 100;
    weeklySpend += chargePence / 100;
    return { chargePence, cap };
  });
}

export function getSampleTransactions(pattern: SamplePatternId = "flexible"): SampleTransaction[] {
  const sampleJourneys = sampleJourneysByPattern[pattern];
  const adultCharges = priceJourneys(sampleJourneys, false);
  const railcardCharges = priceJourneys(sampleJourneys, true);

  return sampleJourneys.map((journey, index) => ({
    ...journey,
    index,
    farePence: Math.round((journey.mode === "bus" ? BUS_SINGLE_FARE : journey.peak ? PAYG_FARES.tfl[ZONE_RANGE].peak : PAYG_FARES.tfl[ZONE_RANGE].offPeak) * 100),
    adultChargedPence: adultCharges[index].chargePence,
    railcardChargedPence: railcardCharges[index].chargePence,
    adultCap: adultCharges[index].cap,
    railcardCap: railcardCharges[index].cap,
  }));
}

export const sampleProductPence = {
  travelcard: Math.round(TRAVELCARD_WEEKLY[ZONE_RANGE] * 100),
  monthlyTravelcard: Math.round(TRAVELCARD_MONTHLY[ZONE_RANGE] * 100),
  studentMonthlyTravelcard: Math.round(STUDENT_TRAVELCARD_MONTHLY[ZONE_RANGE] * 100),
  student: Math.round(STUDENT_TRAVELCARD_WEEKLY[ZONE_RANGE] * 100),
} as const;

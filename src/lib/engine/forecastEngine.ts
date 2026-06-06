// Forecast Engine — cost projections and product comparisons
import type { PlannedJourney } from './recurrenceEngine';
import type { ClassifiedJourney } from './journeyClassifier';
import {
  lookupFare,
  getZoneRange,
  BUS_SINGLE_FARE,
  lookupDailyCap,
  lookupWeeklyCap,
  calculateDiscountedFare,
  roundToNearest10p,
  type RailcardType,
  RAILCARDS,
  TRAVELCARD_WEEKLY,
  TRAVELCARD_MONTHLY,
  TRAVELCARD_ANNUAL,
  STUDENT_TRAVELCARD_ANNUAL,
  STUDENT_PHOTOCARD_FEE,
  isPeakJourney,
  getRepresentativeTime,
  formatLocalDate,
  parseLocalDate,
} from '../data/fareData';

export interface ForecastDay {
  date: Date;
  dateStr: string;
  journeys: PlannedJourney[];
  totalFare: number;
  totalFareRailcard: number;
  dailyCap: number;
  cappedFare: number;
  cappedFareRailcard: number;
  capHit: boolean;
  capProgress: number;
  capHitRailcard: boolean;
  capProgressRailcard: number;
}

export interface ForecastResult {
  days: ForecastDay[];
  weeklyBreakdown: ForecastWeek[];
  totalPayg: number;
  totalPaygRailcard: number;
  totalPaygCapped: number;
  totalPaygRailcardCapped: number;
  projections: CostProjection;
}

export interface ForecastWeek {
  weekStart: Date;
  weekEnd: Date;
  days: ForecastDay[];
  totalFare: number;
  totalFareRailcard: number;
  weeklyCap: number;
  capHit: boolean;
  capProgress: number;
}

export interface CostProjection {
  weekly: ProductCosts;
  monthly: ProductCosts;
  annual: ProductCosts;
}

export interface ProductCosts {
  payg: number;
  paygRailcard: number;
  travelcard: Record<string, number>;
  studentTravelcard: Record<string, number>;
  bestOption: string;
  bestCost: number;
}

// Run forecast on planned journeys
export function runForecast(
  plannedJourneys: PlannedJourney[],
  railcardType: RailcardType,
  railcardCost: number
): ForecastResult {
  const railcard = RAILCARDS[railcardType];

  // Group by day
  const dayMap = new Map<string, PlannedJourney[]>();
  for (const j of plannedJourneys) {
    const key = j.dateStr;
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(j);
  }

  const days: ForecastDay[] = [];

  for (const [dateStr, journeys] of dayMap) {
    let totalFare = 0;
    let totalFareRailcard = 0;
    let maxZoneSpread = 0;
    let maxZoneRange = 'Z1';

    for (const j of journeys) {
      const repTime = getRepresentativeTime(j.timePeriod);
      const isPeakFare = isPeakJourney(j.date, repTime, j.originZone, j.destinationZone);

      // Calculate raw single fare
      const zoneRange = getZoneRange(j.originZone, j.destinationZone);
      const fare = j.mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, j.mode);
      
      let railcardFare = calculateDiscountedFare(fare, railcardType, isPeakFare, j.mode === 'bus', j.originZone, j.destinationZone, j.mode);

      totalFare += fare;
      totalFareRailcard += railcardFare;

      // Track max zone range for cap
      const parts = zoneRange.replace('Z', '').split('-');
      const spread = parts.length > 1 ? parseInt(parts[1]) - parseInt(parts[0]) : 0;
      if (spread > maxZoneSpread) {
        maxZoneSpread = spread;
        maxZoneRange = zoneRange;
      }
    }

    const isPeakDay = journeys.some(j => {
      const repTime = getRepresentativeTime(j.timePeriod);
      return isPeakJourney(j.date, repTime, j.originZone, j.destinationZone);
    });
    
    if (maxZoneRange === 'Z1' || maxZoneRange === 'Z2') {
      maxZoneRange = 'Z1-2';
    }
    
    const dailyCap = lookupDailyCap(maxZoneRange, isPeakDay, 'none');
    const railcardDailyCap = lookupDailyCap(maxZoneRange, isPeakDay, railcardType);
    const cappedFare = Math.min(totalFare, dailyCap);
    const cappedFareRailcard = Math.min(totalFareRailcard, railcardDailyCap);
    const capHit = totalFare >= dailyCap;
    const capHitRailcard = totalFareRailcard >= railcardDailyCap;
    const capProgressRailcard = railcardDailyCap > 0 ? Math.min(1, totalFareRailcard / railcardDailyCap) : 0;

    days.push({
      date: journeys[0].date,
      dateStr,
      journeys,
      totalFare: round2(totalFare),
      totalFareRailcard: round2(totalFareRailcard),
      dailyCap,
      cappedFare: round2(cappedFare),
      cappedFareRailcard: round2(cappedFareRailcard),
      capHit,
      capProgress: Math.min(1, totalFare / dailyCap),
      capHitRailcard,
      capProgressRailcard,
    });
  }

  days.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group by week
  const weekMap = new Map<string, ForecastDay[]>();
  for (const day of days) {
    const monday = getMonday(day.date);
    const key = formatLocalDate(monday);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(day);
  }

  const weeklyBreakdown: ForecastWeek[] = [];
  for (const [weekKey, weekDays] of weekMap) {
    const weekStart = parseLocalDate(weekKey);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const totalFare = weekDays.reduce((s, d) => s + d.cappedFare, 0);
    const totalFareRailcard = weekDays.reduce((s, d) => s + d.cappedFareRailcard, 0);

    // Determine weekly cap zone range
    const allJourneys = weekDays.flatMap((d) => d.journeys);
    let maxSpread = 0;
    let maxRange = 'Z1';
    for (const j of allJourneys) {
      const zr = getZoneRange(j.originZone, j.destinationZone);
      const parts = zr.replace('Z', '').split('-');
      const spread = parts.length > 1 ? parseInt(parts[1]) - parseInt(parts[0]) : 0;
      if (spread > maxSpread) { maxSpread = spread; maxRange = zr; }
    }

    const weeklyCap = lookupWeeklyCap(maxRange, 'none');
    const railcardWeeklyCap = lookupWeeklyCap(maxRange, railcardType);

    // Apply weekly cap to total if needed
    const cappedTotalFare = Math.min(totalFare, weeklyCap);
    const cappedTotalFareRailcard = Math.min(totalFareRailcard, railcardWeeklyCap);

    // Distribute the weekly caps chronologically across daily spend boxes
    weekDays.sort((a, b) => a.date.getTime() - b.date.getTime());
    let runningWeekTotal = 0;
    let runningWeekTotalRailcard = 0;
    for (const d of weekDays) {
      const remainingWeeklyCap = Math.max(0, weeklyCap - runningWeekTotal);
      const remainingWeeklyCapRailcard = Math.max(0, railcardWeeklyCap - runningWeekTotalRailcard);

      const oldCappedFare = d.cappedFare;
      const oldCappedFareRailcard = d.cappedFareRailcard;

      d.cappedFare = round2(Math.min(oldCappedFare, remainingWeeklyCap));
      d.cappedFareRailcard = round2(Math.min(oldCappedFareRailcard, remainingWeeklyCapRailcard));

      runningWeekTotal += d.cappedFare;
      runningWeekTotalRailcard += d.cappedFareRailcard;

      // Mark cap hit and progress as complete if daily cap OR weekly cap is hit
      if (oldCappedFareRailcard > d.cappedFareRailcard || runningWeekTotalRailcard >= railcardWeeklyCap) {
        d.capHitRailcard = true;
        d.capProgressRailcard = 1.0;
      }
      if (oldCappedFare > d.cappedFare || runningWeekTotal >= weeklyCap) {
        d.capHit = true;
        d.capProgress = 1.0;
      }
    }

    weeklyBreakdown.push({
      weekStart,
      weekEnd,
      days: weekDays,
      totalFare: round2(cappedTotalFare),
      totalFareRailcard: round2(cappedTotalFareRailcard),
      weeklyCap,
      capHit: totalFare >= weeklyCap,
      capProgress: Math.min(1, totalFare / weeklyCap),
    });
  }

  weeklyBreakdown.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  const totalPayg = round2(days.reduce((s, d) => s + d.totalFare, 0));
  const totalPaygRailcard = round2(days.reduce((s, d) => s + d.totalFareRailcard, 0));
  const totalPaygCapped = round2(days.reduce((s, d) => s + d.cappedFare, 0));
  const totalPaygRailcardCapped = round2(days.reduce((s, d) => s + d.cappedFareRailcard, 0));

  const totalWeeks = weeklyBreakdown.length || 1;
  const avgWeekly = totalPaygCapped / totalWeeks;
  const avgWeeklyRailcard = totalPaygRailcardCapped / totalWeeks;

  // Build projections
  const projections: CostProjection = {
    weekly: buildProductCosts(avgWeekly, avgWeeklyRailcard + railcardCost / 52),
    monthly: buildProductCosts(avgWeekly * 4.33, avgWeeklyRailcard * 4.33 + railcardCost / 12),
    annual: buildProductCosts(avgWeekly * 52, avgWeeklyRailcard * 52 + railcardCost),
  };

  return {
    days,
    weeklyBreakdown,
    totalPayg,
    totalPaygRailcard,
    totalPaygCapped,
    totalPaygRailcardCapped,
    projections,
  };
}

function buildProductCosts(payg: number, paygRailcard: number): ProductCosts {
  const travelcard: Record<string, number> = {};
  const studentTravelcard: Record<string, number> = {};

  for (const [zone, price] of Object.entries(TRAVELCARD_WEEKLY)) {
    travelcard[zone] = price;
  }
  for (const [zone, price] of Object.entries(STUDENT_TRAVELCARD_ANNUAL)) {
    studentTravelcard[zone] = (price + STUDENT_PHOTOCARD_FEE) / 52;
  }

  let bestOption = 'PAYG';
  let bestCost = payg;

  if (paygRailcard < bestCost) {
    bestOption = 'PAYG + Railcard';
    bestCost = paygRailcard;
  }

  return {
    payg: round2(payg),
    paygRailcard: round2(paygRailcard),
    travelcard,
    studentTravelcard,
    bestOption,
    bestCost: round2(bestCost),
  };
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

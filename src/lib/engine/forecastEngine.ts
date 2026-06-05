// Forecast Engine — cost projections and product comparisons
import type { PlannedJourney } from './recurrenceEngine';
import type { ClassifiedJourney } from './journeyClassifier';
import {
  lookupFare,
  getZoneRange,
  BUS_SINGLE_FARE,
  lookupDailyCap,
  lookupWeeklyCap,
  roundToNearest10p,
  type RailcardType,
  RAILCARDS,
  TRAVELCARD_WEEKLY,
  TRAVELCARD_MONTHLY,
  TRAVELCARD_ANNUAL,
  STUDENT_TRAVELCARD_ANNUAL,
  STUDENT_PHOTOCARD_FEE,
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
      const dayOfWeek = j.date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      let isPeakFare = false;
      if (!isWeekend) {
        if (j.timePeriod === '06:30-09:30' || j.timePeriod === '16:00-19:00') {
          isPeakFare = true;
        }
      }

      // Calculate raw single fare
      const zoneRange = getZoneRange(j.originZone, j.destinationZone);
      const fare = j.mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, j.mode);
      
      let railcardFare = fare;
      if (j.mode !== 'bus') {
        if (!isPeakFare || railcard.appliesToPeak) {
          railcardFare = roundToNearest10p(fare * (1 - railcard.discount));
        }
      }

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
      const dayOfWeek = j.date.getDay();
      return (dayOfWeek >= 1 && dayOfWeek <= 5) && (j.timePeriod === '04:30-06:29' || j.timePeriod === '06:30-09:30');
    });
    
    if (maxZoneRange === 'Z1' || maxZoneRange === 'Z2') {
      maxZoneRange = 'Z1-2';
    }
    
    const dailyCap = lookupDailyCap(maxZoneRange, isPeakDay);
    const cappedFare = Math.min(totalFare, dailyCap);
    const cappedFareRailcard = Math.min(totalFareRailcard, dailyCap);
    const capHit = totalFare >= dailyCap;

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
    });
  }

  days.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group by week
  const weekMap = new Map<string, ForecastDay[]>();
  for (const day of days) {
    const monday = getMonday(day.date);
    const key = monday.toISOString().split('T')[0];
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(day);
  }

  const weeklyBreakdown: ForecastWeek[] = [];
  for (const [weekKey, weekDays] of weekMap) {
    const weekStart = new Date(weekKey);
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

    const weeklyCap = lookupWeeklyCap(maxRange);

    weeklyBreakdown.push({
      weekStart,
      weekEnd,
      days: weekDays,
      totalFare: round2(totalFare),
      totalFareRailcard: round2(totalFareRailcard),
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

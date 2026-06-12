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
  type FareType,
  FARE_TYPES,
  TRAVELCARD_WEEKLY,
  TRAVELCARD_MONTHLY,
  TRAVELCARD_ANNUAL,
  STUDENT_TRAVELCARD_ANNUAL,
  STUDENT_PHOTOCARD_FEE,
  isPeakJourney,
  getRepresentativeTime,
  formatLocalDate,
  parseLocalDate,
  getTravelcardJourneyFare,
  getBusPassJourneyFare,
} from '../data/fareData';

export interface ForecastDay {
  date: Date;
  dateStr: string;
  journeys: PlannedJourney[];
  totalFare: number;
  totalFareFareType: number;
  dailyCap: number;
  cappedFare: number;
  cappedFareFareType: number;
  capHit: boolean;
  capProgress: number;
  capHitFareType: boolean;
  capProgressFareType: number;
}

export interface ForecastResult {
  days: ForecastDay[];
  weeklyBreakdown: ForecastWeek[];
  totalPayg: number;
  totalPaygFareType: number;
  totalPaygCapped: number;
  totalPaygFareTypeCapped: number;
  projections: CostProjection;
}

export interface ForecastWeek {
  weekStart: Date;
  weekEnd: Date;
  days: ForecastDay[];
  totalFare: number;
  totalFareFareType: number;
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
  paygFareType: number;
  travelcard: Record<string, number>;
  studentTravelcard: Record<string, number>;
  bestOption: string;
  bestCost: number;
}

// Run forecast on planned journeys
export function runForecast(
  plannedJourneys: PlannedJourney[],
  fareType: FareType,
  fareTypeCost: number
): ForecastResult {
  const fareTypeInfo = FARE_TYPES[fareType];

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
    let totalFareFareType = 0;
    let maxZoneSpread = 0;
    let maxZoneRange = 'Z1';

    for (const j of journeys) {
      const repTime = getRepresentativeTime(j.timePeriod);
      const isPeakFare = isPeakJourney(j.date, repTime, j.originZone, j.destinationZone);

      // Calculate raw single fare — prefer station-specific API fares when available
      const zoneRange = getZoneRange(j.originZone, j.destinationZone);
      let fare: number;
      if (j.isAdvancedMode && j.exactFarePeak !== undefined && j.exactFareOffPeak !== undefined) {
        fare = isPeakFare ? j.exactFarePeak : j.exactFareOffPeak;
      } else {
        fare = j.mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, j.mode);
      }
      
      let fareTypeFare = calculateDiscountedFare(fare, fareType, isPeakFare, j.mode === 'bus', j.originZone, j.destinationZone, j.mode);

      totalFare += fare;
      totalFareFareType += fareTypeFare;

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
    const fareTypeDailyCap = lookupDailyCap(maxZoneRange, isPeakDay, fareType);
    const cappedFare = Math.min(totalFare, dailyCap);
    const cappedFareFareType = Math.min(totalFareFareType, fareTypeDailyCap);
    const capHit = totalFare >= dailyCap;
    const capHitFareType = totalFareFareType >= fareTypeDailyCap;
    const capProgressFareType = fareTypeDailyCap > 0 ? Math.min(1, totalFareFareType / fareTypeDailyCap) : 0;

    days.push({
      date: journeys[0].date,
      dateStr,
      journeys,
      totalFare: round2(totalFare),
      totalFareFareType: round2(totalFareFareType),
      dailyCap,
      cappedFare: round2(cappedFare),
      cappedFareFareType: round2(cappedFareFareType),
      capHit,
      capProgress: Math.min(1, totalFare / dailyCap),
      capHitFareType,
      capProgressFareType,
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
    const totalFareFareType = weekDays.reduce((s, d) => s + d.cappedFareFareType, 0);

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
    const fareTypeWeeklyCap = lookupWeeklyCap(maxRange, fareType);

    // Apply weekly cap to total if needed
    const cappedTotalFare = Math.min(totalFare, weeklyCap);
    const cappedTotalFareFareType = Math.min(totalFareFareType, fareTypeWeeklyCap);

    // Distribute the weekly caps chronologically across daily spend boxes
    weekDays.sort((a, b) => a.date.getTime() - b.date.getTime());
    let runningWeekTotal = 0;
    let runningWeekTotalFareType = 0;
    for (const d of weekDays) {
      const remainingWeeklyCap = Math.max(0, weeklyCap - runningWeekTotal);
      const remainingWeeklyCapFareType = Math.max(0, fareTypeWeeklyCap - runningWeekTotalFareType);

      const oldCappedFare = d.cappedFare;
      const oldCappedFareFareType = d.cappedFareFareType;

      d.cappedFare = round2(Math.min(oldCappedFare, remainingWeeklyCap));
      d.cappedFareFareType = round2(Math.min(oldCappedFareFareType, remainingWeeklyCapFareType));

      runningWeekTotal += d.cappedFare;
      runningWeekTotalFareType += d.cappedFareFareType;

      // Mark cap hit and progress as complete if daily cap OR weekly cap is hit
      if (oldCappedFareFareType > d.cappedFareFareType || runningWeekTotalFareType >= fareTypeWeeklyCap) {
        d.capHitFareType = true;
        d.capProgressFareType = 1.0;
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
      totalFareFareType: round2(cappedTotalFareFareType),
      weeklyCap,
      capHit: totalFare >= weeklyCap,
      capProgress: Math.min(1, totalFare / weeklyCap),
    });
  }

  weeklyBreakdown.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  const totalPayg = round2(days.reduce((s, d) => s + d.totalFare, 0));
  const totalPaygFareType = round2(days.reduce((s, d) => s + d.totalFareFareType, 0));
  const totalPaygCapped = round2(days.reduce((s, d) => s + d.cappedFare, 0));
  const totalPaygFareTypeCapped = round2(days.reduce((s, d) => s + d.cappedFareFareType, 0));

  const totalWeeks = weeklyBreakdown.length || 1;
  const avgWeekly = totalPaygCapped / totalWeeks;
  const avgWeeklyFareType = totalPaygFareTypeCapped / totalWeeks;

  // Build projections
  const projections: CostProjection = {
    weekly: buildProductCosts(avgWeekly, avgWeeklyFareType + fareTypeCost / 52),
    monthly: buildProductCosts(avgWeekly * 4.33, avgWeeklyFareType * 4.33 + fareTypeCost / 12),
    annual: buildProductCosts(avgWeekly * 52, avgWeeklyFareType * 52 + fareTypeCost),
  };

  return {
    days,
    weeklyBreakdown,
    totalPayg,
    totalPaygFareType,
    totalPaygCapped,
    totalPaygFareTypeCapped,
    projections,
  };
}

function buildProductCosts(payg: number, paygFareType: number): ProductCosts {
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

  if (paygFareType < bestCost) {
    bestOption = 'PAYG + Fare Type';
    bestCost = paygFareType;
  }

  return {
    payg: round2(payg),
    paygFareType: round2(paygFareType),
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

export function simulatePlannedJourneysSpend(
  plannedJourneys: PlannedJourney[],
  fareType: FareType,
  productType: 'bus_pass' | 'travelcard',
  tcZoneRange: string = 'Z1-2'
): number {
  const dayMap = new Map<string, PlannedJourney[]>();
  for (const j of plannedJourneys) {
    const key = j.dateStr;
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(j);
  }

  const days: { date: Date; dateStr: string; totalFare: number; maxZoneRange: string; isPeakDay: boolean }[] = [];

  for (const [dateStr, journeys] of dayMap) {
    let totalFare = 0;
    let maxZoneSpread = 0;
    let maxZoneRange = 'Z1';

    for (const j of journeys) {
      const repTime = getRepresentativeTime(j.timePeriod);
      const isPeakFare = isPeakJourney(j.date, repTime, j.originZone, j.destinationZone);
      const zoneRange = getZoneRange(j.originZone, j.destinationZone);
      
      let rawFare: number;
      if (j.isAdvancedMode && j.exactFarePeak !== undefined && j.exactFareOffPeak !== undefined) {
        rawFare = isPeakFare ? j.exactFarePeak : j.exactFareOffPeak;
      } else {
        rawFare = j.mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, j.mode);
      }
      const baseFare = calculateDiscountedFare(rawFare, fareType, isPeakFare, j.mode === 'bus', j.originZone, j.destinationZone, j.mode);

      let passFare = baseFare;
      const mockJourneyForPass = {
        mode: j.mode,
        originZone: j.originZone,
        destinationZone: j.destinationZone,
        isPeak: isPeakFare
      };

      if (productType === 'bus_pass') {
        passFare = getBusPassJourneyFare(mockJourneyForPass, baseFare);
      } else {
        passFare = getTravelcardJourneyFare(mockJourneyForPass, tcZoneRange, baseFare, fareType);
      }

      totalFare += passFare;

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

    days.push({
      date: journeys[0].date,
      dateStr,
      totalFare,
      maxZoneRange,
      isPeakDay
    });
  }

  days.sort((a, b) => a.date.getTime() - b.date.getTime());

  const weekMap = new Map<string, typeof days>();
  for (const day of days) {
    const monday = getMonday(day.date);
    const key = formatLocalDate(monday);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(day);
  }

  let totalCappedSpend = 0;

  for (const [weekKey, weekDays] of weekMap) {
    for (const d of weekDays) {
      const dailyCap = lookupDailyCap(d.maxZoneRange, d.isPeakDay, fareType);
      d.totalFare = Math.min(d.totalFare, dailyCap);
    }

    const weekStart = parseLocalDate(weekKey);
    const totalWeekFare = weekDays.reduce((s, d) => s + d.totalFare, 0);

    const weekJourneys = weekDays.flatMap(d => dayMap.get(d.dateStr) || []);
    let maxSpread = 0;
    let maxRange = 'Z1';
    for (const j of weekJourneys) {
      const zr = getZoneRange(j.originZone, j.destinationZone);
      const parts = zr.replace('Z', '').split('-');
      const spread = parts.length > 1 ? parseInt(parts[1]) - parseInt(parts[0]) : 0;
      if (spread > maxSpread) { maxSpread = spread; maxRange = zr; }
    }

    if (maxRange === 'Z1' || maxRange === 'Z2') {
      maxRange = 'Z1-2';
    }

    const weeklyCap = lookupWeeklyCap(maxRange, fareType);
    totalCappedSpend += Math.min(totalWeekFare, weeklyCap);
  }

  return totalCappedSpend;
}

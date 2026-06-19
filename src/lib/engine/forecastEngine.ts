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
  getDailyBusCap,
  getWeeklyBusCap,
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
  cappedBusFare?: number;
  cappedBusFareFareType?: number;
  cappedRailFare?: number;
  cappedRailFareFareType?: number;
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
    
    const dailyBusCap = getDailyBusCap('none');
    const fareTypeDailyBusCap = getDailyBusCap(fareType);

    const hasRail = journeys.some(j => j.mode !== 'bus');
    const dailyCap = hasRail ? lookupDailyCap(maxZoneRange, isPeakDay, 'none') : dailyBusCap;
    const fareTypeDailyCap = hasRail ? lookupDailyCap(maxZoneRange, isPeakDay, fareType) : fareTypeDailyBusCap;

    // Apply daily capping sequentially to the planned journeys of the day
    const sortedJourneys = [...journeys].sort((a, b) => (a.timePeriod || '').localeCompare(b.timePeriod || ''));
    let runningSpend = 0;
    let runningSpendFareType = 0;
    let runningBusSpend = 0;
    let runningBusSpendFareType = 0;

    let dayCappedBus = 0;
    let dayCappedBusFareType = 0;
    let dayCappedRail = 0;
    let dayCappedRailFareType = 0;

    for (const j of sortedJourneys) {
      const repTime = getRepresentativeTime(j.timePeriod);
      const isPeakFare = isPeakJourney(j.date, repTime, j.originZone, j.destinationZone);

      const zoneRange = getZoneRange(j.originZone, j.destinationZone);
      let fare: number;
      if (j.isAdvancedMode && j.exactFarePeak !== undefined && j.exactFareOffPeak !== undefined) {
        fare = isPeakFare ? j.exactFarePeak : j.exactFareOffPeak;
      } else {
        fare = j.mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, j.mode);
      }
      
      let fareTypeFare = calculateDiscountedFare(fare, fareType, isPeakFare, j.mode === 'bus', j.originZone, j.destinationZone, j.mode);

      // Standard adult capping
      let finalFare = fare;
      if (j.mode === 'bus') {
        let busPart = fare;
        if (runningBusSpend >= dailyBusCap) {
          busPart = 0;
        } else if (runningBusSpend + fare > dailyBusCap) {
          busPart = dailyBusCap - runningBusSpend;
        }

        if (runningSpend >= dailyCap) {
          finalFare = 0;
        } else if (runningSpend + busPart > dailyCap) {
          finalFare = dailyCap - runningSpend;
        } else {
          finalFare = busPart;
        }
        runningBusSpend += finalFare;
        runningSpend += finalFare;
        dayCappedBus += finalFare;
      } else {
        if (runningSpend >= dailyCap) {
          finalFare = 0;
        } else if (runningSpend + fare > dailyCap) {
          finalFare = dailyCap - runningSpend;
        } else {
          finalFare = fare;
        }
        runningSpend += finalFare;
        dayCappedRail += finalFare;
      }

      // Concession capping
      let finalFareFareType = fareTypeFare;
      if (j.mode === 'bus') {
        let busPart = fareTypeFare;
        if (runningBusSpendFareType >= fareTypeDailyBusCap) {
          busPart = 0;
        } else if (runningBusSpendFareType + fareTypeFare > fareTypeDailyBusCap) {
          busPart = fareTypeDailyBusCap - runningBusSpendFareType;
        }

        if (runningSpendFareType >= fareTypeDailyCap) {
          finalFareFareType = 0;
        } else if (runningSpendFareType + busPart > fareTypeDailyCap) {
          finalFareFareType = fareTypeDailyCap - runningSpendFareType;
        } else {
          finalFareFareType = busPart;
        }
        runningBusSpendFareType += finalFareFareType;
        runningSpendFareType += finalFareFareType;
        dayCappedBusFareType += finalFareFareType;
      } else {
        if (runningSpendFareType >= fareTypeDailyCap) {
          finalFareFareType = 0;
        } else if (runningSpendFareType + fareTypeFare > fareTypeDailyCap) {
          finalFareFareType = fareTypeDailyCap - runningSpendFareType;
        } else {
          finalFareFareType = fareTypeFare;
        }
        runningSpendFareType += finalFareFareType;
        dayCappedRailFareType += finalFareFareType;
      }
    }

    const capHit = runningSpend >= dailyCap || runningBusSpend >= dailyBusCap;
    const capHitFareType = runningSpendFareType >= fareTypeDailyCap || runningBusSpendFareType >= fareTypeDailyBusCap;
    const capProgressFareType = fareTypeDailyCap > 0 ? Math.min(1, runningSpendFareType / fareTypeDailyCap) : 0;

    days.push({
      date: journeys[0].date,
      dateStr,
      journeys,
      totalFare: round2(totalFare),
      totalFareFareType: round2(totalFareFareType),
      dailyCap,
      cappedFare: round2(runningSpend),
      cappedFareFareType: round2(runningSpendFareType),
      capHit,
      capProgress: Math.min(1, runningSpend / dailyCap),
      capHitFareType,
      capProgressFareType,
      cappedBusFare: round2(dayCappedBus),
      cappedBusFareFareType: round2(dayCappedBusFareType),
      cappedRailFare: round2(dayCappedRail),
      cappedRailFareFareType: round2(dayCappedRailFareType),
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

    const weeklyBusCap = getWeeklyBusCap('none');
    const fareTypeWeeklyBusCap = getWeeklyBusCap(fareType);

    const hasRail = allJourneys.some(j => j.mode !== 'bus');
    const weeklyCap = hasRail ? lookupWeeklyCap(maxRange, 'none') : weeklyBusCap;
    const fareTypeWeeklyCap = hasRail ? lookupWeeklyCap(maxRange, fareType) : fareTypeWeeklyBusCap;

    const weeklyBusSpend = weekDays.reduce((s, d) => s + (d.cappedBusFare ?? 0), 0);
    const weeklyBusSpendFareType = weekDays.reduce((s, d) => s + (d.cappedBusFareFareType ?? 0), 0);
    const weeklyRailSpend = weekDays.reduce((s, d) => s + (d.cappedRailFare ?? 0), 0);
    const weeklyRailSpendFareType = weekDays.reduce((s, d) => s + (d.cappedRailFareFareType ?? 0), 0);

    const cappedWeeklyBus = Math.min(weeklyBusSpend, weeklyBusCap);
    const cappedWeeklyBusFareType = Math.min(weeklyBusSpendFareType, fareTypeWeeklyBusCap);

    // Apply weekly mixed cap
    const cappedTotalFare = Math.min(weeklyRailSpend + cappedWeeklyBus, weeklyCap);
    const cappedTotalFareFareType = Math.min(weeklyRailSpendFareType + cappedWeeklyBusFareType, fareTypeWeeklyCap);

    // Distribute the weekly caps chronologically across daily spend boxes
    weekDays.sort((a, b) => a.date.getTime() - b.date.getTime());
    let runningBusSpendOfWeek = 0;
    let runningBusSpendOfWeekFareType = 0;
    let runningTotalSpendOfWeek = 0;
    let runningTotalSpendOfWeekFareType = 0;

    for (const d of weekDays) {
      const remainingWeeklyBusCap = Math.max(0, weeklyBusCap - runningBusSpendOfWeek);
      const remainingWeeklyBusCapFareType = Math.max(0, fareTypeWeeklyBusCap - runningBusSpendOfWeekFareType);

      const remainingWeeklyCap = Math.max(0, weeklyCap - runningTotalSpendOfWeek);
      const remainingWeeklyCapFareType = Math.max(0, fareTypeWeeklyCap - runningTotalSpendOfWeekFareType);

      const oldCappedFare = d.cappedFare;
      const oldCappedFareFareType = d.cappedFareFareType;

      const dCappedBus = d.cappedBusFare ?? 0;
      const dCappedBusFareType = d.cappedBusFareFareType ?? 0;
      const dCappedRail = d.cappedRailFare ?? 0;
      const dCappedRailFareType = d.cappedRailFareFareType ?? 0;

      const allowedBus = Math.min(dCappedBus, remainingWeeklyBusCap);
      const allowedBusFareType = Math.min(dCappedBusFareType, remainingWeeklyBusCapFareType);

      d.cappedFare = round2(Math.min(dCappedRail + allowedBus, remainingWeeklyCap));
      d.cappedFareFareType = round2(Math.min(dCappedRailFareType + allowedBusFareType, remainingWeeklyCapFareType));

      runningBusSpendOfWeek += allowedBus;
      runningBusSpendOfWeekFareType += allowedBusFareType;
      runningTotalSpendOfWeek += d.cappedFare;
      runningTotalSpendOfWeekFareType += d.cappedFareFareType;

      // Mark cap hit and progress as complete if daily cap OR weekly cap is hit
      if (oldCappedFareFareType > d.cappedFareFareType || runningTotalSpendOfWeekFareType >= fareTypeWeeklyCap || runningBusSpendOfWeekFareType >= fareTypeWeeklyBusCap) {
        d.capHitFareType = true;
        d.capProgressFareType = 1.0;
      }
      if (oldCappedFare > d.cappedFare || runningTotalSpendOfWeek >= weeklyCap || runningBusSpendOfWeek >= weeklyBusCap) {
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
      capHit: (weeklyBusSpend >= weeklyBusCap) || (weeklyRailSpend + cappedWeeklyBus >= weeklyCap),
      capProgress: Math.min(1, (weeklyRailSpend + cappedWeeklyBus) / weeklyCap),
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

  const days: { date: Date; dateStr: string; totalFare: number; maxZoneRange: string; isPeakDay: boolean; cappedBusFare?: number; cappedRailFare?: number; hasRail?: boolean }[] = [];

  for (const [dateStr, journeys] of dayMap) {
    let totalFare = 0;
    let totalRailFare = 0;
    let totalBusFare = 0;
    let maxZoneSpread = 0;
    let maxZoneRange = 'Z1';
    let hasRail = false;

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

      if (j.mode === 'bus') {
        totalBusFare += passFare;
      } else {
        totalRailFare += passFare;
        hasRail = true;
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

    const dailyBusCap = getDailyBusCap(fareType);
    const cappedBus = Math.min(totalBusFare, dailyBusCap);
    const dailyCap = hasRail ? lookupDailyCap(maxZoneRange, isPeakDay, fareType) : dailyBusCap;

    days.push({
      date: journeys[0].date,
      dateStr,
      totalFare: totalRailFare + cappedBus,
      maxZoneRange,
      isPeakDay,
      cappedBusFare: cappedBus,
      cappedRailFare: totalRailFare,
      hasRail
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
    const weeklyBusCap = getWeeklyBusCap(fareType);
    const weeklyBusSpend = weekDays.reduce((s, d) => s + (d.cappedBusFare ?? 0), 0);
    const weeklyRailSpend = weekDays.reduce((s, d) => s + (d.cappedRailFare ?? 0), 0);

    const cappedWeeklyBusSpend = Math.min(weeklyBusSpend, weeklyBusCap);

    for (const d of weekDays) {
      const dailyBusCap = getDailyBusCap(fareType);
      const dailyCap = d.hasRail ? lookupDailyCap(d.maxZoneRange, d.isPeakDay, fareType) : dailyBusCap;
      d.totalFare = Math.min(d.totalFare, dailyCap);
    }

    const weekStart = parseLocalDate(weekKey);
    const totalWeekFare = weekDays.reduce((s, d) => s + d.totalFare, 0);

    const weekJourneys = weekDays.flatMap(d => dayMap.get(d.dateStr) || []);
    let maxSpread = 0;
    let maxRange = 'Z1';
    let hasWeeklyRail = false;
    for (const j of weekJourneys) {
      const zr = getZoneRange(j.originZone, j.destinationZone);
      const parts = zr.replace('Z', '').split('-');
      const spread = parts.length > 1 ? parseInt(parts[1]) - parseInt(parts[0]) : 0;
      if (spread > maxSpread) { maxSpread = spread; maxRange = zr; }
      if (j.mode !== 'bus') hasWeeklyRail = true;
    }

    if (maxRange === 'Z1' || maxRange === 'Z2') {
      maxRange = 'Z1-2';
    }

    const weeklyCap = hasWeeklyRail ? lookupWeeklyCap(maxRange, fareType) : weeklyBusCap;
    const totalWeeklySpendBeforeMixedCap = weeklyRailSpend + cappedWeeklyBusSpend;
    totalCappedSpend += Math.min(totalWeeklySpendBeforeMixedCap, weeklyCap);
  }

  return totalCappedSpend;
}

/**
 * Simulate the total capped spend over a planning period where a Travelcard is only active
 * for a specific sub-range of dates, and PAYG is used for the remaining days.
 */
export function simulateHybridPlannedJourneysSpend(
  plannedJourneys: PlannedJourney[],
  tcZoneRange: string,
  tcStartDate: Date | null,
  tcEndDate: Date | null,
  tcFareType: FareType,
  paygFareType: FareType
): number {
  const dayMap = new Map<string, PlannedJourney[]>();
  for (const j of plannedJourneys) {
    const key = j.dateStr;
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(j);
  }

  const days: { date: Date; dateStr: string; totalFare: number; maxZoneRange: string; isPeakDay: boolean; isTcActive: boolean; cappedBusFare?: number; cappedRailFare?: number; hasRail?: boolean }[] = [];

  for (const [dateStr, journeys] of dayMap) {
    let totalFare = 0;
    let totalRailFare = 0;
    let totalBusFare = 0;
    let maxZoneSpread = 0;
    let maxZoneRange = 'Z1';
    let hasRail = false;

    const firstJourneyDate = journeys[0].date;
    // Normalize date parts to compare dates (ignoring time)
    const dTime = new Date(firstJourneyDate.getFullYear(), firstJourneyDate.getMonth(), firstJourneyDate.getDate()).getTime();
    
    let isTcActive = false;
    if (tcStartDate && tcEndDate) {
      const tcStartTime = new Date(tcStartDate.getFullYear(), tcStartDate.getMonth(), tcStartDate.getDate()).getTime();
      const tcEndTime = new Date(tcEndDate.getFullYear(), tcEndDate.getMonth(), tcEndDate.getDate()).getTime();
      isTcActive = dTime >= tcStartTime && dTime <= tcEndTime;
    }

    const activeFareType = isTcActive ? tcFareType : paygFareType;

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

      const baseFare = calculateDiscountedFare(rawFare, activeFareType, isPeakFare, j.mode === 'bus', j.originZone, j.destinationZone, j.mode);

      let fare = baseFare;
      if (isTcActive) {
        const mockJourneyForPass = {
          mode: j.mode,
          originZone: j.originZone,
          destinationZone: j.destinationZone,
          isPeak: isPeakFare
        };
        // Travelcard coverage applies
        fare = getTravelcardJourneyFare(mockJourneyForPass, tcZoneRange, baseFare, activeFareType);
      }

      if (j.mode === 'bus') {
        totalBusFare += fare;
      } else {
        totalRailFare += fare;
        hasRail = true;
      }

      totalFare += fare;

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

    const activeDailyBusCap = getDailyBusCap(activeFareType);
    const cappedBus = Math.min(totalBusFare, activeDailyBusCap);
    const dailyCap = hasRail ? lookupDailyCap(maxZoneRange, isPeakDay, activeFareType) : activeDailyBusCap;

    days.push({
      date: firstJourneyDate,
      dateStr,
      totalFare: totalRailFare + cappedBus,
      maxZoneRange,
      isPeakDay,
      isTcActive,
      cappedBusFare: cappedBus,
      cappedRailFare: totalRailFare,
      hasRail
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
    // Determine the capping fare type for this week.
    // If the Travelcard is active for any day in this week, use the tcFareType (student/adult).
    // Otherwise, use paygFareType.
    const weekHasTc = weekDays.some(d => d.isTcActive);
    const weekFareType = weekHasTc ? tcFareType : paygFareType;

    const activeWeeklyBusCap = getWeeklyBusCap(weekFareType);
    const weeklyBusSpend = weekDays.reduce((s, d) => s + (d.cappedBusFare ?? 0), 0);
    const weeklyRailSpend = weekDays.reduce((s, d) => s + (d.cappedRailFare ?? 0), 0);

    const cappedWeeklyBusSpend = Math.min(weeklyBusSpend, activeWeeklyBusCap);

    for (const d of weekDays) {
      const activeDailyBusCap = getDailyBusCap(d.isTcActive ? tcFareType : paygFareType);
      const dailyCap = d.hasRail ? lookupDailyCap(d.maxZoneRange, d.isPeakDay, d.isTcActive ? tcFareType : paygFareType) : activeDailyBusCap;
      d.totalFare = Math.min(d.totalFare, dailyCap);
    }

    const weekStart = parseLocalDate(weekKey);
    const totalWeekFare = weekDays.reduce((s, d) => s + d.totalFare, 0);

    const weekJourneys = weekDays.flatMap(d => dayMap.get(d.dateStr) || []);
    let maxSpread = 0;
    let maxRange = 'Z1';
    let hasWeeklyRail = false;
    for (const j of weekJourneys) {
      const zr = getZoneRange(j.originZone, j.destinationZone);
      const parts = zr.replace('Z', '').split('-');
      const spread = parts.length > 1 ? parseInt(parts[1]) - parseInt(parts[0]) : 0;
      if (spread > maxSpread) { maxSpread = spread; maxRange = zr; }
      if (j.mode !== 'bus') hasWeeklyRail = true;
    }

    if (maxRange === 'Z1' || maxRange === 'Z2') {
      maxRange = 'Z1-2';
    }

    const weeklyCap = hasWeeklyRail ? lookupWeeklyCap(maxRange, weekFareType) : activeWeeklyBusCap;
    const totalWeeklySpendBeforeMixedCap = weeklyRailSpend + cappedWeeklyBusSpend;
    totalCappedSpend += Math.min(totalWeeklySpendBeforeMixedCap, weeklyCap);
  }

  return totalCappedSpend;
}

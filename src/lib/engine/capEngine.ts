// Cap Engine — daily and weekly cap tracking
import type { ClassifiedJourney } from './journeyClassifier';
import type { FareResult } from './fareCalculator';
import { lookupDailyCap, lookupWeeklyCap, BUS_DAILY_CAP } from '../data/fareData';

export interface DayCapResult {
  date: string;
  dateObj: Date;
  journeys: FareResult[];
  totalSpend: number;
  railJourneySpend: number;
  busSpend: number;
  maxZoneRange: string;
  dailyCap: number;
  busDailyCap: number;
  capHit: boolean;
  capType: 'peak' | 'off-peak' | 'none';
  savedByCap: number;
  capProgress: number; // 0-1 progress toward cap
}

export interface WeekCapResult {
  weekStart: Date;
  weekEnd: Date;
  days: DayCapResult[];
  totalSpend: number;
  maxZoneRange: string;
  weeklyCap: number;
  capHit: boolean;
  savedByCap: number;
  capProgress: number;
}

// Group journeys by calendar day
function groupByDay(fareResults: FareResult[]): Map<string, FareResult[]> {
  const dayMap = new Map<string, FareResult[]>();

  for (const result of fareResults) {
    const dateKey = result.journey.raw.dateStr;
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, []);
    }
    dayMap.get(dateKey)!.push(result);
  }

  return dayMap;
}

// Get the widest zone range for a set of journeys (determines which cap applies)
function getMaxZoneRange(journeys: FareResult[]): string {
  let maxSpread = 0;
  let maxRange = 'Z1';

  for (const j of journeys) {
    if (j.journey.isBus) continue;
    const range = j.journey.zoneRange;
    if (!range) continue;

    // Parse zone range to get spread
    const parts = range.replace('Z', '').split('-');
    const min = parseInt(parts[0], 10);
    const max = parts.length > 1 ? parseInt(parts[1], 10) : min;
    const spread = max - min;

    if (spread > maxSpread || (spread === maxSpread && min < parseInt(maxRange.replace('Z', '').split('-')[0], 10))) {
      maxSpread = spread;
      maxRange = range;
    }
  }

  return maxRange;
}

// Calculate daily cap analysis
export function calculateDailyCaps(fareResults: FareResult[]): DayCapResult[] {
  const dayGroups = groupByDay(fareResults);
  const results: DayCapResult[] = [];

  for (const [dateStr, journeys] of dayGroups) {
    const railJourneys = journeys.filter((j) => !j.journey.isBus);
    const busJourneys = journeys.filter((j) => j.journey.isBus);

    const maxZoneRange = getMaxZoneRange(journeys);
    const dailyCap = lookupDailyCap(maxZoneRange);

    // Calculate actual spend
    const railSpend = railJourneys.reduce((sum, j) => sum + j.actualCharge, 0);
    const busSpend = busJourneys.reduce((sum, j) => sum + j.actualCharge, 0);
    const totalSpend = railSpend + busSpend;

    // Calculate how much was saved by capping
    const uncappedRailSpend = railJourneys.reduce((sum, j) => sum + j.expectedFare, 0);
    const uncappedBusSpend = busJourneys.reduce((sum, j) => sum + j.expectedFare, 0);

    const capHit = totalSpend >= dailyCap * 0.95 || journeys.some((j) => j.journey.isCapHit);
    const savedByCap = capHit ? Math.max(0, (uncappedRailSpend + uncappedBusSpend) - totalSpend) : 0;
    const hasPeakJourney = journeys.some((j) => j.journey.isPeak);
    const capType = capHit ? (hasPeakJourney ? 'peak' : 'off-peak') : 'none';

    results.push({
      date: dateStr,
      dateObj: journeys[0].journey.raw.date,
      journeys,
      totalSpend: Math.round(totalSpend * 100) / 100,
      railJourneySpend: Math.round(railSpend * 100) / 100,
      busSpend: Math.round(busSpend * 100) / 100,
      maxZoneRange,
      dailyCap,
      busDailyCap: BUS_DAILY_CAP,
      capHit,
      capType,
      savedByCap: Math.round(savedByCap * 100) / 100,
      capProgress: Math.min(1, totalSpend / dailyCap),
    });
  }

  // Sort by date
  results.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  return results;
}

// Get Monday of the week for a given date
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Calculate weekly cap analysis
export function calculateWeeklyCaps(dailyResults: DayCapResult[]): WeekCapResult[] {
  // Group by week (Mon-Sun)
  const weekMap = new Map<string, DayCapResult[]>();

  for (const day of dailyResults) {
    const monday = getMonday(day.dateObj);
    const weekKey = monday.toISOString().split('T')[0];

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(day);
  }

  const results: WeekCapResult[] = [];

  for (const [weekKey, days] of weekMap) {
    const weekStart = new Date(weekKey);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Widest zone range across the week
    const allJourneys = days.flatMap((d) => d.journeys);
    const maxZoneRange = getMaxZoneRange(allJourneys);
    const weeklyCap = lookupWeeklyCap(maxZoneRange);

    const totalSpend = days.reduce((sum, d) => sum + d.totalSpend, 0);
    const capHit = totalSpend >= weeklyCap;
    const savedByCap = capHit ? Math.max(0, totalSpend - weeklyCap) : 0;

    results.push({
      weekStart,
      weekEnd,
      days,
      totalSpend: Math.round(totalSpend * 100) / 100,
      maxZoneRange,
      weeklyCap,
      capHit,
      savedByCap: Math.round(savedByCap * 100) / 100,
      capProgress: Math.min(1, totalSpend / weeklyCap),
    });
  }

  results.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  return results;
}

// Overall cap summary
export interface CapSummary {
  totalDays: number;
  daysCapHit: number;
  totalWeeks: number;
  weeksCapHit: number;
  totalSavedByDailyCap: number;
  totalSavedByWeeklyCap: number;
  averageDailySpend: number;
  averageWeeklySpend: number;
}

export function getCapSummary(
  dailyResults: DayCapResult[],
  weeklyResults: WeekCapResult[]
): CapSummary {
  return {
    totalDays: dailyResults.length,
    daysCapHit: dailyResults.filter((d) => d.capHit).length,
    totalWeeks: weeklyResults.length,
    weeksCapHit: weeklyResults.filter((w) => w.capHit).length,
    totalSavedByDailyCap: Math.round(
      dailyResults.reduce((sum, d) => sum + d.savedByCap, 0) * 100
    ) / 100,
    totalSavedByWeeklyCap: Math.round(
      weeklyResults.reduce((sum, w) => sum + w.savedByCap, 0) * 100
    ) / 100,
    averageDailySpend:
      dailyResults.length > 0
        ? Math.round(
            (dailyResults.reduce((sum, d) => sum + d.totalSpend, 0) / dailyResults.length) * 100
          ) / 100
        : 0,
    averageWeeklySpend:
      weeklyResults.length > 0
        ? Math.round(
            (weeklyResults.reduce((sum, w) => sum + w.totalSpend, 0) / weeklyResults.length) * 100
          ) / 100
        : 0,
  };
}

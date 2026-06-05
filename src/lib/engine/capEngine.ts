// Cap Engine — daily and weekly cap tracking
import type { ClassifiedJourney } from './journeyClassifier';
import type { FareResult } from './fareCalculator';
import { lookupDailyCap, lookupWeeklyCap, BUS_DAILY_CAP, DAILY_CAPS, DAILY_CAPS_OFFPEAK } from '../data/fareData';

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
  let minZone = 99;
  let maxZone = 0;
  let hasRail = false;

  for (const j of journeys) {
    if (j.journey.isBus) continue;
    const range = j.journey.zoneRange;
    if (!range) continue;

    hasRail = true;
    const parts = range.replace('Z', '').split('-');
    const z1 = parseInt(parts[0], 10);
    const z2 = parts.length > 1 ? parseInt(parts[1], 10) : z1;

    minZone = Math.min(minZone, z1, z2);
    maxZone = Math.max(maxZone, z1, z2);
  }

  if (!hasRail) return 'Z1-2'; // Default for bus-only or no-zone rail
  
  let result = minZone === maxZone ? `Z${minZone}` : `Z${minZone}-${maxZone}`;
  if (result === 'Z1' || result === 'Z2') {
    result = 'Z1-2';
  }
  return result;
}

// Calculate daily cap analysis
export function calculateDailyCaps(fareResults: FareResult[]): DayCapResult[] {
  const dayGroups = groupByDay(fareResults);
  const results: DayCapResult[] = [];

  for (const [dateStr, journeys] of dayGroups) {
    const railJourneys = journeys.filter((j) => !j.journey.isBus);
    const busJourneys = journeys.filter((j) => j.journey.isBus);

    let maxZoneRange = getMaxZoneRange(journeys);

    // Determine off-peak vs peak cap based on the first journey of the day
    let isPeakDay = false;
    if (journeys.length > 0) {
      const sortedJourneys = [...journeys].sort((a, b) => (a.journey.raw.startTime || '').localeCompare(b.journey.raw.startTime || ''));
      const firstTime = sortedJourneys[0].journey.raw.startTime;
      const dayOfWeek = sortedJourneys[0].journey.raw.date.getDay();
      
      // Peak cap applies if the first journey on a weekday is between 04:30 and 09:30
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && firstTime >= '04:30' && firstTime < '09:30') {
        isPeakDay = true;
      }
    }
    
    // Calculate actual spend first to infer cap if needed
    const railSpend = railJourneys.reduce((sum, j) => sum + j.actualCharge, 0);
    const busSpend = busJourneys.reduce((sum, j) => sum + j.actualCharge, 0);
    const totalSpend = railSpend + busSpend;
    
    let dailyCap = lookupDailyCap(maxZoneRange, isPeakDay);
    const explicitCapHit = journeys.some((j) => j.journey.isCapHit);
    
    if (explicitCapHit) {
      // Only infer if the current maxZoneRange's cap doesn't match the total spend
      const currentCapValue = isPeakDay ? DAILY_CAPS[maxZoneRange] ?? 16.30 : DAILY_CAPS_OFFPEAK[maxZoneRange] ?? 16.30;
      
      if (Math.abs(currentCapValue - totalSpend) > 0.05) {
        // Current cap does not match the actual spend! We need to infer it.
        const caps = isPeakDay ? DAILY_CAPS : DAILY_CAPS_OFFPEAK;
        let inferredZone: string | null = null;
        
        // Direct match - find the first one to avoid picking Z6 when Z1-2 matches
        for (const [zone, cap] of Object.entries(caps)) {
          if (Math.abs(cap - totalSpend) < 0.05) {
            inferredZone = zone;
            break; // Stop at the first match (e.g. Z1 or Z1-2)
          }
        }
        
        // Railcard off-peak match
        if (!inferredZone && !isPeakDay) {
          const unDiscounted = totalSpend / (2/3);
          for (const [zone, cap] of Object.entries(caps)) {
            if (Math.abs(cap - unDiscounted) < 0.20) {
              inferredZone = zone;
              break;
            }
          }
        }
        
        if (inferredZone) {
          maxZoneRange = inferredZone;
        }
      }
      
      // The total spend IS the daily cap
      dailyCap = totalSpend;
    }

    // Calculate how much was saved by capping
    const uncappedRailSpend = railJourneys.reduce((sum, j) => sum + j.expectedFare, 0);
    const uncappedBusSpend = busJourneys.reduce((sum, j) => sum + j.expectedFare, 0);

    const capHit = totalSpend >= dailyCap * 0.95 || journeys.some((j) => j.journey.isCapHit);
    const savedByCap = capHit ? Math.max(0, (uncappedRailSpend + uncappedBusSpend) - totalSpend) : 0;
    
    const capType = capHit ? (isPeakDay ? 'peak' : 'off-peak') : (isPeakDay ? 'peak' : 'off-peak');

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

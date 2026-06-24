// Cap Engine — daily and weekly cap tracking
import type { ClassifiedJourney } from './journeyClassifier';
import type { FareResult } from './fareCalculator';
import {
  lookupDailyCap,
  lookupWeeklyCap,
  BUS_DAILY_CAP,
  DAILY_CAPS,
  DAILY_CAPS_OFFPEAK,
  roundToNearest10p,
  type FareType,
  formatLocalDate,
  parseLocalDate,
  getDailyBusCap,
  getWeeklyBusCap,
  getOutsideZoneDailyCap,
  getOutsideZoneWeeklyCap,
  isStPancrasToStratford,
  isCapPeakForStation,
  getZoneRange,
  lookupFare,
  calculateDiscountedFare,
} from '../data/fareData';

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
  railcardActive: boolean;
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
function getMaxZoneRange(journeys: FareResult[], railcardType: FareType = 'none'): string {
  let minZone = 99;
  let maxZone = 0;
  let hasRail = false;

  for (const j of journeys) {
    if (j.journey.isBus) continue;
    // Exclude St Pancras-Stratford exception from zone capping ranges
    if (isStPancrasToStratford(
      j.journey.originNaptan,
      j.journey.destinationNaptan,
      j.journey.origin,
      j.journey.destination
    )) {
      continue;
    }
    const range = j.journey.zoneRange;
    if (!range) continue;

    hasRail = true;
    const parts = range.replace('Z', '').split('-');
    let z1 = parseInt(parts[0], 10);
    let z2 = parts.length > 1 ? parseInt(parts[1], 10) : z1;

    // Check if the journey actually went through a higher zone (e.g., Zone 1)
    // than origin/destination stations.
    if (z1 > 1 && z2 > 1) {
      const isPeak = j.journey.isPeak;
      // Get the fare to compare (raw charge if historical, or expectedFare if planned)
      const fareToCompare = j.journey.raw.charge > 0 ? j.journey.raw.charge : j.expectedFare;

      for (let zCand = z1 - 1; zCand >= 1; zCand--) {
        const candidateRange = `Z${zCand}-${Math.max(zCand, z2)}`;
        const candFare = lookupFare(candidateRange, isPeak, j.journey.mode);
        const discountedCandFare = calculateDiscountedFare(
          candFare,
          railcardType,
          isPeak,
          false,
          j.journey.originZone ?? undefined,
          j.journey.destinationZone ?? undefined,
          j.journey.mode,
          j.journey.originNaptan || j.journey.origin,
          j.journey.destinationNaptan || j.journey.destination
        );

        if (fareToCompare >= discountedCandFare - 0.05) {
          z1 = zCand;
        }
      }
    }

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
export function calculateDailyCaps(fareResults: FareResult[], railcardType: FareType = 'none'): DayCapResult[] {
  const dayGroups = groupByDay(fareResults);
  const results: DayCapResult[] = [];

  for (const [dateStr, journeys] of dayGroups) {
    const railJourneys = journeys.filter((j) => !j.journey.isBus);
    const busJourneys = journeys.filter((j) => j.journey.isBus);
    const nonExceptionRailJourneys = railJourneys.filter((j) => !isStPancrasToStratford(
      j.journey.originNaptan,
      j.journey.destinationNaptan,
      j.journey.origin,
      j.journey.destination
    ));

    let maxZoneRange = getMaxZoneRange(journeys, railcardType);

    // Determine cap type: the day is peak if at least one rail journey on that day is peak
    const isPeakDay = journeys.some(j => !j.journey.isBus && j.journey.isCapPeak);
    
    // Detect if this is a simulation (meaning the actualCharge values are expected/concession fares, not CSV values)
    const isSimulated = journeys.some((j) => j.actualCharge !== j.journey.raw.charge);

    // Calculate spend on normal (non-exception) journeys
    const normalJourneys = journeys.filter(j => !isStPancrasToStratford(
      j.journey.originNaptan,
      j.journey.destinationNaptan,
      j.journey.origin,
      j.journey.destination
    ));
    const normalTotalSpend = normalJourneys.reduce((sum, j) => sum + j.actualCharge, 0);
    
    let railcardActive = false;
    
    // Heuristic 1: Check single fares for ~34% discount
    for (const j of railJourneys) {
      if (j.actualCharge > 0 && j.expectedFare > 0) {
        const discountRatio = j.actualCharge / j.expectedFare;
        if (discountRatio > 0.5 && discountRatio < 0.75) {
          railcardActive = true;
          break;
        }
      }
    }

    const dailyBusCap = getDailyBusCap(railcardType);
    const hasRail = nonExceptionRailJourneys.length > 0;
    let dailyCap = hasRail ? lookupDailyCap(maxZoneRange, isPeakDay, railcardType) : dailyBusCap;

    let outsideZoneCap: number | null = null;
    for (const res of nonExceptionRailJourneys) {
      const oNaptan = res.journey.originNaptan;
      const dNaptan = res.journey.destinationNaptan;
      if (oNaptan) {
        const cap = getOutsideZoneDailyCap(oNaptan, railcardType, isPeakDay);
        if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
          outsideZoneCap = cap;
        }
      }
      if (dNaptan) {
        const cap = getOutsideZoneDailyCap(dNaptan, railcardType, isPeakDay);
        if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
          outsideZoneCap = cap;
        }
      }
    }
    if (outsideZoneCap !== null) {
      dailyCap = outsideZoneCap;
    }

    const explicitCapHit = journeys.some((j) => j.journey.isCapHit);
    
    if (explicitCapHit && !isSimulated) {
      // Heuristic 2: Cap inference based on actual spend of normal journeys
      let inferredZone: string | null = null;
      
      // Try finding an exact match in Adult Caps
      for (const [zone, cap] of Object.entries(DAILY_CAPS)) {
        if (Math.abs(cap - normalTotalSpend) < 0.05) {
          inferredZone = zone;
          break; 
        }
      }
      
      // Try finding an exact match in Railcard Caps
      if (!inferredZone) {
        for (const [zone, cap] of Object.entries(DAILY_CAPS_OFFPEAK)) {
          if (Math.abs(cap - normalTotalSpend) < 0.05) {
            inferredZone = zone;
            railcardActive = true; // Strict railcard cap hit
            break; 
          }
        }
      }
      
      if (inferredZone) {
        maxZoneRange = inferredZone;
      }
      
      // The daily cap is the normal total spend
      dailyCap = normalTotalSpend;
    }

    // Apply capping sequentially to the actualCharges
    const sortedJourneys = [...journeys].sort((a, b) => (a.journey.raw.startTime || '').localeCompare(b.journey.raw.startTime || ''));
    let runningSpend = 0;
    let runningBusSpend = 0;
    
    for (const res of sortedJourneys) {
      const originalCharge = res.actualCharge;
      let cappedCharge = originalCharge;
      
      const isPenalty = !!(res.journey.origin && res.journey.destination && res.journey.origin === res.journey.destination);
      const isException = isStPancrasToStratford(
        res.journey.originNaptan,
        res.journey.destinationNaptan,
        res.journey.origin,
        res.journey.destination
      );
      
      if (isPenalty || isException) {
        // Penalty fares / exception fares do not count towards the daily cap and cannot be capped
        cappedCharge = originalCharge;
      } else {
        if (res.journey.isBus) {
          // Apply daily bus cap first
          let busCharge = originalCharge;
          if (runningBusSpend >= dailyBusCap) {
            busCharge = 0;
          } else if (runningBusSpend + originalCharge > dailyBusCap) {
            busCharge = dailyBusCap - runningBusSpend;
          }

          // Apply overall mixed daily cap
          if (runningSpend >= dailyCap) {
            cappedCharge = 0;
          } else if (runningSpend + busCharge > dailyCap) {
            cappedCharge = dailyCap - runningSpend;
          } else {
            cappedCharge = busCharge;
          }

          runningBusSpend += cappedCharge;
          runningSpend += cappedCharge;
        } else {
          // Rail journey
          if (runningSpend >= dailyCap) {
            cappedCharge = 0;
          } else if (runningSpend + originalCharge > dailyCap) {
            cappedCharge = dailyCap - runningSpend;
          } else {
            cappedCharge = originalCharge;
          }
          runningSpend += cappedCharge;
        }
      }
      
      res.actualCharge = cappedCharge;
    }


    // Recalculate spends after capping
    const railSpend = sortedJourneys.filter((j) => !j.journey.isBus).reduce((sum, j) => sum + j.actualCharge, 0);
    const busSpend = sortedJourneys.filter((j) => j.journey.isBus).reduce((sum, j) => sum + j.actualCharge, 0);
    const totalSpend = railSpend + busSpend;

    // Calculate how much was saved by capping
    const uncappedRailSpend = railJourneys.reduce((sum, j) => sum + j.expectedFare, 0);
    const uncappedBusSpend = busJourneys.reduce((sum, j) => sum + j.expectedFare, 0);

    const capHit = (dailyCap > 0 && totalSpend >= dailyCap * 0.95) || (dailyBusCap > 0 && runningBusSpend >= dailyBusCap * 0.95) || journeys.some((j) => j.journey.isCapHit);
    const savedByCap = capHit ? Math.max(0, (uncappedRailSpend + uncappedBusSpend) - totalSpend) : 0;
    
    const capType = hasRail ? (isPeakDay ? 'peak' : 'off-peak') : 'none';

    results.push({
      date: dateStr,
      dateObj: journeys[0].journey.raw.date,
      journeys,
      totalSpend: Math.round(totalSpend * 100) / 100,
      railJourneySpend: Math.round(railSpend * 100) / 100,
      busSpend: Math.round(busSpend * 100) / 100,
      maxZoneRange,
      dailyCap,
      busDailyCap: dailyBusCap,
      capHit,
      capType,
      savedByCap: Math.round(savedByCap * 100) / 100,
      capProgress: Math.min(1, totalSpend / dailyCap),
      railcardActive,
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
export function calculateWeeklyCaps(dailyResults: DayCapResult[], railcardType: FareType = 'none'): WeekCapResult[] {
  // Group by week (Mon-Sun)
  const weekMap = new Map<string, DayCapResult[]>();

  for (const day of dailyResults) {
    const monday = getMonday(day.dateObj);
    const weekKey = formatLocalDate(monday);

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(day);
  }

  const results: WeekCapResult[] = [];

  for (const [weekKey, days] of weekMap) {
    const weekStart = parseLocalDate(weekKey);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Widest zone range across the week
    const allJourneys = days.flatMap((d) => d.journeys);
    const maxZoneRange = getMaxZoneRange(allJourneys, railcardType);
    const hasRail = allJourneys.some((j) => !j.journey.isBus && !isStPancrasToStratford(
      j.journey.originNaptan,
      j.journey.destinationNaptan,
      j.journey.origin,
      j.journey.destination
    ));
    
    const weeklyBusCap = getWeeklyBusCap(railcardType);
    let weeklyCap = hasRail ? lookupWeeklyCap(maxZoneRange, railcardType) : weeklyBusCap;

    let outsideZoneCap: number | null = null;
    for (const res of allJourneys) {
      if (res.journey.isBus) continue;
      if (isStPancrasToStratford(
        res.journey.originNaptan,
        res.journey.destinationNaptan,
        res.journey.origin,
        res.journey.destination
      )) {
        continue;
      }
      const oNaptan = res.journey.originNaptan;
      const dNaptan = res.journey.destinationNaptan;
      if (oNaptan) {
        const cap = getOutsideZoneWeeklyCap(oNaptan, railcardType);
        if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
          outsideZoneCap = cap;
        }
      }
      if (dNaptan) {
        const cap = getOutsideZoneWeeklyCap(dNaptan, railcardType);
        if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
          outsideZoneCap = cap;
        }
      }
    }
    if (outsideZoneCap !== null) {
      weeklyCap = outsideZoneCap;
    }

    const weeklyBusSpend = days.reduce((sum, d) => sum + d.busSpend, 0);
    const weeklyRailSpend = days.reduce((sum, d) => sum + d.railJourneySpend, 0);

    // Calculate weekly exception spend (St Pancras-Stratford)
    let weeklyExceptionSpend = 0;
    for (const d of days) {
      for (const j of d.journeys) {
        if (isStPancrasToStratford(
          j.journey.originNaptan,
          j.journey.destinationNaptan,
          j.journey.origin,
          j.journey.destination
        )) {
          weeklyExceptionSpend += j.actualCharge;
        }
      }
    }

    const weeklyNormalRailSpend = weeklyRailSpend - weeklyExceptionSpend;

    // Capped weekly bus spend
    const cappedWeeklyBusSpend = Math.min(weeklyBusSpend, weeklyBusCap);

    // Total spend before weekly mixed cap
    const totalWeeklySpendBeforeMixedCap = weeklyNormalRailSpend + cappedWeeklyBusSpend;

    // Final weekly spend capped at weekly mixed cap
    const finalWeeklySpend = Math.min(totalWeeklySpendBeforeMixedCap, weeklyCap) + weeklyExceptionSpend;

    const totalSpendWithoutWeeklyCapping = days.reduce((sum, d) => sum + d.totalSpend, 0);
    const capHit = (weeklyBusCap > 0 && weeklyBusSpend >= weeklyBusCap) || (weeklyCap > 0 && totalWeeklySpendBeforeMixedCap >= weeklyCap);
    const savedByCap = Math.max(0, totalSpendWithoutWeeklyCapping - finalWeeklySpend);

    results.push({
      weekStart,
      weekEnd,
      days,
      totalSpend: Math.round(finalWeeklySpend * 100) / 100,
      maxZoneRange,
      weeklyCap,
      capHit,
      savedByCap: Math.round(savedByCap * 100) / 100,
      capProgress: Math.min(1, finalWeeklySpend / weeklyCap),
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

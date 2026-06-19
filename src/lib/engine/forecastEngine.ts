// Forecast Engine — cost projections and product comparisons
import { getStationInfo } from '../data/stationService';
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
  getOutsideZoneDailyCap,
  getOutsideZoneWeeklyCap,
  isStPancrasToStratford,
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
  isBusCapHit?: boolean;
  isBusCapHitFareType?: boolean;
  isTotalCapHit?: boolean;
  isTotalCapHitFareType?: boolean;
  busProgress?: number;
  railProgress?: number;
  busProgressFareType?: number;
  railProgressFareType?: number;
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
  fareTypeWeeklyCap: number;
  capHit: boolean;
  capProgress: number;
  maxRange: string;
  outsideZoneStations: string[];
  stationsVisited: string[];
  widestCapStation?: string;
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
  fareTypeCost: number,
  activeFareType?: FareType
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
      let fareTypeFare: number;

      if (j.isAdvancedMode && j.exactFarePeak !== undefined && j.exactFareOffPeak !== undefined) {
        const basePeak = j.exactBaseFarePeak ?? j.exactFarePeak;
        const baseOffPeak = j.exactBaseFareOffPeak ?? j.exactFareOffPeak;
        fare = isPeakFare ? basePeak : baseOffPeak;

        if (activeFareType !== undefined && fareType === activeFareType) {
          fareTypeFare = isPeakFare ? j.exactFarePeak : j.exactFareOffPeak;
        } else {
          fareTypeFare = calculateDiscountedFare(
            fare,
            fareType,
            isPeakFare,
            j.mode === 'bus',
            j.originZone,
            j.destinationZone,
            j.mode,
            j.originStationName,
            j.destinationStationName
          );
        }
      } else {
        fare = j.mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, j.mode);
        fareTypeFare = calculateDiscountedFare(
          fare,
          fareType,
          isPeakFare,
          j.mode === 'bus',
          j.originZone,
          j.destinationZone,
          j.mode,
          j.originStationName,
          j.destinationStationName
        );
      }

      totalFare += fare;
      totalFareFareType += fareTypeFare;

      // Track max zone range for cap — exclude St Pancras-Stratford exceptions
      const oNaptan = j.originStationName ? getStationInfo(j.originStationName)?.naptanId : null;
      const dNaptan = j.destinationStationName ? getStationInfo(j.destinationStationName)?.naptanId : null;
      const isException = isStPancrasToStratford(oNaptan, dNaptan, j.originStationName, j.destinationStationName);

      if (!isException) {
        const parts = zoneRange.replace('Z', '').split('-');
        const spread = parts.length > 1 ? parseInt(parts[1]) - parseInt(parts[0]) : 0;
        if (spread > maxZoneSpread) {
          maxZoneSpread = spread;
          maxZoneRange = zoneRange;
        }
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

    const hasRail = journeys.some(j => {
      if (j.mode === 'bus') return false;
      const oNaptan = j.originStationName ? getStationInfo(j.originStationName)?.naptanId : null;
      const dNaptan = j.destinationStationName ? getStationInfo(j.destinationStationName)?.naptanId : null;
      return !isStPancrasToStratford(oNaptan, dNaptan, j.originStationName, j.destinationStationName);
    });
    let dailyCap = hasRail ? lookupDailyCap(maxZoneRange, isPeakDay, 'none') : dailyBusCap;
    let fareTypeDailyCap = hasRail ? lookupDailyCap(maxZoneRange, isPeakDay, fareType) : fareTypeDailyBusCap;

    const ozDailyCap = getOutsideZoneDailyCapForJourneys(journeys, 'none', isPeakDay);
    if (ozDailyCap !== null) dailyCap = ozDailyCap;
    const ozFtDailyCap = getOutsideZoneDailyCapForJourneys(journeys, fareType, isPeakDay);
    if (ozFtDailyCap !== null) fareTypeDailyCap = ozFtDailyCap;

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

    let dayExceptionSpend = 0;
    let dayExceptionSpendFareType = 0;

    for (const j of sortedJourneys) {
      const repTime = getRepresentativeTime(j.timePeriod);
      const isPeakFare = isPeakJourney(j.date, repTime, j.originZone, j.destinationZone);

      const zoneRange = getZoneRange(j.originZone, j.destinationZone);
      let fare: number;
      let fareTypeFare: number;

      if (j.isAdvancedMode && j.exactFarePeak !== undefined && j.exactFareOffPeak !== undefined) {
        const basePeak = j.exactBaseFarePeak ?? j.exactFarePeak;
        const baseOffPeak = j.exactBaseFareOffPeak ?? j.exactFareOffPeak;
        fare = isPeakFare ? basePeak : baseOffPeak;

        if (activeFareType !== undefined && fareType === activeFareType) {
          fareTypeFare = isPeakFare ? j.exactFarePeak : j.exactFareOffPeak;
        } else {
          fareTypeFare = calculateDiscountedFare(
            fare,
            fareType,
            isPeakFare,
            j.mode === 'bus',
            j.originZone,
            j.destinationZone,
            j.mode,
            j.originStationName,
            j.destinationStationName
          );
        }
      } else {
        fare = j.mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, j.mode);
        fareTypeFare = calculateDiscountedFare(
          fare,
          fareType,
          isPeakFare,
          j.mode === 'bus',
          j.originZone,
          j.destinationZone,
          j.mode,
          j.originStationName,
          j.destinationStationName
        );
      }

      const oNaptan = j.originStationName ? getStationInfo(j.originStationName)?.naptanId : null;
      const dNaptan = j.destinationStationName ? getStationInfo(j.destinationStationName)?.naptanId : null;
      const isException = isStPancrasToStratford(oNaptan, dNaptan, j.originStationName, j.destinationStationName);

      if (isException) {
        dayExceptionSpend += fare;
        dayExceptionSpendFareType += fareTypeFare;
        dayCappedRail += fare;
        dayCappedRailFareType += fareTypeFare;
      } else {
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
    }

    const isBusCapHit = dailyBusCap > 0 && runningBusSpend >= dailyBusCap;
    const isBusCapHitFareType = fareTypeDailyBusCap > 0 && runningBusSpendFareType >= fareTypeDailyBusCap;

    const isTotalCapHit = dailyCap > 0 && runningSpend >= dailyCap;
    const isTotalCapHitFareType = fareTypeDailyCap > 0 && runningSpendFareType >= fareTypeDailyCap;

    const capHit = isTotalCapHit || isBusCapHit;
    const capHitFareType = isTotalCapHitFareType || isBusCapHitFareType;
    
    const capProgress = dailyCap > 0 ? Math.min(1, runningSpend / dailyCap) : 0;
    const capProgressFareType = fareTypeDailyCap > 0 ? Math.min(1, runningSpendFareType / fareTypeDailyCap) : 0;

    const busProgress = dailyCap > 0 ? Math.min(1, dayCappedBus / dailyCap) : 0;
    const railProgress = dailyCap > 0 ? Math.min(1, dayCappedRail / dailyCap) : 0;
    const busProgressFareType = fareTypeDailyCap > 0 ? Math.min(1, dayCappedBusFareType / fareTypeDailyCap) : 0;
    const railProgressFareType = fareTypeDailyCap > 0 ? Math.min(1, dayCappedRailFareType / fareTypeDailyCap) : 0;

    days.push({
      date: journeys[0].date,
      dateStr,
      journeys,
      totalFare: round2(totalFare),
      totalFareFareType: round2(totalFareFareType),
      dailyCap,
      cappedFare: round2(runningSpend + dayExceptionSpend),
      cappedFareFareType: round2(runningSpendFareType + dayExceptionSpendFareType),
      capHit,
      capProgress,
      capHitFareType,
      capProgressFareType,
      cappedBusFare: round2(dayCappedBus),
      cappedBusFareFareType: round2(dayCappedBusFareType),
      cappedRailFare: round2(dayCappedRail),
      cappedRailFareFareType: round2(dayCappedRailFareType),
      isBusCapHit,
      isBusCapHitFareType,
      isTotalCapHit,
      isTotalCapHitFareType,
      busProgress,
      railProgress,
      busProgressFareType,
      railProgressFareType,
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

    // Determine weekly cap zone range — exclude St Pancras-Stratford exceptions
    const allJourneys = weekDays.flatMap((d) => d.journeys);
    let maxSpread = 0;
    let maxRange = 'Z1';
    for (const j of allJourneys) {
      const oNaptan = j.originStationName ? getStationInfo(j.originStationName)?.naptanId : null;
      const dNaptan = j.destinationStationName ? getStationInfo(j.destinationStationName)?.naptanId : null;
      if (isStPancrasToStratford(oNaptan, dNaptan, j.originStationName, j.destinationStationName)) {
        continue;
      }
      const zr = getZoneRange(j.originZone, j.destinationZone);
      const parts = zr.replace('Z', '').split('-');
      const spread = parts.length > 1 ? parseInt(parts[1]) - parseInt(parts[0]) : 0;
      if (spread > maxSpread) { maxSpread = spread; maxRange = zr; }
    }

    const weeklyBusCap = getWeeklyBusCap('none');
    const fareTypeWeeklyBusCap = getWeeklyBusCap(fareType);

    const hasRail = allJourneys.some(j => {
      if (j.mode !== 'bus') {
        const oNaptan = j.originStationName ? getStationInfo(j.originStationName)?.naptanId : null;
        const dNaptan = j.destinationStationName ? getStationInfo(j.destinationStationName)?.naptanId : null;
        return !isStPancrasToStratford(oNaptan, dNaptan, j.originStationName, j.destinationStationName);
      }
      return false;
    });
    let weeklyCap = hasRail ? lookupWeeklyCap(maxRange, 'none') : weeklyBusCap;
    let fareTypeWeeklyCap = hasRail ? lookupWeeklyCap(maxRange, fareType) : fareTypeWeeklyBusCap;

    const ozWeeklyCap = getOutsideZoneWeeklyCapForJourneys(allJourneys, 'none');
    if (ozWeeklyCap !== null) weeklyCap = ozWeeklyCap;
    const ozFtWeeklyCap = getOutsideZoneWeeklyCapForJourneys(allJourneys, fareType);
    if (ozFtWeeklyCap !== null) fareTypeWeeklyCap = ozFtWeeklyCap;

    const weeklyBusSpend = weekDays.reduce((s, d) => s + (d.cappedBusFare ?? 0), 0);
    const weeklyBusSpendFareType = weekDays.reduce((s, d) => s + (d.cappedBusFareFareType ?? 0), 0);
    const weeklyRailSpend = weekDays.reduce((s, d) => s + (d.cappedRailFare ?? 0), 0);
    const weeklyRailSpendFareType = weekDays.reduce((s, d) => s + (d.cappedRailFareFareType ?? 0), 0);

    // Calculate weekly exception spend (St Pancras-Stratford)
    let weeklyExceptionSpend = 0;
    let weeklyExceptionSpendFareType = 0;
    for (const d of weekDays) {
      for (const j of d.journeys) {
        const oNaptan = j.originStationName ? getStationInfo(j.originStationName)?.naptanId : null;
        const dNaptan = j.destinationStationName ? getStationInfo(j.destinationStationName)?.naptanId : null;
        if (isStPancrasToStratford(oNaptan, dNaptan, j.originStationName, j.destinationStationName)) {
          const repTime = getRepresentativeTime(j.timePeriod);
          const isPeakFare = isPeakJourney(j.date, repTime, j.originZone, j.destinationZone);
          const zoneRange = getZoneRange(j.originZone, j.destinationZone);
          
          let fare: number;
          let fareTypeFare: number;
          if (j.isAdvancedMode && j.exactFarePeak !== undefined && j.exactFareOffPeak !== undefined) {
            const basePeak = j.exactBaseFarePeak ?? j.exactFarePeak;
            const baseOffPeak = j.exactBaseFareOffPeak ?? j.exactFareOffPeak;
            fare = isPeakFare ? basePeak : baseOffPeak;
            if (activeFareType !== undefined && fareType === activeFareType) {
              fareTypeFare = isPeakFare ? j.exactFarePeak : j.exactFareOffPeak;
            } else {
              fareTypeFare = calculateDiscountedFare(fare, fareType, isPeakFare, false, j.originZone, j.destinationZone, j.mode, j.originStationName, j.destinationStationName);
            }
          } else {
            fare = lookupFare(zoneRange, isPeakFare, j.mode);
            fareTypeFare = calculateDiscountedFare(fare, fareType, isPeakFare, false, j.originZone, j.destinationZone, j.mode, j.originStationName, j.destinationStationName);
          }
          weeklyExceptionSpend += fare;
          weeklyExceptionSpendFareType += fareTypeFare;
        }
      }
    }

    const weeklyNormalRailSpend = weeklyRailSpend - weeklyExceptionSpend;
    const weeklyNormalRailSpendFareType = weeklyRailSpendFareType - weeklyExceptionSpendFareType;

    const cappedWeeklyBus = Math.min(weeklyBusSpend, weeklyBusCap);
    const cappedWeeklyBusFareType = Math.min(weeklyBusSpendFareType, fareTypeWeeklyBusCap);

    // Apply weekly mixed cap to normal spends, then add exception spends
    const cappedTotalFare = Math.min(weeklyNormalRailSpend + cappedWeeklyBus, weeklyCap) + weeklyExceptionSpend;
    const cappedTotalFareFareType = Math.min(weeklyNormalRailSpendFareType + cappedWeeklyBusFareType, fareTypeWeeklyCap) + weeklyExceptionSpendFareType;

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

      // Extract day exception spend
      let dayExceptionSpend = 0;
      let dayExceptionSpendFareType = 0;
      for (const j of d.journeys) {
        const oNaptan = j.originStationName ? getStationInfo(j.originStationName)?.naptanId : null;
        const dNaptan = j.destinationStationName ? getStationInfo(j.destinationStationName)?.naptanId : null;
        if (isStPancrasToStratford(oNaptan, dNaptan, j.originStationName, j.destinationStationName)) {
          const repTime = getRepresentativeTime(j.timePeriod);
          const isPeakFare = isPeakJourney(j.date, repTime, j.originZone, j.destinationZone);
          const zoneRange = getZoneRange(j.originZone, j.destinationZone);
          
          let fare: number;
          let fareTypeFare: number;
          if (j.isAdvancedMode && j.exactFarePeak !== undefined && j.exactFareOffPeak !== undefined) {
            const basePeak = j.exactBaseFarePeak ?? j.exactFarePeak;
            const baseOffPeak = j.exactBaseFareOffPeak ?? j.exactFareOffPeak;
            fare = isPeakFare ? basePeak : baseOffPeak;
            if (activeFareType !== undefined && fareType === activeFareType) {
              fareTypeFare = isPeakFare ? j.exactFarePeak : j.exactFareOffPeak;
            } else {
              fareTypeFare = calculateDiscountedFare(fare, fareType, isPeakFare, false, j.originZone, j.destinationZone, j.mode, j.originStationName, j.destinationStationName);
            }
          } else {
            fare = lookupFare(zoneRange, isPeakFare, j.mode);
            fareTypeFare = calculateDiscountedFare(fare, fareType, isPeakFare, false, j.originZone, j.destinationZone, j.mode, j.originStationName, j.destinationStationName);
          }
          dayExceptionSpend += fare;
          dayExceptionSpendFareType += fareTypeFare;
        }
      }

      const dCappedNormalRail = dCappedRail - dayExceptionSpend;
      const dCappedNormalRailFareType = dCappedRailFareType - dayExceptionSpendFareType;

      const allowedBus = Math.min(dCappedBus, remainingWeeklyBusCap);
      const allowedBusFareType = Math.min(dCappedBusFareType, remainingWeeklyBusCapFareType);

      const cappedNormalTotal = Math.min(dCappedNormalRail + allowedBus, remainingWeeklyCap);
      const cappedNormalTotalFareType = Math.min(dCappedNormalRailFareType + allowedBusFareType, remainingWeeklyCapFareType);

      d.cappedFare = round2(cappedNormalTotal + dayExceptionSpend);
      d.cappedFareFareType = round2(cappedNormalTotalFareType + dayExceptionSpendFareType);

      runningBusSpendOfWeek += allowedBus;
      runningBusSpendOfWeekFareType += allowedBusFareType;
      runningTotalSpendOfWeek += cappedNormalTotal;
      runningTotalSpendOfWeekFareType += cappedNormalTotalFareType;

      // Mark cap hit and progress as complete if daily cap OR weekly cap is hit
      if (
        oldCappedFareFareType > d.cappedFareFareType || 
        (fareTypeWeeklyCap > 0 && runningTotalSpendOfWeekFareType >= fareTypeWeeklyCap) || 
        (fareTypeWeeklyBusCap > 0 && runningBusSpendOfWeekFareType >= fareTypeWeeklyBusCap)
      ) {
        d.capHitFareType = true;
        d.capProgressFareType = 1.0;
      }
      if (
        oldCappedFare > d.cappedFare || 
        (weeklyCap > 0 && runningTotalSpendOfWeek >= weeklyCap) || 
        (weeklyBusCap > 0 && runningBusSpendOfWeek >= weeklyBusCap)
      ) {
        d.capHit = true;
        d.capProgress = 1.0;
      }
    }

    const stationsVisited = Array.from(new Set(
      allJourneys.flatMap(j => [j.originStationName, j.destinationStationName]).filter((name): name is string => !!name)
    ));
    const outsideZoneStations = stationsVisited.filter(name => {
      const info = getStationInfo(name);
      return info?.outsideZone === true;
    });

    const widestCapStation = getOutsideZoneWeeklyCapStationForJourneys(allJourneys, fareType) || undefined;

    weeklyBreakdown.push({
      weekStart,
      weekEnd,
      days: weekDays,
      totalFare: round2(cappedTotalFare),
      totalFareFareType: round2(cappedTotalFareFareType),
      weeklyCap,
      fareTypeWeeklyCap,
      capHit: (weeklyBusCap > 0 && weeklyBusSpend >= weeklyBusCap) || (weeklyCap > 0 && weeklyRailSpend + cappedWeeklyBus >= weeklyCap),
      capProgress: weeklyCap > 0 ? Math.min(1, (weeklyRailSpend + cappedWeeklyBus) / weeklyCap) : 0,
      maxRange,
      outsideZoneStations,
      stationsVisited,
      widestCapStation,
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
  tcZoneRange: string = 'Z1-2',
  activeFareType?: FareType
): number {
  const dayMap = new Map<string, PlannedJourney[]>();
  for (const j of plannedJourneys) {
    const key = j.dateStr;
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(j);
  }

  const days: { date: Date; dateStr: string; totalFare: number; maxZoneRange: string; isPeakDay: boolean; cappedBusFare?: number; cappedRailFare?: number; hasRail?: boolean; dailyCap: number }[] = [];

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
      
      let baseFare: number;
      if (j.isAdvancedMode && j.exactFarePeak !== undefined && j.exactFareOffPeak !== undefined) {
        if (activeFareType !== undefined && fareType === activeFareType) {
          baseFare = isPeakFare ? j.exactFarePeak : j.exactFareOffPeak;
        } else {
          const rawFare = isPeakFare ? (j.exactBaseFarePeak ?? j.exactFarePeak) : (j.exactBaseFareOffPeak ?? j.exactFareOffPeak);
          baseFare = calculateDiscountedFare(
            rawFare,
            fareType,
            isPeakFare,
            j.mode === 'bus',
            j.originZone,
            j.destinationZone,
            j.mode,
            j.originStationName,
            j.destinationStationName
          );
        }
      } else {
        const rawFare = j.mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, j.mode);
        baseFare = calculateDiscountedFare(
          rawFare,
          fareType,
          isPeakFare,
          j.mode === 'bus',
          j.originZone,
          j.destinationZone,
          j.mode,
          j.originStationName,
          j.destinationStationName
        );
      }

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
    let dailyCap = hasRail ? lookupDailyCap(maxZoneRange, isPeakDay, fareType) : dailyBusCap;
    const ozDailyCap = getOutsideZoneDailyCapForJourneys(journeys, fareType, isPeakDay);
    if (ozDailyCap !== null) dailyCap = ozDailyCap;

    days.push({
      date: journeys[0].date,
      dateStr,
      totalFare: totalRailFare + cappedBus,
      maxZoneRange,
      isPeakDay,
      cappedBusFare: cappedBus,
      cappedRailFare: totalRailFare,
      hasRail,
      dailyCap
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
      d.totalFare = Math.min(d.totalFare, d.dailyCap);
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

    let weeklyCap = hasWeeklyRail ? lookupWeeklyCap(maxRange, fareType) : weeklyBusCap;
    const ozWeeklyCap = getOutsideZoneWeeklyCapForJourneys(weekJourneys, fareType);
    if (ozWeeklyCap !== null) weeklyCap = ozWeeklyCap;

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
  paygFareType: FareType,
  activeGlobalFareType?: FareType
): number {
  const dayMap = new Map<string, PlannedJourney[]>();
  for (const j of plannedJourneys) {
    const key = j.dateStr;
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(j);
  }

  const days: { date: Date; dateStr: string; totalFare: number; maxZoneRange: string; isPeakDay: boolean; isTcActive: boolean; cappedBusFare?: number; cappedRailFare?: number; hasRail?: boolean; dailyCap: number }[] = [];

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
      
      let baseFare: number;
      if (j.isAdvancedMode && j.exactFarePeak !== undefined && j.exactFareOffPeak !== undefined) {
        if (activeGlobalFareType !== undefined && activeFareType === activeGlobalFareType) {
          baseFare = isPeakFare ? j.exactFarePeak : j.exactFareOffPeak;
        } else {
          const rawFare = isPeakFare ? (j.exactBaseFarePeak ?? j.exactFarePeak) : (j.exactBaseFareOffPeak ?? j.exactFareOffPeak);
          baseFare = calculateDiscountedFare(
            rawFare,
            activeFareType,
            isPeakFare,
            j.mode === 'bus',
            j.originZone,
            j.destinationZone,
            j.mode,
            j.originStationName,
            j.destinationStationName
          );
        }
      } else {
        const rawFare = j.mode === 'bus' ? BUS_SINGLE_FARE : lookupFare(zoneRange, isPeakFare, j.mode);
        baseFare = calculateDiscountedFare(
          rawFare,
          activeFareType,
          isPeakFare,
          j.mode === 'bus',
          j.originZone,
          j.destinationZone,
          j.mode,
          j.originStationName,
          j.destinationStationName
        );
      }

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
    let dailyCap = hasRail ? lookupDailyCap(maxZoneRange, isPeakDay, activeFareType) : activeDailyBusCap;
    const ozDailyCap = getOutsideZoneDailyCapForJourneys(journeys, activeFareType, isPeakDay);
    if (ozDailyCap !== null) dailyCap = ozDailyCap;

    days.push({
      date: firstJourneyDate,
      dateStr,
      totalFare: totalRailFare + cappedBus,
      maxZoneRange,
      isPeakDay,
      isTcActive,
      cappedBusFare: cappedBus,
      cappedRailFare: totalRailFare,
      hasRail,
      dailyCap
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
      d.totalFare = Math.min(d.totalFare, d.dailyCap);
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

    let weeklyCap = hasWeeklyRail ? lookupWeeklyCap(maxRange, weekFareType) : activeWeeklyBusCap;
    const ozWeeklyCap = getOutsideZoneWeeklyCapForJourneys(weekJourneys, weekFareType);
    if (ozWeeklyCap !== null) weeklyCap = ozWeeklyCap;

    const totalWeeklySpendBeforeMixedCap = weeklyRailSpend + cappedWeeklyBusSpend;
    totalCappedSpend += Math.min(totalWeeklySpendBeforeMixedCap, weeklyCap);
  }

  return totalCappedSpend;
}

function getOutsideZoneDailyCapForJourneys(journeys: PlannedJourney[], fareType: FareType, isPeakDay: boolean): number | null {
  let outsideZoneCap: number | null = null;
  for (const j of journeys) {
    if (j.mode === 'bus') continue;
    const oNaptan = j.originStationName ? getStationInfo(j.originStationName)?.naptanId : null;
    const dNaptan = j.destinationStationName ? getStationInfo(j.destinationStationName)?.naptanId : null;
    if (isStPancrasToStratford(oNaptan, dNaptan, j.originStationName, j.destinationStationName)) {
      continue;
    }
    if (j.originStationName) {
      const oInfo = getStationInfo(j.originStationName);
      if (oInfo && oInfo.naptanId) {
        const cap = getOutsideZoneDailyCap(oInfo.naptanId, fareType, isPeakDay);
        if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
          outsideZoneCap = cap;
        }
      }
    }
    if (j.destinationStationName) {
      const dInfo = getStationInfo(j.destinationStationName);
      if (dInfo && dInfo.naptanId) {
        const cap = getOutsideZoneDailyCap(dInfo.naptanId, fareType, isPeakDay);
        if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
          outsideZoneCap = cap;
        }
      }
    }
  }
  return outsideZoneCap;
}

function getOutsideZoneWeeklyCapForJourneys(journeys: PlannedJourney[], fareType: FareType): number | null {
  let outsideZoneCap: number | null = null;
  for (const j of journeys) {
    if (j.mode === 'bus') continue;
    const oNaptan = j.originStationName ? getStationInfo(j.originStationName)?.naptanId : null;
    const dNaptan = j.destinationStationName ? getStationInfo(j.destinationStationName)?.naptanId : null;
    if (isStPancrasToStratford(oNaptan, dNaptan, j.originStationName, j.destinationStationName)) {
      continue;
    }
    if (j.originStationName) {
      const oInfo = getStationInfo(j.originStationName);
      if (oInfo && oInfo.naptanId) {
        const cap = getOutsideZoneWeeklyCap(oInfo.naptanId, fareType);
        if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
          outsideZoneCap = cap;
        }
      }
    }
    if (j.destinationStationName) {
      const dInfo = getStationInfo(j.destinationStationName);
      if (dInfo && dInfo.naptanId) {
        const cap = getOutsideZoneWeeklyCap(dInfo.naptanId, fareType);
        if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
          outsideZoneCap = cap;
        }
      }
    }
  }
  return outsideZoneCap;
}

function getOutsideZoneWeeklyCapStationForJourneys(journeys: PlannedJourney[], fareType: FareType): string | null {
  let outsideZoneCap: number | null = null;
  let widestStation: string | null = null;
  for (const j of journeys) {
    if (j.mode === 'bus') continue;
    const oNaptan = j.originStationName ? getStationInfo(j.originStationName)?.naptanId : null;
    const dNaptan = j.destinationStationName ? getStationInfo(j.destinationStationName)?.naptanId : null;
    if (isStPancrasToStratford(oNaptan, dNaptan, j.originStationName, j.destinationStationName)) {
      continue;
    }
    if (j.originStationName) {
      const oInfo = getStationInfo(j.originStationName);
      if (oInfo && oInfo.naptanId) {
        const cap = getOutsideZoneWeeklyCap(oInfo.naptanId, fareType);
        if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
          outsideZoneCap = cap;
          widestStation = j.originStationName;
        }
      }
    }
    if (j.destinationStationName) {
      const dInfo = getStationInfo(j.destinationStationName);
      if (dInfo && dInfo.naptanId) {
        const cap = getOutsideZoneWeeklyCap(dInfo.naptanId, fareType);
        if (cap !== null && (outsideZoneCap === null || cap > outsideZoneCap)) {
          outsideZoneCap = cap;
          widestStation = j.destinationStationName;
        }
      }
    }
  }
  return widestStation;
}


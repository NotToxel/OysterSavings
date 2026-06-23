// Savings Engine — fare type comparison, break-even analysis
import type { ClassifiedJourney } from './journeyClassifier';
import { calculateExpectedFare, calculateFareTypeFare, calculateAllFares, type FareResult } from './fareCalculator';
import { calculateDailyCaps, calculateWeeklyCaps, type DayCapResult } from './capEngine';
import {
  type FareType,
  FARE_TYPES,
  OYSTER_CARD_COST,
  TRAVELCARD_WEEKLY,
  TRAVELCARD_MONTHLY,
  TRAVELCARD_ANNUAL,
  STUDENT_TRAVELCARD_WEEKLY,
  STUDENT_TRAVELCARD_MONTHLY,
  STUDENT_TRAVELCARD_ANNUAL,
  STUDENT_PHOTOCARD_FEE,
  getTravelcardJourneyFare,
  getBusPassJourneyFare,
  BUS_PASS_WEEKLY,
  BUS_PASS_MONTHLY,
  BUS_PASS_ANNUAL,
  STUDENT_BUS_PASS_WEEKLY,
  STUDENT_BUS_PASS_MONTHLY,
  STUDENT_BUS_PASS_ANNUAL,
} from '../data/fareData';

export interface FareTypeSavingsResult {
  fareType: FareType;
  fareTypeName: string;
  totalActualSpend: number;
  totalExpectedSpend: number; // without fare type
  totalFareTypeSpend: number; // with fare type
  totalSaving: number;
  fareTypeCost: number;
  oysterCost: number;
  netSaving: number; // saving minus fare type + oyster cost
  breakEvenJourneys: number; // how many journeys to break even
  breakEvenDate: Date | null; // estimated date
  perJourneySaving: number; // average saving per eligible journey
  eligibleJourneys: number; // journeys where discount applies
  totalJourneys: number;
  dailyBreakdown: DaySavingBreakdown[];
  hasExistingDiscount: boolean;
}

export interface DaySavingBreakdown {
  date: string;
  dateObj: Date;
  standardSpend: number;
  fareTypeSpend: number;
  saving: number;
  journeyCount: number;
}

export interface ProductComparisonResult {
  zoneRange: string;
  weeklyPayg: number;
  weeklyPaygFareType: number;
  weeklyPaygRailcard: number;
  weeklyTravelcard: number;
  weeklyStudentTravelcard: number;
  weeklyBusPass: number;
  monthlyPayg: number;
  monthlyPaygFareType: number;
  monthlyPaygRailcard: number;
  monthlyTravelcard: number;
  monthlyStudentTravelcard: number;
  monthlyBusPass: number;
  monthlyStudentBusPass: number;
  annualPayg: number;
  annualPaygFareType: number;
  annualPaygRailcard: number;
  annualTravelcard: number;
  annualStudentTravelcard: number;
  annualBusPass: number;
  annualStudentBusPass: number;
  bestWeekly: string;
  bestMonthly: string;
  bestAnnual: string;
}

// Calculate total fare type savings across all journeys using Daily Caps simulation
export function calculateFareTypeSavings(
  journeys: ClassifiedJourney[],
  fareType: FareType,
  fareTypeCost: number,
  includeOysterCost: boolean,
  useAlternativeFares: boolean = false
): FareTypeSavingsResult {
  const fareTypeInfo = FARE_TYPES[fareType];
  const ZIP_11_15_FEE = 16.5;
  const ZIP_16_17_FEE = 22.0;
  let oysterCost = includeOysterCost ? OYSTER_CARD_COST : 0;
  if (fareType === 'student' && includeOysterCost) {
    oysterCost = STUDENT_PHOTOCARD_FEE;
  } else if (fareType === 'zip_11_15' && includeOysterCost) {
    oysterCost = ZIP_11_15_FEE;
  } else if (fareType === 'zip_16_17' && includeOysterCost) {
    oysterCost = ZIP_16_17_FEE;
  } else if (fareType === 'none') {
    oysterCost = 0; // Adult / Contactless — no Oyster card fee to include
  }
  // Jobcentre Plus can now include Oyster card cost when toggled on

  const effectiveFareTypeCost = fareType === 'none' ? 0 : fareTypeCost;

  // Generate base FareResults
  const baseFares = calculateAllFares(journeys, fareType, useAlternativeFares);

  // 1. Actual Scenario (what the CSV says)
  const actualCaps = calculateDailyCaps(baseFares, fareType);
  let totalActual = 0;
  for (const day of actualCaps) totalActual += day.totalSpend;

  // 2. Standard PAYG Scenario (Adult)
  const standardFares = baseFares.map(f => ({ ...f, actualCharge: f.expectedFare }));
  const standardCaps = calculateDailyCaps(standardFares);
  const standardWeekly = calculateWeeklyCaps(standardCaps);
  let totalExpected = 0;
  for (const week of standardWeekly) totalExpected += week.totalSpend;

  // 3. FareType Scenario
  const fareTypeFares = baseFares.map(f => ({ ...f, actualCharge: f.fareTypeFare ?? f.expectedFare }));
  const fareTypeCaps = calculateDailyCaps(fareTypeFares, fareType);
  const fareTypeWeekly = calculateWeeklyCaps(fareTypeCaps, fareType);
  let totalFareType = 0;
  for (const week of fareTypeWeekly) totalFareType += week.totalSpend;

  let eligibleCount = 0;
  const dailyMap = new Map<string, DaySavingBreakdown>();

  for (let i = 0; i < standardCaps.length; i++) {
    const stdDay = standardCaps[i];
    const rcDay = fareTypeCaps[i];
    
    // An eligible day is one where the fareType simulation produced a lower spend than standard
    if (stdDay.totalSpend > rcDay.totalSpend) {
      eligibleCount++;
    }

    dailyMap.set(stdDay.date, {
      date: stdDay.date,
      dateObj: stdDay.dateObj,
      standardSpend: stdDay.totalSpend,
      fareTypeSpend: rcDay.totalSpend,
      saving: Math.max(0, stdDay.totalSpend - rcDay.totalSpend),
      journeyCount: stdDay.journeys.length,
    });
  }

  const totalSaving = Math.max(0, totalExpected - totalFareType);
  const detected = detectActiveDiscount(journeys, useAlternativeFares);
  const hasExistingDiscount = detected === fareType && detected !== 'none';
  
  const netSaving = hasExistingDiscount
    ? (totalSaving - effectiveFareTypeCost - oysterCost)
    : (totalActual - (totalFareType + effectiveFareTypeCost + oysterCost));

  // Break-even calculation
  const avgSavingPerJourney = eligibleCount > 0 ? totalSaving / eligibleCount : 0;
  const breakEvenJourneys =
    avgSavingPerJourney > 0 ? Math.ceil((effectiveFareTypeCost + oysterCost) / avgSavingPerJourney) : Infinity;

  // Estimate break-even date based on travel frequency (using days instead of journeys)
  const dateRange = journeys.length > 0
    ? (journeys[journeys.length - 1].raw.date.getTime() - journeys[0].raw.date.getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const daysPerEligibleDay = eligibleCount > 0 && dateRange > 0 ? dateRange / eligibleCount : 0;
  const daysToBreakEven = breakEvenJourneys * daysPerEligibleDay;

  let breakEvenDate: Date | null = null;
  if (isFinite(daysToBreakEven) && journeys.length > 0) {
    breakEvenDate = new Date(journeys[0].raw.date);
    breakEvenDate.setDate(breakEvenDate.getDate() + Math.ceil(daysToBreakEven));
  }

  const dailyBreakdown = Array.from(dailyMap.values()).sort(
    (a, b) => a.dateObj.getTime() - b.dateObj.getTime()
  );


  // Round everything
  return {
    fareType,
    fareTypeName: fareTypeInfo.name,
    totalActualSpend: round2(totalActual),
    totalExpectedSpend: round2(totalExpected),
    totalFareTypeSpend: round2(totalFareType),
    totalSaving: round2(totalSaving),
    netSaving: round2(netSaving),
    fareTypeCost: effectiveFareTypeCost,
    oysterCost,
    breakEvenJourneys: isFinite(breakEvenJourneys) ? breakEvenJourneys : -1,
    breakEvenDate,
    dailyBreakdown,
    hasExistingDiscount,
    perJourneySaving: round2(avgSavingPerJourney),
    eligibleJourneys: eligibleCount,
    totalJourneys: journeys.length
  };
}

// Calculate product comparison for planning mode
export function calculateProductComparison(
  journeys: ClassifiedJourney[],
  fareType: FareType,
  fareTypeCost: number,
  includeStudentPhotocardFee: boolean,
  useAlternativeFares: boolean = false
): ProductComparisonResult[] {
  const effectiveFareTypeCost = (fareType === 'none' || fareType === 'jobcentre' || fareType === 'zip_11_15' || fareType === 'zip_16_17' || fareType === 'railcard') ? 0 : fareTypeCost;
  
  let cardCost = 0;
  if (includeStudentPhotocardFee) {
    if (fareType === 'student') {
      cardCost = 12;
    } else if (fareType === 'zip_11_15') {
      cardCost = 16.5;
    } else if (fareType === 'zip_16_17') {
      cardCost = 22;
    } else if (fareType === 'none') {
      cardCost = 0;
    } else {
      // Jobcentre Plus, Disabled Persons, and National Railcard
      cardCost = 7;
    }
  }

  const studentCardCost = includeStudentPhotocardFee ? STUDENT_PHOTOCARD_FEE : 0;

  // Calculate max/min zone traveled in the history (minimum fallback of Zone 2)
  let minZoneTraveled = 9;
  let maxZoneTraveled = 2;
  let hasRailOrTube = false;
  for (const j of journeys) {
    if (j.mode !== 'bus' && (j.mode as string) !== 'tram') {
      if (j.originZone) {
        minZoneTraveled = Math.min(minZoneTraveled, j.originZone);
        maxZoneTraveled = Math.max(maxZoneTraveled, j.originZone);
        hasRailOrTube = true;
      }
      if (j.destinationZone) {
        minZoneTraveled = Math.min(minZoneTraveled, j.destinationZone);
        maxZoneTraveled = Math.max(maxZoneTraveled, j.destinationZone);
        hasRailOrTube = true;
      }
    }
  }

  // Dynamically filter zoneRanges to only include zones up to maxZoneTraveled (min fallback of Z1-2)
  const zoneRanges: string[] = [];
  for (let z = 2; z <= maxZoneTraveled; z++) {
    if (z <= 9) {
      zoneRanges.push(`Z1-${z}`);
    }
  }
  // Specific outer zone range if traveler stays outside Zone 1
  if (hasRailOrTube && minZoneTraveled > 1 && maxZoneTraveled >= minZoneTraveled) {
    const rangeKey = minZoneTraveled === maxZoneTraveled ? `Z${minZoneTraveled}` : `Z${minZoneTraveled}-${maxZoneTraveled}`;
    if (!zoneRanges.includes(rangeKey)) {
      zoneRanges.push(rangeKey);
    }
  }
  if (zoneRanges.length === 0) {
    zoneRanges.push('Z1-2');
  }

  const results: ProductComparisonResult[] = [];

  // Generate base FareResults
  const baseFares = calculateAllFares(journeys, fareType, useAlternativeFares);

  // 1. Simulate Standard PAYG (Adult) with daily and weekly caps
  const standardFares = baseFares.map(f => ({ ...f, actualCharge: f.expectedFare }));
  const standardDaily = calculateDailyCaps(standardFares);
  const standardWeekly = calculateWeeklyCaps(standardDaily);
  const totalStandardWeeks = standardWeekly.length || 1;
  const totalStandardSpend = standardWeekly.reduce((sum, w) => sum + w.totalSpend, 0);
  const weeklyPaygRaw = totalStandardSpend / totalStandardWeeks;
  const weeklyPayg = round2(weeklyPaygRaw);

  // 2. Simulate FareType PAYG with daily and weekly caps
  const fareTypeFares = baseFares.map(f => ({ ...f, actualCharge: f.fareTypeFare ?? f.expectedFare }));
  const fareTypeDaily = calculateDailyCaps(fareTypeFares, fareType);
  const fareTypeWeekly = calculateWeeklyCaps(fareTypeDaily, fareType);
  const totalFareTypeWeeks = fareTypeWeekly.length || 1;
  const totalFareTypeSpend = fareTypeWeekly.reduce((sum, w) => sum + w.totalSpend, 0);
  const weeklyPaygFareTypeRaw = fareType === 'none' ? weeklyPaygRaw : totalFareTypeSpend / totalFareTypeWeeks;
  const weeklyPaygFareType = round2(weeklyPaygFareTypeRaw);

  // 3. Simulate National Railcard PAYG with daily and weekly caps
  const railcardFares = calculateAllFares(journeys, 'railcard', useAlternativeFares).map(f => ({ ...f, actualCharge: f.fareTypeFare ?? f.expectedFare }));
  const railcardDaily = calculateDailyCaps(railcardFares, 'railcard');
  const railcardWeekly = calculateWeeklyCaps(railcardDaily, 'railcard');
  const totalRailcardWeeks = railcardWeekly.length || 1;
  const totalRailcardSpend = railcardWeekly.reduce((sum, w) => sum + w.totalSpend, 0);
  const weeklyPaygRailcardRaw = totalRailcardSpend / totalRailcardWeeks;
  const railcardCardCost = (fareType === 'railcard' && includeStudentPhotocardFee) ? 7 : 0;
  const paygRailcardCostWeekly = round2(weeklyPaygRailcardRaw + railcardCardCost / 52);
  const paygRailcardCostMonthly = round2(weeklyPaygRailcardRaw * 4.33 + railcardCardCost / 12);
  const paygRailcardCostAnnual = round2(weeklyPaygRailcardRaw * 52 + railcardCardCost);

  const totalWeeks = fareTypeWeekly.length || 1;

  // Standard and Student Bus Pass simulation
  const uncoveredBusPassSpend = simulateProductSpend(baseFares, fareType, 'bus_pass');
  const weeklyUncoveredBusPassSpend = uncoveredBusPassSpend / totalWeeks;

  const studentBaseFares = fareType === 'student' ? baseFares : calculateAllFares(journeys, 'student', useAlternativeFares);
  const studentUncoveredBusPassSpend = simulateProductSpend(studentBaseFares, 'student', 'bus_pass');
  const weeklyStudentUncoveredBusPassSpend = studentUncoveredBusPassSpend / totalWeeks;

  const weeklyBusPassCost = BUS_PASS_WEEKLY + weeklyUncoveredBusPassSpend;
  const monthlyBusPassCost = BUS_PASS_MONTHLY + weeklyUncoveredBusPassSpend * 4.33;
  const annualBusPassCost = BUS_PASS_ANNUAL + weeklyUncoveredBusPassSpend * 52;

  const weeklyStudentBusPassCost = STUDENT_BUS_PASS_WEEKLY + weeklyStudentUncoveredBusPassSpend + round2(studentCardCost / 52);
  const monthlyStudentBusPassCost = STUDENT_BUS_PASS_MONTHLY + weeklyStudentUncoveredBusPassSpend * 4.33 + round2(studentCardCost / 12);
  const annualStudentBusPassCost = STUDENT_BUS_PASS_ANNUAL + weeklyStudentUncoveredBusPassSpend * 52 + studentCardCost;

  for (const zoneRange of zoneRanges) {
    const isZip = fareType === 'zip_11_15' || fareType === 'zip_16_17';
    const weeklyTc = isZip ? (TRAVELCARD_WEEKLY[zoneRange] ?? 0) * 0.5 : (TRAVELCARD_WEEKLY[zoneRange] ?? 0);
    const monthlyTc = isZip ? (TRAVELCARD_MONTHLY[zoneRange] ?? 0) * 0.5 : (TRAVELCARD_MONTHLY[zoneRange] ?? 0);
    const annualTc = isZip ? (TRAVELCARD_ANNUAL[zoneRange] ?? 0) * 0.5 : (TRAVELCARD_ANNUAL[zoneRange] ?? 0);
    const studentWeeklyTc = isZip ? 0 : (STUDENT_TRAVELCARD_WEEKLY[zoneRange] ?? 0);
    const studentMonthlyTc = isZip ? 0 : (STUDENT_TRAVELCARD_MONTHLY[zoneRange] ?? 0);
    const studentAnnualTc = isZip ? 0 : (STUDENT_TRAVELCARD_ANNUAL[zoneRange] ?? 0);

    const uncoveredSpend = simulateProductSpend(baseFares, fareType, 'travelcard', zoneRange);
    const weeklyUncoveredSpend = uncoveredSpend / totalWeeks;

    const studentUncoveredSpend = simulateProductSpend(studentBaseFares, 'student', 'travelcard', zoneRange);
    const weeklyStudentUncoveredSpend = studentUncoveredSpend / totalWeeks;

    const paygFareTypeCostWeekly = round2(weeklyPaygFareTypeRaw + (effectiveFareTypeCost + cardCost) / 52);
    const paygFareTypeCostMonthly = round2(weeklyPaygFareTypeRaw * 4.33 + (effectiveFareTypeCost + cardCost) / 12);
    const paygFareTypeCostAnnual = round2(weeklyPaygFareTypeRaw * 52 + effectiveFareTypeCost + cardCost);

    const weeklyTcWithCard = weeklyTc + weeklyUncoveredSpend + (isZip ? round2(cardCost / 52) : 0);
    const monthlyTcWithCard = monthlyTc + weeklyUncoveredSpend * 4.33 + (isZip ? round2(cardCost / 12) : 0);
    const annualTcWithCard = annualTc + weeklyUncoveredSpend * 52 + (isZip ? cardCost : 0);

    const studentWeeklyTcWithCard = studentWeeklyTc > 0 ? studentWeeklyTc + weeklyStudentUncoveredSpend + round2(studentCardCost / 52) : 0;
    const studentMonthlyTcWithCard = studentMonthlyTc > 0 ? studentMonthlyTc + weeklyStudentUncoveredSpend * 4.33 + round2(studentCardCost / 12) : 0;
    const studentAnnualTcWithCard = studentAnnualTc > 0 ? studentAnnualTc + weeklyStudentUncoveredSpend * 52 + studentCardCost : 0;

    results.push({
      zoneRange,
      weeklyPayg,
      weeklyPaygFareType: paygFareTypeCostWeekly,
      weeklyPaygRailcard: paygRailcardCostWeekly,
      weeklyTravelcard: weeklyTcWithCard,
      weeklyStudentTravelcard: studentWeeklyTcWithCard,
      weeklyBusPass: round2(weeklyBusPassCost),
      monthlyPayg: round2(weeklyPaygRaw * 4.33),
      monthlyPaygFareType: paygFareTypeCostMonthly,
      monthlyPaygRailcard: paygRailcardCostMonthly,
      monthlyTravelcard: monthlyTcWithCard,
      monthlyStudentTravelcard: studentMonthlyTcWithCard,
      monthlyBusPass: round2(monthlyBusPassCost),
      monthlyStudentBusPass: round2(monthlyStudentBusPassCost),
      annualPayg: round2(weeklyPaygRaw * 52),
      annualPaygFareType: paygFareTypeCostAnnual,
      annualPaygRailcard: paygRailcardCostAnnual,
      annualTravelcard: annualTcWithCard,
      annualStudentTravelcard: studentAnnualTcWithCard,
      annualBusPass: round2(annualBusPassCost),
      annualStudentBusPass: round2(annualStudentBusPassCost),
      bestWeekly: getBest([
        ['PAYG', weeklyPayg],
        ['PAYG + Fare Type', paygFareTypeCostWeekly],
        ['PAYG + Railcard', paygRailcardCostWeekly],
        ['Travelcard', weeklyTcWithCard],
        ['Student Travelcard', studentWeeklyTcWithCard],
        ['Bus & Tram Pass', round2(weeklyBusPassCost)],
      ]),
      bestMonthly: getBest([
        ['PAYG', round2(weeklyPaygRaw * 4.33)],
        ['PAYG + Fare Type', paygFareTypeCostMonthly],
        ['PAYG + Railcard', paygRailcardCostMonthly],
        ['Travelcard', monthlyTcWithCard],
        ['Student Travelcard', studentMonthlyTcWithCard],
        ['Bus & Tram Pass', round2(monthlyBusPassCost)],
        ['Student Bus Pass', round2(monthlyStudentBusPassCost)],
      ]),
      bestAnnual: getBest([
        ['PAYG', round2(weeklyPaygRaw * 52)],
        ['PAYG + Fare Type', paygFareTypeCostAnnual],
        ['PAYG + Railcard', paygRailcardCostAnnual],
        ['Travelcard', annualTcWithCard],
        ['Student Travelcard', studentAnnualTcWithCard],
        ['Bus & Tram Pass', round2(annualBusPassCost)],
        ['Student Bus Pass', round2(annualStudentBusPassCost)],
      ]),
    });
  }

  return results;
}

function getBest(options: [string, number][]): string {
  const valid = options.filter(([, v]) => v > 0);
  if (valid.length === 0) return 'N/A';
  valid.sort((a, b) => a[1] - b[1]);
  return valid[0][0];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function simulateProductSpend(
  baseFares: FareResult[],
  fareType: FareType,
  productType: 'bus_pass' | 'travelcard',
  tcZoneRange: string = 'Z1-2'
): number {
  const mockFares = baseFares.map(f => {
    const baseFare = f.fareTypeFare ?? f.expectedFare;
    let passFare = baseFare;
    if (productType === 'bus_pass') {
      passFare = getBusPassJourneyFare(f.journey, baseFare);
    } else {
      passFare = getTravelcardJourneyFare(f.journey, tcZoneRange, baseFare, fareType);
    }

    return {
      ...f,
      actualCharge: passFare,
      expectedFare: passFare,
      fareTypeFare: passFare,
      journey: {
        ...f.journey,
        isCapHit: false
      }
    };
  });

  const dailyCaps = calculateDailyCaps(mockFares, fareType);
  const weeklyCaps = calculateWeeklyCaps(dailyCaps, fareType);
  return weeklyCaps.reduce((sum, w) => sum + w.totalSpend, 0);
}

export function detectActiveDiscount(journeys: ClassifiedJourney[], useAlternativeFares: boolean = false): FareType {
  if (journeys.length === 0) return 'none';

  const discountFareTypes: FareType[] = ['railcard', 'disabled', 'jobcentre', 'zip_16_17', 'zip_11_15'];

  let bestFareType: FareType = 'none';
  let bestMatchRate = 0;
  const matchRates = new Map<FareType, number>();

  for (const fareType of discountFareTypes) {
    const baseFares = calculateAllFares(journeys, fareType, useAlternativeFares);

    let fareTypeMatches = 0;
    let standardMatches = 0;
    let eligibleJourneysCount = 0;

    for (const f of baseFares) {
      if (f.journey.isBus || f.journey.isCapHit || f.actualCharge <= 0 || f.expectedFare <= 0) continue;
      if (f.journey.origin && f.journey.destination && f.journey.origin === f.journey.destination) continue;
      if (f.actualCharge === 4.65) continue;

      const discountApplies = Math.abs((f.fareTypeFare ?? f.expectedFare) - f.expectedFare) >= 0.05;
      if (!discountApplies) continue;

      eligibleJourneysCount++;
      const matchesStandard = Math.abs(f.actualCharge - f.expectedFare) < 0.05;
      const matchesConcession = Math.abs(f.actualCharge - (f.fareTypeFare ?? f.expectedFare)) < 0.05;

      if (matchesConcession) {
        fareTypeMatches++;
      } else if (matchesStandard) {
        standardMatches++;
      }
    }

    if (eligibleJourneysCount > 0 && fareTypeMatches > standardMatches && standardMatches === 0) {
      const matchRate = fareTypeMatches / eligibleJourneysCount;
      matchRates.set(fareType, matchRate);
      if (matchRate >= 0.90 && matchRate > bestMatchRate) {
        bestMatchRate = matchRate;
        bestFareType = fareType;
      }
    }
  }

  // Disambiguation for Disabled Persons Railcard vs Standard Railcard
  if (bestFareType === 'disabled') {
    // 1. Check if they paid standard peak fare on any peak journey
    let paidStandardPeak = false;
    const standardFares = calculateAllFares(journeys, 'none');
    for (const f of standardFares) {
      if (f.journey.isBus || f.journey.isCapHit || f.actualCharge <= 0 || f.expectedFare <= 0) continue;
      if (f.journey.origin && f.journey.destination && f.journey.origin === f.journey.destination) continue;
      if (f.actualCharge === 4.65) continue;

      if (f.journey.isPeak) {
        if (Math.abs(f.actualCharge - f.expectedFare) < 0.05) {
          paidStandardPeak = true;
          break;
        }
      }
    }

    const railcardRate = matchRates.get('railcard') || 0;
    const disabledRate = matchRates.get('disabled') || 0;

    // 2. If they paid standard peak, or if disabled doesn't beat railcard by at least 5% (0.05)
    if (paidStandardPeak || (disabledRate - railcardRate < 0.05)) {
      if (railcardRate >= 0.90) {
        bestFareType = 'railcard';
      } else {
        bestFareType = 'none';
      }
    }
  }

  return bestFareType;
}


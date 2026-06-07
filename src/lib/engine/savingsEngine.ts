// Savings Engine — fare type comparison, break-even analysis
import type { ClassifiedJourney } from './journeyClassifier';
import { calculateExpectedFare, calculateFareTypeFare, calculateAllFares } from './fareCalculator';
import { calculateDailyCaps, calculateWeeklyCaps, type DayCapResult } from './capEngine';
import {
  type FareType,
  FARE_TYPES,
  OYSTER_CARD_COST,
  TRAVELCARD_WEEKLY,
  TRAVELCARD_MONTHLY,
  TRAVELCARD_ANNUAL,
  STUDENT_TRAVELCARD_MONTHLY,
  STUDENT_TRAVELCARD_ANNUAL,
  STUDENT_PHOTOCARD_FEE,
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
  weeklyTravelcard: number;
  monthlyPayg: number;
  monthlyPaygFareType: number;
  monthlyTravelcard: number;
  annualPayg: number;
  annualPaygFareType: number;
  annualTravelcard: number;
  monthlyStudentTravelcard: number;
  annualStudentTravelcard: number;
  bestWeekly: string;
  bestMonthly: string;
  bestAnnual: string;
}

// Calculate total fare type savings across all journeys using Daily Caps simulation
export function calculateFareTypeSavings(
  journeys: ClassifiedJourney[],
  fareType: FareType,
  fareTypeCost: number,
  includeOysterCost: boolean
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
  } else if (fareType === 'jobcentre' || fareType === 'none') {
    oysterCost = 0; // Jobcentre Plus and Adult / Contactless have no Oyster card fee / cost
  }

  const effectiveFareTypeCost = fareType === 'none' ? 0 : fareTypeCost;

  // Generate base FareResults
  const baseFares = calculateAllFares(journeys, fareType);

  // 1. Actual Scenario (what the CSV says)
  const actualCaps = calculateDailyCaps(baseFares);
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
  const netSaving = totalSaving - effectiveFareTypeCost - oysterCost;

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

  // Heuristic to detect if CSV fares already have the selected fareType discount
  // If actual spend is significantly lower than expected PAYG, and very close to or less than the simulated fareType spend,
  // it's likely they already have the fareType applied to their history.
  let hasExistingDiscount = false;
  if (totalActual < totalExpected * 0.85 && totalActual <= totalFareType * 1.05) {
    hasExistingDiscount = true;
  }

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
  includeStudentPhotocardFee: boolean
): ProductComparisonResult[] {
  const effectiveFareTypeCost = (fareType === 'none' || fareType === 'jobcentre' || fareType === 'zip_11_15' || fareType === 'zip_16_17') ? 0 : fareTypeCost;
  
  let cardCost = 0;
  if (includeStudentPhotocardFee) {
    if (fareType === 'student') {
      cardCost = 12;
    } else if (fareType === 'zip_11_15') {
      cardCost = 16.5;
    } else if (fareType === 'zip_16_17') {
      cardCost = 22;
    } else if (fareType === 'none' || fareType === 'jobcentre') {
      cardCost = 0;
    } else {
      cardCost = 7;
    }
  }

  const zoneRanges = ['Z1-2', 'Z1-3', 'Z1-4', 'Z1-5', 'Z1-6'];
  const results: ProductComparisonResult[] = [];

  // Generate base FareResults
  const baseFares = calculateAllFares(journeys, fareType);

  // 1. Simulate Standard PAYG (Adult) with daily and weekly caps
  const standardFares = baseFares.map(f => ({ ...f, actualCharge: f.expectedFare }));
  const standardDaily = calculateDailyCaps(standardFares);
  const standardWeekly = calculateWeeklyCaps(standardDaily);
  const totalStandardWeeks = standardWeekly.length || 1;
  const totalStandardSpend = standardWeekly.reduce((sum, w) => sum + w.totalSpend, 0);
  const weeklyPayg = round2(totalStandardSpend / totalStandardWeeks);

  // 2. Simulate FareType PAYG with daily and weekly caps
  const fareTypeFares = baseFares.map(f => ({ ...f, actualCharge: f.fareTypeFare ?? f.expectedFare }));
  const fareTypeDaily = calculateDailyCaps(fareTypeFares, fareType);
  const fareTypeWeekly = calculateWeeklyCaps(fareTypeDaily, fareType);
  const totalFareTypeWeeks = fareTypeWeekly.length || 1;
  const totalFareTypeSpend = fareTypeWeekly.reduce((sum, w) => sum + w.totalSpend, 0);
  let weeklyPaygFareType = round2(totalFareTypeSpend / totalFareTypeWeeks);

  if (fareType === 'none') {
    weeklyPaygFareType = weeklyPayg;
  }

  for (const zoneRange of zoneRanges) {
    const isZip = fareType === 'zip_11_15' || fareType === 'zip_16_17';
    const weeklyTc = isZip ? (TRAVELCARD_WEEKLY[zoneRange] ?? 0) * 0.5 : (TRAVELCARD_WEEKLY[zoneRange] ?? 0);
    const monthlyTc = isZip ? (TRAVELCARD_MONTHLY[zoneRange] ?? 0) * 0.5 : (TRAVELCARD_MONTHLY[zoneRange] ?? 0);
    const annualTc = isZip ? (TRAVELCARD_ANNUAL[zoneRange] ?? 0) * 0.5 : (TRAVELCARD_ANNUAL[zoneRange] ?? 0);
    const studentMonthlyTc = isZip ? 0 : (STUDENT_TRAVELCARD_MONTHLY[zoneRange] ?? 0);
    const studentAnnualTc = isZip ? 0 : (STUDENT_TRAVELCARD_ANNUAL[zoneRange] ?? 0);

    const paygFareTypeCostWeekly = weeklyPaygFareType + round2((effectiveFareTypeCost + cardCost) / 52);
    const paygFareTypeCostMonthly = round2(weeklyPaygFareType * 4.33 + (effectiveFareTypeCost + cardCost) / 12);
    const paygFareTypeCostAnnual = round2(weeklyPaygFareType * 52 + effectiveFareTypeCost + cardCost);

    const weeklyTcWithCard = weeklyTc + (fareType !== 'student' ? round2(cardCost / 52) : 0);
    const monthlyTcWithCard = monthlyTc + (fareType !== 'student' ? round2(cardCost / 12) : 0);
    const annualTcWithCard = annualTc + (fareType !== 'student' ? cardCost : 0);

    const studentMonthlyTcWithCard = studentMonthlyTc > 0 ? studentMonthlyTc + (cardCost / 12) : 0;
    const studentAnnualTcWithCard = studentAnnualTc > 0 ? studentAnnualTc + cardCost : 0;

    results.push({
      zoneRange,
      weeklyPayg,
      weeklyPaygFareType: paygFareTypeCostWeekly,
      weeklyTravelcard: weeklyTcWithCard,
      monthlyPayg: round2(weeklyPayg * 4.33),
      monthlyPaygFareType: paygFareTypeCostMonthly,
      monthlyTravelcard: monthlyTcWithCard,
      monthlyStudentTravelcard: studentMonthlyTcWithCard,
      annualPayg: round2(weeklyPayg * 52),
      annualPaygFareType: paygFareTypeCostAnnual,
      annualTravelcard: annualTcWithCard,
      annualStudentTravelcard: studentAnnualTcWithCard,
      bestWeekly: getBest([
        ['PAYG', weeklyPayg],
        ['PAYG + Fare Type', paygFareTypeCostWeekly],
        ['Travelcard', weeklyTcWithCard],
      ]),
      bestMonthly: getBest([
        ['PAYG', round2(weeklyPayg * 4.33)],
        ['PAYG + Fare Type', paygFareTypeCostMonthly],
        ['Travelcard', monthlyTcWithCard],
        ['Student Travelcard', studentMonthlyTcWithCard],
      ]),
      bestAnnual: getBest([
        ['PAYG', round2(weeklyPayg * 52)],
        ['PAYG + Fare Type', paygFareTypeCostAnnual],
        ['Travelcard', annualTcWithCard],
        ['Student Travelcard', studentAnnualTcWithCard],
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

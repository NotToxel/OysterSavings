// Savings Engine — railcard comparison, break-even analysis
import type { ClassifiedJourney } from './journeyClassifier';
import { calculateExpectedFare, calculateRailcardFare, calculateAllFares } from './fareCalculator';
import { calculateDailyCaps, calculateWeeklyCaps, type DayCapResult } from './capEngine';
import {
  type RailcardType,
  RAILCARDS,
  OYSTER_CARD_COST,
  TRAVELCARD_WEEKLY,
  TRAVELCARD_MONTHLY,
  TRAVELCARD_ANNUAL,
  STUDENT_TRAVELCARD_MONTHLY,
  STUDENT_TRAVELCARD_ANNUAL,
  STUDENT_PHOTOCARD_FEE,
} from '../data/fareData';

export interface RailcardSavingsResult {
  railcardType: RailcardType;
  railcardName: string;
  totalActualSpend: number;
  totalExpectedSpend: number; // without railcard
  totalRailcardSpend: number; // with railcard
  totalSaving: number;
  railcardCost: number;
  oysterCost: number;
  netSaving: number; // saving minus railcard + oyster cost
  breakEvenJourneys: number; // how many journeys to break even
  breakEvenDate: Date | null; // estimated date
  perJourneySaving: number; // average saving per eligible journey
  eligibleJourneys: number; // journeys where railcard applies
  totalJourneys: number;
  dailyBreakdown: DaySavingBreakdown[];
  hasExistingDiscount: boolean;
}

export interface DaySavingBreakdown {
  date: string;
  dateObj: Date;
  standardSpend: number;
  railcardSpend: number;
  saving: number;
  journeyCount: number;
}

export interface ProductComparisonResult {
  zoneRange: string;
  weeklyPayg: number;
  weeklyPaygRailcard: number;
  weeklyTravelcard: number;
  monthlyPayg: number;
  monthlyPaygRailcard: number;
  monthlyTravelcard: number;
  annualPayg: number;
  annualPaygRailcard: number;
  annualTravelcard: number;
  monthlyStudentTravelcard: number;
  annualStudentTravelcard: number;
  bestWeekly: string;
  bestMonthly: string;
  bestAnnual: string;
}

// Calculate total railcard savings across all journeys using Daily Caps simulation
export function calculateRailcardSavings(
  journeys: ClassifiedJourney[],
  railcardType: RailcardType,
  railcardCost: number,
  includeOysterCost: boolean
): RailcardSavingsResult {
  const railcard = RAILCARDS[railcardType];
  const ZIP_11_15_FEE = 16.5;
  const ZIP_16_17_FEE = 22.0;
  let oysterCost = includeOysterCost ? OYSTER_CARD_COST : 0;
  if (railcardType === 'student' && includeOysterCost) {
    oysterCost = STUDENT_PHOTOCARD_FEE;
  } else if (railcardType === 'zip_11_15' && includeOysterCost) {
    oysterCost = ZIP_11_15_FEE;
  } else if (railcardType === 'zip_16_17' && includeOysterCost) {
    oysterCost = ZIP_16_17_FEE;
  } else if (railcardType === 'jobcentre' || railcardType === 'none') {
    oysterCost = 0; // Jobcentre Plus and Adult / Contactless have no Oyster card fee / cost
  }

  const effectiveRailcardCost = railcardType === 'none' ? 0 : railcardCost;

  // Generate base FareResults
  const baseFares = calculateAllFares(journeys, railcardType);

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

  // 3. Railcard Scenario
  const railcardFares = baseFares.map(f => ({ ...f, actualCharge: f.railcardFare ?? f.expectedFare }));
  const railcardCaps = calculateDailyCaps(railcardFares, railcardType);
  const railcardWeekly = calculateWeeklyCaps(railcardCaps, railcardType);
  let totalRailcard = 0;
  for (const week of railcardWeekly) totalRailcard += week.totalSpend;

  let eligibleCount = 0;
  const dailyMap = new Map<string, DaySavingBreakdown>();

  for (let i = 0; i < standardCaps.length; i++) {
    const stdDay = standardCaps[i];
    const rcDay = railcardCaps[i];
    
    // An eligible day is one where the railcard simulation produced a lower spend than standard
    if (stdDay.totalSpend > rcDay.totalSpend) {
      eligibleCount++;
    }

    dailyMap.set(stdDay.date, {
      date: stdDay.date,
      dateObj: stdDay.dateObj,
      standardSpend: stdDay.totalSpend,
      railcardSpend: rcDay.totalSpend,
      saving: Math.max(0, stdDay.totalSpend - rcDay.totalSpend),
      journeyCount: stdDay.journeys.length,
    });
  }

  const totalSaving = Math.max(0, totalExpected - totalRailcard);
  const netSaving = totalSaving - effectiveRailcardCost - oysterCost;

  // Break-even calculation
  const avgSavingPerJourney = eligibleCount > 0 ? totalSaving / eligibleCount : 0;
  const breakEvenJourneys =
    avgSavingPerJourney > 0 ? Math.ceil((effectiveRailcardCost + oysterCost) / avgSavingPerJourney) : Infinity;

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

  // Heuristic to detect if CSV fares already have the selected railcard discount
  // If actual spend is significantly lower than expected PAYG, and very close to or less than the simulated railcard spend,
  // it's likely they already have the railcard applied to their history.
  let hasExistingDiscount = false;
  if (totalActual < totalExpected * 0.85 && totalActual <= totalRailcard * 1.05) {
    hasExistingDiscount = true;
  }

  // Round everything
  return {
    railcardType,
    railcardName: railcard.name,
    totalActualSpend: round2(totalActual),
    totalExpectedSpend: round2(totalExpected),
    totalRailcardSpend: round2(totalRailcard),
    totalSaving: round2(totalSaving),
    netSaving: round2(netSaving),
    railcardCost: effectiveRailcardCost,
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
  railcardType: RailcardType,
  railcardCost: number,
  includeStudentPhotocardFee: boolean
): ProductComparisonResult[] {
  const effectiveRailcardCost = (railcardType === 'none' || railcardType === 'jobcentre' || railcardType === 'zip_11_15' || railcardType === 'zip_16_17') ? 0 : railcardCost;
  
  let cardCost = 0;
  if (includeStudentPhotocardFee) {
    if (railcardType === 'student') {
      cardCost = 12;
    } else if (railcardType === 'zip_11_15') {
      cardCost = 16.5;
    } else if (railcardType === 'zip_16_17') {
      cardCost = 22;
    } else if (railcardType === 'none' || railcardType === 'jobcentre') {
      cardCost = 0;
    } else {
      cardCost = 7;
    }
  }

  const zoneRanges = ['Z1-2', 'Z1-3', 'Z1-4', 'Z1-5', 'Z1-6'];
  const results: ProductComparisonResult[] = [];

  // Generate base FareResults
  const baseFares = calculateAllFares(journeys, railcardType);

  // 1. Simulate Standard PAYG (Adult) with daily and weekly caps
  const standardFares = baseFares.map(f => ({ ...f, actualCharge: f.expectedFare }));
  const standardDaily = calculateDailyCaps(standardFares);
  const standardWeekly = calculateWeeklyCaps(standardDaily);
  const totalStandardWeeks = standardWeekly.length || 1;
  const totalStandardSpend = standardWeekly.reduce((sum, w) => sum + w.totalSpend, 0);
  const weeklyPayg = round2(totalStandardSpend / totalStandardWeeks);

  // 2. Simulate Railcard PAYG with daily and weekly caps
  const railcardFares = baseFares.map(f => ({ ...f, actualCharge: f.railcardFare ?? f.expectedFare }));
  const railcardDaily = calculateDailyCaps(railcardFares, railcardType);
  const railcardWeekly = calculateWeeklyCaps(railcardDaily, railcardType);
  const totalRailcardWeeks = railcardWeekly.length || 1;
  const totalRailcardSpend = railcardWeekly.reduce((sum, w) => sum + w.totalSpend, 0);
  let weeklyPaygRailcard = round2(totalRailcardSpend / totalRailcardWeeks);

  if (railcardType === 'none') {
    weeklyPaygRailcard = weeklyPayg;
  }

  for (const zoneRange of zoneRanges) {
    const isZip = railcardType === 'zip_11_15' || railcardType === 'zip_16_17';
    const weeklyTc = isZip ? (TRAVELCARD_WEEKLY[zoneRange] ?? 0) * 0.5 : (TRAVELCARD_WEEKLY[zoneRange] ?? 0);
    const monthlyTc = isZip ? (TRAVELCARD_MONTHLY[zoneRange] ?? 0) * 0.5 : (TRAVELCARD_MONTHLY[zoneRange] ?? 0);
    const annualTc = isZip ? (TRAVELCARD_ANNUAL[zoneRange] ?? 0) * 0.5 : (TRAVELCARD_ANNUAL[zoneRange] ?? 0);
    const studentMonthlyTc = isZip ? 0 : (STUDENT_TRAVELCARD_MONTHLY[zoneRange] ?? 0);
    const studentAnnualTc = isZip ? 0 : (STUDENT_TRAVELCARD_ANNUAL[zoneRange] ?? 0);

    const paygRailcardCostWeekly = weeklyPaygRailcard + round2((effectiveRailcardCost + cardCost) / 52);
    const paygRailcardCostMonthly = round2(weeklyPaygRailcard * 4.33 + (effectiveRailcardCost + cardCost) / 12);
    const paygRailcardCostAnnual = round2(weeklyPaygRailcard * 52 + effectiveRailcardCost + cardCost);

    const weeklyTcWithCard = weeklyTc + (railcardType !== 'student' ? round2(cardCost / 52) : 0);
    const monthlyTcWithCard = monthlyTc + (railcardType !== 'student' ? round2(cardCost / 12) : 0);
    const annualTcWithCard = annualTc + (railcardType !== 'student' ? cardCost : 0);

    const studentMonthlyTcWithCard = studentMonthlyTc > 0 ? studentMonthlyTc + (cardCost / 12) : 0;
    const studentAnnualTcWithCard = studentAnnualTc > 0 ? studentAnnualTc + cardCost : 0;

    results.push({
      zoneRange,
      weeklyPayg,
      weeklyPaygRailcard: paygRailcardCostWeekly,
      weeklyTravelcard: weeklyTcWithCard,
      monthlyPayg: round2(weeklyPayg * 4.33),
      monthlyPaygRailcard: paygRailcardCostMonthly,
      monthlyTravelcard: monthlyTcWithCard,
      monthlyStudentTravelcard: studentMonthlyTcWithCard,
      annualPayg: round2(weeklyPayg * 52),
      annualPaygRailcard: paygRailcardCostAnnual,
      annualTravelcard: annualTcWithCard,
      annualStudentTravelcard: studentAnnualTcWithCard,
      bestWeekly: getBest([
        ['PAYG', weeklyPayg],
        ['PAYG + Railcard', paygRailcardCostWeekly],
        ['Travelcard', weeklyTcWithCard],
      ]),
      bestMonthly: getBest([
        ['PAYG', round2(weeklyPayg * 4.33)],
        ['PAYG + Railcard', paygRailcardCostMonthly],
        ['Travelcard', monthlyTcWithCard],
        ['Student Travelcard', studentMonthlyTcWithCard],
      ]),
      bestAnnual: getBest([
        ['PAYG', round2(weeklyPayg * 52)],
        ['PAYG + Railcard', paygRailcardCostAnnual],
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

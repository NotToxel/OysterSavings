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
  lookupDailyCap,
  roundToNearest10p,
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
  const STUDENT_PHOTOCARD_FEE = 12;
  let oysterCost = includeOysterCost ? OYSTER_CARD_COST : 0;
  if (railcardType === 'student' && includeOysterCost) {
    oysterCost = STUDENT_PHOTOCARD_FEE;
  }

  // Generate base FareResults
  const baseFares = calculateAllFares(journeys, railcardType);

  // 1. Actual Scenario (what the CSV says)
  const actualCaps = calculateDailyCaps(baseFares);
  let totalActual = 0;
  for (const day of actualCaps) totalActual += day.totalSpend;

  // 2. Standard PAYG Scenario (Adult)
  const standardFares = baseFares.map(f => ({ ...f, actualCharge: f.expectedFare }));
  const standardCaps = calculateDailyCaps(standardFares);
  let totalExpected = 0;
  for (const day of standardCaps) totalExpected += day.totalSpend;

  // 3. Railcard Scenario
  const railcardFares = baseFares.map(f => ({ ...f, actualCharge: f.railcardFare ?? f.expectedFare }));
  const railcardCaps = calculateDailyCaps(railcardFares);
  let totalRailcard = 0;
  for (const day of railcardCaps) totalRailcard += day.totalSpend;

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
  const netSaving = totalSaving - railcardCost - oysterCost;

  // Break-even calculation
  const avgSavingPerJourney = eligibleCount > 0 ? totalSaving / eligibleCount : 0;
  const breakEvenJourneys =
    avgSavingPerJourney > 0 ? Math.ceil((railcardCost + oysterCost) / avgSavingPerJourney) : Infinity;

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
    railcardCost,
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
  const studentPhotocardCost = includeStudentPhotocardFee ? 12 : 0;
  const zoneRanges = ['Z1-2', 'Z1-3', 'Z1-4', 'Z1-5', 'Z1-6'];
  const results: ProductComparisonResult[] = [];

  // Calculate average journeys per week from the data
  const fareResults = calculateAllFares(journeys);
  const dailyResults = calculateDailyCaps(fareResults);
  const weeklyResults = calculateWeeklyCaps(dailyResults);

  const totalWeeks = weeklyResults.length || 1;
  const avgWeeklySpend = fareResults.reduce((s, j) => s + j.actualCharge, 0) / totalWeeks;

  for (const zoneRange of zoneRanges) {
    const weeklyTc = TRAVELCARD_WEEKLY[zoneRange] ?? 0;
    const monthlyTc = TRAVELCARD_MONTHLY[zoneRange] ?? 0;
    const annualTc = TRAVELCARD_ANNUAL[zoneRange] ?? 0;
    const studentMonthlyTc = STUDENT_TRAVELCARD_MONTHLY[zoneRange] ?? 0;
    const studentAnnualTc = STUDENT_TRAVELCARD_ANNUAL[zoneRange] ?? 0;

    // Use actual data to project costs
    const weeklyPayg = round2(avgWeeklySpend);
    const railcardFareResults = calculateAllFares(journeys, railcardType);
    const weeklyPaygRailcard = round2(
      railcardFareResults.reduce((s, j) => s + (j.railcardFare ?? j.expectedFare), 0) / totalWeeks
    );

    results.push({
      zoneRange,
      weeklyPayg,
      weeklyPaygRailcard: weeklyPaygRailcard + round2(railcardCost / 52),
      weeklyTravelcard: weeklyTc,
      monthlyPayg: round2(weeklyPayg * 4.33),
      monthlyPaygRailcard: round2(weeklyPaygRailcard * 4.33 + railcardCost / 12),
      monthlyTravelcard: monthlyTc,
      monthlyStudentTravelcard: studentMonthlyTc > 0 ? studentMonthlyTc + (studentPhotocardCost / 12) : 0,
      annualPayg: round2(weeklyPayg * 52),
      annualPaygRailcard: round2(weeklyPaygRailcard * 52 + railcardCost),
      annualTravelcard: annualTc,
      annualStudentTravelcard: studentAnnualTc > 0 ? studentAnnualTc + studentPhotocardCost : 0,
      bestWeekly: getBest([
        ['PAYG', weeklyPayg],
        ['PAYG + Railcard', weeklyPaygRailcard],
        ['Travelcard', weeklyTc],
      ]),
      bestMonthly: getBest([
        ['PAYG', round2(weeklyPayg * 4.33)],
        ['PAYG + Railcard', round2(weeklyPaygRailcard * 4.33 + railcardCost / 12)],
        ['Travelcard', monthlyTc],
        ['Student Travelcard', studentMonthlyTc > 0 ? studentMonthlyTc + (studentPhotocardCost / 12) : 0],
      ]),
      bestAnnual: getBest([
        ['PAYG', round2(weeklyPayg * 52)],
        ['PAYG + Railcard', round2(weeklyPaygRailcard * 52 + railcardCost)],
        ['Travelcard', annualTc],
        ['Student Travelcard', studentAnnualTc > 0 ? studentAnnualTc + studentPhotocardCost : 0],
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

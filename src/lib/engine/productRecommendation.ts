import type { ProductComparisonResult } from './savingsEngine';
import type { FareType } from '../data/fareData';

export type ComparisonSpan = 'weekly' | 'monthly' | 'annual';

/** Advice is based on the selected eligibility scenario, never chart visibility. */
export function recommendProduct(
  comparison: ProductComparisonResult,
  span: ComparisonSpan,
  fareType: FareType,
  concessionName = 'Discounted PAYG',
) {
  const cost = (product: string) => comparison[`${span}${product}` as keyof ProductComparisonResult] as number;
  const options = [
    { name: 'PAYG', cost: cost('Payg') },
    { name: 'Bus & Tram Pass', cost: cost('BusPass') },
  ];
  if (comparison.travelcardEligible) options.push({ name: 'Travelcard', cost: cost('Travelcard') });
  if (fareType === 'railcard') options.push({ name: 'PAYG + Railcard', cost: cost('PaygRailcard') });
  else if (fareType !== 'none' && fareType !== 'student') {
    options.push({ name: concessionName, cost: cost('PaygFareType') });
  }
  if (fareType === 'student') {
    if (comparison.travelcardEligible) options.push({ name: 'Student Travelcard', cost: cost('StudentTravelcard') });
    if (span !== 'weekly') options.push({ name: 'Student Bus Pass', cost: cost('StudentBusPass') });
  }
  // Zero is a valid price for a free concession. Exclude absent/invalid prices.
  const valid = options.filter(option => Number.isFinite(option.cost) && option.cost >= 0);
  valid.sort((a, b) => a.cost - b.cost);
  const best = valid[0];
  if (!best) return null;
  return { ...best, adultPayg: cost('Payg'), saving: Math.max(0, cost('Payg') - best.cost) };
}

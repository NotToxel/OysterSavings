// Journey Filter — automated row exclusion per SRS §3.2
import type { ParsedJourney } from './csvParser';

export type ExclusionReason =
  | 'incomplete_no_touch_in'
  | 'incomplete_no_touch_out'
  | 'auto_top_up'
  | 'tfl_adjustment'
  | 'non_travel';

export interface ExcludedJourney {
  journey: ParsedJourney;
  reason: ExclusionReason;
  description: string;
}

export interface FilterResult {
  valid: ParsedJourney[];
  excluded: ExcludedJourney[];
}

export function filterJourneys(journeys: ParsedJourney[]): FilterResult {
  const valid: ParsedJourney[] = [];
  const excluded: ExcludedJourney[] = [];

  for (const journey of journeys) {
    const action = journey.journeyAction;
    const exclusion = getExclusionReason(action, journey);

    if (exclusion) {
      excluded.push({
        journey,
        ...exclusion,
      });
    } else {
      valid.push(journey);
    }
  }

  return { valid, excluded };
}

function getExclusionReason(
  action: string,
  journey: ParsedJourney
): { reason: ExclusionReason; description: string } | null {
  // 1. Incomplete journeys
  if (action.includes('[No touch-in]')) {
    return {
      reason: 'incomplete_no_touch_in',
      description: 'Incomplete journey — no touch-in recorded. Maximum penalty fare may have been charged.',
    };
  }
  if (action.includes('[No touch-out]')) {
    return {
      reason: 'incomplete_no_touch_out',
      description: 'Incomplete journey — no touch-out recorded. Maximum penalty fare may have been charged.',
    };
  }

  // 2. Auto top-ups
  if (action.toLowerCase().startsWith('auto top-up')) {
    return {
      reason: 'auto_top_up',
      description: 'Auto top-up transaction — not a journey.',
    };
  }

  // 3. TfL adjustments / credit-only rows
  if (journey.charge === 0 && journey.credit > 0 && !action.toLowerCase().includes('bus journey') && !action.includes(' to ')) {
    return {
      reason: 'tfl_adjustment',
      description: 'TfL credit adjustment or goodwill gesture — not a journey.',
    };
  }

  // 4. Manual top-ups (vending machine, online top-ups)
  const lowerAction = action.toLowerCase();
  if (
    lowerAction.includes('top-up') ||
    lowerAction.includes('topped up') ||
    lowerAction.includes('oyster helpline')
  ) {
    return {
      reason: 'non_travel',
      description: 'Non-travel action (manual top-up or administrative).',
    };
  }

  return null;
}

// Get summary stats for the filter results
export function getFilterSummary(result: FilterResult) {
  const reasonCounts: Record<ExclusionReason, number> = {
    incomplete_no_touch_in: 0,
    incomplete_no_touch_out: 0,
    auto_top_up: 0,
    tfl_adjustment: 0,
    non_travel: 0,
  };

  for (const ex of result.excluded) {
    reasonCounts[ex.reason]++;
  }

  return {
    totalProcessed: result.valid.length + result.excluded.length,
    validCount: result.valid.length,
    excludedCount: result.excluded.length,
    reasonCounts,
    reasonLabels: {
      incomplete_no_touch_in: 'Incomplete (no touch-in)',
      incomplete_no_touch_out: 'Incomplete (no touch-out)',
      auto_top_up: 'Auto top-up',
      tfl_adjustment: 'TfL adjustment',
      non_travel: 'Non-travel action',
    } as Record<ExclusionReason, string>,
  };
}

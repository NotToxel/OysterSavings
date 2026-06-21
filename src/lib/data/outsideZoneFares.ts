// Outside Zone 1-9 Station Fares — March 2026 rates
// Data sourced from TfL national rail fare tables
// These stations fall outside the standard fare zones 1-9 and have their own
// station-specific daily/weekly caps and travelcard prices.

import type { FareType } from './fareData';

export interface OutsideZoneDailyCap {
  peak: number;
  offPeak: number;
}

export interface OutsideZoneZoneRange {
  /** Zone range string, e.g. "Z1-8" */
  zoneRange: string;
  /** Mon-Sun weekly cap (adult) — null if not available */
  weeklyCap: number | null;
  /** Travelcard prices for this zone range */
  travelcard?: {
    weekly?: number;
    monthly?: number;
    annual?: number;
  };
}

export interface OutsideZoneStationGroup {
  /** Lowercase station keys that share these fares */
  stationKeys: string[];
  /** NaPTAN IDs for these stations */
  naptanIds: string[];
  /** Whether this station is contactless-only (no Oyster) */
  contactlessOnly: boolean;
  /** Per-fare-type daily caps */
  dailyCaps: Partial<Record<FareType, OutsideZoneDailyCap>>;
  /** Zone-range-specific weekly caps and travelcard prices, per fare type */
  zoneRanges: Partial<Record<FareType, OutsideZoneZoneRange[]>>;
  /** Special notes (e.g. "Excludes Gatwick Express") */
  notes?: string;
}

import outsideZoneFaresData from './outsideZoneFares.json';
export const OUTSIDE_ZONE_STATIONS: OutsideZoneStationGroup[] = outsideZoneFaresData as any;

// ── Lookup helpers ──

/** Index by NaPTAN ID for O(1) lookups */
const naptanIndex = new Map<string, OutsideZoneStationGroup>();
/** Index by station key for O(1) lookups */
const stationKeyIndex = new Map<string, OutsideZoneStationGroup>();

for (const group of OUTSIDE_ZONE_STATIONS) {
  for (const naptanId of group.naptanIds) {
    naptanIndex.set(naptanId, group);
  }
  for (const key of group.stationKeys) {
    stationKeyIndex.set(key, group);
  }
}

/** Look up an outside-zone station group by NaPTAN ID */
export function getOutsideZoneGroupByNaptan(naptanId: string): OutsideZoneStationGroup | null {
  return naptanIndex.get(naptanId) ?? null;
}

/** Look up an outside-zone station group by station key (lowercase name) */
export function getOutsideZoneGroupByKey(stationKey: string): OutsideZoneStationGroup | null {
  return stationKeyIndex.get(stationKey) ?? null;
}

/** Check if a NaPTAN ID belongs to an outside-zone station */
export function isOutsideZoneNaptan(naptanId: string): boolean {
  return naptanIndex.has(naptanId);
}

/** Check if a NaPTAN ID belongs to a contactless-only station */
export function isContactlessOnlyNaptan(naptanId: string): boolean {
  const group = naptanIndex.get(naptanId);
  return group?.contactlessOnly === true;
}

/**
 * Check if a fare type is valid for a given station.
 * Contactless-only stations only accept 'none' (Adult / Contactless).
 */
export function isValidFareTypeForStation(naptanId: string, fareType: FareType): boolean {
  const group = naptanIndex.get(naptanId);
  if (!group) return true; // Not an outside-zone station — all fare types valid
  if (group.contactlessOnly && fareType !== 'none') return false;
  return true;
}

/**
 * Get the station-specific daily cap for an outside-zone station.
 * Returns null if the station is not outside-zone or if the fare type has no cap data.
 */
export function getOutsideZoneDailyCap(
  naptanId: string,
  fareType: FareType,
  isPeak: boolean
): number | null {
  const group = naptanIndex.get(naptanId);
  if (!group) return null;

  // Contactless-only stations only support 'none'
  if (group.contactlessOnly && fareType !== 'none') return null;

  const caps = group.dailyCaps[fareType];
  if (caps) {
    return isPeak ? caps.peak : caps.offPeak;
  }

  // Fallback to 'none' (Adult) daily caps if this fareType is not specifically defined
  const noneCaps = group.dailyCaps['none'];
  if (!noneCaps) return null;

  // If child/concession fare types that get 50% discount
  if (fareType === 'jobcentre' || fareType === 'zip_11_15' || fareType === 'zip_16_17') {
    const val = isPeak ? noneCaps.peak : noneCaps.offPeak;
    return Math.floor(val * 0.5 * 20) / 20; // round down to nearest 5p per TfL rules
  }

  // If railcard / disabled fare types
  if (fareType === 'railcard' || fareType === 'disabled') {
    // Standard railcards get 1/3 discount on off-peak only (appliesToPeak is false)
    // Disabled Persons gets 1/3 discount on both peak and off-peak daily caps (appliesToPeak is true)
    const multiplier = 0.666;
    if (isPeak) {
      if (fareType === 'disabled') {
        return Math.floor(noneCaps.peak * multiplier * 20) / 20;
      }
      return noneCaps.peak; // standard railcard pays peak cap
    } else {
      return Math.floor(noneCaps.offPeak * multiplier * 20) / 20;
    }
  }

  return isPeak ? noneCaps.peak : noneCaps.offPeak;
}

/**
 * Get the station-specific weekly cap for an outside-zone station.
 * Uses the widest zone range available for the given fare type.
 * Returns null if the station is not outside-zone or if no weekly cap exists.
 */
export function getOutsideZoneWeeklyCap(
  naptanId: string,
  fareType: FareType
): number | null {
  const group = naptanIndex.get(naptanId);
  if (!group) return null;

  if (group.contactlessOnly && fareType !== 'none') return null;

  let ranges = group.zoneRanges[fareType];
  if (ranges && ranges.length > 0) {
    return ranges[0].weeklyCap;
  }

  // Fallback to 'none' (Adult) if this fareType has no specific weekly cap range
  const noneRanges = group.zoneRanges['none'];
  if (!noneRanges || noneRanges.length === 0) return null;

  const baseCap = noneRanges[0].weeklyCap;
  if (baseCap === null) return null;

  if (fareType === 'jobcentre' || fareType === 'zip_11_15' || fareType === 'zip_16_17') {
    return Math.round(baseCap * 0.5 * 10) / 10; // Round to nearest 10p per TfL rules
  }

  return baseCap;
}

/**
 * Get any special notes for an outside-zone station (e.g. "Excludes Gatwick Express").
 */
export function getOutsideZoneNotes(naptanId: string): string | null {
  const group = naptanIndex.get(naptanId);
  return group?.notes ?? null;
}

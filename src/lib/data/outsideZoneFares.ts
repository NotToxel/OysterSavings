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

/**
 * Outside-zone station fare data, sourced from TfL CSVs:
 * - national_rail_adult_fares.csv
 * - national_rail_16_plus_fares.csv
 * - national_rail_jobcentre_fares.csv
 * - national_rail_railcard_fares.csv
 * - national_rail_disabled_persons_railcard_fares.csv
 */
export const OUTSIDE_ZONE_STATIONS: OutsideZoneStationGroup[] = [
  // ── Broxbourne, Hertford East, Ware, St. Margarets & Rye House ──
  {
    stationKeys: ['broxbourne', 'hertford east', 'ware', 'st. margarets', 'rye house'],
    naptanIds: ['910GBROXBRN', '910GHERTFDE', '910GWARE', '910GSMARGRT', '910GRYEHOUS'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 32.30, offPeak: 24.50 },
      zip_16_17:  { peak: 16.15, offPeak: 12.25 },
      jobcentre:  { peak: 16.15, offPeak: 12.25 },
      railcard:   { peak: 32.30, offPeak: 16.30 },
      disabled:   { peak: 21.50, offPeak: 16.30 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-8', weeklyCap: 122.00, travelcard: { weekly: 122.00, monthly: 468.50, annual: 4880 } },
        { zoneRange: 'Z2-8', weeklyCap: 95.80, travelcard: { weekly: 95.80, monthly: 367.90, annual: 3832 } },
      ],
      zip_16_17: [
        { zoneRange: 'Z1-8', weeklyCap: 61.00, travelcard: { weekly: 61.00, monthly: 234.30, annual: 2440 } },
        { zoneRange: 'Z2-8', weeklyCap: 47.90, travelcard: { weekly: 47.90, monthly: 184.00, annual: 1916 } },
      ],
      jobcentre: [
        { zoneRange: 'Z1-8', weeklyCap: 61.00, travelcard: { weekly: 61.00, monthly: 234.30 } },
        { zoneRange: 'Z2-8', weeklyCap: 47.90, travelcard: { weekly: 47.90, monthly: 184.00 } },
      ],
    },
  },

  // ── Watford Junction ──
  {
    stationKeys: ['watford junction'],
    naptanIds: ['910GWATFJDC'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 32.30, offPeak: 24.10 },
      zip_16_17:  { peak: 16.15, offPeak: 12.05 },
      jobcentre:  { peak: 16.15, offPeak: 12.05 },
      railcard:   { peak: 32.30, offPeak: 16.05 },
      disabled:   { peak: 21.50, offPeak: 16.05 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-8', weeklyCap: 117.00, travelcard: { weekly: 117.00, monthly: 449.30, annual: 4680 } },
      ],
      zip_16_17: [
        { zoneRange: 'Z1-8', weeklyCap: 58.50, travelcard: { weekly: 58.50, monthly: 224.70, annual: 2340 } },
      ],
      jobcentre: [
        { zoneRange: 'Z1-8', weeklyCap: 58.50, travelcard: { weekly: 58.50, monthly: 224.70 } },
        { zoneRange: 'Z2-8', weeklyCap: 39.50, travelcard: { weekly: 39.50, monthly: 151.70 } },
        { zoneRange: 'Z4-8', weeklyCap: 35.40, travelcard: { weekly: 35.40, monthly: 136.00 } },
      ],
    },
  },

  // ── Shenfield ──
  {
    stationKeys: ['shenfield'],
    naptanIds: ['910GSHENFLD'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 40.00, offPeak: 26.80 },
      zip_16_17:  { peak: 20.00, offPeak: 13.40 },
      jobcentre:  { peak: 20.00, offPeak: 13.40 },
      railcard:   { peak: 40.00, offPeak: 17.80 },
      disabled:   { peak: 26.60, offPeak: 17.80 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-9', weeklyCap: 138.90, travelcard: { weekly: 138.90, monthly: 533.40, annual: 5556 } },
      ],
      zip_16_17: [
        { zoneRange: 'Z1-9', weeklyCap: 69.50, travelcard: { weekly: 69.50, monthly: 266.90, annual: 2778 } },
      ],
      jobcentre: [
        { zoneRange: 'Z1-9', weeklyCap: 69.50, travelcard: { weekly: 69.50, monthly: 266.90 } },
        { zoneRange: 'Z2-9', weeklyCap: 52.60, travelcard: { weekly: 52.60, monthly: 202.00 } },
      ],
    },
  },

  // ── Gatwick Airport ──
  {
    stationKeys: ['gatwick airport'],
    naptanIds: ['920GLGW0'],
    contactlessOnly: false,
    notes: 'Excludes Gatwick Express',
    dailyCaps: {
      none:       { peak: 40.80, offPeak: 24.10 },
      zip_16_17:  { peak: 20.40, offPeak: 12.05 },
      jobcentre:  { peak: 20.40, offPeak: 12.05 },
      railcard:   { peak: 40.80, offPeak: 16.05 },
      disabled:   { peak: 27.15, offPeak: 16.05 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 129.40 },
      ],
    },
  },

  // ── Horley, Salfords, Earlswood & Redhill ──
  {
    stationKeys: ['horley', 'salfords', 'earlswood', 'redhill'],
    naptanIds: ['910GHORLEY', '910GSALFDS', '910GEARLSWD', '910GREDHILL'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 36.00, offPeak: 20.00 },
      zip_16_17:  { peak: 18.00, offPeak: 10.00 },
      jobcentre:  { peak: 18.00, offPeak: 10.00 },
      railcard:   { peak: 36.00, offPeak: 13.30 },
      disabled:   { peak: 23.95, offPeak: 13.30 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 113.40 },
      ],
    },
  },

  // ── Cuffley ──
  {
    stationKeys: ['cuffley'],
    naptanIds: ['910GCUFFLEY'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 26.20, offPeak: 19.30 },
      zip_16_17:  { peak: 13.10, offPeak: 9.65 },
      jobcentre:  { peak: 13.10, offPeak: 9.65 },
      railcard:   { peak: 26.20, offPeak: 12.85 },
      disabled:   { peak: 17.40, offPeak: 12.85 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 100.80 },
      ],
    },
  },

  // ── Hertford North ──
  {
    stationKeys: ['hertford north'],
    naptanIds: ['910GHFDN'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 31.00, offPeak: 23.90 },
      zip_16_17:  { peak: 15.50, offPeak: 11.95 },
      jobcentre:  { peak: 15.50, offPeak: 11.95 },
      railcard:   { peak: 31.00, offPeak: 15.90 },
      disabled:   { peak: 20.60, offPeak: 15.90 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 124.20 },
      ],
    },
  },

  // ── Bayford ──
  {
    stationKeys: ['bayford'],
    naptanIds: ['910GBAYFORD'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 29.70, offPeak: 23.50 },
      zip_16_17:  { peak: 14.85, offPeak: 11.75 },
      jobcentre:  { peak: 14.85, offPeak: 11.75 },
      railcard:   { peak: 29.70, offPeak: 15.65 },
      disabled:   { peak: 19.75, offPeak: 15.65 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 113.20 },
      ],
    },
  },

  // ── Epsom ──
  {
    stationKeys: ['epsom'],
    naptanIds: ['910GEPSM'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 27.80, offPeak: 18.00 },
      zip_16_17:  { peak: 13.90, offPeak: 9.00 },
      jobcentre:  { peak: 13.90, offPeak: 9.00 },
      railcard:   { peak: 27.80, offPeak: 11.95 },
      disabled:   { peak: 18.50, offPeak: 11.95 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 92.60 },
      ],
    },
  },

  // ── Merstham ──
  {
    stationKeys: ['merstham'],
    naptanIds: ['910GMERSTHM'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 35.90, offPeak: 20.00 },
      zip_16_17:  { peak: 17.95, offPeak: 10.00 },
      jobcentre:  { peak: 17.95, offPeak: 10.00 },
      railcard:   { peak: 35.90, offPeak: 13.30 },
      disabled:   { peak: 23.90, offPeak: 13.30 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 106.20 },
      ],
    },
  },

  // ── Potters Bar ──
  {
    stationKeys: ['potters bar'],
    naptanIds: ['910GPOTRSBR'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 30.80, offPeak: 19.40 },
      zip_16_17:  { peak: 15.10, offPeak: 9.70 },
      jobcentre:  { peak: 15.10, offPeak: 9.70 },
      railcard:   { peak: 30.80, offPeak: 12.90 },
      disabled:   { peak: 20.50, offPeak: 12.90 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 102.40 },
      ],
    },
  },

  // ── Radlett ──
  {
    stationKeys: ['radlett'],
    naptanIds: ['910GRADLETT'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 31.90, offPeak: 20.90 },
      zip_16_17:  { peak: 15.95, offPeak: 10.45 },
      jobcentre:  { peak: 15.95, offPeak: 10.45 },
      railcard:   { peak: 31.90, offPeak: 13.90 },
      disabled:   { peak: 21.20, offPeak: 13.90 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 109.80 },
      ],
    },
  },

  // ── Ockendon, Chafford Hundred, Purfleet & Grays ──
  {
    stationKeys: ['ockendon', 'chafford hundred', 'purfleet', 'grays'],
    naptanIds: ['910GOCKENDN', '910GCHADHDD', '910GPURFLET', '910GGRAYS'],
    contactlessOnly: false,
    dailyCaps: {
      none:       { peak: 32.30, offPeak: 24.10 },
      zip_16_17:  { peak: 16.15, offPeak: 12.05 },
      jobcentre:  { peak: 16.15, offPeak: 12.05 },
      railcard:   { peak: 32.30, offPeak: 16.05 },
      disabled:   { peak: 21.50, offPeak: 16.05 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 117.00 },
      ],
    },
  },

  // ── Taplow (contactless only) ──
  {
    stationKeys: ['taplow'],
    naptanIds: ['910GTAPLOW'],
    contactlessOnly: true,
    dailyCaps: {
      none: { peak: 37.70, offPeak: 24.90 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 125.00 },
      ],
    },
  },

  // ── Burnham (contactless only) ──
  {
    stationKeys: ['burnham'],
    naptanIds: ['910GBNHAM'],
    contactlessOnly: true,
    dailyCaps: {
      none: { peak: 34.50, offPeak: 23.50 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 119.10 },
      ],
    },
  },

  // ── Slough (contactless only) ──
  {
    stationKeys: ['slough'],
    naptanIds: ['910GSLOUGH'],
    contactlessOnly: true,
    dailyCaps: {
      none: { peak: 31.20, offPeak: 22.40 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 113.40 },
      ],
    },
  },

  // ── Langley (contactless only) ──
  {
    stationKeys: ['langley'],
    naptanIds: ['910GLANGLEY'],
    contactlessOnly: true,
    dailyCaps: {
      none: { peak: 30.20, offPeak: 21.70 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 97.90 },
      ],
    },
  },

  // ── Iver (contactless only) ──
  {
    stationKeys: ['iver'],
    naptanIds: ['910GIVER'],
    contactlessOnly: true,
    dailyCaps: {
      none: { peak: 27.10, offPeak: 20.40 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 91.50 },
      ],
    },
  },

  // ── Reading (contactless only) ──
  {
    stationKeys: ['reading'],
    naptanIds: ['910GRDNGSTN'],
    contactlessOnly: true,
    dailyCaps: {
      none: { peak: 71.30, offPeak: 37.20 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 177.80 },
      ],
    },
  },

  // ── Twyford (contactless only) ──
  {
    stationKeys: ['twyford'],
    naptanIds: ['910GTWYFORD'],
    contactlessOnly: true,
    dailyCaps: {
      none: { peak: 46.20, offPeak: 30.30 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 146.30 },
      ],
    },
  },

  // ── Maidenhead (contactless only) ──
  {
    stationKeys: ['maidenhead'],
    naptanIds: ['910GMDNHEAD'],
    contactlessOnly: true,
    dailyCaps: {
      none: { peak: 39.50, offPeak: 25.60 },
    },
    zoneRanges: {
      none: [
        { zoneRange: 'Z1-6', weeklyCap: 128.80 },
      ],
    },
  },
];

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
  if (!caps) return null;

  return isPeak ? caps.peak : caps.offPeak;
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

  const ranges = group.zoneRanges[fareType];
  if (!ranges || ranges.length === 0) return null;

  // Return the widest zone range's weekly cap (first entry is typically the widest)
  return ranges[0].weeklyCap;
}

/**
 * Get any special notes for an outside-zone station (e.g. "Excludes Gatwick Express").
 */
export function getOutsideZoneNotes(naptanId: string): string | null {
  const group = naptanIndex.get(naptanId);
  return group?.notes ?? null;
}

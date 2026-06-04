// TfL Fare Data — March 2026 rates (frozen caps until 2027)
// All fares in GBP

export type ZoneRange =
  | 'Z1'
  | 'Z1-2'
  | 'Z1-3'
  | 'Z1-4'
  | 'Z1-5'
  | 'Z1-6'
  | 'Z2'
  | 'Z2-3'
  | 'Z2-6'
  | 'Z3'
  | 'Z3-5'
  | 'Z3-6'
  | 'Z4'
  | 'Z4-6'
  | 'Z5'
  | 'Z5-6'
  | 'Z6';

export interface SingleFare {
  peak: number;
  offPeak: number;
}

// PAYG single fares for Tube, DLR, London Overground, Elizabeth line, National Rail (within London)
export const PAYG_FARES: Record<string, SingleFare> = {
  'Z1':   { peak: 3.10, offPeak: 3.00 },
  'Z1-2': { peak: 3.60, offPeak: 3.10 },
  'Z1-3': { peak: 3.90, offPeak: 3.30 },
  'Z1-4': { peak: 4.80, offPeak: 3.60 },
  'Z1-5': { peak: 5.30, offPeak: 3.80 },
  'Z1-6': { peak: 5.90, offPeak: 4.00 },
  // Non-Zone-1 journeys
  'Z2':   { peak: 2.30, offPeak: 2.20 },
  'Z2-3': { peak: 2.30, offPeak: 2.20 },
  'Z2-6': { peak: 3.10, offPeak: 2.50 },
  'Z3':   { peak: 2.30, offPeak: 2.20 },
  'Z3-5': { peak: 2.30, offPeak: 2.20 },
  'Z3-6': { peak: 2.30, offPeak: 2.20 },
  'Z4':   { peak: 2.30, offPeak: 2.20 },
  'Z4-6': { peak: 2.30, offPeak: 2.20 },
  'Z5':   { peak: 2.30, offPeak: 2.20 },
  'Z5-6': { peak: 2.30, offPeak: 2.20 },
  'Z6':   { peak: 2.30, offPeak: 2.20 },
};

// Daily caps (anytime) — frozen until 2027
export const DAILY_CAPS: Record<string, number> = {
  'Z1':   8.90,
  'Z1-2': 8.90,
  'Z1-3': 10.50,
  'Z1-4': 12.80,
  'Z1-5': 15.30,
  'Z1-6': 16.30,
  'Z2':   8.90,
  'Z2-3': 8.90,
  'Z2-6': 10.50,
  'Z3':   8.90,
  'Z3-5': 8.90,
  'Z3-6': 8.90,
  'Z4':   8.90,
  'Z4-6': 8.90,
  'Z5':   8.90,
  'Z5-6': 8.90,
  'Z6':   8.90,
};

// Off-peak daily caps (for railcard holders)
export const DAILY_CAPS_OFFPEAK: Record<string, number> = {
  'Z1':   8.90,
  'Z1-2': 8.90,
  'Z1-3': 10.50,
  'Z1-4': 12.80,
  'Z1-5': 15.30,
  'Z1-6': 16.30,
  'Z2':   8.90,
  'Z2-3': 8.90,
  'Z2-6': 10.50,
  'Z3':   8.90,
  'Z3-5': 8.90,
  'Z3-6': 8.90,
  'Z4':   8.90,
  'Z4-6': 8.90,
  'Z5':   8.90,
  'Z5-6': 8.90,
  'Z6':   8.90,
};

// Weekly caps (Mon–Sun) — frozen until 2027
export const WEEKLY_CAPS: Record<string, number> = {
  'Z1':   44.70,
  'Z1-2': 44.70,
  'Z1-3': 52.50,
  'Z1-4': 64.20,
  'Z1-5': 76.40,
  'Z1-6': 81.60,
  'Z2':   29.10,
  'Z2-3': 29.10,
  'Z2-6': 52.50,
  'Z3':   29.10,
  'Z3-5': 29.10,
  'Z3-6': 29.10,
  'Z4':   29.10,
  'Z4-6': 29.10,
  'Z5':   29.10,
  'Z5-6': 29.10,
  'Z6':   29.10,
};

// Bus & Tram
export const BUS_SINGLE_FARE = 1.75;
export const BUS_DAILY_CAP = 5.25;
export const HOPPER_WINDOW_MINUTES = 60;

// Travelcard prices — frozen until March 2027
export const TRAVELCARD_WEEKLY: Record<string, number> = {
  'Z1-2': 44.70,
  'Z1-3': 52.50,
  'Z1-4': 64.20,
  'Z1-5': 76.40,
  'Z1-6': 81.60,
};

export const TRAVELCARD_MONTHLY: Record<string, number> = {
  'Z1-2': 171.70,
  'Z1-3': 201.60,
  'Z1-4': 246.60,
  'Z1-5': 293.40,
  'Z1-6': 313.40,
};

export const TRAVELCARD_ANNUAL: Record<string, number> = {
  'Z1-2': 1788,
  'Z1-3': 2100,
  'Z1-4': 2568,
  'Z1-5': 3056,
  'Z1-6': 3264,
};

// Student Travelcard (18+ Student Oyster) — 30% off adult annual
export const STUDENT_TRAVELCARD_ANNUAL: Record<string, number> = {
  'Z1-2': 1252,
  'Z1-3': 1470,
  'Z1-4': 1798,
  'Z1-5': 2139,
  'Z1-6': 2285,
};

// Railcard types and their discounts
export type RailcardType =
  | '16-25'
  | '26-30'
  | 'senior'
  | 'disabled'
  | 'hmforces'
  | 'veterans';

export interface RailcardInfo {
  name: string;
  discount: number; // fraction (e.g., 1/3)
  appliesToPeak: boolean;
  cost1Year: number;
  cost3Year: number;
}

export const RAILCARDS: Record<RailcardType, RailcardInfo> = {
  '16-25': {
    name: '16-25 Railcard',
    discount: 1 / 3,
    appliesToPeak: false,
    cost1Year: 30,
    cost3Year: 70,
  },
  '26-30': {
    name: '26-30 Railcard',
    discount: 1 / 3,
    appliesToPeak: false,
    cost1Year: 30,
    cost3Year: 70,
  },
  senior: {
    name: 'Senior Railcard',
    discount: 1 / 3,
    appliesToPeak: false,
    cost1Year: 30,
    cost3Year: 70,
  },
  disabled: {
    name: 'Disabled Persons Railcard',
    discount: 1 / 3,
    appliesToPeak: true, // applies to ALL fares
    cost1Year: 20,
    cost3Year: 54,
  },
  hmforces: {
    name: 'HM Forces Railcard',
    discount: 1 / 3,
    appliesToPeak: false,
    cost1Year: 21,
    cost3Year: 0, // not available
  },
  veterans: {
    name: 'Veterans Railcard',
    discount: 1 / 3,
    appliesToPeak: false,
    cost1Year: 21,
    cost3Year: 0,
  },
};

export const OYSTER_CARD_COST = 7.0;

// TfL rounding: fares are rounded to the nearest 10p
export function roundToNearest10p(amount: number): number {
  return Math.round(amount * 10) / 10;
}

// Determine zone range string from origin/destination zones
export function getZoneRange(originZone: number, destZone: number): string {
  const minZone = Math.min(originZone, destZone);
  const maxZone = Math.max(originZone, destZone);

  if (minZone === maxZone) {
    return `Z${minZone}`;
  }
  return `Z${minZone}-${maxZone}`;
}

// Lookup PAYG fare for a given zone range and peak status
export function lookupFare(zoneRange: string, isPeak: boolean): number {
  const fare = PAYG_FARES[zoneRange];
  if (!fare) {
    // Fallback: find the widest matching range
    return isPeak ? 5.90 : 4.00;
  }
  return isPeak ? fare.peak : fare.offPeak;
}

// Lookup daily cap for a given zone range
export function lookupDailyCap(zoneRange: string): number {
  return DAILY_CAPS[zoneRange] ?? 16.30;
}

// Lookup weekly cap for a given zone range
export function lookupWeeklyCap(zoneRange: string): number {
  return WEEKLY_CAPS[zoneRange] ?? 81.60;
}

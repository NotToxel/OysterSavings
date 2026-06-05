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

export interface FareScales {
  tfl: Record<string, SingleFare>;
  national_rail: Record<string, SingleFare>;
  nr_tube: Record<string, SingleFare>;
}

// PAYG single fares broken down by transport mode
export const PAYG_FARES: FareScales = {
  tfl: {
    'Z1':   { peak: 3.10, offPeak: 3.00 },
    'Z1-2': { peak: 3.60, offPeak: 3.10 },
    'Z1-3': { peak: 3.90, offPeak: 3.30 },
    'Z1-4': { peak: 4.80, offPeak: 3.60 },
    'Z1-5': { peak: 5.30, offPeak: 3.80 },
    'Z1-6': { peak: 5.90, offPeak: 4.00 },
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
  },
  national_rail: {
    'Z1':   { peak: 2.80, offPeak: 2.70 },
    'Z1-2': { peak: 3.20, offPeak: 2.60 },
    'Z1-3': { peak: 3.70, offPeak: 2.45 },
    'Z1-4': { peak: 4.20, offPeak: 2.80 },
    'Z1-5': { peak: 4.90, offPeak: 3.30 },
    'Z1-6': { peak: 5.80, offPeak: 3.70 },
    'Z2':   { peak: 2.60, offPeak: 2.50 },
    'Z2-3': { peak: 2.60, offPeak: 2.50 },
    'Z2-6': { peak: 3.60, offPeak: 2.90 },
    'Z3':   { peak: 2.60, offPeak: 2.50 },
    'Z3-5': { peak: 2.60, offPeak: 2.50 },
    'Z3-6': { peak: 2.60, offPeak: 2.50 },
    'Z4':   { peak: 2.60, offPeak: 2.50 },
    'Z4-6': { peak: 2.60, offPeak: 2.50 },
    'Z5':   { peak: 2.60, offPeak: 2.50 },
    'Z5-6': { peak: 2.60, offPeak: 2.50 },
    'Z6':   { peak: 2.60, offPeak: 2.50 },
  },
  nr_tube: {
    'Z1':   { peak: 3.60, offPeak: 3.10 },
    'Z1-2': { peak: 4.20, offPeak: 3.60 },
    'Z1-3': { peak: 4.80, offPeak: 3.60 },
    'Z1-4': { peak: 5.40, offPeak: 4.20 },
    'Z1-5': { peak: 6.60, offPeak: 4.80 },
    'Z1-6': { peak: 7.50, offPeak: 5.20 },
    'Z2':   { peak: 3.10, offPeak: 2.50 },
    'Z2-3': { peak: 3.10, offPeak: 2.50 },
    'Z2-6': { peak: 4.60, offPeak: 3.90 },
    'Z3':   { peak: 3.10, offPeak: 2.50 },
    'Z3-5': { peak: 3.10, offPeak: 2.50 },
    'Z3-6': { peak: 3.10, offPeak: 2.50 },
    'Z4':   { peak: 3.10, offPeak: 2.50 },
    'Z4-6': { peak: 3.10, offPeak: 2.50 },
    'Z5':   { peak: 3.10, offPeak: 2.50 },
    'Z5-6': { peak: 3.10, offPeak: 2.50 },
    'Z6':   { peak: 3.10, offPeak: 2.50 },
  }
};

// Generated Daily Caps
export const DAILY_CAPS: Record<string, number> = {
  'Z1': 8.90,
  'Z1-2': 8.90,
  'Z1-3': 10.50,
  'Z1-4': 12.80,
  'Z1-5': 15.30,
  'Z1-6': 16.30,
  'Z1-7': 17.80,
  'Z1-8': 21.00,
  'Z1-9': 23.30,
  'Z2': 8.90,
  'Z2-3': 10.50,
  'Z2-4': 12.80,
  'Z2-5': 15.30,
  'Z2-6': 16.30,
  'Z2-7': 17.80,
  'Z2-8': 21.00,
  'Z2-9': 23.30,
  'Z3': 10.50,
  'Z3-4': 12.80,
  'Z3-5': 15.30,
  'Z3-6': 16.30,
  'Z3-7': 17.80,
  'Z3-8': 21.00,
  'Z3-9': 23.30,
  'Z4': 12.80,
  'Z4-5': 15.30,
  'Z4-6': 16.30,
  'Z4-7': 17.80,
  'Z4-8': 21.00,
  'Z4-9': 23.30,
  'Z5': 15.30,
  'Z5-6': 16.30,
  'Z5-7': 17.80,
  'Z5-8': 21.00,
  'Z5-9': 23.30,
  'Z6': 16.30,
  'Z6-7': 17.80,
  'Z6-8': 21.00,
  'Z6-9': 23.30,
  'Z7': 17.80,
  'Z7-8': 21.00,
  'Z7-9': 23.30,
  'Z8': 21.00,
  'Z8-9': 23.30,
};

export const DAILY_CAPS_OFFPEAK: Record<string, number> = {
  'Z1': 5.90,
  'Z1-2': 5.90,
  'Z1-3': 6.95,
  'Z1-4': 8.50,
  'Z1-5': 10.15,
  'Z1-6': 10.85,
  'Z1-7': 10.85,
  'Z1-8': 10.85,
  'Z1-9': 10.85,
  'Z2': 5.90,
  'Z2-3': 6.95,
  'Z2-4': 8.50,
  'Z2-5': 10.15,
  'Z2-6': 10.85,
  'Z2-7': 10.85,
  'Z2-8': 10.85,
  'Z2-9': 10.85,
  'Z3': 6.95,
  'Z3-4': 8.50,
  'Z3-5': 10.15,
  'Z3-6': 10.85,
  'Z3-7': 10.85,
  'Z3-8': 10.85,
  'Z3-9': 10.85,
  'Z4': 8.50,
  'Z4-5': 10.15,
  'Z4-6': 10.85,
  'Z4-7': 10.85,
  'Z4-8': 10.85,
  'Z4-9': 10.85,
  'Z5': 10.15,
  'Z5-6': 10.85,
  'Z5-7': 10.85,
  'Z5-8': 10.85,
  'Z5-9': 10.85,
  'Z6': 10.85,
  'Z6-7': 10.85,
  'Z6-8': 10.85,
  'Z6-9': 10.85,
  'Z7': 10.85,
  'Z7-8': 10.85,
  'Z7-9': 10.85,
  'Z8': 10.85,
  'Z8-9': 10.85,
};

export const WEEKLY_CAPS: Record<string, number> = {
  'Z1': 44.70,
  'Z1-2': 44.70,
  'Z1-3': 52.50,
  'Z1-4': 64.20,
  'Z1-5': 76.40,
  'Z1-6': 81.60,
  'Z1-7': 88.90,
  'Z1-8': 104.90,
  'Z1-9': 116.40,
  'Z2': 33.50,
  'Z2-3': 33.50,
  'Z2-4': 37.10,
  'Z2-5': 44.50,
  'Z2-6': 55.90,
  'Z2-7': 57.90,
  'Z2-8': 78.90,
  'Z2-9': 78.90,
  'Z3': 33.50,
  'Z3-4': 33.50,
  'Z3-5': 37.10,
  'Z3-6': 44.50,
  'Z3-7': 57.90,
  'Z3-8': 78.90,
  'Z3-9': 78.90,
  'Z4': 33.50,
  'Z4-5': 33.50,
  'Z4-6': 37.10,
  'Z4-7': 41.90,
  'Z4-8': 70.70,
  'Z4-9': 70.70,
  'Z5': 33.50,
  'Z5-6': 33.50,
  'Z5-7': 41.90,
  'Z5-8': 70.70,
  'Z5-9': 70.70,
  'Z6': 33.50,
  'Z6-7': 41.90,
  'Z6-8': 70.70,
  'Z6-9': 70.70,
  'Z7': 41.90,
  'Z7-8': 70.70,
  'Z7-9': 70.70,
  'Z8': 70.70,
  'Z8-9': 70.70,
};

// Bus & Tram
export const BUS_SINGLE_FARE = 1.75;
export const BUS_DAILY_CAP = 5.25;
export const HOPPER_WINDOW_MINUTES = 60;

export const STUDENT_PHOTOCARD_FEE = 12;

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

// Student Travelcard (18+ Student Oyster) — 30% off adult annual/monthly
export const STUDENT_TRAVELCARD_MONTHLY: Record<string, number> = {
  'Z1-2': 120.20,
  'Z1-3': 141.10,
  'Z1-4': 172.60,
  'Z1-5': 205.40,
  'Z1-6': 219.40,
};

export const STUDENT_TRAVELCARD_ANNUAL: Record<string, number> = {
  'Z1-2': 1252,
  'Z1-3': 1470,
  'Z1-4': 1798,
  'Z1-5': 2139,
  'Z1-6': 2285,
};

// Railcard types and their discounts
export type RailcardType =
  | 'none'
  | 'student'
  | '16-25'
  | '26-30'
  | 'senior'
  | 'disabled'
  | 'hmforces'
  | 'veterans'
  | 'network';

export interface RailcardInfo {
  name: string;
  discount: number; // fraction (e.g., 1/3)
  appliesToPeak: boolean;
  cost1Year: number;
  cost3Year: number;
}

export const RAILCARDS: Record<RailcardType, RailcardInfo> = {
  'none': {
    name: 'Adult / Contactless',
    discount: 0,
    appliesToPeak: false,
    cost1Year: 0,
    cost3Year: 0,
  },
  'student': {
    name: '18+ Student',
    discount: 0, // Gets 30% off travelcards, no PAYG discount natively without adding a 16-25 railcard
    appliesToPeak: false,
    cost1Year: 0, // Admin fee handled by STUDENT_PHOTOCARD_FEE
    cost3Year: 0,
  },
  '16-25': {
    name: '16-25 Railcard',
    discount: 1 / 3,
    appliesToPeak: false,
    cost1Year: 35,
    cost3Year: 80,
  },
  '26-30': {
    name: '26-30 Railcard',
    discount: 1 / 3,
    appliesToPeak: false,
    cost1Year: 35,
    cost3Year: 0,
  },
  senior: {
    name: 'Senior Railcard',
    discount: 1 / 3,
    appliesToPeak: false,
    cost1Year: 35,
    cost3Year: 80,
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
    cost3Year: 0,
  },
  veterans: {
    name: 'Veterans Railcard',
    discount: 1 / 3,
    appliesToPeak: false,
    cost1Year: 35,
    cost3Year: 80,
  },
  'network': {
    name: 'Network Railcard',
    discount: 1 / 3,
    appliesToPeak: false, // only applies after 10am weekdays
    cost1Year: 30,
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
export function lookupFare(zoneRange: string, isPeak: boolean, mode: string = 'underground'): number {
  let scale = PAYG_FARES.tfl;
  if (mode === 'national_rail') {
    scale = PAYG_FARES.national_rail;
  } else if (mode === 'nr_tube') {
    scale = PAYG_FARES.nr_tube;
  }
  
  const fare = scale[zoneRange] || PAYG_FARES.tfl[zoneRange];
  if (!fare) {
    // Fallback: use generic max or infer
    return isPeak ? 5.90 : 4.00;
  }
  return isPeak ? fare.peak : fare.offPeak;
}

// Lookup daily cap for a given zone range
export function lookupDailyCap(zoneRange: string, isPeak: boolean = true): number {
  if (isPeak) {
    return DAILY_CAPS[zoneRange] ?? 16.30;
  }
  return DAILY_CAPS_OFFPEAK[zoneRange] ?? 16.30;
}

// Lookup weekly cap for a given zone range
export function lookupWeeklyCap(zoneRange: string): number {
  return WEEKLY_CAPS[zoneRange] ?? 81.60;
}

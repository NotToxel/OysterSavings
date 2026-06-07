// TfL Fare Data — March 2026 rates (frozen caps until 2027)
// All fares in GBP

import sampledZoneFaresData from './sampledZoneFares.json';
const exactFares: Record<string, { peak: number, offPeak: number }> = sampledZoneFaresData as any;

// All fares in GBP

export type ZoneRange =
  | 'Z1'
  | 'Z1-2' | 'Z1-3' | 'Z1-4' | 'Z1-5' | 'Z1-6' | 'Z1-7' | 'Z1-8' | 'Z1-9'
  | 'Z2'
  | 'Z2-3' | 'Z2-4' | 'Z2-5' | 'Z2-6' | 'Z2-7' | 'Z2-8' | 'Z2-9'
  | 'Z3'
  | 'Z3-4' | 'Z3-5' | 'Z3-6' | 'Z3-7' | 'Z3-8' | 'Z3-9'
  | 'Z4'
  | 'Z4-5' | 'Z4-6' | 'Z4-7' | 'Z4-8' | 'Z4-9'
  | 'Z5'
  | 'Z5-6' | 'Z5-7' | 'Z5-8' | 'Z5-9'
  | 'Z6'
  | 'Z6-7' | 'Z6-8' | 'Z6-9'
  | 'Z7'
  | 'Z7-8' | 'Z7-9'
  | 'Z8'
  | 'Z8-9'
  | 'Z9';

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
// Updated from TfL API — June 2026 (Metropolitan + Southeastern line sampling)
export const PAYG_FARES: FareScales = {
  tfl: {
    'Z1':   { peak: 3.10, offPeak: 3.00 },
    'Z1-2': { peak: 3.60, offPeak: 3.10 },
    'Z1-3': { peak: 3.90, offPeak: 3.30 },
    'Z1-4': { peak: 4.80, offPeak: 3.60 },
    'Z1-5': { peak: 5.30, offPeak: 3.80 },
    'Z1-6': { peak: 5.90, offPeak: 4.00 },
    'Z1-7': { peak: 7.10, offPeak: 5.20 },
    'Z1-8': { peak: 8.70, offPeak: 5.20 },
    'Z1-9': { peak: 8.80, offPeak: 5.30 },
    'Z2':   { peak: 2.30, offPeak: 2.20 },
    'Z2-3': { peak: 2.50, offPeak: 2.30 },
    'Z2-4': { peak: 3.20, offPeak: 2.40 },
    'Z2-5': { peak: 3.40, offPeak: 2.50 },
    'Z2-6': { peak: 3.80, offPeak: 2.60 },
    'Z2-7': { peak: 5.20, offPeak: 3.70 },
    'Z2-8': { peak: 5.90, offPeak: 3.80 },
    'Z2-9': { peak: 5.90, offPeak: 3.80 },
    'Z3':   { peak: 2.30, offPeak: 2.20 },
    'Z3-4': { peak: 2.50, offPeak: 2.30 },
    'Z3-5': { peak: 3.20, offPeak: 2.40 },
    'Z3-6': { peak: 3.40, offPeak: 2.50 },
    'Z3-7': { peak: 4.20, offPeak: 2.40 },
    'Z3-8': { peak: 5.10, offPeak: 2.40 },
    'Z3-9': { peak: 5.30, offPeak: 2.40 },
    'Z4':   { peak: 2.30, offPeak: 2.20 },
    'Z4-5': { peak: 2.50, offPeak: 2.30 },
    'Z4-6': { peak: 3.20, offPeak: 2.40 },
    'Z4-7': { peak: 3.40, offPeak: 2.40 },
    'Z4-8': { peak: 4.20, offPeak: 2.40 },
    'Z4-9': { peak: 4.30, offPeak: 2.40 },
    'Z5':   { peak: 2.30, offPeak: 2.20 },
    'Z5-6': { peak: 2.50, offPeak: 2.30 },
    'Z5-7': { peak: 3.10, offPeak: 2.40 },
    'Z5-8': { peak: 3.40, offPeak: 2.40 },
    'Z5-9': { peak: 3.70, offPeak: 2.40 },
    'Z6':   { peak: 2.30, offPeak: 2.20 },
    'Z6-7': { peak: 2.30, offPeak: 2.10 },
    'Z6-8': { peak: 3.10, offPeak: 2.30 },
    'Z6-9': { peak: 3.20, offPeak: 2.40 },
    'Z7':   { peak: 2.10, offPeak: 2.00 },
    'Z7-8': { peak: 2.30, offPeak: 2.10 },
    'Z7-9': { peak: 2.40, offPeak: 2.20 },
    'Z8':   { peak: 2.30, offPeak: 2.10 },
    'Z8-9': { peak: 2.30, offPeak: 2.10 },
    'Z9':   { peak: 2.30, offPeak: 2.10 },
  },
  national_rail: {
    'Z1':    { peak: 3.10, offPeak: 3.00 },
    'Z1-2':  { peak: 3.90, offPeak: 3.20 },
    'Z1-3':  { peak: 4.60, offPeak: 3.70 },
    'Z1-4':  { peak: 5.30, offPeak: 4.00 },
    'Z1-5':  { peak: 6.60, offPeak: 4.40 },
    'Z1-6':  { peak: 8.50, offPeak: 5.20 },
    'Z1-7':  { peak: 7.10, offPeak: 5.20 },
    'Z1-8':  { peak: 9.60, offPeak: 5.70 },
    'Z1-9':  { peak: 11.20, offPeak: 7.70 },
    'Z2':    { peak: 3.00, offPeak: 2.70 },
    'Z2-3':  { peak: 3.60, offPeak: 3.00 },
    'Z2-4':  { peak: 5.30, offPeak: 4.00 },
    'Z2-5':  { peak: 6.60, offPeak: 4.40 },
    'Z2-6':  { peak: 8.50, offPeak: 5.20 },
    'Z2-7':  { peak: 5.80, offPeak: 4.20 },
    'Z2-8':  { peak: 9.60, offPeak: 5.70 },
    'Z2-9':  { peak: 8.70, offPeak: 5.80 },
    'Z3':    { peak: 3.00, offPeak: 2.70 },
    'Z3-4':  { peak: 3.60, offPeak: 3.00 },
    'Z3-5':  { peak: 4.00, offPeak: 3.20 },
    'Z3-6':  { peak: 4.80, offPeak: 3.70 },
    'Z3-7':  { peak: 5.80, offPeak: 4.20 },
    'Z3-8':  { peak: 5.80, offPeak: 3.70 },
    'Z3-9':  { peak: 8.70, offPeak: 5.80 },
    'Z4':    { peak: 3.00, offPeak: 2.70 },
    'Z4-5':  { peak: 4.00, offPeak: 3.20 },
    'Z4-6':  { peak: 4.80, offPeak: 3.70 },
    'Z4-7':  { peak: 5.80, offPeak: 4.20 },
    'Z4-8':  { peak: 5.80, offPeak: 3.70 },
    'Z4-9':  { peak: 8.70, offPeak: 5.80 },
    'Z5':    { peak: 3.00, offPeak: 2.70 },
    'Z5-6':  { peak: 3.60, offPeak: 3.00 },
    'Z5-7':  { peak: 10.40, offPeak: 7.00 },
    'Z5-8':  { peak: 4.80, offPeak: 3.70 },
    'Z5-9':  { peak: 10.60, offPeak: 7.30 },
    'Z6':    { peak: 3.00, offPeak: 2.70 },
    'Z6-7':  { peak: 5.80, offPeak: 4.20 },
    'Z6-8':  { peak: 4.80, offPeak: 3.70 },
    'Z6-9':  { peak: 8.70, offPeak: 5.80 },
    'Z7':    { peak: 2.10, offPeak: 2.00 },
    'Z7-8':  { peak: 10.40, offPeak: 7.00 },
    'Z7-9':  { peak: 7.80, offPeak: 4.70 },
    'Z8':    { peak: 5.80, offPeak: 3.70 },
    'Z8-9':  { peak: 10.40, offPeak: 7.00 },
    'Z9':    { peak: 2.10, offPeak: 2.00 },
  },
  nr_tube: {
    'Z1':    { peak: 3.10, offPeak: 3.00 },
    'Z1-2':  { peak: 5.90, offPeak: 5.10 },
    'Z1-3':  { peak: 6.60, offPeak: 5.40 },
    'Z1-4':  { peak: 7.30, offPeak: 5.90 },
    'Z1-5':  { peak: 8.80, offPeak: 6.30 },
    'Z1-6':  { peak: 10.40, offPeak: 7.00 },
    'Z1-7':  { peak: 13.50, offPeak: 9.00 },
    'Z1-8':  { peak: 10.40, offPeak: 7.00 },
    'Z1-9':  { peak: 12.30, offPeak: 9.20 },
    'Z2':    { peak: 3.60, offPeak: 3.10 },
    'Z2-3':  { peak: 3.90, offPeak: 3.30 },
    'Z2-4':  { peak: 4.80, offPeak: 3.60 },
    'Z2-5':  { peak: 5.30, offPeak: 3.80 },
    'Z2-6':  { peak: 5.90, offPeak: 4.00 },
    'Z2-7':  { peak: 7.10, offPeak: 5.20 },
    'Z2-8':  { peak: 10.40, offPeak: 7.00 },
    'Z2-9':  { peak: 11.20, offPeak: 7.70 },
    'Z3':    { peak: 6.60, offPeak: 5.40 },
    'Z3-4':  { peak: 7.30, offPeak: 5.90 },
    'Z3-5':  { peak: 8.80, offPeak: 6.30 },
    'Z3-6':  { peak: 10.40, offPeak: 7.00 },
    'Z3-7':  { peak: 7.10, offPeak: 5.20 },
    'Z3-8':  { peak: 10.40, offPeak: 7.00 },
    'Z3-9':  { peak: 10.40, offPeak: 7.00 },
    'Z4':    { peak: 7.30, offPeak: 5.90 },
    'Z4-5':  { peak: 8.80, offPeak: 6.30 },
    'Z4-6':  { peak: 10.40, offPeak: 7.00 },
    'Z4-7':  { peak: 7.10, offPeak: 5.20 },
    'Z4-8':  { peak: 10.40, offPeak: 7.00 },
    'Z4-9':  { peak: 10.40, offPeak: 7.00 },
    'Z5':    { peak: 8.80, offPeak: 6.30 },
    'Z5-6':  { peak: 10.40, offPeak: 7.00 },
    'Z5-7':  { peak: 7.10, offPeak: 5.20 },
    'Z5-8':  { peak: 10.40, offPeak: 7.00 },
    'Z5-9':  { peak: 10.40, offPeak: 7.00 },
    'Z6':    { peak: 10.40, offPeak: 7.00 },
    'Z6-7':  { peak: 7.10, offPeak: 5.20 },
    'Z6-8':  { peak: 10.40, offPeak: 7.00 },
    'Z6-9':  { peak: 10.40, offPeak: 7.00 },
    'Z7-8':  { peak: 2.30, offPeak: 2.10 },
    'Z7-9':  { peak: 2.40, offPeak: 2.20 },
    'Z8-9':  { peak: 2.30, offPeak: 2.10 },
    'Z7':    { peak: 2.10, offPeak: 2.00 },
    'Z8':    { peak: 2.30, offPeak: 2.10 },
    'Z9':    { peak: 2.10, offPeak: 2.00 }
  }
};

// Override PAYG_FARES with randomly sampled exact fares generated by updateZoneTables
try {
  if (sampledZoneFaresData) {
    for (const mode of Object.keys(sampledZoneFaresData)) {
      if (PAYG_FARES[mode as keyof FareScales]) {
        for (const [zone, fare] of Object.entries(sampledZoneFaresData[mode as keyof typeof sampledZoneFaresData] || {})) {
          PAYG_FARES[mode as keyof FareScales][zone] = fare;
        }
      }
    }
  }
} catch(e) {
  // Ignore
}

// Generated Daily Caps
export const DAILY_CAPS: Record<string, number> = {
  'Z1-2': 8.90,
  'Z1-3': 10.50,
  'Z1-4': 12.80,
  'Z1-5': 15.30,
  'Z1-6': 16.30,
  'Z1-7': 17.80,
  'Z1-8': 21.00,
  'Z1-9': 23.30,
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
  'Z1-2': 5.90,
  'Z1-3': 6.95,
  'Z1-4': 8.50,
  'Z1-5': 10.15,
  'Z1-6': 10.85,
  'Z1-7': 10.85,
  'Z1-8': 10.85,
  'Z1-9': 10.85,
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

// Fare Type types and their discounts
export type FareType =
  | 'none'
  | 'student'
  | 'zip_11_15'
  | 'zip_16_17'
  | 'jobcentre'
  | 'disabled'
  | 'railcard';

export interface FareTypeInfo {
  name: string;
  discount: number; // fraction (e.g., 1/3)
  appliesToPeak: boolean;
  cost1Year: number;
  cost3Year: number;
}

export const FARE_TYPES: Record<FareType, FareTypeInfo> = {
  'none': {
    name: 'Adult / Contactless',
    discount: 0,
    appliesToPeak: false,
    cost1Year: 0,
    cost3Year: 0,
  },
  'student': {
    name: 'Apprentice / 18+ Student Oyster',
    discount: 0, // Gets 30% off travelcards, no PAYG discount natively without adding a railcard
    appliesToPeak: false,
    cost1Year: 0,
    cost3Year: 0,
  },
  'zip_11_15': {
    name: '11-15 Zip Oyster Card',
    discount: 0.5,
    appliesToPeak: true,
    cost1Year: 0,
    cost3Year: 0,
  },
  'zip_16_17': {
    name: '16+ Zip Oyster Card',
    discount: 0.5,
    appliesToPeak: true,
    cost1Year: 0,
    cost3Year: 0,
  },
  'jobcentre': {
    name: 'Jobcentre Plus Travel Discount',
    discount: 0.5,
    appliesToPeak: true,
    cost1Year: 0,
    cost3Year: 0,
  },
  'disabled': {
    name: 'Disabled Persons Railcard',
    discount: 1 / 3,
    appliesToPeak: true,
    cost1Year: 20,
    cost3Year: 54,
  },
  'railcard': {
    name: 'National Railcard / Gold Card',
    discount: 1 / 3,
    appliesToPeak: false,
    cost1Year: 30,
    cost3Year: 70,
  },
};

export const OYSTER_CARD_COST = 7.0;

// TfL rounding: fares are rounded to the nearest 10p
export function roundToNearest10p(amount: number): number {
  return Math.round(amount * 10) / 10;
}

// Calculate discounted fare based on TfL's rules:
// - Standard Railcards (16-25, 26-30, Senior, Disabled, Network, etc.) get 1/3 off off-peak fares,
//   which uses a 33.4% discount (0.666 multiplier) and rounds down to the nearest 5p.
// - Jobcentre Plus Travel Discount gets a 50% discount (0.5 multiplier) and rounds down to the nearest 5p.
export function calculateDiscountedFare(
  baseFare: number,
  fareType: FareType,
  isPeak: boolean,
  isBus: boolean = false,
  originZone?: number,
  destinationZone?: number,
  mode?: string
): number {
  if (fareType === 'none' || fareType === 'student') {
    return baseFare;
  }

  const fareTypeInfo = FARE_TYPES[fareType];
  if (!fareTypeInfo) return baseFare;

  // 11-15 Zip: Free bus/tram, flat child fares on TfL Rail in Zones 1-6
  if (fareType === 'zip_11_15') {
    if (isBus) return 0.00;
    
    const isTfLOnly = mode !== undefined && mode !== 'national_rail' && mode !== 'nr_tube';
    const isWithinZones1To6 = originZone !== undefined && destinationZone !== undefined && originZone >= 1 && originZone <= 6 && destinationZone >= 1 && destinationZone <= 6;
    
    if (isTfLOnly && isWithinZones1To6) {
      return isPeak ? 1.05 : 0.95;
    }
    
    return Math.floor(baseFare * 0.5 * 20) / 20;
  }

  // 16+ Zip: Free bus/tram, 50% off rail single fares
  if (fareType === 'zip_16_17') {
    if (isBus) return 0.00;
    return Math.floor(baseFare * 0.5 * 20) / 20;
  }

  if (isBus) {
    if (fareType === 'jobcentre') {
      return Math.floor(baseFare * 0.5 * 20) / 20;
    }
    return baseFare;
  }

  // Peak fares do not get discount unless appliesToPeak is true (Disabled Persons / Jobcentre)
  if (isPeak && !fareTypeInfo.appliesToPeak) {
    return baseFare;
  }

  const multiplier = fareType === 'jobcentre' ? 0.5 : 0.666;
  return Math.floor(baseFare * multiplier * 20) / 20;
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

// Lookup exact station-to-station fare if available from scraped data
export function lookupExactFare(originId: string, destId: string, isPeak: boolean): number | null {
  const key = `${originId}-${destId}`;
  const reverseKey = `${destId}-${originId}`;
  
  const fare = exactFares[key] || exactFares[reverseKey];
  if (fare) {
    const amount = isPeak ? fare.peak : fare.offPeak;
    return amount !== null ? amount : null;
  }
  return null;
}

// Lookup daily cap for a given zone range
export function lookupDailyCap(zoneRange: string, isPeak: boolean = true, fareType: FareType = 'none'): number {
  const adultCap = DAILY_CAPS[zoneRange] ?? 16.30;
  
  if (fareType === 'jobcentre' || fareType === 'zip_11_15' || fareType === 'zip_16_17') {
    return Math.floor(adultCap * 0.5 * 20) / 20;
  }
  
  if (fareType === 'none' || fareType === 'student') {
    // Standard adults pay the standard cap whether peak or off-peak
    return adultCap;
  }
  
  // Standard Railcards (National Railcard / Gold Card) get off-peak daily caps.
  // Disabled Persons Railcard gets 1/3 discount on both peak and off-peak daily caps.
  const isEligibleForDiscount = !isPeak || fareType === 'disabled';
  if (isEligibleForDiscount) {
    return DAILY_CAPS_OFFPEAK[zoneRange] ?? Math.floor(adultCap * 0.666 * 20) / 20;
  }
  
  return adultCap;
}

// Lookup weekly cap for a given zone range
export function lookupWeeklyCap(zoneRange: string, fareType: FareType = 'none'): number {
  const baseCap = WEEKLY_CAPS[zoneRange] ?? 81.60;
  if (fareType === 'jobcentre' || fareType === 'zip_11_15' || fareType === 'zip_16_17') {
    return Math.round(baseCap * 0.5 * 10) / 10; // Round to nearest 10p
  }
  return baseCap;
}

// Meeus/Jones/Butcher Gregorian Easter Algorithm
export function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const monthIndex = Math.floor((h + L - 7 * m + 114) / 31) - 1; // 0-based index
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, monthIndex, day);
}

// England & Wales Bank Holidays
export function isUKBankHoliday(date: Date): boolean {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-based
  const d = date.getDate();

  // 1. New Year's Day (Jan 1) or substitute Monday
  // If Jan 1 is Sat, sub is Monday Jan 3. If Jan 1 is Sun, sub is Monday Jan 2.
  const jan1 = new Date(y, 0, 1);
  const jan1Day = jan1.getDay();
  let nydSub = 1;
  if (jan1Day === 6) nydSub = 3; // Sat -> Monday Jan 3
  else if (jan1Day === 0) nydSub = 2; // Sun -> Monday Jan 2
  
  if (m === 0 && d === 1 && jan1Day !== 0 && jan1Day !== 6) return true;
  if (m === 0 && d === nydSub && (jan1Day === 0 || jan1Day === 6)) return true;

  // Easter Holidays
  const easter = getEasterDate(y);
  
  // Good Friday (Easter - 2 days)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  if (m === goodFriday.getMonth() && d === goodFriday.getDate()) return true;

  // Easter Monday (Easter + 1 day)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  if (m === easterMonday.getMonth() && d === easterMonday.getDate()) return true;

  // Early May Bank Holiday: First Monday in May
  let firstMay = new Date(y, 4, 1);
  while (firstMay.getDay() !== 1) {
    firstMay.setDate(firstMay.getDate() + 1);
  }
  if (m === 4 && d === firstMay.getDate()) return true;

  // Spring Bank Holiday: Last Monday in May
  let lastMay = new Date(y, 4, 31);
  while (lastMay.getDay() !== 1) {
    lastMay.setDate(lastMay.getDate() - 1);
  }
  if (m === 4 && d === lastMay.getDate()) return true;

  // Summer Bank Holiday: Last Monday in August
  let lastAug = new Date(y, 7, 31);
  while (lastAug.getDay() !== 1) {
    lastAug.setDate(lastAug.getDate() - 1);
  }
  if (m === 7 && d === lastAug.getDate()) return true;

  // Christmas Day & Boxing Day
  const xmasDayOfWeek = new Date(y, 11, 25).getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (xmasDayOfWeek === 6) {
    // Christmas is Saturday -> Monday 27th and Tuesday 28th are substitute holidays
    if (m === 11 && (d === 27 || d === 28)) return true;
  } else if (xmasDayOfWeek === 0) {
    // Christmas is Sunday -> Monday 26th (Boxing Day) and Tuesday 27th (Christmas substitute) are holidays
    if (m === 11 && (d === 26 || d === 27)) return true;
  } else if (xmasDayOfWeek === 5) {
    // Christmas is Friday -> Boxing Day is Saturday -> Monday 28th is Boxing Day substitute holiday
    if (m === 11 && (d === 25 || d === 28)) return true;
  } else {
    // Christmas is Monday-Thursday -> standard Dec 25 and Dec 26 holidays
    if (m === 11 && (d === 25 || d === 26)) return true;
  }

  return false;
}

// peak hours: Monday to Friday (except bank holidays) 06:30 - 09:30 and 16:00 - 19:00
export function isPeakJourney(
  date: Date,
  timeStr: string, // "HH:MM"
  originZone: number | null,
  destZone: number | null
): boolean {
  const dayOfWeek = date.getDay();
  // Weekends are always off-peak
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // Bank holidays are always off-peak
  if (isUKBankHoliday(date)) return false;

  const parts = timeStr.split(':');
  if (parts.length !== 2) return false;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return false;

  const totalMinutes = hours * 60 + minutes;

  // Morning peak: 06:30 - 09:30
  const isMorningPeak = totalMinutes >= 390 && totalMinutes < 570;

  // Evening peak: 16:00 - 19:00
  const isEveningPeak = totalMinutes >= 960 && totalMinutes < 1140;

  if (isMorningPeak) return true;

  if (isEveningPeak) {
    // Evening Peak Exemption: travel from outside Zone 1 to Zone 1
    if (originZone !== null && destZone !== null && originZone > 1 && destZone === 1) {
      return false; // Inbound to Zone 1 is off-peak
    }
    return true;
  }

  return false;
}

// Representative time for Planner ranges
export function getRepresentativeTime(timePeriod: string): string {
  if (timePeriod === '06:30-09:30') return '07:30';
  if (timePeriod === '16:00-19:00') return '17:30';
  if (timePeriod === '04:30-06:29') return '05:30';
  if (timePeriod === '09:31-15:59') return '11:00';
  if (timePeriod === '19:01-04:29') return '21:00';
  return '12:00';
}

// Local YYYY-MM-DD date formatter
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Local date string parser
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

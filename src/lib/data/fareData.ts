// TfL Fare Data — March 2026 rates (frozen caps until 2027)
// All fares in GBP

import sampledZoneFaresData from './sampledZoneFares.json';
const exactFares: Record<string, { peak: number, offPeak: number }> = sampledZoneFaresData as any;

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

export * from './fareRates';
import {
  PAYG_FARES,
  DAILY_CAPS,
  DAILY_CAPS_OFFPEAK,
  WEEKLY_CAPS,
  BUS_SINGLE_FARE,
  BUS_DAILY_CAP,
  HOPPER_WINDOW_MINUTES,
  BUS_PASS_WEEKLY,
  BUS_PASS_MONTHLY,
  BUS_PASS_ANNUAL,
  STUDENT_BUS_PASS_WEEKLY,
  STUDENT_BUS_PASS_MONTHLY,
  STUDENT_BUS_PASS_ANNUAL,
  STUDENT_PHOTOCARD_FEE,
  TRAVELCARD_WEEKLY,
  TRAVELCARD_MONTHLY,
  TRAVELCARD_ANNUAL,
  STUDENT_TRAVELCARD_MONTHLY,
  STUDENT_TRAVELCARD_ANNUAL,
  FARE_TYPES,
  OYSTER_CARD_COST
} from './fareRates';

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

export function parseZoneRange(rangeStr: string): { min: number; max: number } {
  const match = rangeStr.match(/Z(\d+)(?:-(\d+))?/);
  if (!match) return { min: 1, max: 2 };
  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  return { min, max };
}

export function travelcardIncludesTrams(minZone: number, maxZone: number): boolean {
  for (let z = 3; z <= 6; z++) {
    if (z >= minZone && z <= maxZone) return true;
  }
  return false;
}

export function getTravelcardJourneyFare(
  journey: { mode: string; originZone: number | null; destinationZone: number | null; isPeak: boolean },
  tcZoneRange: string,
  baseFare: number,
  fareType: FareType
): number {
  if (journey.mode === 'bus') {
    return 0; // all travelcards include buses by default
  }

  const { min: minTc, max: maxTc } = parseZoneRange(tcZoneRange);

  if (journey.mode === 'tram') {
    const includesTrams = travelcardIncludesTrams(minTc, maxTc);
    return includesTrams ? 0 : baseFare;
  }

  // Rail/Tube:
  const oZone = journey.originZone;
  const dZone = journey.destinationZone;

  if (oZone === null || dZone === null) {
    return baseFare;
  }

  const zMin = Math.min(oZone, dZone);
  const zMax = Math.max(oZone, dZone);

  // If both origin and dest zones are within the travelcard covered zones
  if (zMin >= minTc && zMax <= maxTc) {
    return 0;
  }

  // If entirely outside
  if (zMax < minTc || zMin > maxTc) {
    return baseFare;
  }

  // Partially outside (extension)
  let boundaryZone = maxTc;
  let outsideZone = zMax;
  if (zMin < minTc) {
    boundaryZone = minTc;
    outsideZone = zMin;
  }

  const extRange = getZoneRange(boundaryZone, outsideZone);
  const extRawFare = lookupFare(extRange, journey.isPeak, journey.mode);

  return calculateDiscountedFare(
    extRawFare,
    fareType,
    journey.isPeak,
    false,
    boundaryZone,
    outsideZone,
    journey.mode
  );
}

export function getBusPassJourneyFare(
  journey: { mode: string; originZone: number | null; destinationZone: number | null; isPeak: boolean },
  baseFare: number
): number {
  if (journey.mode === 'bus' || journey.mode === 'tram') {
    return 0; // covered by Bus & Tram Pass
  }
  return baseFare; // rail/tube is not covered
}

// TfL Fare Data — March 2026 rates (frozen caps until 2027)
// All fares in GBP

import sampledZoneFaresData from './sampledZoneFares.json';
const exactFares: Record<string, { peak: number, offPeak: number }> = sampledZoneFaresData as any;
import { getStationByNaptan, getStationInfo } from './stationService';

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
export * from './outsideZoneFares';
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
  STUDENT_TRAVELCARD_WEEKLY,
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
  mode?: string,
  originNaptanOrName?: string | null,
  destinationNaptanOrName?: string | null
): number {
  if (fareType === 'none' || fareType === 'student') {
    return baseFare;
  }

  // If origin/destination is contactless-only, concession/discount fares do not apply (force base fare)
  if (originNaptanOrName || destinationNaptanOrName) {
    let isContactlessOnly = false;
    const checkContactlessOnly = (val: string | null | undefined) => {
      if (!val) return false;
      const byNaptan = getStationByNaptan(val);
      if (byNaptan?.info.contactlessOnly) return true;
      const byName = getStationInfo(val);
      if (byName?.contactlessOnly) return true;
      return false;
    };
    if (checkContactlessOnly(originNaptanOrName) || checkContactlessOnly(destinationNaptanOrName)) {
      isContactlessOnly = true;
    }
    if (isContactlessOnly) {
      return baseFare;
    }
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
  const zones = [originZone, destZone].filter(z => z > 0);
  if (zones.length === 0) {
    return 'Z1-2';
  }
  const minZone = Math.min(...zones);
  const maxZone = Math.max(...zones);

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
  // 'elizabeth', 'underground', 'overground', 'dlr', and other TfL modes use the default tfl scale

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

// Get daily bus and tram cap (Jobcentre Plus and others get same cap as adult)
export function getDailyBusCap(fareType: FareType): number {
  if (fareType === 'zip_11_15' || fareType === 'zip_16_17') {
    return 0.00;
  }
  return BUS_DAILY_CAP; // £5.25
}

// Get weekly bus and tram cap (Jobcentre Plus and others get same cap as adult)
export function getWeeklyBusCap(fareType: FareType): number {
  if (fareType === 'zip_11_15' || fareType === 'zip_16_17') {
    return 0.00;
  }
  return BUS_PASS_WEEKLY; // £24.70
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

/**
 * Off-peak daily cap exception stations.
 * Journeys tapping in from these stations AT OR AFTER the listed cut-off time
 * (during the 06:30–09:30 morning peak window on weekdays) count towards the
 * OFF-PEAK daily cap, even though the peak single fare is still charged.
 * Values are the cut-off in total minutes from midnight.
 */
export const OFFPEAK_CAP_EXCEPTION_STATIONS: Record<string, number> = {
  // Amersham
  'amersham': 550,           // 09:10
  'amersham rail station': 550,
  'amersham underground station': 550,

  // Broxbourne
  'broxbourne': 560,         // 09:20
  'broxbourne rail station': 560,

  // Bushey
  'bushey': 560,             // 09:20
  'bushey rail station': 560,

  // Carpenders Park
  'carpenders park': 560,    // 09:20
  'carpenders park rail station': 560,

  // Chalfont & Latimer
  'chalfont & latimer': 560, // 09:20
  'chalfont & latimer rail station': 560,
  'chalfont & latimer underground station': 560,
  'chalfont and latimer': 560,
  'chalfont and latimer rail station': 560,
  'chalfont and latimer underground station': 560,

  // Chesham
  'chesham': 550,            // 09:10
  'chesham underground station': 550,

  // Enfield Chase
  'enfield chase': 560,      // 09:20
  'enfield chase rail station': 560,

  // Epsom
  'epsom': 560,              // 09:20
  'epsom rail station': 560,

  // Hatch End
  'hatch end': 560,          // 09:20
  'hatch end rail station': 560,

  // Hertford East
  'hertford east': 540,      // 09:00
  'hertford east rail station': 540,

  // Hertford North
  'hertford north': 560,     // 09:20
  'hertford north rail station': 560,

  // Rye House
  'rye house': 540,          // 09:00
  'rye house rail station': 540,

  // St Margarets (Herts)
  'st margarets (herts)': 540,  // 09:00
  'st margarets herts': 540,
  'st. margarets (herts)': 540,
  'st. margarets herts': 540,
  'st margarets (herts) rail station': 540,
  'st. margarets (herts) rail station': 540,
  'st margarets herts rail station': 540,

  // Swanley
  'swanley': 550,            // 09:10
  'swanley rail station': 550,

  // Watford High Street
  'watford high street': 550, // 09:10
  'watford high street rail station': 550,

  // Ware
  'ware': 540,               // 09:00
  'ware rail station': 540,

  // Burnham
  'burnham': 550,            // 09:10
  'burnham (berks)': 550,
  'burnham (berks) rail station': 550,

  // Slough
  'slough': 560,             // 09:20
  'slough rail station': 560,

  // Taplow
  'taplow': 550,             // 09:10
  'taplow rail station': 550,

  // Maidenhead
  'maidenhead': 558,         // 09:18
  'maidenhead rail station': 558,

  // Twyford
  'twyford': 550,            // 09:10
  'twyford rail station': 550,
};

/**
 * Returns the off-peak cap cut-off in total minutes for a station, or null if
 * the station is not in the exception list.
 */
export function getOffpeakCapCutoff(stationName: string | null | undefined): number | null {
  if (!stationName) return null;
  const key = stationName.toLowerCase().trim();
  return OFFPEAK_CAP_EXCEPTION_STATIONS[key] ?? null;
}

/**
 * Determines whether a journey contributes to the PEAK daily cap.
 * Unlike isPeakJourney() which determines the fare, this function determines
 * which cap bucket the journey counts towards.
 *
 * For exception stations: a journey in the 06:30–09:30 window that taps in
 * AT OR AFTER the station's cut-off time counts towards the off-peak cap
 * (even though the peak fare is charged).
 */
export function isCapPeakForStation(
  date: Date,
  timeStr: string,
  originName: string | null | undefined
): boolean {
  const dayOfWeek = date.getDay();
  // Weekends and bank holidays are always off-peak cap
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  if (isUKBankHoliday(date)) return false;

  const parts = timeStr.split(':');
  if (parts.length !== 2) return false;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return false;

  const totalMinutes = hours * 60 + minutes;

  // Capping Peak (Anytime) window: 04:30 to 09:29 (270 to 569 minutes)
  const isCappingPeakWindow = totalMinutes >= 270 && totalMinutes < 570;

  if (isCappingPeakWindow) {
    // Check if origin station has an off-peak cap exception (cutoff time before 09:30)
    const cutoff = getOffpeakCapCutoff(originName);
    if (cutoff !== null && totalMinutes >= cutoff) {
      // Tap-in is at or after the station's cutoff time → counts as off-peak cap
      return false;
    }
    return true; // Standard morning/pre-09:30 peak cap
  }

  return false; // All other times (including evening peak 16:00-19:00) count towards off-peak cap
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

export function isStPancrasToStratford(
  oNaptan: string | null | undefined,
  dNaptan: string | null | undefined,
  oName: string | null | undefined,
  dName: string | null | undefined
): boolean {
  const on = oNaptan || '';
  const dn = dNaptan || '';
  const oNameLower = (oName || '').toLowerCase();
  const dNameLower = (dName || '').toLowerCase();

  const isStPancrasLL = (naptan: string, name: string) => {
    return naptan === '910GSTPXBOX' || 
           (name.includes('st pancras') && name.includes('ll')) ||
           (name.includes('st. pancras') && name.includes('ll'));
  };

  const isStratfordIntl = (naptan: string, name: string) => {
    return naptan === '910GSTFODOM' || 
           (name.includes('stratford international') && !name.includes('dlr'));
  };

  const isStPancrasOrig = isStPancrasLL(on, oNameLower);
  const isStratfordDest = isStratfordIntl(dn, dNameLower);
  const isStPancrasDest = isStPancrasLL(dn, dNameLower);
  const isStratfordOrig = isStratfordIntl(on, oNameLower);

  return (isStPancrasOrig && isStratfordDest) || (isStPancrasDest && isStratfordOrig);
}

export function getTravelcardJourneyFare(
  journey: {
    mode: string;
    originZone: number | null;
    destinationZone: number | null;
    isPeak: boolean;
    originNaptan?: string | null;
    destinationNaptan?: string | null;
    origin?: string | null;
    destination?: string | null;
  },
  tcZoneRange: string,
  baseFare: number,
  fareType: FareType
): number {
  if (isStPancrasToStratford(
    journey.originNaptan,
    journey.destinationNaptan,
    journey.origin,
    journey.destination
  )) {
    return baseFare;
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

/**
 * Advance a date by N calendar months (TfL rolling month logic).
 * A rolling month runs from the Nth of one month to the (N-1)th of the next.
 * E.g., June 15 → July 15 (1 month advance), coverage: June 15 to July 14.
 * Clamps to month end if needed (e.g., Jan 31 → Feb 28).
 */
export function advanceByMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  // Clamp to end of target month if day overflowed
  // (e.g., Jan 31 + 1 month → Mar 3 in some years, should be Feb 28)
  const targetMonth = (date.getMonth() + months) % 12;
  const targetYear = date.getFullYear() + Math.floor((date.getMonth() + months) / 12);
  if (result.getMonth() !== ((targetMonth + 12) % 12) || result.getFullYear() !== targetYear) {
    // Day overflowed — clamp to last day of target month
    return new Date(targetYear, targetMonth + 1, 0);
  }
  return result;
}

/**
 * Count calendar days between two dates (inclusive of start, exclusive of end).
 */
export function daysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Ceil a number to the nearest 10p (£0.10).
 */
function ceilTo10p(amount: number): number {
  return Math.ceil(amount * 10) / 10;
}

export interface TravelcardPeriodResult {
  cost: number;
  label: string;
}

/**
 * Calculate the cheapest way to cover a planning period with TfL travelcards.
 *
 * TfL sells: weekly (7-day), monthly (rolling calendar month), annual, and
 * odd-period travelcards (min 1 month + 1 day, priced using monthly/30 daily
 * rate, ceiling to nearest 10p).
 *
 * The price per month is fixed regardless of actual month length, but coverage
 * varies (Feb=28d, Jun=30d, Jul=31d). This function uses actual calendar month
 * boundaries from startDate to correctly count whole months and remaining days.
 */
export function calculateTravelcardPeriodCost(
  startDate: Date,
  endDate: Date,
  weeklyRate: number,
  monthlyRate: number,
  annualRate: number
): TravelcardPeriodResult {
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { cost: 0, label: 'N/A' };
  }
  const totalDays = daysBetween(startDate, endDate) + 1; // inclusive of both ends

  // No TC product under 7 days
  if (isNaN(totalDays) || totalDays <= 0) return { cost: 0, label: 'N/A' };
  if (totalDays <= 6) return { cost: 0, label: 'Use PAYG' };

  // Strategy 1: Weekly TCs only
  const weeksNeeded = Math.ceil(totalDays / 7);
  const weeklyCost = weeksNeeded * weeklyRate;
  let bestCost = weeklyCost;
  let bestLabel = `${weeksNeeded}× Weekly`;

  // Strategy 2: Monthly-based (with odd-period extension if needed)
  if (monthlyRate > 0 && totalDays >= 28) {
    // Count how many whole calendar months fit from startDate
    let wholeMonths = 0;
    let cursor = new Date(startDate);
    while (wholeMonths < 100) {
      const nextMonth = advanceByMonths(startDate, wholeMonths + 1);
      if (daysBetween(startDate, nextMonth) > totalDays) break;
      wholeMonths++;
      cursor = nextMonth;
    }

    // Remaining calendar days after whole months
    const coveredDays = daysBetween(startDate, cursor);
    const extraDays = totalDays - coveredDays;

    let monthlyCost: number;
    let monthlyLabel: string;

    if (extraDays <= 0) {
      // Exactly covered by whole months
      monthlyCost = wholeMonths * monthlyRate;
      monthlyLabel = wholeMonths === 1 ? '1× Monthly' : `${wholeMonths}× Monthly`;
    } else {
      // Odd-period surcharge: extraDays × (monthlyRate / 30), ceil to 10p
      const dailyRate = monthlyRate / 30;
      const surcharge = ceilTo10p(extraDays * dailyRate);
      monthlyCost = wholeMonths * monthlyRate + surcharge;
      monthlyLabel = wholeMonths === 0
        ? `${extraDays}-day odd-period`
        : wholeMonths === 1
          ? `1 Month + ${extraDays} days`
          : `${wholeMonths} Months + ${extraDays} days`;

      // Also compare: buy one more monthly TC instead of odd-period surcharge
      // (might be cheaper if extra days are many)
      const extraWeeklyCost = Math.ceil(extraDays / 7) * weeklyRate;
      const monthlyPlusWeeklyCost = wholeMonths * monthlyRate + extraWeeklyCost;
      if (monthlyPlusWeeklyCost < monthlyCost) {
        const extraWeeks = Math.ceil(extraDays / 7);
        monthlyCost = monthlyPlusWeeklyCost;
        monthlyLabel = wholeMonths === 1
          ? `1× Monthly + ${extraWeeks}× Weekly`
          : `${wholeMonths}× Monthly + ${extraWeeks}× Weekly`;
      }

      const onMoreMonthlyCost = (wholeMonths + 1) * monthlyRate;
      if (onMoreMonthlyCost < monthlyCost) {
        monthlyCost = onMoreMonthlyCost;
        monthlyLabel = `${wholeMonths + 1}× Monthly`;
      }
    }

    if (monthlyCost < bestCost) {
      bestCost = monthlyCost;
      bestLabel = monthlyLabel;
    }
  }

  // Strategy 3: Annual TC (only if it beats the monthly-based cost)
  if (annualRate > 0 && annualRate < bestCost) {
    bestCost = annualRate;
    bestLabel = 'Annual';
  }

  return {
    cost: Math.round(bestCost * 100) / 100,
    label: bestLabel,
  };
}

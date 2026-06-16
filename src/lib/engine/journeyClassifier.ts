// Journey Classifier — extracts mode, zones, peak/off-peak from CSV journey strings
import type { ParsedJourney } from './csvParser';
import { detectTransportMode, getStationZone, getStationBestZone, getStationInfo, type TransportMode } from '../data/stationService';
import { getZoneRange, isPeakJourney, isUKBankHoliday, lookupFare } from '../data/fareData';

export interface ClassifiedJourney {
  raw: ParsedJourney;
  mode: TransportMode;
  isBus: boolean;
  busRoute: string | null;
  origin: string | null;
  destination: string | null;
  originZone: number | null;
  destinationZone: number | null;
  zoneRange: string | null;
  isPeak: boolean;
  isEveningPeakException: boolean;
  dayOfWeek: number; // 0=Sun, 6=Sat
  isWeekend: boolean;
  isCapHit: boolean;
  isHopperFree: boolean;
}

// Parse time string "HH:MM" to hours and minutes
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return { hours, minutes };
}

// Check if a time falls within peak hours
// Peak: Mon-Fri 06:30-09:30 and 16:00-19:00
function isPeakTime(time: { hours: number; minutes: number }, dayOfWeek: number): boolean {
  // Weekends and public holidays are always off-peak
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const totalMinutes = time.hours * 60 + time.minutes;

  // Morning peak: 06:30 - 09:30
  if (totalMinutes >= 390 && totalMinutes < 570) return true;

  // Evening peak: 16:00 - 19:00
  if (totalMinutes >= 960 && totalMinutes < 1140) return true;

  return false;
}

// SRS §4.2: Evening Peak Exception
// Journeys starting OUTSIDE Zone 1 and ending INSIDE Zone 1 during 16:00-19:00 weekdays
// are charged at OFF-PEAK rates
function isEveningPeakException(
  time: { hours: number; minutes: number },
  dayOfWeek: number,
  originZone: number | null,
  destZone: number | null
): boolean {
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const totalMinutes = time.hours * 60 + time.minutes;

  // Only during evening peak window
  if (totalMinutes < 960 || totalMinutes >= 1140) return false;

  // Origin must be outside Zone 1, destination must be Zone 1
  if (originZone !== null && destZone !== null) {
    return originZone > 1 && destZone === 1;
  }

  return false;
}

// Extract origin and destination from journey string
// e.g., "Barnes [National Rail] to Charing Cross [National Rail]"
// e.g., "Hammersmith (District, Piccadilly lines) to Leicester Square"
function extractStations(journeyAction: string): { origin: string; destination: string } | null {
  // Bus journeys don't have origin/destination in the traditional sense
  if (journeyAction.toLowerCase().includes('bus journey')) return null;

  const toIndex = journeyAction.indexOf(' to ');
  if (toIndex === -1) {
    // Check for "Entered and exited X"
    const enteredMatch = journeyAction.match(/Entered and exited (.+)/i);
    if (enteredMatch) {
      const station = enteredMatch[1].trim();
      return { origin: station, destination: station };
    }
    return null;
  }

  const origin = journeyAction.substring(0, toIndex).trim();
  const destination = journeyAction.substring(toIndex + 4).trim();

  return { origin, destination };
}

// Extract bus route number
function extractBusRoute(journeyAction: string): string | null {
  const match = journeyAction.match(/bus journey,\s*route\s*(\w+)/i);
  return match ? match[1] : null;
}

export function classifyJourney(journey: ParsedJourney): ClassifiedJourney {
  let mode = detectTransportMode(journey.journeyAction);
  const isBus = mode === 'bus' || mode === 'tram';
  const busRoute = isBus ? extractBusRoute(journey.journeyAction) : null;

  const dayOfWeek = journey.date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let origin: string | null = null;
  let destination: string | null = null;
  let originZone: number | null = null;
  let destinationZone: number | null = null;
  let zoneRange: string | null = null;

  if (!isBus) {
    const stations = extractStations(journey.journeyAction);
    if (stations) {
      let oInfo = getStationInfo(stations.origin);
      let dInfo = getStationInfo(stations.destination);

      // Disambiguation logic: assume same mode you started on unless the fare is higher
      if (oInfo && dInfo) {
        const constOInfo = oInfo;
        const constDInfo = dInfo;
        const sharedModes = constOInfo.modes.filter(m => constDInfo.modes.includes(m));
        if (sharedModes.length === 0) {
          // They don't share a mode. Let's see if we can resolve them to share a mode.
          // 1. Try to change destination to match one of the origin's modes
          let resolvedD = dInfo;
          let resolvedO = oInfo;
          let resolvedDChanged = false;

          for (const oMode of oInfo.modes) {
            const altD = getStationInfo(stations.destination, oMode);
            if (altD && altD.name !== dInfo.name) {
              const zoneRangeSame = getZoneRange(oInfo.zone, altD.zone);
              const zoneRangeDefault = getZoneRange(oInfo.zone, dInfo.zone);
              const tempIsPeak = isPeakJourney(journey.date, journey.startTime, oInfo.zone, altD.zone);
              
              const sameMode = ['underground', 'overground', 'dlr', 'elizabeth'].includes(oMode) ? 'underground' : oMode;
              
              let defaultMode = 'underground';
              const oHasTfl = oInfo.modes.some(m => ['underground', 'dlr', 'elizabeth', 'overground'].includes(m));
              const dHasTfl = dInfo.modes.some(m => ['underground', 'dlr', 'elizabeth', 'overground'].includes(m));
              if (oHasTfl && dHasTfl) {
                defaultMode = 'underground';
              } else {
                const oIsNR = oInfo.modes.includes('national_rail') && !oHasTfl;
                const dIsNR = dInfo.modes.includes('national_rail') && !dHasTfl;
                if ((oHasTfl && dIsNR) || (dHasTfl && oIsNR)) {
                  defaultMode = 'nr_tube';
                } else if (oIsNR && dIsNR) {
                  defaultMode = 'national_rail';
                }
              }

              const fareSame = lookupFare(zoneRangeSame, tempIsPeak, sameMode);
              const fareDefault = lookupFare(zoneRangeDefault, tempIsPeak, defaultMode);

              if (fareDefault > fareSame) {
                // Check if CSV charge is closer to fareDefault than fareSame under potential discount multipliers
                const distSame = Math.min(...[1.0, 0.666, 0.5].map(m => Math.abs(Math.floor(fareSame * m * 20) / 20 - journey.charge)));
                const distDefault = Math.min(...[1.0, 0.666, 0.5].map(m => Math.abs(Math.floor(fareDefault * m * 20) / 20 - journey.charge)));
                if (distSame < distDefault) {
                  resolvedD = altD;
                  resolvedDChanged = true;
                  break;
                }
              } else {
                // If fare is not higher, assume same mode
                resolvedD = altD;
                resolvedDChanged = true;
                break;
              }
            }
          }

          // 2. If destination was not changed, try to change origin to match one of the destination's modes
          if (!resolvedDChanged) {
            for (const dMode of dInfo.modes) {
              const altO = getStationInfo(stations.origin, dMode);
              if (altO && altO.name !== oInfo.name) {
                const zoneRangeSame = getZoneRange(altO.zone, dInfo.zone);
                const zoneRangeDefault = getZoneRange(oInfo.zone, dInfo.zone);
                const tempIsPeak = isPeakJourney(journey.date, journey.startTime, altO.zone, dInfo.zone);
                
                const sameMode = ['underground', 'overground', 'dlr', 'elizabeth'].includes(dMode) ? 'underground' : dMode;
                
                let defaultMode = 'underground';
                const oHasTfl = oInfo.modes.some(m => ['underground', 'dlr', 'elizabeth', 'overground'].includes(m));
                const dHasTfl = dInfo.modes.some(m => ['underground', 'dlr', 'elizabeth', 'overground'].includes(m));
                if (oHasTfl && dHasTfl) {
                  defaultMode = 'underground';
                } else {
                  const oIsNR = oInfo.modes.includes('national_rail') && !oHasTfl;
                  const dIsNR = dInfo.modes.includes('national_rail') && !dHasTfl;
                  if ((oHasTfl && dIsNR) || (dHasTfl && oIsNR)) {
                    defaultMode = 'nr_tube';
                  } else if (oIsNR && dIsNR) {
                    defaultMode = 'national_rail';
                  }
                }

                const fareSame = lookupFare(zoneRangeSame, tempIsPeak, sameMode);
                const fareDefault = lookupFare(zoneRangeDefault, tempIsPeak, defaultMode);

                if (fareDefault > fareSame) {
                  const distSame = Math.min(...[1.0, 0.666, 0.5].map(m => Math.abs(Math.floor(fareSame * m * 20) / 20 - journey.charge)));
                  const distDefault = Math.min(...[1.0, 0.666, 0.5].map(m => Math.abs(Math.floor(fareDefault * m * 20) / 20 - journey.charge)));
                  if (distSame < distDefault) {
                    resolvedO = altO;
                    break;
                  }
                } else {
                  resolvedO = altO;
                  break;
                }
              }
            }
          }

          oInfo = resolvedO;
          dInfo = resolvedD;
        }
      }

      origin = oInfo ? oInfo.name : stations.origin;
      destination = dInfo ? dInfo.name : stations.destination;

      // Get basic zones first
      const basicOriginZone = getStationZone(stations.origin);
      const basicDestZone = getStationZone(stations.destination);

      // Then optimize with alt-zones for cheapest fare
      if (basicOriginZone !== null && basicDestZone !== null) {
        originZone = getStationBestZone(stations.origin, basicDestZone) ?? basicOriginZone;
        destinationZone = getStationBestZone(stations.destination, basicOriginZone) ?? basicDestZone;
        zoneRange = getZoneRange(originZone, destinationZone);
      }
      
      // Refine mode if it's ambiguous (only override if detectTransportMode gave 'underground' or 'unknown')
      // Do not override precisely detected modes (elizabeth, overground, dlr, national_rail)
      const detectedModeIsAmbiguous = mode === 'unknown' || mode === 'underground';
      const isHeathrowJourney = stations.origin.toLowerCase().includes('heathrow') || stations.destination.toLowerCase().includes('heathrow');
      
      // Preserve elizabeth mode explicitly when Heathrow is involved (premium fare)
      if (isHeathrowJourney && (mode === 'elizabeth' || stations.destination.toLowerCase().includes('[elizabeth line]') || stations.origin.toLowerCase().includes('[elizabeth line]'))) {
        mode = 'elizabeth';
      } else if (detectedModeIsAmbiguous) {
        if (oInfo && dInfo) {
          const TFL_MODES = ['underground', 'dlr', 'elizabeth', 'overground'];
          const oHasTfl = oInfo.modes.some(m => TFL_MODES.includes(m));
          const dHasTfl = dInfo.modes.some(m => TFL_MODES.includes(m));

          // TfL boundary rule: both stations on TfL network → standard Tube fares
          if (oHasTfl && dHasTfl) {
            mode = 'underground';
          } else {
            const oIsNR = oInfo.modes.includes('national_rail') && !oHasTfl;
            const dIsNR = dInfo.modes.includes('national_rail') && !dHasTfl;

            // One TfL + one NR-only → mixed fare
            if ((oHasTfl && dIsNR) || (dHasTfl && oIsNR)) {
              mode = 'nr_tube';
            }
            // Both NR-only
            else if (oIsNR && dIsNR) {
              mode = 'national_rail';
            }
            // Fallback: try to infer from individual station modes
            else if (mode === 'unknown') {
              if (oInfo.modes.includes('elizabeth') || dInfo.modes.includes('elizabeth')) mode = 'underground';
              else if (oInfo.modes.includes('overground') || dInfo.modes.includes('overground')) mode = 'underground';
              else if (oInfo.modes.includes('underground') || dInfo.modes.includes('underground')) mode = 'underground';
              else if (oInfo.modes.includes('national_rail')) mode = 'national_rail';
            }
          }
        } else if (mode === 'unknown' && oInfo) {
          if (oInfo.modes.includes('elizabeth')) mode = 'underground';
          else if (oInfo.modes.includes('overground')) mode = 'underground';
          else if (oInfo.modes.includes('underground')) mode = 'underground';
          else if (oInfo.modes.includes('national_rail')) mode = 'national_rail';
        }
      }
    }
  }
  const time = parseTime(journey.startTime);
  let isPeak = false;
  let eveningException = false;

  if (time && !isBus) {
    isPeak = isPeakJourney(journey.date, journey.startTime, originZone, destinationZone);

    // Track if it fell in the evening peak window but was exempted
    const totalMinutes = time.hours * 60 + time.minutes;
    const inEveningWindow = totalMinutes >= 960 && totalMinutes < 1140;
    const isWeekDay = dayOfWeek !== 0 && dayOfWeek !== 6;
    if (inEveningWindow && isWeekDay && !isUKBankHoliday(journey.date) && originZone !== null && destinationZone !== null && originZone > 1 && destinationZone === 1) {
      eveningException = true;
    }
  }

  // Detect cap hit from note
  const isCapHit = journey.note.toLowerCase().includes('daily cap') ||
    journey.note.toLowerCase().includes('cheaper or free today');

  // Detect hopper fare
  const isHopperFree = journey.note.toLowerCase().includes('continuation of your previous journey');

  return {
    raw: journey,
    mode,
    isBus,
    busRoute,
    origin,
    destination,
    originZone,
    destinationZone,
    zoneRange,
    isPeak,
    isEveningPeakException: eveningException,
    dayOfWeek,
    isWeekend,
    isCapHit,
    isHopperFree,
  };
}

export function classifyAll(journeys: ParsedJourney[]): ClassifiedJourney[] {
  return journeys.map(classifyJourney);
}

import { getStationByNaptan, getStationInfo } from '../data/stationService';
import type { ClassifiedJourney } from './journeyClassifier';
import { calculateDiscountedFare, type FareType } from '../data/fareData';
import { apiRetryStatus } from '../stores/stores';

const CACHE_KEY = 'oystersavings_station_fare_cache';
const MAX_CACHE_ENTRIES = 500;
const REQUEST_COOLDOWN_MS = 200;

export interface RouteOption {
  peak: number;
  offPeak: number;
  routeDescription: string;
}

export interface StationFare {
  peak: number;
  offPeak: number;
  basePeak: number;
  baseOffPeak: number;
  fromStation: string;
  toStation: string;
  fetchedAt: number;
  validUntil: number;  // from API endDate — auto-expires when fare period ends
  isFromApi: true;
  options?: RouteOption[];
  baseOptions?: RouteOption[];
  routeDescription?: string;
  passengerTypeMatched: boolean;
}

export interface FallbackFare {
  peak: number;
  offPeak: number;
  basePeak: number;
  baseOffPeak: number;
  isFromApi: false;
  reason?: 'offline' | 'timeout' | 'no_route' | 'api_error';
}

export type FareResult = StationFare | FallbackFare;

interface CacheStore {
  entries: Record<string, StationFare>;
  lastUpdated: number;
}

// In-memory session cache for instant lookups
const sessionCache = new Map<string, StationFare>();

// In-flight request deduplication
const inFlightRequests = new Map<string, Promise<FareResult>>();

// Rate limiting
let lastRequestTime = 0;

export function fareTypeToPassengerTypes(fareType: string): string[] {
  switch (fareType) {
    case 'none':
      return ['Adult'];
    case 'railcard':
      return ['Railcard'];
    case 'jobcentre':
      return ['JobCentrePlus'];
    case 'disabled':
      return ['DisabledPersonsRailcard'];
    case 'zip_11_15':
      return ['Age11To15'];
    case 'zip_16_17':
      return ['Age16To18'];
    case 'student':
      return ['Student18Plus', 'Apprentice'];
    default:
      return ['Adult'];
  }
}

function getCacheKey(fromNaptan: string, toNaptan: string, fareType: string = 'none'): string {
  return `${fromNaptan}-${toNaptan}-${fareType}`;
}

// Load persistent cache from localStorage
function loadPersistentCache(): CacheStore {
  if (typeof window === 'undefined') return { entries: {}, lastUpdated: 0 };
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { entries: {}, lastUpdated: 0 };
    return JSON.parse(raw) as CacheStore;
  } catch {
    return { entries: {}, lastUpdated: 0 };
  }
}

// Save persistent cache to localStorage with LRU eviction
function savePersistentCache(cache: CacheStore): void {
  if (typeof window === 'undefined') return;
  try {
    // LRU eviction if over limit
    const entries = Object.entries(cache.entries);
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
      const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
      for (const [key] of toRemove) {
        delete cache.entries[key];
      }
    }
    cache.lastUpdated = Date.now();
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable — silently continue
  }
}

// Check if a cached fare is still valid (hasn't expired)
function isCacheValid(fare: StationFare): boolean {
  return Date.now() < fare.validUntil;
}

// Look up fare from cache layers (session → localStorage)
export function getCachedFare(
  fromNaptan: string,
  toNaptan: string,
  useAlternativeFares: boolean = false,
  fareType: string = 'none'
): StationFare | null {
  const key = getCacheKey(fromNaptan, toNaptan, fareType);

  // Layer 1: Session cache (fastest)
  let sessionHit = sessionCache.get(key);
  if (!sessionHit) {
    // Also try the old key for backwards compatibility
    const oldKey = useAlternativeFares ? `${fromNaptan}-${toNaptan}-cheapest` : `${fromNaptan}-${toNaptan}-${fareType}`;
    sessionHit = sessionCache.get(oldKey);
  }
  if (sessionHit && isCacheValid(sessionHit)) {
    return sessionHit;
  }

  // Layer 2: localStorage persistent cache
  const persistentCache = loadPersistentCache();
  let persistentHit = persistentCache.entries[key];
  if (!persistentHit) {
    const oldKey = useAlternativeFares ? `${fromNaptan}-${toNaptan}-cheapest` : `${fromNaptan}-${toNaptan}-${fareType}`;
    persistentHit = persistentCache.entries[oldKey];
  }
  if (persistentHit && isCacheValid(persistentHit)) {
    // Promote to session cache
    sessionCache.set(key, persistentHit);
    return persistentHit;
  }

  return null;
}

// Store fare in both cache layers
function setCachedFare(fromNaptan: string, toNaptan: string, fare: StationFare, fareType: string = 'none'): void {
  const key = getCacheKey(fromNaptan, toNaptan, fareType);

  // Session cache
  sessionCache.set(key, fare);

  // Persistent cache
  const cache = loadPersistentCache();
  cache.entries[key] = fare;
  savePersistentCache(cache);
}

export function mergeRouteOptions(options: RouteOption[]): RouteOption[] {
  const merged: RouteOption[] = [];
  for (const opt of options) {
    const existing = merged.find(
      m => Math.abs(m.peak - opt.peak) < 0.001 && Math.abs(m.offPeak - opt.offPeak) < 0.001
    );
    if (existing) {
      if (!existing.routeDescription.includes(opt.routeDescription)) {
        existing.routeDescription += ` OR ${opt.routeDescription}`;
      }
    } else {
      merged.push({ ...opt });
    }
  }
  return merged;
}

// Parse TfL FareTo API response
function parseTflFareResponse(
  adultData: unknown[],
  concessionData: unknown[] | null,
  fromNaptan: string,
  toNaptan: string,
  fareType: string
): StationFare | null {
  try {
    const targetPassengerTypes = fareTypeToPassengerTypes(fareType);
    
    // Helper to parse for a list of passenger types on a specific data source
    const parseForPassengerTypes = (
      sourceData: unknown[],
      types: string[]
    ): { options: RouteOption[], validUntil: number } | null => {
      const rawOptions: RouteOption[] = [];
      let validUntil = Date.now() + 365 * 24 * 60 * 60 * 1000;
      
      for (const section of sourceData) {
        const s = section as Record<string, unknown>;
        const rows = s.rows as Array<Record<string, unknown>> | undefined;
        if (!rows) continue;
        
        for (const row of rows) {
          if (!types.includes(row.passengerType as string)) continue;
          
          const ticketsAvailable = row.ticketsAvailable as Array<Record<string, unknown>> | undefined;
          if (!ticketsAvailable) continue;
          
          const endDateStr = row.endDate as string | undefined;
          if (endDateStr) {
            const t = new Date(endDateStr).getTime();
            if (!isNaN(t) && t < validUntil) {
              validUntil = t;
            }
          }
          
          const routeDescription = (row.routeDescription as string) || (row.displayName as string) || 'Default Route';
          const paygCosts: number[] = [];
          
          for (const ticket of ticketsAvailable) {
            const ticketType = ticket.ticketType as Record<string, unknown> | undefined;
            const ticketTime = ticket.ticketTime as Record<string, unknown> | undefined;
            const cost = parseFloat(ticket.cost as string);
            if (isNaN(cost)) continue;
            
            const typeDesc = (ticketType?.description as string || '').toLowerCase();
            const timeDesc = (ticketTime?.description as string || '').toLowerCase();
            
            if (!typeDesc.includes('pay as you go') && !typeDesc.includes('oyster')) continue;
            
            if (
              timeDesc.includes('peak') && !timeDesc.includes('off')
              || timeDesc.includes('0630') || timeDesc.includes('06:30')
              || (timeDesc.includes('monday') && timeDesc.includes('friday'))
            ) {
              paygCosts.push(cost);
            } else if (
              timeDesc.includes('off peak') || timeDesc.includes('off-peak')
              || timeDesc.includes('all other times')
              || timeDesc.includes('at any time')
            ) {
              paygCosts.push(cost);
            } else {
              paygCosts.push(cost);
            }
          }
          
          if (paygCosts.length > 0) {
            let peak = 0;
            let offPeak = 0;
            if (paygCosts.length >= 2) {
              paygCosts.sort((a, b) => a - b);
              peak = paygCosts[paygCosts.length - 1];
              offPeak = paygCosts[0];
            } else {
              peak = paygCosts[0];
              offPeak = paygCosts[0];
            }
            
            let finalRouteDesc = routeDescription;
            if (finalRouteDesc.toLowerCase() === 'default route') {
              finalRouteDesc = 'Default Route';
            }
            
            rawOptions.push({
              peak,
              offPeak,
              routeDescription: finalRouteDesc
            });
          }
        }
      }
      
      if (rawOptions.length === 0) return null;
      
      return {
        options: mergeRouteOptions(rawOptions),
        validUntil
      };
    };
    
    // 1. Parse base adult fares
    const adultResult = parseForPassengerTypes(adultData, ['Adult']);
    if (!adultResult) return null;
    
    // 2. Parse target passenger types fares
    let targetResult = concessionData ? parseForPassengerTypes(concessionData, targetPassengerTypes) : null;
    let passengerTypeMatched = true;
    
    if (!targetResult) {
      passengerTypeMatched = false;
      // Fallback: apply manual discount formula to the adult result
      const options = adultResult.options.map(opt => {
        const peakDisc = calculateDiscountedFare(
          opt.peak,
          fareType as any,
          true,
          false,
          undefined,
          undefined,
          undefined,
          fromNaptan,
          toNaptan
        );
        const offPeakDisc = calculateDiscountedFare(
          opt.offPeak,
          fareType as any,
          false,
          false,
          undefined,
          undefined,
          undefined,
          fromNaptan,
          toNaptan
        );
        return {
          peak: peakDisc,
          offPeak: offPeakDisc,
          routeDescription: opt.routeDescription
        };
      });
      targetResult = {
        options,
        validUntil: adultResult.validUntil
      };
    }
    
    // Get default options
    const defaultTargetOpt = targetResult.options.find(o => o.routeDescription === 'Default Route') || targetResult.options[0];
    const defaultAdultOpt = adultResult.options.find(o => o.routeDescription === 'Default Route') || adultResult.options[0];
    
    return {
      peak: defaultTargetOpt.peak,
      offPeak: defaultTargetOpt.offPeak,
      basePeak: defaultAdultOpt.peak,
      baseOffPeak: defaultAdultOpt.offPeak,
      fromStation: fromNaptan,
      toStation: toNaptan,
      fetchedAt: Date.now(),
      validUntil: Math.min(targetResult.validUntil, adultResult.validUntil),
      isFromApi: true,
      options: targetResult.options,
      baseOptions: adultResult.options,
      routeDescription: defaultTargetOpt.routeDescription,
      passengerTypeMatched
    };
  } catch {
    return null;
  }
}

// Fetch raw passengerType fares from TfL API with timeout, rate limiting, and retries
// Fetch raw passengerType fares from TfL API with timeout, rate limiting, and retries
async function fetchRawFromTfl(
  fromNaptan: string,
  toNaptan: string,
  passengerType: string
): Promise<unknown[] | { isError: true; reason: 'offline' | 'timeout' | 'no_route' | 'api_error' }> {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { isError: true, reason: 'offline' };
  }

  const maxRetries = 3;
  let attempt = 0;
  let lastErrorReason: 'offline' | 'timeout' | 'no_route' | 'api_error' = 'api_error';
  const key = `${fromNaptan}-${toNaptan}-${passengerType}`;

  const clearStatus = () => {
    apiRetryStatus.update(state => {
      const newState = { ...state };
      delete newState[key];
      return newState;
    });
  };

  while (attempt < maxRetries) {
    attempt++;

    // Update store with current attempt status
    apiRetryStatus.update(state => ({
      ...state,
      [key]: { attempt, maxRetries, status: attempt === 1 ? 'loading' : 'retrying' }
    }));

    // Rate limiting between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const cooldown = attempt === 1 ? REQUEST_COOLDOWN_MS : 500;
    if (timeSinceLastRequest < cooldown) {
      await new Promise(resolve => setTimeout(resolve, cooldown - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    const url = `https://api.tfl.gov.uk/StopPoint/${fromNaptan}/FareTo/${toNaptan}?passengerType=${passengerType}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for each attempt

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        // Too Many Requests — wait longer before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        lastErrorReason = 'api_error';
        continue;
      }

      if (response.status === 404) {
        // Not Found / No direct route or no fares available
        clearStatus();
        return { isError: true, reason: 'no_route' };
      }

      if (!response.ok) {
        // HTTP error (500, 502, 503, etc) — wait and retry
        lastErrorReason = 'api_error';
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        clearStatus();
        return { isError: true, reason: 'api_error' };
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        clearStatus();
        return { isError: true, reason: 'api_error' };
      }

      clearStatus();
      return data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastErrorReason = 'timeout';
      } else if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
        lastErrorReason = 'offline';
      } else {
        lastErrorReason = 'api_error';
      }

      if (attempt < maxRetries) {
        apiRetryStatus.update(state => ({
          ...state,
          [key]: { attempt, maxRetries, status: 'timeout' }
        }));
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      clearStatus();
      return { isError: true, reason: lastErrorReason };
    }
  }
  clearStatus();
  return { isError: true, reason: lastErrorReason };
}

// Fetch concession/discount fares alongside Adult base fares in parallel
async function fetchFromTfl(
  fromNaptan: string,
  toNaptan: string,
  fareType: string
): Promise<StationFare | { isError: true; reason: 'offline' | 'timeout' | 'no_route' | 'api_error' }> {
  const targetPassengerTypes = fareTypeToPassengerTypes(fareType);
  const primaryConcessionType = targetPassengerTypes[0];

  // Fetch Adult (base) fares first (or parallel)
  const adultPromise = fetchRawFromTfl(fromNaptan, toNaptan, 'Adult');

  if (fareType === 'none' || primaryConcessionType === 'Adult') {
    const adultData = await adultPromise;
    if ('isError' in adultData) {
      return adultData;
    }
    const parsed = parseTflFareResponse(adultData, null, fromNaptan, toNaptan, fareType);
    if (parsed) return parsed;
    return { isError: true, reason: 'api_error' };
  }

  // Fetch both in parallel
  const concessionPromise = fetchRawFromTfl(fromNaptan, toNaptan, primaryConcessionType);
  const [adultData, concessionData] = await Promise.all([adultPromise, concessionPromise]);

  if ('isError' in adultData) {
    return adultData;
  }

  const parsed = parseTflFareResponse(
    adultData,
    'isError' in concessionData ? null : concessionData,
    fromNaptan,
    toNaptan,
    fareType
  );
  if (parsed) return parsed;
  return { isError: true, reason: 'api_error' };
}

/**
 * Look up the fare between two stations.
 * Uses a multi-layer cache strategy:
 *   1. In-memory session cache (instant)
 *   2. localStorage persistent cache (sub-ms)
 *   3. TfL FareTo API (network, ~500ms)
 *   4. Fallback to zone-based local fare
 *
 * @param fromNaptanRaw - NaPTAN ID of origin station (can be parent Hub or child)
 * @param toNaptanRaw - NaPTAN ID of destination station (can be parent Hub or child)
 * @param fallbackFare - Zone-based fare to use if API is unavailable
 * @param useAlternativeFares - Preference for cheapest route from TfL API
 * @param mode - Transport mode context to resolve the correct child platform ID
 * @param fareType - Core fare type (Adult, Student, Railcard, etc.) to target correct passenger type
 */
export async function lookupStationFare(
  fromNaptan: string,
  toNaptan: string,
  fallbackFare: { peak: number; offPeak: number },
  useAlternativeFares: boolean = false,
  mode: string = 'underground',
  fareType: FareType = 'none'
): Promise<FareResult> {

  // Check cache first
  const cached = getCachedFare(fromNaptan, toNaptan, useAlternativeFares, fareType);
  let fareResult: FareResult;

  if (cached) {
    fareResult = cached;
  } else {
    const key = getCacheKey(fromNaptan, toNaptan, fareType);

    // Check if already in-flight (deduplication)
    const inFlight = inFlightRequests.get(key);
    if (inFlight) {
      fareResult = await inFlight;
    } else {
      // Create the fetch promise
      const fetchPromise = (async (): Promise<FareResult> => {
        const apiResult = await fetchFromTfl(fromNaptan, toNaptan, fareType);

        if (apiResult && !('isError' in apiResult)) {
          setCachedFare(fromNaptan, toNaptan, apiResult, fareType);
          return apiResult;
        }

        const reason = apiResult && 'isError' in apiResult ? apiResult.reason : 'api_error';

        // Fallback to zone-based fare
        const basePeak = fallbackFare.peak;
        const baseOffPeak = fallbackFare.offPeak;
        const peak = calculateDiscountedFare(basePeak, fareType, true, false, undefined, undefined, undefined, fromNaptan, toNaptan);
        const offPeak = calculateDiscountedFare(baseOffPeak, fareType, false, false, undefined, undefined, undefined, fromNaptan, toNaptan);

        return {
          peak,
          offPeak,
          basePeak,
          baseOffPeak,
          isFromApi: false,
          reason,
        };
      })();

      // Register in-flight
      inFlightRequests.set(key, fetchPromise);

      try {
        fareResult = await fetchPromise;
      } finally {
        inFlightRequests.delete(key);
      }
    }
  }

  // Adjust top-level peak and off-peak fares based on useAlternativeFares setting
  if (fareResult.isFromApi) {
    if (!fareResult.options) {
      fareResult.options = [
        {
          peak: fareResult.peak,
          offPeak: fareResult.offPeak,
          routeDescription: fareResult.routeDescription || 'Default Route',
        }
      ];
    }

    const defaultRoute = fareResult.options.find(o => o.routeDescription === 'Default Route') || fareResult.options[0];
    const sorted = [...fareResult.options].sort((a, b) => (a.peak + a.offPeak) - (b.peak + b.offPeak));
    const cheapestRoute = sorted[0];

    const selectedRoute = useAlternativeFares ? cheapestRoute : defaultRoute;

    return {
      ...fareResult,
      peak: selectedRoute.peak,
      offPeak: selectedRoute.offPeak,
      routeDescription: selectedRoute.routeDescription,
    };
  }

  return fareResult;
}

/**
 * Get the number of cached station fares
 */
export function getCacheStats(): { sessionCount: number; persistentCount: number } {
  const persistent = loadPersistentCache();
  return {
    sessionCount: sessionCache.size,
    persistentCount: Object.keys(persistent.entries).length,
  };
}

/**
 * Clear all cached station fares
 */
export function clearFareCache(): void {
  sessionCache.clear();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CACHE_KEY);
  }
}

/**
 * Pre-fetch live fares from the TfL API for all unique journeys resolved in the upload
 */
export async function preFetchLiveFaresForJourneys(
  journeys: ClassifiedJourney[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const uniquePairs = new Map<string, { from: string; to: string; mode: string }>();

  for (const j of journeys) {
    if (j.isBus || !j.originNaptan || !j.destinationNaptan) continue;
    if (j.originNaptan === j.destinationNaptan) continue;
    const key = `${j.originNaptan}-${j.destinationNaptan}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, { from: j.originNaptan, to: j.destinationNaptan, mode: j.mode });
    }
  }

  if (uniquePairs.size === 0) {
    if (onProgress) onProgress(0, 0);
    return;
  }

  console.log(`Pre-fetching live fares for ${uniquePairs.size} unique journey pairs...`);

  let count = 0;
  const total = uniquePairs.size;

  for (const [, { from, to, mode }] of uniquePairs) {
    try {
      // Bypasses network request if already cached, otherwise fetches and caches
      await lookupStationFare(from, to, { peak: 0, offPeak: 0 }, false, mode);
    } catch (e) {
      console.error(`Failed to pre-fetch fare from ${from} to ${to}:`, e);
    }
    count++;
    if (onProgress) {
      onProgress(count, total);
    }
  }
}

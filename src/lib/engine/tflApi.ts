// TfL API Service — station-to-station fare lookup with multi-layer caching
// Privacy: Only NaPTAN IDs are sent to TfL. No user data, CSV data, or travel history.

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
  fromStation: string;
  toStation: string;
  fetchedAt: number;
  validUntil: number;  // from API endDate — auto-expires when fare period ends
  isFromApi: true;
  options?: RouteOption[];
  routeDescription?: string;
}

export interface FallbackFare {
  peak: number;
  offPeak: number;
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

function getCacheKey(fromNaptan: string, toNaptan: string): string {
  return `${fromNaptan}-${toNaptan}`;
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
function getCachedFare(fromNaptan: string, toNaptan: string, useAlternativeFares: boolean = false): StationFare | null {
  const key = getCacheKey(fromNaptan, toNaptan);

  // Layer 1: Session cache (fastest)
  let sessionHit = sessionCache.get(key);
  if (!sessionHit) {
    // Also try the old key for backwards compatibility
    const oldKey = useAlternativeFares ? `${fromNaptan}-${toNaptan}-cheapest` : `${fromNaptan}-${toNaptan}`;
    sessionHit = sessionCache.get(oldKey);
  }
  if (sessionHit && isCacheValid(sessionHit)) {
    return sessionHit;
  }

  // Layer 2: localStorage persistent cache
  const persistentCache = loadPersistentCache();
  let persistentHit = persistentCache.entries[key];
  if (!persistentHit) {
    const oldKey = useAlternativeFares ? `${fromNaptan}-${toNaptan}-cheapest` : `${fromNaptan}-${toNaptan}`;
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
function setCachedFare(fromNaptan: string, toNaptan: string, fare: StationFare): void {
  const key = getCacheKey(fromNaptan, toNaptan);

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
  data: unknown[],
  fromNaptan: string,
  toNaptan: string
): StationFare | null {
  try {
    const rawOptions: RouteOption[] = [];
    let validUntil = Date.now() + 365 * 24 * 60 * 60 * 1000;

    for (const section of data) {
      const s = section as Record<string, unknown>;
      const rows = s.rows as Array<Record<string, unknown>> | undefined;
      if (!rows) continue;

      for (const row of rows) {
        if (row.passengerType !== 'Adult') continue;

        const ticketsAvailable = row.ticketsAvailable as Array<Record<string, unknown>> | undefined;
        if (!ticketsAvailable) continue;

        // Parse end date for cache expiry
        const endDateStr = row.endDate as string | undefined;
        if (endDateStr) {
          const t = new Date(endDateStr).getTime();
          if (!isNaN(t) && t < validUntil) {
            validUntil = t;
          }
        }

        const routeDescription = (row.routeDescription as string) || (row.displayName as string) || 'Default Route';

        // Collect all PAYG ticket costs
        const paygCosts: number[] = [];

        for (const ticket of ticketsAvailable) {
          const ticketType = ticket.ticketType as Record<string, unknown> | undefined;
          const ticketTime = ticket.ticketTime as Record<string, unknown> | undefined;
          const cost = parseFloat(ticket.cost as string);

          if (isNaN(cost)) continue;

          const typeDesc = (ticketType?.description as string || '').toLowerCase();
          const timeDesc = (ticketTime?.description as string || '').toLowerCase();

          // Look for PAYG / Pay as you go tickets
          if (!typeDesc.includes('pay as you go') && !typeDesc.includes('oyster')) continue;

          // Try to identify peak vs off-peak
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

    // Merge options that have identical peak and off-peak costs
    const mergedOptions = mergeRouteOptions(rawOptions);

    // Find the default option
    const defaultOpt = mergedOptions.find(o => o.routeDescription === 'Default Route') || mergedOptions[0];

    return {
      peak: defaultOpt.peak,
      offPeak: defaultOpt.offPeak,
      fromStation: fromNaptan,
      toStation: toNaptan,
      fetchedAt: Date.now(),
      validUntil,
      isFromApi: true,
      options: mergedOptions,
      routeDescription: defaultOpt.routeDescription
    };
  } catch {
    return null;
  }
}

// Fetch fare from TfL API with timeout, rate limiting, and retries
async function fetchFromTfl(
  fromNaptan: string,
  toNaptan: string
): Promise<StationFare | { isError: true; reason: 'offline' | 'timeout' | 'no_route' | 'api_error' }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { isError: true, reason: 'offline' };
  }

  const maxRetries = 3;
  let attempt = 0;
  let lastErrorReason: 'offline' | 'timeout' | 'no_route' | 'api_error' = 'api_error';

  while (attempt < maxRetries) {
    attempt++;

    // Rate limiting between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const cooldown = attempt === 1 ? REQUEST_COOLDOWN_MS : 500;
    if (timeSinceLastRequest < cooldown) {
      await new Promise(resolve => setTimeout(resolve, cooldown - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    const url = `https://api.tfl.gov.uk/StopPoint/${fromNaptan}/FareTo/${toNaptan}`;

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
        return { isError: true, reason: 'no_route' };
      }

      if (!response.ok) {
        // HTTP error (500, 502, 503, etc) — wait and retry
        lastErrorReason = 'api_error';
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        return { isError: true, reason: 'api_error' };
      }

      const data = await response.json();
      if (!Array.isArray(data)) return { isError: true, reason: 'api_error' };

      const parsed = parseTflFareResponse(data, fromNaptan, toNaptan);
      if (parsed) return parsed;

      // If parsing failed on a valid response structure, don't retry
      return { isError: true, reason: 'api_error' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastErrorReason = 'timeout';
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        lastErrorReason = 'offline';
      } else {
        lastErrorReason = 'api_error';
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      return { isError: true, reason: lastErrorReason };
    }
  }
  return { isError: true, reason: lastErrorReason };
}

/**
 * Look up the fare between two stations.
 * Uses a multi-layer cache strategy:
 *   1. In-memory session cache (instant)
 *   2. localStorage persistent cache (sub-ms)
 *   3. TfL FareTo API (network, ~500ms)
 *   4. Fallback to zone-based local fare
 *
 * @param fromNaptan - NaPTAN ID of origin station
 * @param toNaptan - NaPTAN ID of destination station
 * @param fallbackFare - Zone-based fare to use if API is unavailable
 * @param useAlternativeFares - Preference for cheapest route from TfL API
 */
export async function lookupStationFare(
  fromNaptan: string,
  toNaptan: string,
  fallbackFare: { peak: number; offPeak: number },
  useAlternativeFares: boolean = false
): Promise<FareResult> {
  // Check cache first
  const cached = getCachedFare(fromNaptan, toNaptan, useAlternativeFares);
  let fareResult: FareResult;

  if (cached) {
    fareResult = cached;
  } else {
    const key = getCacheKey(fromNaptan, toNaptan);

    // Check if already in-flight (deduplication)
    const inFlight = inFlightRequests.get(key);
    if (inFlight) {
      fareResult = await inFlight;
    } else {
      // Create the fetch promise
      const fetchPromise = (async (): Promise<FareResult> => {
        const apiResult = await fetchFromTfl(fromNaptan, toNaptan);

        if (apiResult && !('isError' in apiResult)) {
          setCachedFare(fromNaptan, toNaptan, apiResult);
          return apiResult;
        }

        const reason = apiResult && 'isError' in apiResult ? apiResult.reason : 'api_error';

        // Fallback to zone-based fare
        return {
          peak: fallbackFare.peak,
          offPeak: fallbackFare.offPeak,
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

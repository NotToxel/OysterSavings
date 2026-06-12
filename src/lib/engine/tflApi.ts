// TfL API Service — station-to-station fare lookup with multi-layer caching
// Privacy: Only NaPTAN IDs are sent to TfL. No user data, CSV data, or travel history.

const CACHE_KEY = 'oystersavings_station_fare_cache';
const MAX_CACHE_ENTRIES = 500;
const REQUEST_COOLDOWN_MS = 200;

export interface StationFare {
  peak: number;
  offPeak: number;
  fromStation: string;
  toStation: string;
  fetchedAt: number;
  validUntil: number;  // from API endDate — auto-expires when fare period ends
  isFromApi: true;
}

export interface FallbackFare {
  peak: number;
  offPeak: number;
  isFromApi: false;
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
function getCachedFare(fromNaptan: string, toNaptan: string): StationFare | null {
  const key = getCacheKey(fromNaptan, toNaptan);

  // Layer 1: Session cache (fastest)
  const sessionHit = sessionCache.get(key);
  if (sessionHit && isCacheValid(sessionHit)) {
    return sessionHit;
  }

  // Layer 2: localStorage persistent cache
  const persistentCache = loadPersistentCache();
  const persistentHit = persistentCache.entries[key];
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

// Parse TfL FareTo API response
function parseTflFareResponse(data: unknown[], fromNaptan: string, toNaptan: string): StationFare | null {
  try {
    // The response is an array of FaresSection objects
    // We need to find Adult PAYG fares
    for (const section of data) {
      const s = section as Record<string, unknown>;
      const rows = s.rows as Array<Record<string, unknown>> | undefined;
      if (!rows) continue;

      for (const row of rows) {
        if (row.passengerType !== 'Adult') continue;

        const ticketsAvailable = row.ticketsAvailable as Array<Record<string, unknown>> | undefined;
        if (!ticketsAvailable) continue;

        let validUntil = 0;

        // Parse end date for cache expiry
        const endDateStr = row.endDate as string | undefined;
        if (endDateStr) {
          validUntil = new Date(endDateStr).getTime();
        } else {
          // Default: 1 year from now
          validUntil = Date.now() + 365 * 24 * 60 * 60 * 1000;
        }

        // Collect all PAYG ticket costs
        const paygCosts: number[] = [];

        for (const ticket of ticketsAvailable) {
          const ticketType = ticket.ticketType as Record<string, unknown> | undefined;
          const ticketTime = ticket.ticketTime as Record<string, unknown> | undefined;
          const cost = parseFloat(ticket.cost as string);

          if (isNaN(cost)) continue;

          const typeDesc = (ticketType?.description as string || '').toLowerCase();
          const timeDesc = (ticketTime?.description as string || '').toLowerCase();

          // Look for PAYG / Pay as you go tickets (skip CashSingle etc)
          if (!typeDesc.includes('pay as you go') && !typeDesc.includes('oyster')) continue;

          // Try to identify peak vs off-peak by description keywords first
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
            // Unknown time description — still collect it
            paygCosts.push(cost);
          }
        }

        // If we got at least 2 PAYG fares, the higher is peak, lower is off-peak
        if (paygCosts.length >= 2) {
          paygCosts.sort((a, b) => a - b);
          const offPeakFare = paygCosts[0];           // lowest cost
          const peakFare = paygCosts[paygCosts.length - 1]; // highest cost

          return {
            peak: peakFare,
            offPeak: offPeakFare,
            fromStation: fromNaptan,
            toStation: toNaptan,
            fetchedAt: Date.now(),
            validUntil,
            isFromApi: true,
          };
        }

        // If we only got 1 PAYG fare, use it for both peak and off-peak
        if (paygCosts.length === 1) {
          return {
            peak: paygCosts[0],
            offPeak: paygCosts[0],
            fromStation: fromNaptan,
            toStation: toNaptan,
            fetchedAt: Date.now(),
            validUntil,
            isFromApi: true,
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Fetch fare from TfL API with timeout, rate limiting, and retries
async function fetchFromTfl(fromNaptan: string, toNaptan: string): Promise<StationFare | null> {
  const maxRetries = 3;
  let attempt = 0;

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
        continue;
      }

      if (!response.ok) {
        // HTTP error (500, 502, 503, etc) — wait and retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        return null;
      }

      const data = await response.json();
      if (!Array.isArray(data)) return null;

      const parsed = parseTflFareResponse(data, fromNaptan, toNaptan);
      if (parsed) return parsed;

      // If parsing failed on a valid response structure, don't retry
      return null;
    } catch {
      // Timeout or network error — wait and retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      return null;
    }
  }
  return null;
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
 */
export async function lookupStationFare(
  fromNaptan: string,
  toNaptan: string,
  fallbackFare: { peak: number; offPeak: number }
): Promise<FareResult> {
  // Check cache first
  const cached = getCachedFare(fromNaptan, toNaptan);
  if (cached) return cached;

  const key = getCacheKey(fromNaptan, toNaptan);

  // Check if already in-flight (deduplication)
  const inFlight = inFlightRequests.get(key);
  if (inFlight) return inFlight;

  // Create the fetch promise
  const fetchPromise = (async (): Promise<FareResult> => {
    const apiFare = await fetchFromTfl(fromNaptan, toNaptan);

    if (apiFare) {
      setCachedFare(fromNaptan, toNaptan, apiFare);
      return apiFare;
    }

    // Fallback to zone-based fare
    return {
      peak: fallbackFare.peak,
      offPeak: fallbackFare.offPeak,
      isFromApi: false,
    };
  })();

  // Register in-flight
  inFlightRequests.set(key, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inFlightRequests.delete(key);
  }
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

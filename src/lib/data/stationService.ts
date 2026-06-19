// Station-to-zone mapping for stations commonly found in TfL Oyster CSV exports
// Covers London Underground, National Rail, London Overground, DLR, Elizabeth line

export interface StationInfo {
  name: string;
  zone: number;
  altZone?: number; // stations on zone boundaries
  modes: ('underground' | 'national_rail' | 'overground' | 'dlr' | 'elizabeth' | 'tram')[];
  naptanId?: string; // TfL NaPTAN identifier for API fare lookups
  outsideZone?: boolean; // station is outside standard fare zones 1-9
  contactlessOnly?: boolean; // station only accepts contactless payment (no Oyster)
}

// Map of canonical station names (lowercase) to their zone info
import { STATIONS } from './stationData';

export function normalizeStationName(raw: string): string {
  return raw
    .replace(/\s*\[.*?\]\s*/g, '') // remove [National Rail], [London Underground], etc.
    .replace(/\s*\(platforms?\s*[\d\-]+\)\s*/gi, '') // remove (platforms 12-19)
    .replace(/\s*\(District,\s*Piccadilly lines?\)\s*/gi, '') // Hammersmith qualifier
    .replace(/\s*\(Circle,\s*H&C lines?\)\s*/gi, '') // Hammersmith H&C qualifier
    // Heathrow terminal normalisations (e.g., T 2 & 3 or T4 to canonical names)
    .replace(/\b(t|terminal|terminals)\s*(\d)\s*(?:&|and)\s*(\d)\b/gi, 'terminals $2 & $3')
    .replace(/\b(t|terminal)\s*(\d)\b/gi, 'terminal $2')
    .trim()
    .toLowerCase();
}

function cleanPunctuation(str: string): string {
  return str.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getWords(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/['’\.]/g, '') // remove apostrophes/dots
    .replace(/[^a-z0-9]/g, ' ') // non-alphanumeric to spaces
    .trim()
    .split(/\s+/);
}

function isContiguousSubarray(sub: string[], main: string[]): boolean {
  if (sub.length === 0) return false;
  if (sub.length > main.length) return false;
  for (let i = 0; i <= main.length - sub.length; i++) {
    let match = true;
    for (let j = 0; j < sub.length; j++) {
      if (main[i + j] !== sub[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

// Get full station info object
export function getStationInfo(rawName: string, preferredModeOverride?: string | null): StationInfo | null {
  const normalized = normalizeStationName(rawName);

  // Detect mode qualifier in rawName
  const lowerRaw = rawName.toLowerCase();
  let preferredMode: string | null = null;
  if (lowerRaw.includes('[london underground]') || lowerRaw.includes('underground station') || lowerRaw.includes('tube')) {
    preferredMode = 'underground';
  } else if (lowerRaw.includes('[national rail]') || lowerRaw.includes('rail station')) {
    preferredMode = 'national_rail';
  } else if (lowerRaw.includes('[dlr]') || lowerRaw.includes('dlr station')) {
    preferredMode = 'dlr';
  } else if (lowerRaw.includes('[elizabeth line]') || lowerRaw.includes('elizabeth line station') || lowerRaw.includes('crossrail')) {
    preferredMode = 'elizabeth';
  } else if (lowerRaw.includes('[london overground]') || lowerRaw.includes('overground station')) {
    preferredMode = 'overground';
  } else if (preferredModeOverride) {
    preferredMode = preferredModeOverride;
  }

  // Helper to check compatibility
  const isCompatible = (info: StationInfo) => !preferredMode || info.modes.includes(preferredMode as any);

  // Direct lookup
  if (STATIONS[normalized] && isCompatible(STATIONS[normalized])) {
    return STATIONS[normalized];
  }

  // try fallbacks if direct normalisation fails
  let key = normalized.replace(/\[.*?\]/g, '').trim();
  if (STATIONS[key] && isCompatible(STATIONS[key])) return STATIONS[key];

  key = key.replace(/\(.*?\)/g, '').trim();
  if (STATIONS[key] && isCompatible(STATIONS[key])) return STATIONS[key];

  // Try cleaned punctuation lookup (e.g. matching "queenstown road battersea" to "queenstown road (battersea)")
  const cleanNormalized = cleanPunctuation(normalized);
  for (const [k, info] of Object.entries(STATIONS)) {
    if (cleanPunctuation(k) === cleanNormalized && isCompatible(info)) {
      return info;
    }
  }

  // Word-token based contiguous sub-array matching
  const queryWords = getWords(normalized);
  const matches: { key: string; info: StationInfo }[] = [];

  for (const [k, info] of Object.entries(STATIONS)) {
    const keyWords = getWords(k);
    if (isContiguousSubarray(queryWords, keyWords) || isContiguousSubarray(keyWords, queryWords)) {
      if (isCompatible(info)) {
        matches.push({ key: k, info });
      }
    }
  }

  if (matches.length > 0) {
    const queryWordCount = queryWords.length;
    matches.sort((a, b) => {
      const aWordCount = getWords(a.key).length;
      const bWordCount = getWords(b.key).length;
      const aDiff = Math.abs(aWordCount - queryWordCount);
      const bDiff = Math.abs(bWordCount - queryWordCount);
      
      if (aDiff !== bDiff) {
        return aDiff - bDiff;
      }
      return a.key.localeCompare(b.key);
    });

    return matches[0].info;
  }

  return null;
}


// Look up a station's zone from its name as it appears in the CSV
export function getStationZone(rawName: string): number | null {
  const info = getStationInfo(rawName);
  return info ? info.zone : null;
}

// Get the best zone for fare calculation (use alt zone if cheaper for passenger)
export function getStationBestZone(rawName: string, otherZone: number): number | null {
  const station = getStationInfo(rawName);
  if (!station) return null;

  // If station has an alt zone, pick the one closer to the other station's zone (cheaper fare)
  if (station.altZone !== undefined) {
    const distPrimary = Math.abs(station.zone - otherZone);
    const distAlt = Math.abs(station.altZone - otherZone);
    return distAlt < distPrimary ? station.altZone : station.zone;
  }

  return station.zone;
}

// Get transport mode from CSV Journey/Action string
export type TransportMode = 'underground' | 'national_rail' | 'overground' | 'bus' | 'tram' | 'dlr' | 'elizabeth' | 'nr_tube' | 'unknown';

export function detectTransportMode(journeyAction: string): TransportMode {
  const lower = journeyAction.toLowerCase();

  if (lower.includes('bus journey')) return 'bus';
  if (lower.includes('tram')) return 'tram';

  if (lower.includes('[elizabeth line]')) return 'elizabeth';
  if (lower.includes('[london overground]')) return 'overground';
  if (lower.includes('[dlr]')) return 'dlr';

  const hasNR = lower.includes('[national rail]');
  const hasLU = lower.includes('[london underground]') || (!hasNR && lower.includes(' to '));

  if (hasNR && hasLU && lower.includes(' to ')) return 'nr_tube';
  if (hasNR && lower.includes(' to ')) return 'national_rail';
  if (hasLU && lower.includes(' to ')) return 'underground';

  return 'unknown';
}


export interface StationSearchResult {
  key: string;
  info: StationInfo;
  matchScore: number;
}

const MODE_LABELS: Record<string, string> = {
  underground: 'Tube',
  national_rail: 'National Rail',
  overground: 'London Overground',
  dlr: 'DLR',
  elizabeth: 'Elizabeth line',
};

/**
 * Get human-readable mode labels for a station
 */
export function getModeBadges(modes: StationInfo['modes']): string[] {
  return modes.map(m => MODE_LABELS[m] || m);
}

/**
 * Format a zone display string (e.g., "Zone 2/3" for altZone stations)
 */
export function formatZoneDisplay(info: StationInfo): string {
  if (info.altZone !== undefined) {
    return `Zone ${info.zone}/${info.altZone}`;
  }
  return `Zone ${info.zone}`;
}

/**
 * Zone color palette — consistent across all dashboard views.
 * Maps zone numbers to HSL-tuned colors inspired by TfL zone map aesthetics.
 */
const ZONE_COLORS: Record<number, string> = {
  1: '#0ea5e9', // Sky Blue
  2: '#3b82f6', // Blue
  3: '#10b981', // Green
  4: '#f59e0b', // Amber
  5: '#f97316', // Orange
  6: '#8b5cf6', // Purple
  7: '#ec4899', // Pink
  8: '#ec4899', // Pink
  9: '#ec4899', // Pink
};

/**
 * Get the display color for a zone number or zone range string.
 * Accepts a single zone number (1-9), a zone range string like "Z1-3",
 * or undefined / unknown values (returns fallback).
 */
export function getZoneColor(zone: number | string | undefined): string {
  if (zone === undefined || zone === null) return 'var(--color-oyster-blue)';

  // If it's a number, direct lookup
  if (typeof zone === 'number') {
    return ZONE_COLORS[zone] || 'var(--color-oyster-blue)';
  }

  // If it's a string like "Z1-3", extract the max zone
  const match = zone.match(/(\d+)/g);
  if (match && match.length > 0) {
    const maxZone = Math.max(...match.map(Number));
    return ZONE_COLORS[maxZone] || 'var(--color-oyster-blue)';
  }

  return 'var(--color-oyster-blue)';
}

/**
 * Helper to normalize station names and queries for search by removing
 * apostrophes, replacing special punctuation with spaces, and collapsing whitespace.
 */
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .replace(/['’]/g, '') // remove apostrophes (king's -> kings)
    .replace(/[^a-z0-9]/g, ' ') // replace non-alphanumeric with spaces
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Search stations by name with fuzzy matching.
 * Returns up to `limit` results sorted by relevance.
 */
export function searchStations(query: string, limit: number = 10): StationSearchResult[] {
  if (!query || query.length < 1) return [];

  const q = query.toLowerCase().trim();
  const qNorm = normalizeForSearch(query);
  const hasNorm = qNorm.length > 0;
  const results: StationSearchResult[] = [];

  for (const [key, info] of Object.entries(STATIONS)) {
    const name = info.name.toLowerCase();
    const nameNorm = normalizeForSearch(info.name);
    const keyNorm = normalizeForSearch(key);
    let score = 0;

    // Direct exact matches (non-normalized and normalized)
    if (name === q) {
      score = 100;
    } else if (hasNorm && nameNorm === qNorm) {
      score = 95;
    } 
    // Starts-with matches
    else if (name.startsWith(q)) {
      score = 85 + (q.length / name.length) * 10;
    } else if (hasNorm && nameNorm.startsWith(qNorm)) {
      score = 80 + (qNorm.length / nameNorm.length) * 10;
    } else if (key.startsWith(q)) {
      score = 75 + (q.length / key.length) * 10;
    } else if (hasNorm && keyNorm.startsWith(qNorm)) {
      score = 70 + (qNorm.length / keyNorm.length) * 10;
    }
    // Word-starts-with matches (using normalized strings)
    else if (hasNorm && nameNorm.split(' ').some(word => word.startsWith(qNorm))) {
      score = 55 + (qNorm.length / nameNorm.length) * 10;
    } else if (name.split(/[\s\-&']+/).some(word => word.startsWith(q))) {
      score = 50 + (q.length / name.length) * 10;
    }
    // Includes matches
    else if (name.includes(q)) {
      score = 35 + (q.length / name.length) * 5;
    } else if (hasNorm && nameNorm.includes(qNorm)) {
      score = 30 + (qNorm.length / nameNorm.length) * 5;
    } else if (key.includes(q)) {
      score = 25 + (q.length / key.length) * 5;
    } else if (hasNorm && keyNorm.includes(qNorm)) {
      score = 20 + (qNorm.length / keyNorm.length) * 5;
    }

    if (score > 0) {
      results.push({ key, info, matchScore: score });
    }
  }

  results.sort((a, b) => b.matchScore !== a.matchScore ? b.matchScore - a.matchScore : a.info.name.localeCompare(b.info.name));
  return results.slice(0, limit);
}

export function getStationByNaptan(naptanId: string): { key: string; info: StationInfo } | null {
  for (const [key, info] of Object.entries(STATIONS)) {
    if (info.naptanId === naptanId) return { key, info };
  }
  return null;
}

/**
 * Get all stations as a sorted list (for full autocomplete dropdown)
 */
export function getAllStationsForSearch(): StationSearchResult[] {
  return Object.entries(STATIONS)
    .map(([key, info]) => ({ key, info, matchScore: 0 }))
    .sort((a, b) => a.info.name.localeCompare(b.info.name));
}

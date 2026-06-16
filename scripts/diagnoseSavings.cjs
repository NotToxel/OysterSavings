const fs = require('fs');

// 1. Load STATIONS from stationData.ts
const stationDataContent = fs.readFileSync('c:/Development/OysterSavings/src/lib/data/stationData.ts', 'utf-8');
const STATIONS = {};
const entryRegex = /'([^']+)':\s*\{([\s\S]*?)\},/g;
let match;
while ((match = entryRegex.exec(stationDataContent)) !== null) {
  const key = match[1];
  const body = match[2];
  const nameMatch = body.match(/name:\s*'([^']+)'/);
  const zoneMatch = body.match(/zone:\s*(\d+)/);
  const altZoneMatch = body.match(/altZone:\s*(\d+)/);
  const modesMatch = body.match(/modes:\s*\[([^\]]+)\]/);
  STATIONS[key] = {
    name: nameMatch ? nameMatch[1] : '',
    zone: zoneMatch ? parseInt(zoneMatch[1], 10) : 0,
    altZone: altZoneMatch ? parseInt(altZoneMatch[1], 10) : undefined,
    modes: modesMatch ? modesMatch[1].split(',').map(m => m.replace(/'/g, '').trim()) : []
  };
}

// 2. Parse cap rates from fareRates.ts
const fareRatesContent = fs.readFileSync('c:/Development/OysterSavings/src/lib/data/fareRates.ts', 'utf-8');
function parseRecord(varName) {
  const regex = new RegExp(`export const ${varName}: Record<string, number> = \\{([^\\}]+)\\};`);
  const match = fareRatesContent.match(regex);
  if (!match) return {};
  const record = {};
  match[1].split(',').forEach(line => {
    const parts = line.split(':');
    if (parts.length === 2) {
      const k = parts[0].trim().replace(/['"]/g, '');
      const v = parseFloat(parts[1].trim());
      if (k && !isNaN(v)) record[k] = v;
    }
  });
  return record;
}

const DAILY_CAPS = parseRecord('DAILY_CAPS');
const DAILY_CAPS_OFFPEAK = parseRecord('DAILY_CAPS_OFFPEAK');
const WEEKLY_CAPS = parseRecord('WEEKLY_CAPS');
const FARES_DB = require('c:/Development/OysterSavings/src/lib/data/sampledZoneFares.json');

// Helper functions
function normalizeStationName(raw) {
  return raw
    .replace(/\s*\[.*?\]\s*/g, '')
    .replace(/\s*\(platforms?\s*[\d\-]+\)\s*/gi, '')
    .replace(/\s*\(District,\s*Piccadilly lines?\)\s*/gi, '')
    .replace(/\b(t|terminal|terminals)\s*(\d)\s*(?:&|and)\s*(\d)\b/gi, 'terminals $2 & $3')
    .replace(/\b(t|terminal)\s*(\d)\b/gi, 'terminal $2')
    .trim()
    .toLowerCase();
}

function getStationInfo(rawName) {
  const normalized = normalizeStationName(rawName);
  if (STATIONS[normalized]) return STATIONS[normalized];
  let key = normalized.replace(/\[.*?\]/g, '').trim();
  if (STATIONS[key]) return STATIONS[key];
  key = key.replace(/\(.*?\)/g, '').trim();
  if (STATIONS[key]) return STATIONS[key];
  return null;
}

function detectTransportMode(journeyAction) {
  const lower = journeyAction.toLowerCase();
  if (lower.includes('bus journey')) return 'bus';
  if (lower.includes('tram')) return 'tram';
  const hasNR = lower.includes('[national rail]') || lower.includes('national rail');
  const hasLU = lower.includes('[london underground]') || lower.includes('underground station') || (!hasNR && lower.includes(' to '));
  if (hasNR && hasLU && lower.includes(' to ')) return 'nr_tube';
  if (hasNR && lower.includes(' to ')) return 'national_rail';
  if (hasLU && lower.includes(' to ')) return 'underground';
  return 'unknown';
}

function extractStations(journeyAction) {
  if (journeyAction.toLowerCase().includes('bus journey')) return null;
  const toIndex = journeyAction.indexOf(' to ');
  if (toIndex === -1) {
    const enteredMatch = journeyAction.match(/Entered and exited (.+)/i);
    if (enteredMatch) {
      const station = enteredMatch[1].trim();
      return { origin: station, destination: station };
    }
    return null;
  }
  return {
    origin: journeyAction.substring(0, toIndex).trim(),
    destination: journeyAction.substring(toIndex + 4).trim()
  };
}

function getZoneRange(z1, z2) {
  if (!z1 || !z2) return null;
  if (z1 === z2) return `Z${z1}`;
  return `Z${Math.min(z1, z2)}-${Math.max(z1, z2)}`;
}

function isPeakTime(timeStr, date) {
  if (!timeStr) return false;
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const [h, m] = timeStr.split(':').map(Number);
  const mins = h * 60 + m;
  if ((mins >= 390 && mins < 570) || (mins >= 960 && mins < 1140)) {
    return true;
  }
  return false;
}

function lookupFare(zoneRange, isPeak, mode) {
  if (!zoneRange) return 0;
  let scale = 'tfl';
  if (mode === 'national_rail') scale = 'national_rail';
  else if (mode === 'nr_tube') scale = 'nr_tube';
  const rates = FARES_DB[scale]?.[zoneRange];
  if (!rates) {
    return FARES_DB['tfl']?.[zoneRange]?.[isPeak ? 'peak' : 'offPeak'] || 0;
  }
  return rates[isPeak ? 'peak' : 'offPeak'];
}

function calculateDiscountedFare(baseFare, fareType, isPeak, isBus) {
  if (fareType === 'none') return baseFare;
  if (isBus) return baseFare;
  if (isPeak) return baseFare;
  const multiplier = 0.666;
  return Math.floor(baseFare * multiplier * 20) / 20;
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[1].split(',').map(h => h.replace(/"/g, '').trim());
  const journeys = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = [];
    let inQuotes = false;
    let current = '';
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current);
    if (parts.length < 5) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = parts[idx] ? parts[idx].trim() : '';
    });
    if (!row['Journey/Action'] && !row.Date) continue;
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const dateParts = row.Date.split('-');
    if (dateParts.length !== 3) continue;
    const date = new Date(parseInt(dateParts[2]), months[dateParts[1]], parseInt(dateParts[0]));
    journeys.push({
      date,
      dateStr: row.Date,
      startTime: row['Start Time'] || '',
      endTime: row['End Time'] || '',
      journeyAction: row['Journey/Action'] || '',
      charge: parseFloat(row.Charge) || 0,
      credit: parseFloat(row.Credit) || 0,
      balance: parseFloat(row.Balance) || 0,
      note: row.Note || ''
    });
  }
  return journeys;
}

const rawJourneys = parseCSV('c:/Development/OysterSavings/reference/010933650875-20260614-1419.csv');

// Classify
const classified = rawJourneys.map(j => {
  const isBus = j.journeyAction.toLowerCase().includes('bus');
  let origin = null, destination = null, originZone = null, destinationZone = null, zoneRange = null;
  let mode = detectTransportMode(j.journeyAction);
  if (!isBus) {
    const stations = extractStations(j.journeyAction);
    if (stations) {
      const oInfo = getStationInfo(stations.origin);
      const dInfo = getStationInfo(stations.destination);
      origin = oInfo ? oInfo.name : stations.origin;
      destination = dInfo ? dInfo.name : stations.destination;
      if (oInfo) originZone = oInfo.zone;
      if (dInfo) destinationZone = dInfo.zone;
      zoneRange = getZoneRange(originZone, destinationZone);
    }
  }
  return {
    raw: j,
    mode,
    isBus,
    origin,
    destination,
    originZone,
    destinationZone,
    zoneRange,
    isPeak: isPeakTime(j.startTime, j.date),
    dayOfWeek: j.date.getDay(),
    isCapHit: j.note.includes('cap')
  };
});

// Calculate base fares
const baseFares = classified.map(journey => {
  let expectedFare = 0;
  if (journey.isBus) {
    expectedFare = 1.75;
  } else if (journey.zoneRange) {
    expectedFare = lookupFare(journey.zoneRange, journey.isPeak, journey.mode);
  }
  const actualCharge = journey.raw.charge;
  const fareTypeFare = calculateDiscountedFare(expectedFare, 'railcard', journey.isPeak, journey.isBus);
  return {
    journey,
    expectedFare,
    actualCharge,
    fareTypeFare
  };
});

// Local cap logic implementations
function getMaxZoneRange(journeys) {
  let minZone = 99;
  let maxZone = 0;
  let hasRail = false;
  for (const j of journeys) {
    if (j.journey.isBus) continue;
    const range = j.journey.zoneRange;
    if (!range) continue;
    hasRail = true;
    const parts = range.replace('Z', '').split('-');
    const z1 = parseInt(parts[0], 10);
    const z2 = parts.length > 1 ? parseInt(parts[1], 10) : z1;
    minZone = Math.min(minZone, z1, z2);
    maxZone = Math.max(maxZone, z1, z2);
  }
  if (!hasRail) return 'Z1-2';
  let result = minZone === maxZone ? `Z${minZone}` : `Z${minZone}-${maxZone}`;
  if (result === 'Z1' || result === 'Z2') result = 'Z1-2';
  return result;
}

function lookupDailyCap(zoneRange, isPeak, fareType) {
  const adultCap = DAILY_CAPS[zoneRange] ?? 16.30;
  if (fareType === 'jobcentre' || fareType === 'zip_11_15' || fareType === 'zip_16_17') {
    return Math.floor(adultCap * 0.5 * 20) / 20;
  }
  if (fareType === 'none' || fareType === 'student') return adultCap;
  const isEligibleForDiscount = !isPeak || fareType === 'disabled';
  if (isEligibleForDiscount) {
    return DAILY_CAPS_OFFPEAK[zoneRange] ?? Math.floor(adultCap * 0.666 * 20) / 20;
  }
  return adultCap;
}

function calculateDailyCaps(fareResults, railcardType = 'none') {
  const dayMap = new Map();
  for (const r of fareResults) {
    const key = r.journey.raw.dateStr;
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key).push(r);
  }
  
  const results = [];
  for (const [dateStr, journeys] of dayMap) {
    let maxZoneRange = getMaxZoneRange(journeys);
    let isPeakDay = false;
    if (journeys.length > 0) {
      const sorted = [...journeys].sort((a, b) => a.journey.raw.startTime.localeCompare(b.journey.raw.startTime));
      const firstTime = sorted[0].journey.raw.startTime;
      const dayOfWeek = sorted[0].journey.raw.date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && firstTime >= '04:30' && firstTime < '09:30') {
        isPeakDay = true;
      }
    }
    
    const isSimulated = journeys.some(j => j.actualCharge !== j.journey.raw.charge);
    let initialTotalSpend = journeys.reduce((sum, j) => sum + j.actualCharge, 0);
    let dailyCap = lookupDailyCap(maxZoneRange, isPeakDay, railcardType);
    const explicitCapHit = journeys.some(j => j.journey.isCapHit);
    
    if (explicitCapHit && !isSimulated) {
      let inferredZone = null;
      for (const [zone, cap] of Object.entries(DAILY_CAPS)) {
        if (Math.abs(cap - initialTotalSpend) < 0.05) {
          inferredZone = zone;
          break;
        }
      }
      if (!inferredZone) {
        for (const [zone, cap] of Object.entries(DAILY_CAPS_OFFPEAK)) {
          if (Math.abs(cap - initialTotalSpend) < 0.05) {
            inferredZone = zone;
            break;
          }
        }
      }
      if (inferredZone) maxZoneRange = inferredZone;
      dailyCap = initialTotalSpend;
    }
    
    const sorted = [...journeys].sort((a, b) => a.journey.raw.startTime.localeCompare(b.journey.raw.startTime));
    let runningSpend = 0;
    for (const res of sorted) {
      const originalCharge = res.actualCharge;
      let cappedCharge = originalCharge;
      if (runningSpend >= dailyCap) {
        cappedCharge = 0;
      } else if (runningSpend + originalCharge > dailyCap) {
        cappedCharge = dailyCap - runningSpend;
        runningSpend = dailyCap;
      } else {
        runningSpend += originalCharge;
      }
      res.actualCharge = cappedCharge;
    }
    
    const totalSpend = sorted.reduce((sum, j) => sum + j.actualCharge, 0);
    results.push({
      dateStr,
      dateObj: journeys[0].journey.raw.date,
      totalSpend: Math.round(totalSpend * 100) / 100,
      journeys: sorted
    });
  }
  results.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  return results;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d;
}

function lookupWeeklyCap(zoneRange) {
  return WEEKLY_CAPS[zoneRange] ?? 81.60;
}

function calculateWeeklyCaps(dailyResults) {
  const weekMap = new Map();
  for (const day of dailyResults) {
    const monday = getMonday(day.dateObj);
    const weekKey = monday.toISOString().split('T')[0];
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
    weekMap.get(weekKey).push(day);
  }
  const results = [];
  for (const [weekKey, days] of weekMap) {
    const allJourneys = days.flatMap(d => d.journeys);
    const maxZoneRange = getMaxZoneRange(allJourneys);
    const weeklyCap = lookupWeeklyCap(maxZoneRange);
    const totalSpend = days.reduce((sum, d) => sum + d.totalSpend, 0);
    results.push({
      weekKey,
      totalSpend: Math.min(weeklyCap, totalSpend)
    });
  }
  return results;
}

const actualCaps = calculateDailyCaps(baseFares);
let totalActual = 0;
for (const day of actualCaps) totalActual += day.totalSpend;

const standardFares = baseFares.map(f => ({ ...f, actualCharge: f.expectedFare }));
const standardCaps = calculateDailyCaps(standardFares);
const standardWeekly = calculateWeeklyCaps(standardCaps);
let totalExpected = 0;
for (const week of standardWeekly) totalExpected += week.totalSpend;

const fareTypeFares = baseFares.map(f => ({ ...f, actualCharge: f.fareTypeFare }));
const fareTypeCaps = calculateDailyCaps(fareTypeFares, 'railcard');
const fareTypeWeekly = calculateWeeklyCaps(fareTypeCaps, 'railcard');
let totalFareType = 0;
for (const week of fareTypeWeekly) totalFareType += week.totalSpend;

console.log(`\n=== Heuristics Analysis ===`);
console.log(`totalActual: £${totalActual.toFixed(2)}`);
console.log(`totalExpected: £${totalExpected.toFixed(2)}`);
console.log(`totalExpected * 0.85: £${(totalExpected * 0.85).toFixed(2)}`);
console.log(`totalFareType: £${totalFareType.toFixed(2)}`);
console.log(`totalFareType * 1.05: £${(totalFareType * 1.05).toFixed(2)}`);
console.log(`Condition 1 (totalActual < totalExpected * 0.85): ${totalActual < totalExpected * 0.85}`);
console.log(`Condition 2 (totalActual <= totalFareType * 1.05): ${totalActual <= totalFareType * 1.05}`);

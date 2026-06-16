const fs = require('fs');
const path = require('path');

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
  const naptanMatch = body.match(/naptanId:\s*'([^']+)'/);
  
  STATIONS[key] = {
    name: nameMatch ? nameMatch[1] : '',
    zone: zoneMatch ? parseInt(zoneMatch[1], 10) : 0,
    altZone: altZoneMatch ? parseInt(altZoneMatch[1], 10) : undefined,
    modes: modesMatch ? modesMatch[1].split(',').map(m => m.replace(/'/g, '').trim()) : [],
    naptanId: naptanMatch ? naptanMatch[1] : ''
  };
}

// 2. Load Fares Database
const FARES_DB = require('c:/Development/OysterSavings/src/lib/data/sampledZoneFares.json');

// Helpers
function cleanPunctuation(str) {
  return str.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

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
  const lowerRaw = rawName.toLowerCase();
  let preferredMode = null;
  if (lowerRaw.includes('[london underground]') || lowerRaw.includes('underground station') || lowerRaw.includes('tube')) {
    preferredMode = 'underground';
  } else if (lowerRaw.includes('[national rail]') || lowerRaw.includes('rail station')) {
    preferredMode = 'national_rail';
  }
  
  const isCompatible = (info) => !preferredMode || info.modes.includes(preferredMode);
  
  if (STATIONS[normalized] && isCompatible(STATIONS[normalized])) return STATIONS[normalized];
  
  let key = normalized.replace(/\[.*?\]/g, '').trim();
  if (STATIONS[key] && isCompatible(STATIONS[key])) return STATIONS[key];
  key = key.replace(/\(.*?\)/g, '').trim();
  if (STATIONS[key] && isCompatible(STATIONS[key])) return STATIONS[key];
  
  const cleanNormalized = cleanPunctuation(normalized);
  for (const [k, info] of Object.entries(STATIONS)) {
    if (cleanPunctuation(k) === cleanNormalized && isCompatible(info)) {
      return info;
    }
  }
  
  const matches = [];
  for (const [k, info] of Object.entries(STATIONS)) {
    if (normalized.includes(k) || k.includes(normalized)) {
      matches.push({ key: k, info });
    }
  }
  if (matches.length > 0) {
    if (preferredMode) {
      const best = matches.find(m => m.info.modes.includes(preferredMode));
      if (best) return best.info;
    }
    return matches[0].info;
  }
  return null;
}

function detectTransportMode(journeyAction) {
  const lower = journeyAction.toLowerCase();
  if (lower.includes('bus journey')) return 'bus';
  if (lower.includes('tram')) return 'tram';
  const hasNR = lower.includes('[national_rail]') || lower.includes('[national rail]') || lower.includes('national rail');
  const hasLU = lower.includes('[london underground]') || lower.includes('[underground]') || lower.includes('underground station') || (!hasNR && lower.includes(' to '));
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
  if (day === 0 || day === 6) return false; // weekend is always offpeak
  
  const [h, m] = timeStr.split(':').map(Number);
  const mins = h * 60 + m;
  
  // Morning Peak: 06:30 - 09:30 (390 - 570 mins)
  // Evening Peak: 16:00 - 19:00 (960 - 1140 mins)
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
    // fallback to tfl scale
    return FARES_DB['tfl']?.[zoneRange]?.[isPeak ? 'peak' : 'offPeak'] || 0;
  }
  return rates[isPeak ? 'peak' : 'offPeak'];
}

function calculateDiscountedFare(baseFare, fareType, isPeak, isBus) {
  if (fareType === 'none') return baseFare;
  if (isBus) return baseFare; // no railcard discount on bus single fares
  if (isPeak) return baseFare; // railcard doesn't apply to peak fares
  
  // 1/3 off off-peak fares, rounded down to nearest 5p
  const multiplier = 0.666;
  return Math.floor(baseFare * multiplier * 20) / 20;
}

// Parse CSV
function parseAmount(value) {
  if (!value || value.trim() === '') return 0;
  return parseFloat(value.replace(/[£,]/g, '').trim()) || 0;
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
    let current = '';
    let inQuotes = false;
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
      charge: parseAmount(row.Charge),
      credit: parseAmount(row.Credit),
      balance: parseAmount(row.Balance),
      note: row.Note || ''
    });
  }
  return journeys;
}

const csvFilePath = 'c:/Development/OysterSavings/reference/010933650875-20260614-1419.csv';
const rawJourneys = parseCSV(csvFilePath);

console.log(`=== FARE ANALYSIS FOR CSV 010933650875 ===`);
let matches = 0;
let mismatches = 0;
let totalActual = 0;
let totalSimRailcard = 0;
let totalSimAdult = 0;

for (const r of rawJourneys) {
  if (r.journeyAction.toLowerCase().includes('topped up') || r.journeyAction.toLowerCase().includes('automated refund')) continue;
  
  const stations = extractStations(r.journeyAction);
  let mode = detectTransportMode(r.journeyAction);
  let isBus = mode === 'bus';
  
  let oZone = null, dZone = null, zoneRange = null;
  let expectedAdult = 0, expectedRailcard = 0;
  
  if (isBus) {
    expectedAdult = 1.75;
    expectedRailcard = 1.75;
    zoneRange = 'Bus';
  } else if (stations) {
    const oInfo = getStationInfo(stations.origin);
    const dInfo = getStationInfo(stations.destination);
    if (oInfo) oZone = oInfo.zone;
    if (dInfo) dZone = dInfo.zone;
    zoneRange = getZoneRange(oZone, dZone);
    
    const isPeak = isPeakTime(r.startTime, r.date);
    expectedAdult = lookupFare(zoneRange, isPeak, mode);
    expectedRailcard = calculateDiscountedFare(expectedAdult, 'railcard', isPeak, false);
  }
  
  // Same station exit / incomplete touch fallback
  if (r.charge === 4.65 && (r.journeyAction.includes('Entered and exited') || r.journeyAction.includes('touch'))) {
    expectedAdult = r.charge;
    expectedRailcard = r.charge;
  }
  
  if (r.charge > 0) {
    totalActual += r.charge;
    totalSimAdult += expectedAdult;
    totalSimRailcard += expectedRailcard;
    
    const isRCMatch = Math.abs(r.charge - expectedRailcard) < 0.05;
    const isAdultMatch = Math.abs(r.charge - expectedAdult) < 0.05;
    
    if (isRCMatch) {
      matches++;
    } else {
      mismatches++;
    }
    
    console.log(`[${r.dateStr} ${r.startTime}] "${r.journeyAction}"`);
    console.log(`  Actual Charge: £${r.charge.toFixed(2)}`);
    console.log(`  Expected Adult: £${expectedAdult.toFixed(2)} (Match: ${isAdultMatch})`);
    console.log(`  Expected Railcard: £${expectedRailcard.toFixed(2)} (Match: ${isRCMatch})`);
    console.log();
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total Actual Spend: £${totalActual.toFixed(2)}`);
console.log(`Total Simulated Adult Spend (uncapped): £${totalSimAdult.toFixed(2)}`);
console.log(`Total Simulated Railcard Spend (uncapped): £${totalSimRailcard.toFixed(2)}`);
console.log(`Railcard Fares Matches: ${matches} / ${matches + mismatches}`);
console.log(`Railcard Fares Mismatches: ${mismatches}`);

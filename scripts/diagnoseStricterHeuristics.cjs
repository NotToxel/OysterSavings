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

// 2. Load Fares Database
const FARES_DB = require('c:/Development/OysterSavings/src/lib/data/sampledZoneFares.json');

// Helpers
function normalizeStationName(raw) {
  return raw
    .replace(/\s*\[.*?\]\s*/g, '')
    .replace(/\s*\(platforms?\s*[\d\-]+\)\s*/gi, '')
    .replace(/\s*\(District,\s*Piccadilly lines?\)\s*/gi, '')
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
  
  const fareTypeInfo = {
    'railcard': { discount: 1/3, appliesToPeak: false },
    'disabled': { discount: 1/3, appliesToPeak: true },
    'zip_16_17': { discount: 0.5, appliesToPeak: true },
    'jobcentre': { discount: 0.5, appliesToPeak: true }
  }[fareType];

  if (!fareTypeInfo) return baseFare;
  if (isPeak && !fareTypeInfo.appliesToPeak) return baseFare;

  const multiplier = fareTypeInfo.discount === 0.5 ? 0.5 : 0.666;
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
  const isCapHit = j.note.toLowerCase().includes('daily cap') || j.note.toLowerCase().includes('cheaper or free today');
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
    isCapHit
  };
});

function testFareType(fareType) {
  // Calculate base fares
  const baseFares = classified.map(journey => {
    let expectedFare = 0;
    if (journey.isBus) {
      expectedFare = 1.75;
    } else if (journey.zoneRange) {
      expectedFare = lookupFare(journey.zoneRange, journey.isPeak, journey.mode);
    }
    const actualCharge = journey.raw.charge;
    const fareTypeFare = calculateDiscountedFare(expectedFare, fareType, journey.isPeak, journey.isBus);
    return {
      journey,
      expectedFare,
      actualCharge,
      fareTypeFare
    };
  });

  let fareTypeMatches = 0;
  let standardMatches = 0;
  let eligibleJourneysCount = 0;

  for (const f of baseFares) {
    if (f.journey.isBus || f.journey.isCapHit || f.actualCharge <= 0 || f.expectedFare <= 0) continue;
    if (f.actualCharge === 4.65 || f.actualCharge === 8.90) continue;

    const discountApplies = Math.abs(f.fareTypeFare - f.expectedFare) >= 0.05;
    if (!discountApplies) continue;

    eligibleJourneysCount++;
    const matchesStandard = Math.abs(f.actualCharge - f.expectedFare) < 0.05;
    const matchesConcession = Math.abs(f.actualCharge - f.fareTypeFare) < 0.05;

    if (matchesConcession) {
      fareTypeMatches++;
    } else if (matchesStandard) {
      standardMatches++;
    }
  }

  const hasExistingDiscount = eligibleJourneysCount > 0 && 
                              fareTypeMatches > standardMatches && 
                              (fareTypeMatches / eligibleJourneysCount) > 0.75 && 
                              standardMatches === 0;

  console.log(`FareType: ${fareType.padEnd(10)} | Eligible: ${eligibleJourneysCount.toString().padEnd(2)} | Matches: ${fareTypeMatches.toString().padEnd(2)} | Std Matches: ${standardMatches.toString().padEnd(2)} | Result: ${hasExistingDiscount}`);
}

console.log("=== EVALUATING STRICT HEURISTICS ===");
testFareType('railcard');
testFareType('disabled');
testFareType('zip_16_17');
testFareType('jobcentre');

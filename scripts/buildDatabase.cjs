const fs = require('fs');
const path = require('path');

const comprehensivePath = path.resolve(__dirname, 'comprehensive_stations.json');
const outputPath = path.resolve(__dirname, '../src/lib/data/stationData.json');

if (!fs.existsSync(comprehensivePath)) {
  console.error(`Error: Cached comprehensive database not found at ${comprehensivePath}`);
  console.error(`Please run the fetch script first: node scripts/fetchStations.cjs`);
  process.exit(1);
}

const comp = JSON.parse(fs.readFileSync(comprehensivePath, 'utf-8'));

const INVALID_NAPTANS = new Set(['910GKNGX', '910GSTPADOM']);

// Standardize names by removing standard TfL suffixes
function cleanBaseName(name) {
  return name
    .replace(/\s*(Underground Station|Rail Station|DLR Station|Tram Stop|Elizabeth line Station|Overground Station|Underground|DLR|Elizabeth line|Overground)\s*$/gi, '')
    // .replace(/\s*\(London\)/gi, '') // Preserve (London) in the name
    .replace(/\s*\(platforms?\s*[\d\-]+\)\s*/gi, '')
    .trim();
}

// Map mode to uniform suffix
function getModeSuffix(modes) {
  if (modes.includes('underground')) return ' Underground Station';
  if (modes.includes('dlr')) return ' DLR Station';
  if (modes.includes('national_rail') || modes.includes('overground')) return ' Rail Station';
  if (modes.includes('elizabeth')) return ' Elizabeth line Station';
  if (modes.includes('tram')) return ' Tram Stop';
  return '';
}

// Clean and filter modes, explicitly excluding tram
function cleanModes(modes, name, id) {
  const cleanId = id.toUpperCase();
  const cleanName = name.toLowerCase();

  if (!modes || modes.length === 0) return [];
  
  // Filter out any tram modes
  let filtered = modes.filter(m => m !== 'tram');
  
  if (cleanId.startsWith('940GZZDL') || cleanName.includes('dlr')) {
    return ['dlr'];
  }
  if (cleanId.startsWith('940GZZLU') || cleanName.includes('underground') || cleanName.includes('tube')) {
    return ['underground'];
  }
  if (cleanId.startsWith('940GZZEL') || cleanId.endsWith('XR') || cleanName.includes('elizabeth') || cleanName.includes('crossrail')) {
    return ['elizabeth'];
  }
  if (cleanName.includes('overground') || cleanName.includes('nll')) {
    return ['overground'];
  }
  
  if (cleanId.startsWith('910G')) {
    filtered = filtered.filter(m => m !== 'underground' && m !== 'dlr');
    return filtered.length > 0 ? filtered : ['national_rail'];
  }

  return filtered;
}

// First pass: collect all valid individual stations
const allStations = [];
for (const [id, val] of Object.entries(comp)) {
  // We only keep standard station IDs (940G, 910G, 930G), excluding parent hubs starting with HUB
  if (!id || (!id.startsWith('940G') && !id.startsWith('910G') && !id.startsWith('930G'))) continue;
  if (INVALID_NAPTANS.has(id)) continue;
  
  const modes = cleanModes(val.modes, val.name, id);
  if (modes.length === 0) continue;
  
  const baseName = cleanBaseName(val.name);
  if (!baseName) continue;
  
  allStations.push({
    id,
    name: val.name,
    baseName,
    modes,
    zone: val.zone || 0,
    altZone: val.altZone || null
  });
}

// Group stations by their clean base name
const groups = {};
for (const s of allStations) {
  const lowerBase = s.baseName.toLowerCase().trim();
  if (!groups[lowerBase]) groups[lowerBase] = [];
  groups[lowerBase].push(s);
}

// Build the STATIONS output database
const STATIONS = {};
for (const [lowerBase, groupList] of Object.entries(groups)) {
  // Deduplicate and merge entries in the same base name group that map to the same mode suffix
  const bySuffix = {};
  for (const s of groupList) {
    const suffix = getModeSuffix(s.modes);
    if (!bySuffix[suffix]) {
      bySuffix[suffix] = {
        id: s.id,
        baseName: s.baseName,
        modes: [...s.modes],
        zone: s.zone,
        altZone: s.altZone,
        suffix: suffix
      };
    } else {
      // Merge
      const existing = bySuffix[suffix];
      const mergedModes = new Set([...existing.modes, ...s.modes]);
      existing.modes = Array.from(mergedModes);
      if (existing.zone === 0 || existing.zone === null || existing.zone === undefined) {
        existing.zone = s.zone;
      }
      if (existing.altZone === null || existing.altZone === undefined) {
        existing.altZone = s.altZone;
      }
    }
  }

  const distinctStations = Object.values(bySuffix);

  if (distinctStations.length === 1) {
    // Single station in this base name group: keep name simple (baseName)
    const s = distinctStations[0];
    const key = s.baseName.toLowerCase().trim();
    STATIONS[key] = {
      name: s.baseName,
      zone: s.zone,
      altZone: s.altZone,
      modes: s.modes,
      naptanId: s.id
    };
  } else {
    // Multiple distinct stations: append mode suffix
    for (const s of distinctStations) {
      const fullName = s.baseName + s.suffix;
      const key = fullName.toLowerCase().trim();
      
      STATIONS[key] = {
        name: fullName,
        zone: s.zone,
        altZone: s.altZone,
        modes: s.modes,
        naptanId: s.id
      };
    }
  }
}

// Apply manual overrides to ensure correct NaPTAN IDs and special zone configurations are preserved upon rebuilds
const overrides = {
  "chalfont & latimer underground station": { naptanId: "910GCHLFNAL" },
  "edgware road (bakerloo)": { naptanId: "940GZZLUERC" },
  "greenford underground station": { naptanId: "910GGFORD" },
  "walthamstow central rail station": { naptanId: "940GZZLUWWL" },
  "clapham junction": { naptanId: "910GCLPHMJC" },
  "reading": { naptanId: "910GRDNGSTN", zone: 0, outsideZone: true, contactlessOnly: true },
  "stratford international rail station": { zone: 2, altZone: 3 }
};

for (const [key, val] of Object.entries(overrides)) {
  if (STATIONS[key]) {
    STATIONS[key] = { ...STATIONS[key], ...val };
  }
}

// Format STATIONS object code as clean sorted JSON
const sortedSTATIONS = {};
const sortedKeys = Object.keys(STATIONS).sort();
for (const k of sortedKeys) {
  sortedSTATIONS[k] = STATIONS[k];
}

fs.writeFileSync(outputPath, JSON.stringify(sortedSTATIONS, null, 2), 'utf-8');
console.log(`Successfully compiled and wrote ${sortedKeys.length} split stations to: ${outputPath}`);

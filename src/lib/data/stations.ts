// Station-to-zone mapping for stations commonly found in TfL Oyster CSV exports
// Covers London Underground, National Rail, London Overground, DLR, Elizabeth line

export interface StationInfo {
  name: string;
  zone: number;
  altZone?: number; // stations on zone boundaries
  modes: ('underground' | 'national_rail' | 'overground' | 'dlr' | 'elizabeth')[];
}

// Map of canonical station names (lowercase) to their zone info
const STATIONS: Record<string, StationInfo> = {
  // Zone 1
  'baker street': { name: 'Baker Street', zone: 1, modes: ['underground'] },
  'bank': { name: 'Bank', zone: 1, modes: ['underground', 'dlr'] },
  'barbican': { name: 'Barbican', zone: 1, modes: ['underground'] },
  'bond street': { name: 'Bond Street', zone: 1, modes: ['underground', 'elizabeth'] },
  'borough': { name: 'Borough', zone: 1, modes: ['underground'] },
  'cannon street': { name: 'Cannon Street', zone: 1, modes: ['underground', 'national_rail'] },
  'charing cross': { name: 'Charing Cross', zone: 1, modes: ['underground', 'national_rail'] },
  'covent garden': { name: 'Covent Garden', zone: 1, modes: ['underground'] },
  'elephant & castle': { name: 'Elephant & Castle', zone: 1, altZone: 2, modes: ['underground', 'national_rail'] },
  'embankment': { name: 'Embankment', zone: 1, modes: ['underground'] },
  'euston': { name: 'Euston', zone: 1, modes: ['underground', 'national_rail'] },
  'euston square': { name: 'Euston Square', zone: 1, modes: ['underground'] },
  'farringdon': { name: 'Farringdon', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'] },
  'goodge street': { name: 'Goodge Street', zone: 1, modes: ['underground'] },
  'great portland street': { name: 'Great Portland Street', zone: 1, modes: ['underground'] },
  'green park': { name: 'Green Park', zone: 1, modes: ['underground'] },
  'holborn': { name: 'Holborn', zone: 1, modes: ['underground'] },
  'hyde park corner': { name: 'Hyde Park Corner', zone: 1, modes: ['underground'] },
  'kings cross st pancras': { name: "King's Cross St Pancras", zone: 1, modes: ['underground', 'national_rail'] },
  'knightsbridge': { name: 'Knightsbridge', zone: 1, modes: ['underground'] },
  'lambeth north': { name: 'Lambeth North', zone: 1, modes: ['underground'] },
  'lancaster gate': { name: 'Lancaster Gate', zone: 1, modes: ['underground'] },
  'leicester square': { name: 'Leicester Square', zone: 1, modes: ['underground'] },
  'liverpool street': { name: 'Liverpool Street', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'] },
  'london bridge': { name: 'London Bridge', zone: 1, modes: ['underground', 'national_rail'] },
  'marble arch': { name: 'Marble Arch', zone: 1, modes: ['underground'] },
  'monument': { name: 'Monument', zone: 1, modes: ['underground'] },
  'moorgate': { name: 'Moorgate', zone: 1, modes: ['underground', 'national_rail'] },
  'mornington crescent': { name: 'Mornington Crescent', zone: 2, modes: ['underground'] },
  'old street': { name: 'Old Street', zone: 1, modes: ['underground', 'national_rail'] },
  'oxford circus': { name: 'Oxford Circus', zone: 1, modes: ['underground'] },
  'paddington': { name: 'Paddington', zone: 1, modes: ['underground', 'national_rail', 'elizabeth'] },
  'piccadilly circus': { name: 'Piccadilly Circus', zone: 1, modes: ['underground'] },
  'pimlico': { name: 'Pimlico', zone: 1, modes: ['underground'] },
  'regent\'s park': { name: "Regent's Park", zone: 1, modes: ['underground'] },
  'russell square': { name: 'Russell Square', zone: 1, modes: ['underground'] },
  'st james\'s park': { name: "St James's Park", zone: 1, modes: ['underground'] },
  'st paul\'s': { name: "St Paul's", zone: 1, modes: ['underground'] },
  'temple': { name: 'Temple', zone: 1, modes: ['underground'] },
  'tottenham court road': { name: 'Tottenham Court Road', zone: 1, modes: ['underground', 'elizabeth'] },
  'tower hill': { name: 'Tower Hill', zone: 1, modes: ['underground'] },
  'victoria': { name: 'Victoria', zone: 1, modes: ['underground', 'national_rail'] },
  'warren street': { name: 'Warren Street', zone: 1, modes: ['underground'] },
  'waterloo': { name: 'Waterloo', zone: 1, modes: ['underground', 'national_rail'] },
  'westminster': { name: 'Westminster', zone: 1, modes: ['underground'] },

  // Zone 2
  'angel': { name: 'Angel', zone: 1, modes: ['underground'] },
  'archway': { name: 'Archway', zone: 2, altZone: 3, modes: ['underground'] },
  'barons court': { name: "Barons Court", zone: 2, modes: ['underground'] },
  'bayswater': { name: 'Bayswater', zone: 1, modes: ['underground'] },
  'bethnal green': { name: 'Bethnal Green', zone: 2, modes: ['underground'] },
  'bow road': { name: 'Bow Road', zone: 2, altZone: 3, modes: ['underground'] },
  'brixton': { name: 'Brixton', zone: 2, modes: ['underground'] },
  'bromley-by-bow': { name: 'Bromley-by-Bow', zone: 2, altZone: 3, modes: ['underground'] },
  'caledonian road': { name: 'Caledonian Road', zone: 2, modes: ['underground'] },
  'camden town': { name: 'Camden Town', zone: 2, modes: ['underground'] },
  'chalk farm': { name: 'Chalk Farm', zone: 2, modes: ['underground'] },
  'clapham junction': { name: 'Clapham Junction', zone: 2, modes: ['national_rail', 'overground'] },
  'earls court': { name: "Earl's Court", zone: 1, altZone: 2, modes: ['underground'] },
  'east putney': { name: 'East Putney', zone: 2, altZone: 3, modes: ['underground'] },
  'edgware road': { name: 'Edgware Road', zone: 1, modes: ['underground'] },
  'finsbury park': { name: 'Finsbury Park', zone: 2, modes: ['underground', 'national_rail'] },
  'fulham broadway': { name: 'Fulham Broadway', zone: 2, modes: ['underground'] },
  'gloucester road': { name: 'Gloucester Road', zone: 1, modes: ['underground'] },
  'goldhawk road': { name: 'Goldhawk Road', zone: 2, modes: ['underground'] },
  'hammersmith': { name: 'Hammersmith', zone: 2, modes: ['underground'] },
  'high street kensington': { name: 'High Street Kensington', zone: 1, modes: ['underground'] },
  'highbury & islington': { name: 'Highbury & Islington', zone: 2, modes: ['underground', 'overground'] },
  'holloway road': { name: 'Holloway Road', zone: 2, modes: ['underground'] },
  'hoxton': { name: 'Hoxton', zone: 1, altZone: 2, modes: ['overground'] },
  'kentish town': { name: 'Kentish Town', zone: 2, modes: ['underground', 'national_rail'] },
  'kilburn park': { name: 'Kilburn Park', zone: 2, modes: ['underground'] },
  'ladbroke grove': { name: 'Ladbroke Grove', zone: 2, modes: ['underground'] },
  'latimer road': { name: 'Latimer Road', zone: 2, modes: ['underground'] },
  'maida vale': { name: 'Maida Vale', zone: 2, modes: ['underground'] },
  'mile end': { name: 'Mile End', zone: 2, altZone: 3, modes: ['underground'] },
  'notting hill gate': { name: 'Notting Hill Gate', zone: 1, altZone: 2, modes: ['underground'] },
  'oval': { name: 'Oval', zone: 1, altZone: 2, modes: ['underground'] },
  'paddington (national rail)': { name: 'Paddington', zone: 1, modes: ['national_rail'] },
  'putney bridge': { name: 'Putney Bridge', zone: 2, modes: ['underground'] },
  'queenstown road battersea': { name: 'Queenstown Road Battersea', zone: 2, modes: ['national_rail'] },
  'royal oak': { name: 'Royal Oak', zone: 2, modes: ['underground'] },
  'shepherd\'s bush': { name: "Shepherd's Bush", zone: 2, modes: ['underground'] },
  'shepherd\'s bush market': { name: "Shepherd's Bush Market", zone: 2, modes: ['underground'] },
  'south kensington': { name: 'South Kensington', zone: 1, modes: ['underground'] },
  'stepney green': { name: 'Stepney Green', zone: 2, modes: ['underground'] },
  'stockwell': { name: 'Stockwell', zone: 1, altZone: 2, modes: ['underground'] },
  'tufnell park': { name: 'Tufnell Park', zone: 2, modes: ['underground'] },
  'turnpike lane': { name: 'Turnpike Lane', zone: 3, modes: ['underground'] },
  'vauxhall': { name: 'Vauxhall', zone: 1, altZone: 2, modes: ['underground', 'national_rail'] },
  'warwick avenue': { name: 'Warwick Avenue', zone: 2, modes: ['underground'] },
  'west brompton': { name: 'West Brompton', zone: 2, modes: ['underground', 'overground'] },
  'west kensington': { name: 'West Kensington', zone: 2, modes: ['underground'] },
  'whitechapel': { name: 'Whitechapel', zone: 2, modes: ['underground', 'overground', 'elizabeth'] },

  // Zone 3
  'acton town': { name: 'Acton Town', zone: 3, modes: ['underground'] },
  'balham': { name: 'Balham', zone: 3, modes: ['underground', 'national_rail'] },
  'barnes': { name: 'Barnes', zone: 3, modes: ['national_rail'] },
  'barnes bridge': { name: 'Barnes Bridge', zone: 3, modes: ['national_rail'] },
  'clapham common': { name: 'Clapham Common', zone: 2, modes: ['underground'] },
  'clapham north': { name: 'Clapham North', zone: 2, modes: ['underground'] },
  'clapham south': { name: 'Clapham South', zone: 2, altZone: 3, modes: ['underground'] },
  'east acton': { name: 'East Acton', zone: 2, altZone: 3, modes: ['underground'] },
  'ealing broadway': { name: 'Ealing Broadway', zone: 3, modes: ['underground', 'national_rail', 'elizabeth'] },
  'ealing common': { name: 'Ealing Common', zone: 3, modes: ['underground'] },
  'gunnersbury': { name: 'Gunnersbury', zone: 3, modes: ['underground', 'overground'] },
  'kew gardens': { name: 'Kew Gardens', zone: 3, altZone: 4, modes: ['underground', 'overground'] },
  'mortlake': { name: 'Mortlake', zone: 3, modes: ['national_rail'] },
  'north acton': { name: 'North Acton', zone: 2, altZone: 3, modes: ['underground'] },
  'putney': { name: 'Putney', zone: 2, altZone: 3, modes: ['national_rail'] },
  'ravensbourne': { name: 'Ravensbourne', zone: 4, modes: ['national_rail'] },
  'ravenscourt park': { name: 'Ravenscourt Park', zone: 2, modes: ['underground'] },
  'richmond': { name: 'Richmond', zone: 4, modes: ['underground', 'overground', 'national_rail'] },
  'south wimbledon': { name: 'South Wimbledon', zone: 3, altZone: 4, modes: ['underground'] },
  'stamford brook': { name: 'Stamford Brook', zone: 2, modes: ['underground'] },
  'tooting bec': { name: 'Tooting Bec', zone: 3, modes: ['underground'] },
  'tooting broadway': { name: 'Tooting Broadway', zone: 3, modes: ['underground'] },
  'turnham green': { name: 'Turnham Green', zone: 2, altZone: 3, modes: ['underground'] },
  'wandsworth town': { name: 'Wandsworth Town', zone: 2, altZone: 3, modes: ['national_rail'] },
  'wimbledon': { name: 'Wimbledon', zone: 3, modes: ['underground', 'national_rail'] },

  // Zone 4
  'brimsdown': { name: 'Brimsdown', zone: 5, modes: ['national_rail'] },
  'chiswick': { name: 'Chiswick', zone: 3, modes: ['national_rail'] },
  'hounslow east': { name: 'Hounslow East', zone: 4, modes: ['underground'] },
  'hounslow central': { name: 'Hounslow Central', zone: 4, modes: ['underground'] },
  'hounslow west': { name: 'Hounslow West', zone: 5, modes: ['underground'] },

  // Zone 5-6
  'heathrow terminals 2 & 3': { name: 'Heathrow Terminals 2 & 3', zone: 6, modes: ['underground', 'elizabeth'] },
  'heathrow terminal 4': { name: 'Heathrow Terminal 4', zone: 6, modes: ['underground'] },
  'heathrow terminal 5': { name: 'Heathrow Terminal 5', zone: 6, modes: ['underground', 'elizabeth'] },
};

// Normalize station name for lookup — strips brackets, mode indicators, platform info
function normalizeStationName(raw: string): string {
  return raw
    .replace(/\s*\[.*?\]\s*/g, '') // remove [National Rail], [London Underground], etc.
    .replace(/\s*\(platforms?\s*[\d\-]+\)\s*/gi, '') // remove (platforms 12-19)
    .replace(/\s*\(District,\s*Piccadilly lines?\)\s*/gi, '') // Hammersmith qualifier
    .trim()
    .toLowerCase();
}

// Look up a station's zone from its name as it appears in the CSV
export function getStationZone(rawName: string): number | null {
  const normalized = normalizeStationName(rawName);

  // Direct lookup
  if (STATIONS[normalized]) {
    return STATIONS[normalized].zone;
  }

  // Fuzzy match — check if any key is contained in the normalized name or vice versa
  for (const [key, info] of Object.entries(STATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return info.zone;
    }
  }

  return null;
}

// Get the best zone for fare calculation (use alt zone if cheaper for passenger)
export function getStationBestZone(rawName: string, otherZone: number): number | null {
  const normalized = normalizeStationName(rawName);

  let station: StationInfo | undefined;
  if (STATIONS[normalized]) {
    station = STATIONS[normalized];
  } else {
    for (const [key, info] of Object.entries(STATIONS)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        station = info;
        break;
      }
    }
  }

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
export type TransportMode = 'underground' | 'national_rail' | 'overground' | 'bus' | 'tram' | 'dlr' | 'elizabeth' | 'unknown';

export function detectTransportMode(journeyAction: string): TransportMode {
  const lower = journeyAction.toLowerCase();

  if (lower.includes('bus journey')) return 'bus';
  if (lower.includes('tram')) return 'tram';
  if (lower.includes('[national rail]')) return 'national_rail';
  if (lower.includes('[london overground]')) return 'overground';
  if (lower.includes('[dlr]')) return 'dlr';
  if (lower.includes('[elizabeth')) return 'elizabeth';
  if (lower.includes('[london underground]')) return 'underground';

  // If no explicit tag but station names are present, default to underground
  if (lower.includes(' to ')) return 'underground';

  return 'unknown';
}

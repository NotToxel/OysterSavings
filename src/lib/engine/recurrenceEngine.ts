// Recurrence Engine — recurring schedule builder + CSV pattern detection
import type { ClassifiedJourney } from './journeyClassifier';

export interface RecurrenceRule {
  id: string;
  name: string;
  originZone: number;
  destinationZone: number;
  mode: 'underground' | 'national_rail' | 'nr_tube' | 'bus';
  timePeriod: string;
  isReturn?: boolean;
  returnTimePeriod?: string;
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  intervalType: 'days' | 'weeks' | 'months' | 'years' | 'none';
  intervalValue: number;
  startDate: Date;
  endDate: Date;
  excludeDates?: string[]; // Array of YYYY-MM-DD strings
  // Advanced Mode: station-specific fields
  originStation?: string;       // NaPTAN ID
  destinationStation?: string;  // NaPTAN ID
  originStationName?: string;   // Display name
  destinationStationName?: string;
  exactFarePeak?: number;       // Cached API fare
  exactFareOffPeak?: number;
  isAdvancedMode?: boolean;
  routeDescription?: string;
}

export interface PlannedJourney {
  date: Date;
  dateStr: string;
  ruleId: string;
  ruleName: string;
  originZone: number;
  destinationZone: number;
  mode: 'underground' | 'national_rail' | 'nr_tube' | 'bus';
  timePeriod: string;
  // Advanced Mode fields
  exactFarePeak?: number;
  exactFareOffPeak?: number;
  isAdvancedMode?: boolean;
  originStationName?: string;
  destinationStationName?: string;
  routeDescription?: string;
}

// Generate concrete journey instances from recurrence rules
export function generatePlannedJourneys(rules: RecurrenceRule[]): PlannedJourney[] {
  const journeys: PlannedJourney[] = [];

  for (const rule of rules) {
    const current = new Date(rule.startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(rule.endDate);
    end.setHours(23, 59, 59, 999);

    const excludeSet = new Set(rule.excludeDates || []);

    let weekCount = 0;
    let lastWeek = -1;

    while (current <= end) {
      const dayOfWeek = current.getDay();

      // Track weeks for interval
      const weekNum = getWeekNumber(current);
      if (weekNum !== lastWeek) {
        if (lastWeek !== -1) weekCount++;
        lastWeek = weekNum;
      }

      // Track intervals based on type
      let shouldAdd = false;

      if (rule.intervalType === 'none') {
        // Only run on the exact start date (or end date if same)
        if (current.getTime() === new Date(rule.startDate).setHours(0,0,0,0)) {
          shouldAdd = true;
        }
      } else if (rule.intervalType === 'days') {
        const daysDiff = Math.floor((current.getTime() - new Date(rule.startDate).getTime()) / 86400000);
        if (daysDiff >= 0 && daysDiff % rule.intervalValue === 0) {
          shouldAdd = true;
        }
      } else if (rule.intervalType === 'weeks') {
        if (rule.daysOfWeek.includes(dayOfWeek)) {
          if (weekCount % rule.intervalValue === 0) {
            shouldAdd = true;
          }
        }
      } else if (rule.intervalType === 'months') {
        if (rule.daysOfWeek.includes(dayOfWeek)) {
          const monthDiff = (current.getFullYear() - new Date(rule.startDate).getFullYear()) * 12 + (current.getMonth() - new Date(rule.startDate).getMonth());
          if (monthDiff % rule.intervalValue === 0) {
            shouldAdd = true;
          }
        }
      } else if (rule.intervalType === 'years') {
        if (rule.daysOfWeek.includes(dayOfWeek)) {
          const yearDiff = current.getFullYear() - new Date(rule.startDate).getFullYear();
          if (yearDiff % rule.intervalValue === 0) {
            shouldAdd = true;
          }
        }
      }

      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      if (shouldAdd && !excludeSet.has(dateKey)) {
        journeys.push({
          date: new Date(current),
          dateStr: formatDate(current),
          ruleId: rule.id,
          ruleName: rule.name,
          originZone: rule.originZone,
          destinationZone: rule.destinationZone,
          mode: rule.mode,
          timePeriod: rule.timePeriod,
          // Advanced Mode fields
          ...(rule.isAdvancedMode && {
            isAdvancedMode: true,
            exactFarePeak: rule.exactFarePeak,
            exactFareOffPeak: rule.exactFareOffPeak,
            originStationName: rule.originStationName,
            destinationStationName: rule.destinationStationName,
            routeDescription: rule.routeDescription,
          }),
        });

        if (rule.isReturn && rule.returnTimePeriod) {
          journeys.push({
            date: new Date(current),
            dateStr: formatDate(current),
            ruleId: rule.id + '-return',
            ruleName: rule.name + ' (Return)',
            originZone: rule.destinationZone,
            destinationZone: rule.originZone,
            mode: rule.mode,
            timePeriod: rule.returnTimePeriod,
            // Advanced Mode: reverse direction fares are same
            ...(rule.isAdvancedMode && {
              isAdvancedMode: true,
              exactFarePeak: rule.exactFarePeak,
              exactFareOffPeak: rule.exactFareOffPeak,
              originStationName: rule.destinationStationName,
              destinationStationName: rule.originStationName,
              routeDescription: rule.routeDescription,
            }),
          });
        }
      }

      current.setDate(current.getDate() + 1);
    }
  }

  // Sort by date
  journeys.sort((a, b) => a.date.getTime() - b.date.getTime());
  return journeys;
}

// Helper to get time period from startTime string
function getTimePeriodFromTime(timeStr: string): string {
  if (!timeStr) return '09:31-15:59';
  const parts = timeStr.split(':');
  if (parts.length !== 2) return '09:31-15:59';
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return '09:31-15:59';
  const totalMins = hours * 60 + minutes;

  // 04:30 - 06:29
  if (totalMins >= 270 && totalMins < 390) return '04:30-06:29';
  // 06:30 - 09:30
  if (totalMins >= 390 && totalMins < 570) return '06:30-09:30';
  // 09:31 - 15:59
  if (totalMins >= 570 && totalMins < 960) return '09:31-15:59';
  // 16:00 - 19:00
  if (totalMins >= 960 && totalMins < 1140) return '16:00-19:00';
  // 19:01 - 04:29
  return '19:01-04:29';
}

// Detect recurring commute patterns from CSV data
export interface DetectedPattern {
  origin: string;
  destination: string;
  originZone: number;
  destinationZone: number;
  mode: string;
  timePeriod: string;
  daysOfWeek: number[];
  frequency: number; // times per week
  confidence: number; // 0-1 how strong the pattern is
}

export function detectCommutePatterns(journeys: ClassifiedJourney[]): DetectedPattern[] {
  // Group journeys by route (origin -> destination or bus route) and specific time period
  const routeMap = new Map<string, {
    journeys: ClassifiedJourney[];
    dayOccurrences: Map<number, number>;
  }>();

  for (const j of journeys) {
    let routeKey: string;
    let timePeriod: string;

    if (j.isBus) {
      timePeriod = getTimePeriodFromTime(j.raw.startTime);
      routeKey = `bus-${j.busRoute || 'any'}|${timePeriod}`;
    } else {
      if (!j.origin || !j.destination) continue;
      timePeriod = getTimePeriodFromTime(j.raw.startTime);
      routeKey = `${j.origin.toLowerCase()} to ${j.destination.toLowerCase()}|${timePeriod}`;
    }

    if (!routeMap.has(routeKey)) {
      routeMap.set(routeKey, {
        journeys: [],
        dayOccurrences: new Map(),
      });
    }

    const route = routeMap.get(routeKey)!;
    route.journeys.push(j);

    const day = j.dayOfWeek;
    route.dayOccurrences.set(day, (route.dayOccurrences.get(day) || 0) + 1);
  }

  const patterns: DetectedPattern[] = [];

  // Calculate total weeks in the dataset
  const dates = journeys.map((j) => j.raw.date.getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const totalWeeks = Math.max(1, (maxDate - minDate) / (7 * 24 * 60 * 60 * 1000));

  for (const [routeKey, data] of routeMap) {
    if (data.journeys.length < 4) continue;

    // Find days where this route occurs regularly
    const regularDays: number[] = [];
    for (const [day, count] of data.dayOccurrences) {
      const frequency = count / totalWeeks;
      if (frequency >= 0.3) {
        // occurs at least 30% of the weeks (accounts for holidays, sickness, schedule shifts, casual routines)
        regularDays.push(day);
      }
    }

    if (regularDays.length === 0) continue;

    const sample = data.journeys[0];
    const frequency = data.journeys.length / totalWeeks;
    // Penalize confidence if journeys don't map cleanly to regular days
    const confidence = Math.min(1, frequency / regularDays.length) * (regularDays.length / (data.dayOccurrences.size || 1));

    let origin: string;
    let destination: string;
    let originZone: number;
    let destinationZone: number;
    const timePeriod = routeKey.split('|')[1];

    if (sample.isBus) {
      origin = sample.busRoute ? `Bus Route ${sample.busRoute}` : 'Bus';
      destination = 'Bus';
      originZone = 1;
      destinationZone = 1;
    } else {
      origin = sample.origin || 'Unknown';
      destination = sample.destination || 'Unknown';
      originZone = sample.originZone || 1;
      destinationZone = sample.destinationZone || 1;
    }

    patterns.push({
      origin,
      destination,
      originZone,
      destinationZone,
      mode: sample.mode,
      timePeriod,
      daysOfWeek: regularDays.sort(),
      frequency: Math.round(frequency * 10) / 10,
      confidence,
    });
  }

  // Sort by confidence
  patterns.sort((a, b) => b.confidence - a.confidence);
  return patterns;
}

// Convert detected pattern to a recurrence rule
export function patternToRule(
  pattern: DetectedPattern,
  startDate: Date,
  endDate: Date
): RecurrenceRule {
  return {
    id: crypto.randomUUID(),
    name: `${pattern.origin} → ${pattern.destination}`,
    originZone: pattern.originZone,
    destinationZone: pattern.destinationZone,
    mode: pattern.mode as 'underground' | 'national_rail' | 'nr_tube' | 'bus',
    timePeriod: pattern.timePeriod,
    daysOfWeek: pattern.daysOfWeek,
    intervalType: 'weeks',
    intervalValue: 1,
    startDate,
    endDate,
  };
}

// Helper: get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Format date as DD-MMM-YYYY
function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getDate().toString().padStart(2, '0');
  return `${day}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

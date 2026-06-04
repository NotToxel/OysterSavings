// Recurrence Engine — recurring schedule builder + CSV pattern detection
import type { ClassifiedJourney } from './journeyClassifier';

export interface RecurrenceRule {
  id: string;
  name: string;
  originZone: number;
  destinationZone: number;
  mode: 'underground' | 'national_rail' | 'bus';
  isPeak: boolean;
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  intervalWeeks: number; // 1 = every week, 2 = every other week, etc.
  startDate: Date;
  endDate: Date;
}

export interface PlannedJourney {
  date: Date;
  dateStr: string;
  ruleId: string;
  ruleName: string;
  originZone: number;
  destinationZone: number;
  mode: 'underground' | 'national_rail' | 'bus';
  isPeak: boolean;
}

// Generate concrete journey instances from recurrence rules
export function generatePlannedJourneys(rules: RecurrenceRule[]): PlannedJourney[] {
  const journeys: PlannedJourney[] = [];

  for (const rule of rules) {
    const current = new Date(rule.startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(rule.endDate);
    end.setHours(23, 59, 59, 999);

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

      // Check if this day matches the rule
      if (rule.daysOfWeek.includes(dayOfWeek)) {
        // Check interval (every N weeks)
        if (weekCount % rule.intervalWeeks === 0) {
          journeys.push({
            date: new Date(current),
            dateStr: formatDate(current),
            ruleId: rule.id,
            ruleName: rule.name,
            originZone: rule.originZone,
            destinationZone: rule.destinationZone,
            mode: rule.mode,
            isPeak: rule.isPeak,
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

// Detect recurring commute patterns from CSV data
export interface DetectedPattern {
  origin: string;
  destination: string;
  originZone: number;
  destinationZone: number;
  mode: string;
  isPeak: boolean;
  daysOfWeek: number[];
  frequency: number; // times per week
  confidence: number; // 0-1 how strong the pattern is
}

export function detectCommutePatterns(journeys: ClassifiedJourney[]): DetectedPattern[] {
  // Group journeys by route (origin -> destination)
  const routeMap = new Map<string, {
    journeys: ClassifiedJourney[];
    dayOccurrences: Map<number, number>;
  }>();

  for (const j of journeys) {
    if (j.isBus || !j.origin || !j.destination) continue;

    const routeKey = `${j.originZone}-${j.destinationZone}|${j.isPeak}`;

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

  for (const [, data] of routeMap) {
    if (data.journeys.length < 2) continue;

    // Find days where this route occurs regularly
    const regularDays: number[] = [];
    for (const [day, count] of data.dayOccurrences) {
      const frequency = count / totalWeeks;
      if (frequency >= 0.3) {
        // occurs at least 30% of the weeks
        regularDays.push(day);
      }
    }

    if (regularDays.length === 0) continue;

    const sample = data.journeys[0];
    const frequency = data.journeys.length / totalWeeks;
    const confidence = Math.min(1, frequency / regularDays.length);

    patterns.push({
      origin: sample.origin || 'Unknown',
      destination: sample.destination || 'Unknown',
      originZone: sample.originZone || 1,
      destinationZone: sample.destinationZone || 1,
      mode: sample.mode,
      isPeak: sample.isPeak,
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
    mode: pattern.mode as 'underground' | 'national_rail' | 'bus',
    isPeak: pattern.isPeak,
    daysOfWeek: pattern.daysOfWeek,
    intervalWeeks: 1,
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

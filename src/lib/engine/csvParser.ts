// CSV Parser — uses PapaParse for client-side CSV processing
import Papa from 'papaparse';

export interface RawJourneyRow {
  Date: string;
  'Start Time': string;
  'End Time': string;
  'Journey/Action': string;
  Charge: string;
  Credit: string;
  Balance: string;
  Note: string;
}

export interface ParsedJourney {
  date: Date;
  dateStr: string;
  startTime: string;
  endTime: string;
  journeyAction: string;
  charge: number;
  credit: number;
  balance: number;
  note: string;
  rawIndex: number;
}

export interface ParseResult {
  journeys: ParsedJourney[];
  errors: string[];
  totalRows: number;
}

// Parse DD-MMM-YYYY format (e.g., "11-May-2025")
function parseTflDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = months[parts[1]];
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || month === undefined || isNaN(year)) return null;

  return new Date(year, month, day);
}

// Parse a charge/credit string like "2.45" or ".00" or "" to a number
function parseAmount(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.replace(/[£,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseCSV(csvContent: string): ParseResult {
  const errors: string[] = [];

  // PapaParse config
  const result = Papa.parse<RawJourneyRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    result.errors.forEach((e) => {
      errors.push(`Row ${e.row}: ${e.message}`);
    });
  }

  const journeys: ParsedJourney[] = [];

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];

    // Skip completely empty rows
    if (!row['Journey/Action'] && !row.Date) continue;

    const date = parseTflDate(row.Date);
    if (!date) {
      errors.push(`Row ${i + 1}: Invalid date "${row.Date}"`);
      continue;
    }

    journeys.push({
      date,
      dateStr: row.Date,
      startTime: (row['Start Time'] || '').trim(),
      endTime: (row['End Time'] || '').trim(),
      journeyAction: (row['Journey/Action'] || '').trim(),
      charge: parseAmount(row.Charge),
      credit: parseAmount(row.Credit),
      balance: parseAmount(row.Balance),
      note: (row.Note || '').trim(),
      rawIndex: i + 1,
    });
  }

  return {
    journeys,
    errors,
    totalRows: result.data.length,
  };
}

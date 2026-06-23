import { get } from 'svelte/store';
import { parseCSV } from '../engine/csvParser';
import { filterJourneys } from '../engine/journeyFilter';
import { classifyAll } from '../engine/journeyClassifier';
import { calculateAllFares } from '../engine/fareCalculator';
import { calculateDailyCaps, calculateWeeklyCaps, getCapSummary } from '../engine/capEngine';
import { detectCommutePatterns } from '../engine/recurrenceEngine';
import { detectActiveDiscount } from '../engine/savingsEngine';
import {
  addCard, cards, currentPage
} from '../stores/stores';
import { generateCardId, generateCardName, CARD_COLORS } from '../stores/cardTypes';
import type { CardState } from '../stores/cardTypes';


interface SimJourney {
  startTime: string;
  endTime: string;
  journeyAction: string;
  baseCharge: number;
  isBus: boolean;
  zones: number[];
  note: string;
}

/**
 * Sequential capping and Hopper fare daily processing helper.
 */
function processDayJourneys(
  dateStr: string,
  journeys: SimJourney[],
  currentBalance: { val: number },
  rows: string[]
) {
  // Sort journeys by startTime to be absolutely sure they are chronological
  const sorted = [...journeys].sort((a, b) => a.startTime.localeCompare(b.startTime));
  
  // 1. Determine the daily cap for this day
  const touchedZones = new Set<number>();
  let hasRail = false;
  
  for (const j of sorted) {
    if (!j.isBus) {
      hasRail = true;
      for (const z of j.zones) {
        touchedZones.add(z);
      }
    }
  }
  
  let dailyCap = 5.25; // Bus daily cap is the default
  let zoneRangeStr = '';
  
  if (hasRail) {
    const zonesArray = Array.from(touchedZones);
    const minZone = zonesArray.length > 0 ? Math.min(...zonesArray) : 1;
    const maxZone = zonesArray.length > 0 ? Math.max(...zonesArray) : 2;
    zoneRangeStr = minZone === maxZone ? `Z${minZone}` : `Z${minZone}-${maxZone}`;
    
    // Daily cap values
    const LOCAL_DAILY_CAPS: Record<string, number> = {
      'Z1-2': 8.90, 'Z1-3': 10.50, 'Z1-4': 12.80, 'Z1-5': 15.30, 'Z1-6': 16.30,
      'Z2-3': 10.50, 'Z2-4': 12.80, 'Z2-5': 15.30, 'Z2-6': 16.30,
      'Z3': 10.50, 'Z3-4': 12.80, 'Z3-5': 15.30, 'Z3-6': 16.30,
      'Z4': 12.80, 'Z4-5': 15.30, 'Z4-6': 16.30,
      'Z5': 15.30, 'Z5-6': 16.30, 'Z6': 16.30
    };
    dailyCap = LOCAL_DAILY_CAPS[zoneRangeStr] ?? 16.30;
  }
  
  // 2. Process Hopper Fares and capping chronologically
  let accumulatedSpend = 0;
  let lastChargedBusTime: Date | null = null;
  
  const parseTimeToDate = (timeStr: string): Date => {
    const [h, m] = timeStr.split(':').map(Number);
    return new Date(2000, 0, 1, h, m, 0);
  };
  
  for (const j of sorted) {
    let charge = j.baseCharge;
    let note = j.note;
    
    if (j.isBus) {
      const journeyTime = parseTimeToDate(j.startTime);
      if (lastChargedBusTime && (journeyTime.getTime() - lastChargedBusTime.getTime()) <= 60 * 60 * 1000) {
        // Hopper fare! Free connection
        charge = 0.00;
        note = "continuation of your previous journey";
      } else {
        // Charged bus journey
        lastChargedBusTime = journeyTime;
      }
    }
    
    // Check if this journey would exceed the daily cap
    if (accumulatedSpend >= dailyCap) {
      charge = 0.00;
      note = "Cheaper or free today";
    } else if (accumulatedSpend + charge > dailyCap) {
      charge = Math.round((dailyCap - accumulatedSpend) * 100) / 100;
      accumulatedSpend = dailyCap;
      note = "Cheaper or free today";
    } else {
      accumulatedSpend = Math.round((accumulatedSpend + charge) * 100) / 100;
    }
    
    currentBalance.val -= charge;
    
    // Add row to CSV (wrapped in quotes for actions)
    rows.push(`${dateStr},${j.startTime},${j.endTime || ''},"${j.journeyAction}",${charge.toFixed(2)},,${currentBalance.val.toFixed(2)},${note}`);
  }
}

/**
 * Generates a realistic London travel history CSV (PapaParse readable)
 * representing 3 months (13 weeks / 91 days) of travel up to the current date.
 */
export function generateDemoCSV(profileId: string = 'sarah'): string {
  const today = new Date();
  
  // Start Monday of 12 weeks ago to get exactly 13 full weeks
  const currentDayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const daysToSubtract = (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1) + 84;
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - daysToSubtract);
  startDay.setHours(12, 0, 0, 0); // avoid DST shift issues
  
  const rows: string[] = ["Date,Start Time,End Time,Journey/Action,Charge,Credit,Balance,Note"];
  
  // Helper to format date as DD-MMM-YYYY
  const formatTflDate = (d: Date): string => {
    const dayStr = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthStr = months[d.getMonth()];
    const yearStr = d.getFullYear();
    return `${dayStr}-${monthStr}-${yearStr}`;
  };

  const currentBalance = { val: 20.00 };

  // Generate 91 days (13 full weeks)
  for (let i = 0; i < 91; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    const dayVal = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const dateStr = formatTflDate(d);
    const weekNum = Math.floor(i / 7);
    
    // Add top-ups dynamically to keep balance positive
    if (i === 0) {
      currentBalance.val += 20.00;
      rows.push(`${dateStr},07:30,,"Topped up, £20.00",,20.00,${currentBalance.val.toFixed(2)},`);
    } else if (currentBalance.val < 10.00) {
      currentBalance.val += 20.00;
      rows.push(`${dateStr},07:30,,"Auto top-up, £20.00",,20.00,${currentBalance.val.toFixed(2)},`);
    }
    
    if (profileId === 'sarah') {
      const dayJourneys: SimJourney[] = [];
      
      // Annual leave week (Week 11)
      if (weekNum === 11) {
        if (dayVal === 0) {
          dayJourneys.push({ startTime: "14:00", endTime: "14:20", journeyAction: "Bus journey, route 93", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }
      // Sick week (Week 4)
      else if (weekNum === 4) {
        if (dayVal === 3) {
          dayJourneys.push({ startTime: "12:10", endTime: "12:25", journeyAction: "Bus journey, route 93", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        } else if (dayVal === 6) {
          dayJourneys.push({ startTime: "15:00", endTime: "15:20", journeyAction: "Bus journey, route 93", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }
      // Bank Holiday week (Week 7)
      else if (weekNum === 7) {
        if (dayVal === 1) { // Bank Holiday Monday - leisure trip to Greenwich
          dayJourneys.push({ startTime: "11:00", endTime: "11:45", journeyAction: "Wimbledon to Cutty Sark [DLR]", baseCharge: 2.30, isBus: false, zones: [2, 3], note: "" });
          dayJourneys.push({ startTime: "17:00", endTime: "17:45", journeyAction: "Cutty Sark [DLR] to Wimbledon", baseCharge: 2.30, isBus: false, zones: [2, 3], note: "" });
        } else if (dayVal === 2 || dayVal === 4) { // regular office days (only Tue/Thu this week)
          dayJourneys.push({ startTime: "08:15", endTime: "08:48", journeyAction: "Wimbledon to Bank", baseCharge: 3.90, isBus: false, zones: [1, 3], note: "" });
          dayJourneys.push({ startTime: "17:45", endTime: "18:18", journeyAction: "Bank to Wimbledon", baseCharge: 3.90, isBus: false, zones: [1, 3], note: "" });
        } else if (dayVal === 3) { // WFH Wed
          dayJourneys.push({ startTime: "12:10", endTime: "12:25", journeyAction: "Bus journey, route 93", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "12:45", endTime: "12:58", journeyAction: "Bus journey, route 164", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "16:30", endTime: "16:50", journeyAction: "Bus journey, route 93", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        } else if (dayVal === 5) { // Friday
          dayJourneys.push({ startTime: "08:15", endTime: "08:48", journeyAction: "Wimbledon to Bank", baseCharge: 3.90, isBus: false, zones: [1, 3], note: "" });
          dayJourneys.push({ startTime: "22:30", endTime: "23:05", journeyAction: "Leicester Square to Wimbledon", baseCharge: 3.30, isBus: false, zones: [1, 3], note: "" });
        }
      }
      // Regular weeks
      else {
        // Commute Mon, Tue, Thu
        if (dayVal === 1 || dayVal === 2 || dayVal === 4) {
          dayJourneys.push({ startTime: "08:15", endTime: "08:48", journeyAction: "Wimbledon to Bank", baseCharge: 3.90, isBus: false, zones: [1, 3], note: "" });
          
          if (weekNum === 1 && dayVal === 4) { // Week 1 Thursday special evening
            dayJourneys.push({ startTime: "17:15", endTime: "17:48", journeyAction: "Wimbledon to Waterloo", baseCharge: 3.30, isBus: false, zones: [1, 3], note: "" });
            dayJourneys.push({ startTime: "22:30", endTime: "23:03", journeyAction: "Waterloo to Wimbledon", baseCharge: 3.30, isBus: false, zones: [1, 3], note: "" });
          } else {
            dayJourneys.push({ startTime: "17:45", endTime: "18:18", journeyAction: "Bank to Wimbledon", baseCharge: 3.90, isBus: false, zones: [1, 3], note: "" });
          }
        }
        // WFH Wednesday
        else if (dayVal === 3) {
          if (weekNum === 2) { // Week 2 Wed: Daily Cap Hit Day!
            dayJourneys.push({ startTime: "09:15", endTime: "09:48", journeyAction: "Wimbledon to Bank", baseCharge: 3.90, isBus: false, zones: [1, 3], note: "" });
            dayJourneys.push({ startTime: "11:30", endTime: "11:45", journeyAction: "Bank to Euston", baseCharge: 3.00, isBus: false, zones: [1], note: "" });
            dayJourneys.push({ startTime: "13:15", endTime: "13:40", journeyAction: "Euston to Richmond", baseCharge: 3.60, isBus: false, zones: [1, 4], note: "" });
            dayJourneys.push({ startTime: "15:30", endTime: "15:58", journeyAction: "Richmond to Wimbledon", baseCharge: 2.30, isBus: false, zones: [3, 4], note: "" });
            dayJourneys.push({ startTime: "18:00", endTime: "18:15", journeyAction: "Bus journey, route 93", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          } else {
            dayJourneys.push({ startTime: "12:10", endTime: "12:25", journeyAction: "Bus journey, route 93", baseCharge: 1.75, isBus: true, zones: [], note: "" });
            dayJourneys.push({ startTime: "12:45", endTime: "12:58", journeyAction: "Bus journey, route 164", baseCharge: 1.75, isBus: true, zones: [], note: "" });
            dayJourneys.push({ startTime: "16:30", endTime: "16:50", journeyAction: "Bus journey, route 93", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          }
        }
        // Friday
        else if (dayVal === 5) {
          if (weekNum === 9) { // Week 9 Friday: Incomplete
            dayJourneys.push({ startTime: "08:15", endTime: "08:48", journeyAction: "Wimbledon to Bank", baseCharge: 3.90, isBus: false, zones: [1, 3], note: "" });
            currentBalance.val -= 9.40;
            rows.push(`${dateStr},17:45,,Bank to [No touch-out],9.40,,${currentBalance.val.toFixed(2)},`);
          } else {
            dayJourneys.push({ startTime: "08:15", endTime: "08:48", journeyAction: "Wimbledon to Bank", baseCharge: 3.90, isBus: false, zones: [1, 3], note: "" });
            dayJourneys.push({ startTime: "22:30", endTime: "23:05", journeyAction: "Leicester Square to Wimbledon", baseCharge: 3.30, isBus: false, zones: [1, 3], note: "" });
          }
        }
        // Saturday
        else if (dayVal === 6) {
          if (weekNum === 9) { // refund on Saturday
            currentBalance.val += 9.40;
            rows.push(`${dateStr},10:00,,"TfL customer service refund",,9.40,${currentBalance.val.toFixed(2)},Goodwill gesture`);
          }
          dayJourneys.push({ startTime: "11:45", endTime: "12:20", journeyAction: "Wimbledon to Covent Garden", baseCharge: 3.30, isBus: false, zones: [1, 3], note: "" });
          dayJourneys.push({ startTime: "19:15", endTime: "19:50", journeyAction: "Covent Garden to Wimbledon", baseCharge: 3.30, isBus: false, zones: [1, 3], note: "" });
        }
        // Sunday
        else if (dayVal === 0) {
          dayJourneys.push({ startTime: "14:00", endTime: "14:20", journeyAction: "Bus journey, route 93", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }
      
      processDayJourneys(dateStr, dayJourneys, currentBalance, rows);
    }
    else if (profileId === 'james') {
      const dayJourneys: SimJourney[] = [];

      // Annual leave week (Week 12)
      if (weekNum === 12) {
        if (dayVal === 6) { // Saturday shopping
          dayJourneys.push({ startTime: "12:00", endTime: "12:20", journeyAction: "Finsbury Park to Oxford Circus", baseCharge: 3.10, isBus: false, zones: [1, 2], note: "" });
          dayJourneys.push({ startTime: "17:00", endTime: "17:20", journeyAction: "Oxford Circus to Finsbury Park", baseCharge: 3.10, isBus: false, zones: [1, 2], note: "" });
        }
      }
      // Sick week (Week 5)
      else if (weekNum === 5) {
        if (dayVal === 5) { // local bus GP
          dayJourneys.push({ startTime: "11:00", endTime: "11:15", journeyAction: "Bus journey, route 29", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "12:00", endTime: "12:15", journeyAction: "Bus journey, route 29", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }
      // Bank Holiday week (Week 8)
      else if (weekNum === 8) {
        if (dayVal === 1) { // Bank Holiday Monday - leisure trip to Battersea Power Station
          dayJourneys.push({ startTime: "11:00", endTime: "11:30", journeyAction: "Finsbury Park to Battersea Power Station", baseCharge: 3.10, isBus: false, zones: [1, 2], note: "" });
          dayJourneys.push({ startTime: "16:00", endTime: "16:30", journeyAction: "Battersea Power Station to Finsbury Park", baseCharge: 3.10, isBus: false, zones: [1, 2], note: "" });
        } else if (dayVal >= 2 && dayVal <= 5) { // Tube commute Tue-Fri
          dayJourneys.push({ startTime: "08:30", endTime: "08:55", journeyAction: "Finsbury Park to Oxford Circus", baseCharge: 3.60, isBus: false, zones: [1, 2], note: "" });
          dayJourneys.push({ startTime: "17:30", endTime: "17:55", journeyAction: "Oxford Circus to Finsbury Park", baseCharge: 3.60, isBus: false, zones: [1, 2], note: "" });
        }
      }
      // Regular weeks
      else {
        // Mon-Fri: Tube Commute
        if (dayVal >= 1 && dayVal <= 5) {
          // WFH variation on Wed of Week 2
          if (weekNum === 2 && dayVal === 3) {
            dayJourneys.push({ startTime: "12:30", endTime: "12:45", journeyAction: "Bus journey, route 29", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          } else {
            dayJourneys.push({ startTime: "08:30", endTime: "08:55", journeyAction: "Finsbury Park to Oxford Circus", baseCharge: 3.60, isBus: false, zones: [1, 2], note: "" });
            
            if (dayVal === 4) { // Thursday Overground hop
              dayJourneys.push({ startTime: "17:30", endTime: "17:55", journeyAction: "Oxford Circus to Highbury & Islington", baseCharge: 3.60, isBus: false, zones: [1, 2], note: "" });
              dayJourneys.push({ startTime: "18:30", endTime: "18:42", journeyAction: "Highbury & Islington to Hackney Central [London Overground]", baseCharge: 2.20, isBus: false, zones: [2], note: "" });
              dayJourneys.push({ startTime: "21:30", endTime: "21:42", journeyAction: "Hackney Central [London Overground] to Finsbury Park", baseCharge: 2.20, isBus: false, zones: [2], note: "" });
            } else if (dayVal === 2) { // Tuesday lunch bus
              dayJourneys.push({ startTime: "12:30", endTime: "12:45", journeyAction: "Bus journey, route 73", baseCharge: 1.75, isBus: true, zones: [], note: "" });
              dayJourneys.push({ startTime: "17:30", endTime: "17:55", journeyAction: "Oxford Circus to Finsbury Park", baseCharge: 3.60, isBus: false, zones: [1, 2], note: "" });
            } else if (dayVal === 5 && weekNum === 9) { // Week 9 Friday: Penalty
              currentBalance.val -= 9.40;
              rows.push(`${dateStr},17:30,,Oxford Circus to [No touch-out],9.40,,${currentBalance.val.toFixed(2)},`);
            } else {
              dayJourneys.push({ startTime: "17:30", endTime: "17:55", journeyAction: "Oxford Circus to Finsbury Park", baseCharge: 3.60, isBus: false, zones: [1, 2], note: "" });
            }
          }
        }
        // Saturday: Central hops hitting daily cap of £8.90
        else if (dayVal === 6) {
          if (weekNum === 9) { // refund
            currentBalance.val += 9.40;
            rows.push(`${dateStr},10:00,,"TfL customer service refund",,9.40,${currentBalance.val.toFixed(2)},Goodwill gesture`);
          }
          dayJourneys.push({ startTime: "11:00", endTime: "11:20", journeyAction: "Finsbury Park to Leicester Square", baseCharge: 3.10, isBus: false, zones: [1, 2], note: "" });
          dayJourneys.push({ startTime: "14:00", endTime: "14:12", journeyAction: "Leicester Square to London Bridge", baseCharge: 3.00, isBus: false, zones: [1], note: "" });
          dayJourneys.push({ startTime: "17:00", endTime: "17:20", journeyAction: "London Bridge to Finsbury Park", baseCharge: 3.10, isBus: false, zones: [1, 2], note: "" });
          dayJourneys.push({ startTime: "20:00", endTime: "20:10", journeyAction: "Highbury & Islington to Finsbury Park", baseCharge: 2.20, isBus: false, zones: [2], note: "" });
        }
        // Sunday: Camden Town local trip
        else if (dayVal === 0) {
          dayJourneys.push({ startTime: "15:00", endTime: "15:15", journeyAction: "Finsbury Park to Camden Town", baseCharge: 2.20, isBus: false, zones: [2], note: "" });
          dayJourneys.push({ startTime: "18:00", endTime: "18:15", journeyAction: "Camden Town to Finsbury Park", baseCharge: 2.20, isBus: false, zones: [2], note: "" });
        }
      }

      processDayJourneys(dateStr, dayJourneys, currentBalance, rows);
    }
    else if (profileId === 'chloe') {
      const dayJourneys: SimJourney[] = [];

      // Annual leave week (Week 6)
      if (weekNum === 6) {
        if (dayVal === 0) { // return Sunday bus ride
          dayJourneys.push({ startTime: "18:30", endTime: "18:45", journeyAction: "Bus journey, route K3", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }
      // Sick week (Week 9)
      else if (weekNum === 9) {
        if (dayVal === 2) {
          dayJourneys.push({ startTime: "14:00", endTime: "14:15", journeyAction: "Bus journey, route K3", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }
      // Bank Holiday week (Week 11)
      else if (weekNum === 11) {
        if (dayVal === 1) { // Bank Holiday Monday - leisure Waterloo
          dayJourneys.push({ startTime: "10:30", endTime: "10:55", journeyAction: "Surbiton [National Rail] to Waterloo [National Rail]", baseCharge: 5.20, isBus: false, zones: [1, 6], note: "" });
          dayJourneys.push({ startTime: "18:00", endTime: "18:25", journeyAction: "Waterloo [National Rail] to Surbiton [National Rail]", baseCharge: 5.20, isBus: false, zones: [1, 6], note: "" });
        } else if (dayVal >= 2 && dayVal <= 4) { // Tue-Thu commute
          dayJourneys.push({ startTime: "07:20", endTime: "07:30", journeyAction: "Bus journey, route 465", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "07:35", endTime: "07:42", journeyAction: "Bus journey, route K3", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "08:00", endTime: "08:25", journeyAction: "Surbiton [National Rail] to Waterloo [National Rail]", baseCharge: 8.50, isBus: false, zones: [1, 6], note: "" });
          dayJourneys.push({ startTime: "17:45", endTime: "18:10", journeyAction: "Waterloo [National Rail] to Surbiton [National Rail]", baseCharge: 8.50, isBus: false, zones: [1, 6], note: "" });
          dayJourneys.push({ startTime: "18:30", endTime: "18:40", journeyAction: "Bus journey, route K3", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "18:50", endTime: "19:00", journeyAction: "Bus journey, route 465", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }
      // Regular weeks
      else {
        // Mon-Thu: commute
        if (dayVal >= 1 && dayVal <= 4) {
          dayJourneys.push({ startTime: "07:20", endTime: "07:30", journeyAction: "Bus journey, route 465", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "07:35", endTime: "07:42", journeyAction: "Bus journey, route K3", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          
          if (weekNum === 3 && dayVal === 3) { // Week 3 Wednesday: travel to Vauxhall instead
            dayJourneys.push({ startTime: "08:00", endTime: "08:20", journeyAction: "Surbiton [National Rail] to Vauxhall [National Rail]", baseCharge: 5.20, isBus: false, zones: [2, 6], note: "" });
            dayJourneys.push({ startTime: "17:45", endTime: "18:05", journeyAction: "Vauxhall [National Rail] to Surbiton [National Rail]", baseCharge: 5.20, isBus: false, zones: [2, 6], note: "" });
          } else {
            dayJourneys.push({ startTime: "08:00", endTime: "08:25", journeyAction: "Surbiton [National Rail] to Waterloo [National Rail]", baseCharge: 8.50, isBus: false, zones: [1, 6], note: "" });
            dayJourneys.push({ startTime: "17:45", endTime: "18:10", journeyAction: "Waterloo [National Rail] to Surbiton [National Rail]", baseCharge: 8.50, isBus: false, zones: [1, 6], note: "" });
          }
          
          dayJourneys.push({ startTime: "18:30", endTime: "18:40", journeyAction: "Bus journey, route K3", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "18:50", endTime: "19:00", journeyAction: "Bus journey, route 465", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
        // Friday: WFH local rail
        else if (dayVal === 5) {
          dayJourneys.push({ startTime: "12:00", endTime: "12:12", journeyAction: "Surbiton [National Rail] to Kingston [National Rail]", baseCharge: 2.70, isBus: false, zones: [6], note: "" });
          dayJourneys.push({ startTime: "15:00", endTime: "15:12", journeyAction: "Kingston [National Rail] to Surbiton [National Rail]", baseCharge: 2.70, isBus: false, zones: [6], note: "" });
        }
        // Saturday: Waterloo central trip
        else if (dayVal === 6) {
          dayJourneys.push({ startTime: "10:30", endTime: "10:55", journeyAction: "Surbiton [National Rail] to Waterloo [National Rail]", baseCharge: 5.20, isBus: false, zones: [1, 6], note: "" });
          dayJourneys.push({ startTime: "18:00", endTime: "18:25", journeyAction: "Waterloo [National Rail] to Surbiton [National Rail]", baseCharge: 5.20, isBus: false, zones: [1, 6], note: "" });
        }
      }

      processDayJourneys(dateStr, dayJourneys, currentBalance, rows);
    }
    else if (profileId === 'marcus') {
      const dayJourneys: SimJourney[] = [];

      // Annual leave week (Week 7)
      if (weekNum === 7) {
        if (dayVal === 0) {
          dayJourneys.push({ startTime: "19:00", endTime: "19:15", journeyAction: "Bus journey, route 343", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }
      // Sick week (Week 4)
      else if (weekNum === 4) {
        if (dayVal === 4) { // Thursday GP GP GP
          dayJourneys.push({ startTime: "11:00", endTime: "11:15", journeyAction: "Bus journey, route 343", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "12:00", endTime: "12:15", journeyAction: "Bus journey, route 343", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }
      // Regular and variation weeks
      else {
        const isOvertimeMon = weekNum === 12 && dayVal === 1;
        const isSickFri = weekNum === 10 && dayVal === 5;
        
        // Hospitality shift days (Wed-Sun)
        if (isOvertimeMon || (dayVal === 3 || dayVal === 4 || dayVal === 5 || dayVal === 6 || dayVal === 0) && !isSickFri) {
          // Outbound
          dayJourneys.push({ startTime: "11:00", endTime: "11:20", journeyAction: "Bus journey, route 343", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "11:30", endTime: "11:45", journeyAction: "Bus journey, route 12", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          
          // Friday/Saturday Cap Hit variation
          if (dayVal === 5 || dayVal === 6) {
            dayJourneys.push({ startTime: "14:00", endTime: "14:20", journeyAction: "Bus journey, route 12", baseCharge: 1.75, isBus: true, zones: [], note: "" });
            dayJourneys.push({ startTime: "14:40", endTime: "14:55", journeyAction: "Bus journey, route 148", baseCharge: 1.75, isBus: true, zones: [], note: "" });
            dayJourneys.push({ startTime: "16:30", endTime: "16:50", journeyAction: "Bus journey, route 148", baseCharge: 1.75, isBus: true, zones: [], note: "" });
            dayJourneys.push({ startTime: "18:00", endTime: "18:15", journeyAction: "Bus journey, route 12", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          }
          
          // Return
          dayJourneys.push({ startTime: "23:00", endTime: "23:20", journeyAction: "Bus journey, route 12", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "23:35", endTime: "23:50", journeyAction: "Bus journey, route 343", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
        // Thursday: Overground trip to Canada Water
        else if (dayVal === 4) {
          dayJourneys.push({ startTime: "14:00", endTime: "14:15", journeyAction: "Peckham Rye to Canada Water", baseCharge: 2.20, isBus: false, zones: [2], note: "" });
          dayJourneys.push({ startTime: "18:00", endTime: "18:15", journeyAction: "Canada Water to Peckham Rye", baseCharge: 2.20, isBus: false, zones: [2], note: "" });
        }
        // Monday local shopping
        else if (dayVal === 1) {
          dayJourneys.push({ startTime: "15:00", endTime: "15:15", journeyAction: "Bus journey, route 343", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }

      processDayJourneys(dateStr, dayJourneys, currentBalance, rows);
    }
    else if (profileId === 'amir') {
      const dayJourneys: SimJourney[] = [];

      // Annual leave week (Week 5)
      if (weekNum === 5) {
        // No travel
      }
      // Sick week (Week 9)
      else if (weekNum === 9) {
        if (dayVal === 6) { // local shopping chemist
          dayJourneys.push({ startTime: "11:00", endTime: "11:15", journeyAction: "Bus journey, route 371", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }
      // Regular and variation weeks
      else {
        const isBankHolidayMon = weekNum === 12 && dayVal === 1;
        const isOfficeTue = weekNum === 12 && dayVal === 2;
        
        // Commute days (Mon/Wed, or Tue/Wed on Bank Holiday week)
        if (isOfficeTue || (dayVal === 1 || dayVal === 3) && !isBankHolidayMon) {
          dayJourneys.push({ startTime: "08:15", endTime: "08:50", journeyAction: "Richmond [National Rail] to Bank [London Underground]", baseCharge: 7.30, isBus: false, zones: [1, 4], note: "" });
          dayJourneys.push({ startTime: "17:30", endTime: "18:05", journeyAction: "Bank [London Underground] to Richmond [National Rail]", baseCharge: 7.30, isBus: false, zones: [1, 4], note: "" });
        }
        // Friday Canary Wharf or Heathrow Airport
        else if (dayVal === 5) {
          if (weekNum === 3) { // Heathrow trip
            dayJourneys.push({ startTime: "13:00", endTime: "13:40", journeyAction: "Richmond to Heathrow Terminals 2 & 3", baseCharge: 2.30, isBus: false, zones: [4, 6], note: "" });
            dayJourneys.push({ startTime: "21:00", endTime: "21:40", journeyAction: "Heathrow Terminals 2 & 3 to Richmond", baseCharge: 2.30, isBus: false, zones: [4, 6], note: "" });
          } else { // Canary Wharf
            dayJourneys.push({ startTime: "10:00", endTime: "10:45", journeyAction: "Richmond to Canary Wharf", baseCharge: 3.60, isBus: false, zones: [1, 4], note: "" });
            dayJourneys.push({ startTime: "16:30", endTime: "17:15", journeyAction: "Canary Wharf to Richmond", baseCharge: 3.60, isBus: false, zones: [1, 4], note: "" });
          }
        }
        // Saturday local bus
        else if (dayVal === 6) {
          dayJourneys.push({ startTime: "11:00", endTime: "11:15", journeyAction: "Bus journey, route 371", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "11:30", endTime: "11:45", journeyAction: "Bus journey, route 65", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "15:00", endTime: "15:15", journeyAction: "Bus journey, route 65", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }

      processDayJourneys(dateStr, dayJourneys, currentBalance, rows);
    }
    else if (profileId === 'alex_oyster') {
      const dayJourneys: SimJourney[] = [];
      
      // Sick week (Week 4)
      if (weekNum === 4) {
        if (dayVal === 6) {
          dayJourneys.push({ startTime: "11:30", endTime: "11:50", journeyAction: "Battersea Power Station to Westminster", baseCharge: 1.80, isBus: false, zones: [1], note: "" });
          dayJourneys.push({ startTime: "16:30", endTime: "16:50", journeyAction: "Westminster to Battersea Power Station", baseCharge: 1.80, isBus: false, zones: [1], note: "" });
        }
      }
      // Leave week (Week 11)
      else if (weekNum === 11) {
        // No travel
      }
      // Regular weeks
      else {
        // Commute Mon, Tue, Thu
        if (dayVal === 1 || dayVal === 2 || dayVal === 4) {
          dayJourneys.push({ startTime: "08:30", endTime: "08:50", journeyAction: "Battersea Power Station to Bank", baseCharge: 2.80, isBus: false, zones: [1], note: "" });
          dayJourneys.push({ startTime: "19:15", endTime: "19:35", journeyAction: "Bank to Battersea Power Station", baseCharge: 1.80, isBus: false, zones: [1], note: "" });
        }
        // Saturday leisure
        else if (dayVal === 6) {
          dayJourneys.push({ startTime: "11:30", endTime: "11:50", journeyAction: "Battersea Power Station to Westminster", baseCharge: 1.80, isBus: false, zones: [1], note: "" });
          dayJourneys.push({ startTime: "16:30", endTime: "16:50", journeyAction: "Westminster to Battersea Power Station", baseCharge: 1.80, isBus: false, zones: [1], note: "" });
        }
      }

      processDayJourneys(dateStr, dayJourneys, currentBalance, rows);
    }
    else if (profileId === 'alex_contactless') {
      const dayJourneys: SimJourney[] = [];

      // Leave week (Week 11)
      if (weekNum === 11) {
        // No travel
      }
      // Regular weeks
      else {
        // Wednesday evening
        if (dayVal === 3) {
          dayJourneys.push({ startTime: "18:30", endTime: "18:50", journeyAction: "Battersea Power Station to Leicester Square", baseCharge: 2.80, isBus: false, zones: [1], note: "" });
          dayJourneys.push({ startTime: "22:30", endTime: "22:50", journeyAction: "Leicester Square to Battersea Power Station", baseCharge: 2.70, isBus: false, zones: [1], note: "" });
        }
        // Friday evening
        else if (dayVal === 5) {
          dayJourneys.push({ startTime: "19:15", endTime: "19:35", journeyAction: "Battersea Power Station to London Bridge", baseCharge: 2.70, isBus: false, zones: [1], note: "" });
          dayJourneys.push({ startTime: "23:45", endTime: "00:05", journeyAction: "London Bridge to Battersea Power Station", baseCharge: 2.70, isBus: false, zones: [1], note: "" });
        }
        // Sunday bus
        else if (dayVal === 0) {
          dayJourneys.push({ startTime: "12:00", endTime: "12:15", journeyAction: "Bus journey, route 344", baseCharge: 1.75, isBus: true, zones: [], note: "" });
          dayJourneys.push({ startTime: "15:00", endTime: "15:15", journeyAction: "Bus journey, route 344", baseCharge: 1.75, isBus: true, zones: [], note: "" });
        }
      }

      processDayJourneys(dateStr, dayJourneys, currentBalance, rows);
    }
  }
  
  return rows.join('\n');
}

/**
 * Processes a single demo CSV string into a CardState and adds it.
 */
function processDemoCard(csvContent: string, profileId: string, cardIndex: number, isDemoCard: boolean = true): void {
  const parseResult = parseCSV(csvContent);

  // Filter
  const filtered = filterJourneys(parseResult.journeys);

  // Classify
  const classified = classifyAll(filtered.valid);

  // Calculate Fares
  const fares = calculateAllFares(classified);

  // Detect discount
  const discount = detectActiveDiscount(classified);

  // Cap Analysis
  const dailyCaps = calculateDailyCaps(fares, discount);
  const weeklyCaps = calculateWeeklyCaps(dailyCaps, discount);
  const capSummaryResult = getCapSummary(dailyCaps, weeklyCaps);

  // Detect Commuting Patterns
  const patterns = detectCommutePatterns(classified);

  const cardColor = CARD_COLORS[cardIndex % CARD_COLORS.length];

  const card: CardState = {
    id: generateCardId(),
    name: generateCardName(cardIndex, discount),
    color: cardColor,
    fileName: `demo_${profileId}_history.csv`,
    isDemoCard,
    rawJourneys: parseResult.journeys,
    validJourneys: filtered.valid,
    excludedJourneys: filtered.excluded,
    classifiedJourneys: classified,
    fareResults: fares,
    dailyCapResults: dailyCaps,
    weeklyCapResults: weeklyCaps,
    capSummary: capSummaryResult,
    detectedPatterns: patterns,
    parseErrors: parseResult.errors,
    selectedFareType: discount !== 'none' ? discount : 'none',
    fareTypeCost: 0,
    includeOysterCost: false,
    detectedDiscount: discount,
    duplicatesRemoved: 0,
  };

  addCard(card);
}

/**
 * Loads generated demo travel history into Svelte stores.
 */
export function loadDemoData(profileId: string = 'sarah'): void {
  try {
    if (profileId === 'alex') {
      const csvOyster = generateDemoCSV('alex_oyster');
      const csvContactless = generateDemoCSV('alex_contactless');
      processDemoCard(csvOyster, 'alex_oyster', 0);
      processDemoCard(csvContactless, 'alex_contactless', 1);
    } else {
      const csvContent = generateDemoCSV(profileId);
      const existingCards = get(cards);
      const cardIndex = existingCards.length;
      processDemoCard(csvContent, profileId, cardIndex);
    }

    // Auto navigate to analysis
    currentPage.set('analysis');
  } catch (err) {
    console.error(`Failed to load demo travel history: ${err}`);
  }
}


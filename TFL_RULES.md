# Official TfL Fare & Capping Rules

This document outlines how tap-in times, fare rates, and daily price caps behave under Transport for London (TfL) ticketing rules. The daily price cap operates from **04:30 in the morning until 04:29 the following morning**.

---

## 📅 Weekends & Bank Holidays
* All journeys on Saturdays, Sundays, and UK Bank Holidays are charged **Off-Peak** rates and count exclusively towards the **Off-Peak Daily Cap**.

---

## 🗓️ Weekdays (Monday to Friday)
On weekdays, journeys are classified into five distinct time periods based on the touch-in time, with specific rules governing the rate charged and daily cap contribution:

| Time of Touch-In | Actual Rate Charged | Counts Towards Which Daily Price Cap(s)? | Capping Category |
| :--- | :--- | :--- | :--- |
| **04:30 – 06:30** | Off-Peak | Anytime (Peak) only | Peak Cap |
| **06:30 – 09:30** | Peak | Anytime (Peak) only | Peak Cap |
| **09:30 – 16:00** | Off-Peak | Anytime (Peak) & Off-Peak | Off-Peak Cap |
| **16:00 – 19:00** | Peak | Anytime (Peak) & Off-Peak | Off-Peak Cap * |
| **19:00 – 04:30** | Off-Peak | Anytime (Peak) & Off-Peak | Off-Peak Cap |

*\* Note: Evening peak rail journeys charge Peak single fares, but count towards the Off-Peak daily cap (in the calculation engine).*

---

## ⚙️ How Capping Buckets Are Resolved
1. **Anytime (Peak) Daily Cap**:
   * If a customer has **even one journey** during the **morning capping peak windows** (`04:30 – 06:30` or `06:30 – 09:30`), that journey counts *exclusively* towards the Anytime (Peak) cap.
   * Consequently, the total spend for the entire day is capped at the **Anytime (Peak) Daily Cap** threshold (e.g. £8.90 for Zone 1-2).
2. **Off-Peak Daily Cap**:
   * If all journeys of the day are touched in *outside* the morning peak windows (i.e. within `09:30 – 16:00`, `16:00 – 19:00`, or `19:00 – 04:30`), then every journey counts towards the Off-Peak cap.
   * In this scenario, the daily spend is capped at the lower **Off-Peak Daily Cap** threshold.

---

## 🚌 Bus & Tram Exception
* Bus and tram journeys are flat-rate (**£1.75**) and do not have peak/off-peak windows or geographic zoning.
* Daily bus-only spend caps at **£5.25** independently.
* In mixed mode capping, bus spend contributes to the daily cap, but does not dictate whether the day is Peak or Off-Peak (this is determined solely by rail journeys).

# 🦪 OysterSavings — TfL Fare & Discount Optimizer

OysterSavings is a privacy-first, TfL-inspired dark glassmorphism web application designed to help London commuters analyze their historical travel data, simulate future commutes, and identify the most cost-effective ticket types (PAYG, weekly/monthly/annual Travelcards, and Railcards).

![OysterSavings Application Landing Page](static/images/readme/oystersavings_landing.png)

---

## 🌟 Key Features

### 1. Interactive TfL CSV Walkthrough & Loader
Instead of exposing immediate upload boxes, the landing page uses a **Generate Analysis** flow to guide users step-by-step through requesting their travel data from the official TfL contactless or Oyster portal.
- **Verbatim step guidelines** with mockups showing exactly where to click.
- Supports standard TfL Oyster and contactless account CSV history exports.
- Offers a quick **Browse Demo Profiles** card to instantly explore the dashboard using pre-configured commuters (Sarah, James, Chloe, Marcus, Amir).

![OysterSavings Walkthrough Flow](static/images/readme/walkthrough_active.png)

### 2. Deep Fare & Savings Analysis
Explore detailed historical travel habits across dedicated subtabs:
- **💡 Insights & Commuter Personas**: Identifies travel patterns (peak/off-peak balance, commuter personas, top journeys, and time-of-day heatmaps).
- **💰 Discounted Fares & Missed Savings**: Simulates what your historical journeys would have cost with concessions or a **National Railcard (16-25, 26-30, Senior, Disabled, Gold Card)**, providing an exact break-even trip analysis.
- **📊 Cap Analytics**: Visualizes how often you hit TfL daily and weekly caps with interactive progress bars.
- **🚆 Journeys Log**: Clean, filterable table classifying trips by transport mode (Underground, Elizabeth Line, Overground, Rail, Bus & Tram) with auto-filtered failed taps and refunds.

#### Insights & Commuter Personas
![OysterSavings Insights Dashboard](static/images/readme/analysis_insights.png)

#### Discounted Fares & Railcard Savings Simulator
![OysterSavings Railcard Savings Simulator](static/images/readme/analysis_savings.png)

#### Daily & Weekly Cap Analysis
![OysterSavings Cap Analysis](static/images/readme/analysis_caps.png)

#### Clean Categorized Journeys Table
![OysterSavings Journeys Table](static/images/readme/analysis_journeys.png)

### 3. Future Commuter Routine Planner
- Model upcoming travel routines (origin/destination stations or zones, time periods, return trips, and custom recurrence frequencies).
- Apply **concession or National Railcard discounts** to forecast future PAYG spend vs. weekly, monthly, odd-period, and annual Travelcard passes.
- Integrates client-side TfL API queries to resolve exact advanced routes and live station-to-station fares.

![OysterSavings Commuter Routine Planner with Railcard Applied](static/images/readme/planner_tab.png)

### 4. Product Comparison Engine
- Cross-compares Pay-As-You-Go (PAYG) costs, weekly Caps, and weekly/monthly/annual Travelcards across specific zone ranges to identify exactly where your money goes. Supports custom concession profiles (18+ Student, Zip cards, Disabled, Jobcentre Plus) with isolated card fee evaluations and interactive, glowing filter chips.

![OysterSavings Product Comparison Engine](static/images/readme/compare_tab.png)

---

## 🔒 Privacy & Data Processing Breakdown

OysterSavings is built with a client-side, privacy-first architecture:
*   **TfL API Fare Queries Only**: The application communicates directly with the official Transport for London (TfL) API to fetch live station-to-station fare data. No other servers or external services are contacted.
*   **Local CSV Processing**: Your travel history CSV is processed entirely locally within your browser. The raw travel data is never uploaded, stored, or sent to TfL or any other server.
*   **No Tracking or Cookies**: The application does not load tracking scripts, Google Analytics, or external marketing pixels.
*   **No DB Persistence**: Once you reload or click "New Upload", the parsed state is wiped from memory.

---

## 🛠️ How to Compile and Run Locally

Ensure you have [Node.js (v18 or higher)](https://nodejs.org/) installed.

### 1. Install Dependencies
Clone the repository and install the npm dependencies:
```bash
git clone https://github.com/NotToxel/OysterSavings.git
cd OysterSavings
npm install
```

### 2. Start Local Development Server
Launch the development server with Vite:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

### 3. Production Build & Compilation
Compile and build a highly-optimized client and server bundle:
```bash
npm run build
```

### 4. Preview the Production Build
Validate the compiled production build locally:
```bash
npm run preview
```

### 5. Automated Documentation Screenshots
Re-generate high-DPI screenshots of all core tabs and walkthrough flows for the README:
```bash
npm run screenshots
```

---

## 📦 Tech Stack & Acknowledgements

We acknowledge and thank the creators of the open-source libraries that make OysterSavings possible:
*   **Framework**: [Svelte 5](https://svelte.dev/) & [SvelteKit](https://svelte.dev/docs/kit) - For state management and reactivity.
*   **Styling**: [TailwindCSS v4](https://tailwindcss.com/) - For modern responsive utility tokens.
*   **Compilation**: [Vite](https://vite.dev/) & [TypeScript](https://www.typescriptlang.org/) - For bundling and type safety.
*   **Parser**: [PapaParse](https://www.papaparse.com/) - For high-performance CSV processing.
*   **Charts**: [Chart.js](https://www.chartjs.org/) - For clean, responsive rendering of daily travel statistics.

> [!NOTE]
> **Dependencies & Documentation Policy**: The project configuration and this documentation are actively maintained to be fully up-to-date with package upgrades, Svelte runes, and styling enhancements.

---

## 📄 License

This project is licensed under the **GNU Affero General Public License, Version 3 (AGPL-3.0)**. 
- You may copy, modify, and distribute this software.
- If you run a modified version of this software as a network service, you **must make the source code publicly available** under the same license.
- See the [LICENSE](LICENSE) file for the full legal text.

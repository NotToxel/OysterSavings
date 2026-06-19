# AI Agent Guidelines & Architecture Manual

Welcome to the **OysterSavings** developer handbook. This repository is a privacy-first, TfL-themed dark glassmorphism dashboard built with **Svelte 5**, **TypeScript**, and **Vite**.

When building new features, fixing bugs, or refactoring logic, AI coding agents MUST strictly follow the directives laid out below.

---

## 🔒 1. Core Security & Privacy Principles

> [!CAUTION]
> OysterSavings is designed as a privacy-first application. User travel history data is highly sensitive (revealing daily routines and exact locations).

- **No Data Exfiltration**: Never add any outbound HTTP requests, external logging services, or analytics trackers (e.g., Google Analytics, Mixpanel, Sentry) that export parsed CSV rows or user configurations.
- **TfL API Requests Only**: The only outbound network requests permitted are to the official Transport for London (TfL) APIs for querying station-to-station fare rates. No other external APIs, servers, or trackers may be contacted.
- **No Third-Party Scripts**: Do not dynamically inject scripts or dependencies hosted on external CDN links (e.g., in `app.html` or Svelte files). All resources must be bundled locally.
- **Local Data Processing**: The travel history CSV parsing, classification, daily/weekly caps analysis, and product comparisons run locally in Svelte stores or client-side engine scripts. Station lookups query the TfL API directly from the client side without intermediate databases or logging.

---

## 🛠️ 2. Svelte 5 Coding Conventions

We utilize Svelte 5 and its modern runes system. Do not write Svelte 4 code.

- **Reactivity Runes**: Use `$state`, `$derived`, and `$effect` instead of `let`, `$:`, and stores where appropriate.
  - Correct: `let value = $state(0);`
  - Correct: `let double = $derived(value * 2);`
  - Avoid: `$: double = value * 2;`
- **Component Communication**: Use `$props()` to accept properties instead of Svelte 4's `export let`.
- **Event Listeners**: Use native attributes like `onclick={handler}` instead of Svelte 4's `on:click={handler}`.
- **Global Store Pattern**: Keep global cross-component states inside [src/lib/stores/stores.ts](file:///c:/Development/OysterSavings/src/lib/stores/stores.ts). Svelte stores (like `writable` or `derived`) are utilized to coordinate file loading, parsing, and results across dashboards.

---

## 📦 3. Versioning System & Maintenance

To maintain a consistent and visible build release sequence, you must adhere to the versioning policy:

1. **Version Location**: The version is upkept globally in [package.json](file:///c:/Development/OysterSavings/package.json) under the `"version"` field.
2. **Compile-time Defines**: Vite compile-time defines (`define` inside `vite.config.ts`) inject metadata globally into the app scope:
   - `__BUILD_DATE__`: ISO timestamp of build generation.
   - `__BUILD_VERSION__`: Matches package.json's version.
   - `__COMMIT_HASH__`: Retrieved dynamically from `git rev-parse --short HEAD`.
3. **When to Increment**: Follow the project's custom versioning policy:
   - For minor changes, tweaks, and bug fixes, only increment the minor version number (the third digit, e.g., from `1.3.0` to `1.3.1`).
   - For major features or changes, increment the larger patch number (the second digit, e.g., from `1.3.0` to `1.4.0`).
4. **Typings**: Any global variable added must be registered in [src/app.d.ts](file:///c:/Development/OysterSavings/src/app.d.ts) to prevent TypeScript check errors.
5. **TfL Fare Rates Date**: The date when TfL fares last rose is maintained as a constant `TFL_FARES_LAST_ROSE` inside [src/lib/data/fareData.ts](file:///c:/Development/OysterSavings/src/lib/data/fareData.ts). If you ever update the fare tables with new data, you MUST update this date constant to match the release date of the new rates as long as the user confirms that it was the latest official fare rise and not just fixing wrong existing data.
6. **Avoid Hardcoding**: Always try to avoid hardcoding values which will need to be changed (such as version strings, release dates, or structural constants). Resolve them dynamically or import them from a single source of truth configurations where possible.

---

## 📋 4. Svelte Scoped Styling

- Maintain the premium **TfL-inspired dark glassmorphism** theme.
- Avoid using ad-hoc inline styles. Utilize variables from [layout.css](file:///c:/Development/OysterSavings/src/routes/layout.css) (such as `--color-oyster-blue`, `--color-bg-card`, `--color-border-accent`, etc.).
- Write scoped CSS within the component `<style>` block to keep component definitions isolated.

---

## 🧪 5. Testing and Validation Checklist

Before finishing any execution step, you must execute:
1. **Typechecks & Diagnostics**: Run Svelte Kit check diagnostics:
   ```bash
   cmd.exe /c "npm run check"
   ```
   *Ensure there are zero compile errors and no new warnings introduced.*
2. **Production Compilation**: Verify bundling and build outputs compile successfully:
   ```bash
   cmd.exe /c "npm run build"
   ```
3. **Vite Local Dev**: Keep the local development server running to verify layout changes render cleanly on different responsive viewports.

---

## 📦 6. Station Database Regeneration & Special Exceptions

### Station List Rebuilding & Overrides
When regenerating the core station list using the utility scripts (`fetchStations.cjs` and `buildDatabase.cjs`), several manual overrides and updates must be maintained to ensure proper fare calculations:

1. **NaPTAN ID Corrections**:
   - **Gatwick Airport**: Use `910GGTWK` instead of standard TfL parent ID `920GLGW0`.
   - **Clapham Junction**: Use `910GCLPHMJC` instead of `910GCLPHMJ1`.
   - **Reading**: Use `910GRDNGSTN` (referencing [Outside 1-9 Stations.js](file:///c:/Development/OysterSavings/reference/Outside%201-9%20Stations.js)).
   - **Chalfont & Latimer Underground Station**: Map `naptanId` to `910GCHLFNAL` (the rail station ID) so it fetches fares successfully.
   - **Edgware Road (Bakerloo)**: Map to `940GZZLUERC`.
   - **Greenford Underground Station**: Map to `910GGFORD` (the rail station ID).
   - **Walthamstow Central Rail Station**: Map `naptanId` to `940GZZLUWWL` (instead of Wembley Central or another incorrect auto-resolved station).

2. **Special Zone Overrides**:
   - **Stratford International**: Must be fixed to `zone: 2` and `altZone: 3` (it defaults to `zone: 0` in TfL's direct API, which is a special case).

3. **Special Exception Rules (St Pancras LL to Stratford)**:
   - Fares from **London St Pancras International LL (`910GSTPXBOX`)** are valid, but journeys from `910GSTPXBOX` to **Stratford** do *not* count towards caps and travelcards in the calculation engine because this specific route is high-speed only (Southeastern High Speed) and sits outside standard Oyster capping/travelcard rules.

These overrides are hardcoded into [buildDatabase.cjs](file:///c:/Development/OysterSavings/scripts/buildDatabase.cjs) to prevent regression during station database updates.

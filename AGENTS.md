# AI Agent Guidelines & Architecture Manual

OysterSavings is a privacy-first, TfL-themed dark glassmorphism dashboard built with Svelte 5, TypeScript, and Vite.

---

## 🚀 Getting Started & Critical Validation

For every task, you must use **npm** as the manager and run these commands to verify your changes:

*   **Typechecks & Diagnostics**:
    ```bash
    cmd.exe /c "npm run check"
    ```
*   **Production Compilation**:
    ```bash
    cmd.exe /c "npm run build"
    ```
*   **Vite Local Development**: Use `npm run dev` to run the development server locally and verify responsive viewport rendering.

---

## 🔒 Core Security & Privacy Principles

> [!CAUTION]
> OysterSavings is designed as a privacy-first application. User travel history data is highly sensitive (revealing daily routines and exact locations).

*   **No Data Exfiltration**: Never add any outbound HTTP requests, external logging services, or analytics trackers (e.g., Google Analytics, Mixpanel, Sentry) that export parsed CSV rows or user configurations.
*   **TfL API Requests Only**: The only outbound network requests permitted are to the official Transport for London (TfL) APIs for querying station-to-station fare rates. No other external APIs, servers, or trackers may be contacted.
*   **No Third-Party Scripts**: Do not dynamically inject scripts or dependencies hosted on external CDN links. All resources must be bundled locally.
*   **Local Data Processing**: Travel history CSV parsing, classification, daily/weekly caps analysis, and product comparisons run locally in Svelte stores or client-side engine scripts. Station lookups query the TfL API directly from the client side without intermediate databases or logging.

---

## 📖 Developer Guide & Subsystem Configurations

Select a section below to expand detailed implementation guidelines and configurations.

<details>
<summary>🛠️ Svelte 5 & Scoped Styling Conventions</summary>

### Svelte 5 Runes
We utilize Svelte 5 and its modern runes system. Do not write Svelte 4 code.
*   **Reactivity Runes**: Use `$state`, `$derived`, and `$effect` instead of `let`, `$:`, and stores where appropriate.
    *   *Correct*: `let value = $state(0);`
    *   *Correct*: `let double = $derived(value * 2);`
    *   *Avoid*: `$: double = value * 2;`
*   **Component Communication**: Use `$props()` to accept properties instead of Svelte 4's `export let`.
*   **Event Listeners**: Use native attributes like `onclick={handler}` instead of Svelte 4's `on:click={handler}`.

### Global Stores
Keep global cross-component states inside [stores.ts](./src/lib/stores/stores.ts). Svelte stores (like `writable` or `derived`) are utilized to coordinate file loading, parsing, and results across dashboards.

### Scoped Styling
*   Maintain the premium TfL-inspired dark glassmorphism theme.
*   Utilize variables from [layout.css](./src/routes/layout.css) (such as `--color-oyster-blue`, `--color-bg-card`, `--color-border-accent`, etc.) to keep component styling consistent.
</details>

<details>
<summary>📦 Versioning & Configuration Maintenance</summary>

### Versioning Policy
To maintain a consistent and visible build release sequence, you must adhere to the versioning policy:
1.  **Version Location**: The version is upkept globally in [package.json](./package.json) under the `"version"` field.
2.  **Compile-time Defines**: Vite compile-time defines (specified inside [vite.config.ts](./vite.config.ts)) inject metadata globally into the app scope:
    *   `__BUILD_DATE__`: ISO timestamp of build generation.
    *   `__BUILD_VERSION__`: Matches package.json's version.
    *   `__COMMIT_HASH__`: Retrieved dynamically from `git rev-parse --short HEAD`.
3.  **When to Increment**:
    *   **Patch version** (the third digit, e.g., from `1.18.0` to `1.18.1`): Increment for minor changes, tweaks, and bug fixes.
    *   **Minor version** (the second digit, e.g., from `1.18.0` to `1.19.0`): Increment for major features or changes.
4.  **Typings**: Any global variable added must be registered in [app.d.ts](./src/app.d.ts) to prevent TypeScript check errors.

### Hardcoding Guidelines
Always try to avoid hardcoding values which will need to be changed (such as version strings, release dates, or structural constants). Resolve them dynamically or import them from a single source of truth configurations where possible.
*   *Approved Exception (TfL Fare Rates Date)*: The date when TfL fares last rose is maintained as a constant `TFL_FARES_LAST_ROSE` inside [fareData.ts](./src/lib/data/fareData.ts). If you ever update the fare tables with new data, you MUST update this date constant to match the release date of the new rates as long as the user confirms that it was the latest official fare rise and not just fixing wrong existing data.
*   *Approved Exception (Station Database Overrides)*: Manual overrides and mapping rules in [buildDatabase.cjs](./scripts/buildDatabase.cjs) are acceptable hardcoded configurations to prevent regression during station database regeneration.
</details>

<details>
<summary>🚉 Station Database Regeneration & Special Rules</summary>

### Station List Rebuilding
When regenerating the core station list using the utility scripts [fetchStations.cjs](./scripts/fetchStations.cjs) and [buildDatabase.cjs](./scripts/buildDatabase.cjs), several manual overrides and updates must be maintained to ensure proper fare calculations:

1.  **NaPTAN ID Corrections**:
    *   **Gatwick Airport**: Use `910GGTWK` instead of standard TfL parent ID `920GLGW0`.
    *   **Clapham Junction**: Use `910GCLPHMJC` instead of `910GCLPHMJ1`.
    *   **Reading**: Use `910GRDNGSTN` (referencing [Outside 1-9 Stations.json](./scripts/Outside%201-9%20Stations.json)).
    *   **Chalfont & Latimer Underground Station**: Map `naptanId` to `910GCHLFNAL` (the rail station ID) so it fetches fares successfully.
    *   **Edgware Road (Bakerloo)**: Map to `940GZZLUERC`.
    *   **Greenford Underground Station**: Map to `910GGFORD` (the rail station ID).
    *   **Walthamstow Central Rail Station**: Map `naptanId` to `940GZZLUWWL` (instead of Wembley Central or another incorrect auto-resolved station).

2.  **Special Zone Overrides**:
    *   **Stratford International**: Must be fixed to `zone: 2` and `altZone: 3` (it defaults to `zone: 0` in TfL's direct API, which is a special case).

3.  **Special Exception Rules (St Pancras LL to Stratford)**:
    *   Fares from **London St Pancras International LL (`910GSTPXBOX`)** are valid, but journeys from `910GSTPXBOX` to **Stratford** do *not* count towards caps and travelcards in the calculation engine because this specific route is high-speed only (Southeastern High Speed) and sits outside standard Oyster capping/travelcard rules.

These overrides are hardcoded into [buildDatabase.cjs](./scripts/buildDatabase.cjs) to prevent regression during station database updates.
</details>

# AI Agent Guidelines & Architecture Manual

Welcome to the **OysterSavings** developer handbook. This repository is a privacy-first, TfL-themed dark glassmorphism dashboard built with **Svelte 5**, **TypeScript**, and **Vite**.

When building new features, fixing bugs, or refactoring logic, AI coding agents MUST strictly follow the directives laid out below.

---

## 🔒 1. Core Security & Privacy Principles

> [!CAUTION]
> OysterSavings is designed as a **100% serverless, client-side application**. User travel history data is highly sensitive (revealing daily routines and exact locations).

- **No Data Exfiltration**: Never add any outbound HTTP requests, external logging services, or analytics trackers (e.g., Google Analytics, Mixpanel, Sentry) that export parsed CSV rows or user configurations.
- **No Third-Party Scripts**: Do not dynamically inject scripts or dependencies hosted on external CDN links (e.g., in `app.html` or Svelte files). All resources must be bundled locally.
- **Local Computations Only**: All calculations (fares, daily/weekly caps, routine forecasts, product comparisons) must run locally in Svelte stores or client-side engine scripts.

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
5. **TfL Fare Rates Date**: The date when TfL fares last rose is maintained as a constant `TFL_FARES_LAST_ROSE` inside [src/lib/data/fareData.ts](file:///c:/Development/OysterSavings/src/lib/data/fareData.ts). If you ever update the fare tables with new data, you MUST update this date constant to match the release date of the new rates.

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
   cmd.exe /c npm run check
   ```
   *Ensure there are zero compile errors and no new warnings introduced.*
2. **Production Compilation**: Verify bundling and build outputs compile successfully:
   ```bash
   cmd.exe /c npm run build
   ```
3. **Vite Local Dev**: Keep the local development server running to verify layout changes render cleanly on different responsive viewports.

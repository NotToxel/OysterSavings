# TfL Station Database Generator Scripts

This directory contains utility scripts to fetch station and platform data from the TfL StopPoint API and compile it into Svelte-compatible database structures.

## Files

1. **`fetchStations.cjs`**: Queries TfL API endpoints to recursively scan child stop points and build a complete mapping of all stations (excluding tram stops).
   * Seeded automatically from the existing `src/lib/data/stationData.ts` to keep existing entries synced.
   * Outputs the raw data to `scripts/comprehensive_stations.json` as a local cache.
   
2. **`buildDatabase.cjs`**: Reads the local cache `scripts/comprehensive_stations.json` and compiles it into `src/lib/data/stationData.ts`.
   * Standardizes station names and keys.
   * Merges overlapping platform entries (e.g. Bushey, Reading, Wimbledon Rail, etc.).
   * Strips redundant qualifiers (e.g. `" Underground Station"`, `" Rail Station"`) for single-station groups, while retaining them for distinct multi-station interchanges (e.g. `"Amersham Rail Station"` vs `"Amersham Underground Station"`).
   * Prioritizes `" Rail Station"` over `" Elizabeth line Station"` for platforms that support multiple modes.

## Commands

To rebuild the database from the cached data:
```bash
node scripts/buildDatabase.cjs
```

To fetch fresh records from the TfL API (which will update the cache and write to `stationData.ts`):
```bash
node scripts/fetchStations.cjs
node scripts/buildDatabase.cjs
```

*(Note: If execution policy restrictions allow NPM scripts on your system, you can also use `npm run stations:build`, `npm run stations:fetch`, or `npm run stations:update`.)*

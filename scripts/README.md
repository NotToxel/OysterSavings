# TfL Station Database Generator Scripts

This directory contains utility scripts to fetch station and platform data from the TfL StopPoint API and compile it into Svelte-compatible database structures.

## Files

1. **[`fetchStations.cjs`](./fetchStations.cjs)**: Queries TfL API endpoints to recursively scan child stop points and build a complete mapping of all stations (excluding tram stops).
   * Seeded automatically from the existing [`stationData.json`](../src/lib/data/stationData.json) to keep existing entries synced.
   * Outputs the raw data to [`comprehensive_stations.json`](./comprehensive_stations.json) as a local cache.
   
2. **[`buildDatabase.cjs`](./buildDatabase.cjs)**: Reads the local cache [`comprehensive_stations.json`](./comprehensive_stations.json) and compiles it into [`stationData.json`](../src/lib/data/stationData.json).
   * Standardizes station names and keys.
   * Merges overlapping platform entries (e.g. Bushey, Reading, Wimbledon Rail, etc.).
   * Strips redundant qualifiers (e.g. `" Underground Station"`, `" Rail Station"`) for single-station groups, while retaining them for distinct multi-station interchanges (e.g. `"Amersham Rail Station"` vs `"Amersham Underground Station"`).
   * Prioritizes `" Rail Station"` over `" Elizabeth line Station"` for platforms that support multiple modes.

3. **[`Outside 1-9 Stations.json`](./Outside%201-9%20Stations.json)**: A configuration catalog of Oyster/contactless stations situated outside standard London zones 1-9 (e.g. Gatwick Airport, Reading, Shenfield). Used as reference/overrides for custom zoning and NaPTAN configuration.

## Commands

To rebuild the database from the cached data:
```bash
node scripts/buildDatabase.cjs
```

To fetch fresh records from the TfL API (which will update the cache and write to `stationData.json`):
```bash
node scripts/fetchStations.cjs
node scripts/buildDatabase.cjs
```

*(Note: If execution policy restrictions allow NPM scripts on your system, you can also use `npm run stations:build`, `npm run stations:fetch`, or `npm run stations:update`.)*


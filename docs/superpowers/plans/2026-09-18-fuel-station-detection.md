# Fuel Station Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect vehicles that remain inside a fuel-station geofence for seven minutes, create a deduplicated “possible refuelling” event, and notify Telegram without changing manual fuel readings.

**Architecture:** Import OpenStreetMap fuel-station points into a small PostGIS-backed table. Extend the existing GLONASSSoft position processing path with a pure state-machine service that tracks entry, continuous dwell, notification, and exit. Persist events and queue Telegram notifications through the existing bot notification job mechanism.

**Tech Stack:** Next.js 16.2, TypeScript, Prisma 6/PostgreSQL/PostGIS, existing GLONASSSoft worker, existing Telegram notification queue, Vitest.

## Global Constraints

- Use a 150 m station radius and a 7-minute continuous dwell threshold.
- Emit one notification per entry; allow another only after the vehicle exits and re-enters.
- Label events “Возможная заправка”; GPS does not prove fuel was purchased.
- Do not mutate rental handover/return fuel readings or infer a live fuel percentage.
- Keep OpenStreetMap attribution and source/update timestamps with imported station data.
- Ignore stale/low-quality GPS samples and avoid duplicate notifications.

### Task 1: Model fuel stations and refuelling events

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/<timestamp>_add_fuel_station_detection/migration.sql`
- Test: `src/database/prisma/fuel-station-schema.test.ts`

**Interfaces:**
- `FuelStation`: company-independent station point with `osmType`, `osmId`, name, brand, address, latitude, longitude, source, attribution, and `sourceUpdatedAt`.
- `FuelStationVisit`: vehicle visit state with entry/last-seen/exit timestamps, station relation, notification state, and unique active visit per vehicle/station.

- [ ] Add Prisma models, indexes, and decimal coordinate fields.
- [ ] Add a migration with indexes for `(latitude, longitude)` and active vehicle visits.
- [ ] Add schema tests asserting models, unique constraints, attribution, and update timestamps.
- [ ] Run `npx prisma validate` and the focused schema test.

### Task 2: Import OSM fuel-station points

**Files:**
- Create: `scripts/import-osm-fuel-stations.ts`
- Create: `src/modules/fuel-stations/importer.ts`
- Test: `src/modules/fuel-stations/importer.test.ts`
- Modify: `package.json` (add `fuel-stations:import` script)

**Interfaces:**
- `parseFuelStationFeatures(input): FuelStationInput[]` filters OSM `amenity=fuel` nodes/centroids and normalizes names/brands.
- `upsertFuelStations(database, features, sourceUpdatedAt): Promise<number>` upserts by `(osmType, osmId)` and records OSM attribution.

- [ ] Write parser tests for named, unnamed, malformed, and non-fuel features.
- [ ] Implement the parser without calling Yandex APIs or persisting Yandex data.
- [ ] Implement a CLI that reads an OSM/GeoJSON extract path, supports `--dry-run`, and performs an idempotent upsert.
- [ ] Add a README comment documenting the ODbL attribution requirement and weekly/monthly refresh.
- [ ] Run focused importer tests and a dry run against a small fixture.

### Task 3: Implement the geofence state machine

**Files:**
- Create: `src/modules/fuel-stations/detector.ts`
- Test: `src/modules/fuel-stations/detector.test.ts`

**Interfaces:**
- `FuelStationDetectorOptions = { radiusMeters: 150; dwellMinutes: 7; maxPositionAgeMinutes: 10; maxAccuracyMeters: 150 }`.
- `evaluateFuelStationPosition(input, state, stations, now): DetectorResult` returns `outside`, `entered`, `dwellPending`, `possibleRefuelling`, or `exited` plus the next state.

- [ ] Test entry, dwell below threshold, exactly-seven-minute dwell, exit, re-entry, stale samples, poor accuracy, and two vehicles at one station.
- [ ] Implement haversine distance and deterministic state transitions.
- [ ] Ensure jitter inside the radius does not reset continuous dwell and leaving the radius closes the visit.
- [ ] Ensure a notification cannot be emitted twice for the same visit.

### Task 4: Connect detector to GLONASSSoft positions and Telegram

**Files:**
- Modify: `scripts/run-glonasssoft-live-worker.ts`
- Create: `src/modules/fuel-stations/server/visit-service.ts`
- Modify: `src/modules/bot-api/notifications.ts`
- Test: `src/modules/fuel-stations/server/visit-service.test.ts`
- Test: `src/modules/bot-api/notifications.test.ts`

**Interfaces:**
- `processFuelStationPosition(position): Promise<VisitProcessingResult>` loads nearby stations, persists visit state, and queues one `BotNotificationJob` on threshold.
- Notification template: `⛽ Возможная заправка: {vehicle} {registration}. АЗС: {stationName}, {address}. Въезд: {enteredAt}. Стоянка: {dwellMinutes} мин.`

- [ ] Add a focused service test with fake Prisma and notification queue.
- [ ] Integrate after successful GLONASSSoft position persistence, respecting existing one-second/rate-limit behavior.
- [ ] Resolve active rental/client for the message; use “Нет активной аренды” when absent.
- [ ] Keep failures isolated: a station lookup or Telegram queue failure must not stop GPS ingestion.
- [ ] Run focused tests and the existing GLONASSSoft worker tests.

### Task 5: Add operational visibility and attribution

**Files:**
- Modify: `src/modules/vehicles/server/queries.ts`
- Modify: `src/modules/vehicles/types.ts`
- Modify: `src/app/(protected)/vehicles/[id]/page.tsx`
- Test: `src/modules/vehicles/server/queries.test.ts`

- [ ] Add a “Заправки” timeline section showing station, address, entry time, dwell duration, and “Возможная заправка”.
- [ ] Show that fuel percentage is manual/unknown when no sensor reading exists.
- [ ] Add a small attribution label for OpenStreetMap in the station/event view.
- [ ] Run focused vehicle tests and a production build.

### Task 6: Import Russia station data and verify production

**Files:**
- Create: `scripts/refresh-osm-fuel-stations.ps1`
- Modify: `docs/PROJECT_GUIDE.md`
- Test: `scripts/fuel-stations-smoke.mjs`

- [ ] Download a Russia extract or a filtered fuel-only extract from Geofabrik/OSM, never the full planet file.
- [ ] Run the importer in dry-run mode, inspect counts and duplicate rate, then apply it.
- [ ] Verify a known station fixture and a synthetic vehicle dwell sequence.
- [ ] Deploy with migration, restart the worker, inspect worker logs, and verify one Telegram job is queued for a synthetic event.
- [ ] Run `npm run typecheck`, focused Vitest tests, `npm run build`, and the production smoke check.

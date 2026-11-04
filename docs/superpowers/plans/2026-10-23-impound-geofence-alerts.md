# Impound Geofence Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect Supa Pro fleet vehicles entering Moscow or Saint Petersburg impound-lot geofences and send consistent actionable Telegram alerts.

**Architecture:** A pure geography module owns the versioned location catalogue and entry detector. The existing GLONASSSoft ingestion transaction invokes it after a position is saved and enqueues the existing `OPERATIONAL_ALERT` job. The existing bot job hydrator formats staff/client messages and exposes allow-listed inline actions.

**Tech Stack:** TypeScript 5, Prisma 6, Next.js 16 Route Handlers, Vitest 3, Python 3.12, aiogram 3.

## Global Constraints

- Product copy uses only Supa Pro / СУПА ПРО.
- Preserve tenant boundaries and existing user changes.
- No new dependency.
- Every behavior starts with a failing test.
- Source addresses are versioned and attributable.

---

### Task 1: Versioned impound catalogue and entry detector

**Files:**
- Create: `src/modules/geography/impound-lots.ts`
- Create: `src/modules/geography/impound-lots.test.ts`

**Interfaces:**
- Produces: `IMPOUND_LOTS`, `findImpoundLot(latitude, longitude)`, `detectImpoundEntry(previous, current)`.

- [ ] Write tests proving all 21 official Moscow entries are present, representative Petersburg entries are present, a point inside resolves, a distant point does not, and only outside→inside is an entry.
- [ ] Run `npx vitest run src/modules/geography/impound-lots.test.ts` and confirm RED because the module does not exist.
- [ ] Implement immutable records, Haversine distance, radius matching, and transition logic.
- [ ] Run the same command and confirm GREEN.

### Task 2: Ingestion creates one operational alert per entry

**Files:**
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.ts`
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.test.ts`

**Interfaces:**
- Consumes: `detectImpoundEntry`.
- Produces: `OPERATIONAL_ALERT` payload `{ kind: 'IMPOUND_LOT_ENTRY', vehicleId, rentalId?, impoundLotId, recordedAt }`.

- [ ] Add a failing transaction test for outside→inside and a non-duplication test for inside→inside.
- [ ] Run the target test and confirm RED.
- [ ] Query the previous position, resolve the active rental, and enqueue a group notification with a stable event key based on the entered lot and position.
- [ ] Run the target test and confirm GREEN.

### Task 3: Unified alert formatting and actions

**Files:**
- Modify: `src/modules/bot-api/operational-alerts.ts`
- Modify: `src/modules/bot-api/operational-alerts.test.ts`
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`

**Interfaces:**
- Extends: `formatOperationalAlert` with `IMPOUND_LOT_ENTRY` and impound fields.
- Produces: consistent block formatting for `SPEEDING`, `GEOFENCE_EXIT`, `LOW_FUEL`, and `FUEL_STATION_VISIT`.

- [ ] Add failing snapshot-style assertions for the new impound message and block-form speeding message.
- [ ] Run both target tests and confirm RED.
- [ ] Implement shared event blocks and hydrate impound metadata from the trusted catalogue.
- [ ] Add `notify_client` plus phone/map actions only when data exists.
- [ ] Run both target tests and confirm GREEN.

### Task 4: Secure «Сообщить» callback

**Files:**
- Create: `src/app/api/bot/v1/notifications/notify-client/route.ts`
- Create: `src/app/api/bot/v1/notifications/notify-client/route.test.ts`
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `bot/keyboards/notifications.py`
- Modify: `bot/handlers/notification_actions.py`
- Modify: `bot/services/pilot_api.py`
- Modify: `bot/tests/test_notifications.py`

**Interfaces:**
- Produces API: `POST /api/bot/v1/notifications/notify-client` with `{ rentalId, reason: 'IMPOUND_LOT' }`.
- Produces callback: `notify:client:<rentalId>:impound`.

- [ ] Add failing TS route/service tests and Python keyboard/handler tests.
- [ ] Run target suites and confirm RED.
- [ ] Implement tenant-scoped staff authorization, active-rental validation, client Telegram validation, minute idempotency, callback parsing, and user feedback.
- [ ] Run target suites and confirm GREEN.

### Task 5: Regression and production rollout

**Files:**
- Modify: `docs/PROJECT_GUIDE.md`

- [ ] Run `npx vitest run` for all touched TS suites.
- [ ] Run Python bot tests for notifications and keyboards.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] Deploy as a new immutable release, restart the GLONASSSoft worker and bot, and verify health plus one non-delivering formatter fixture.
- [ ] Confirm production logs contain no alert-loop or Telegram callback errors.

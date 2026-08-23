# Live GLONASSSoft Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver fresh GLONASSSoft positions to the protected Pilot+ map within 2–4 seconds without page reloads.

**Architecture:** A long-running, non-overlapping worker calls the existing company synchronizer every two seconds and publishes changed vehicle IDs to a tenant Redis channel. A protected Next.js SSE route sends an authoritative database snapshot initially and after each tenant event; the client replaces its vehicle state and MapLibre animates the updated markers.

**Tech Stack:** TypeScript 5, Node.js 20+, Next.js 16.2 route handlers, React 19, Prisma 6/PostgreSQL, Redis 8, MapLibre GL 5, Vitest 3, systemd.

## Global Constraints

- Poll all linked vehicles for a company in one GLONASSSoft `vehicles/getlastdata` request every 2 seconds.
- Never overlap worker cycles.
- Keep credentials in server-only environment/database configuration and never log them.
- Keep the last known position on provider, Redis, or SSE failures.
- Preserve tenant authorization for snapshots and subscriptions.
- Continue using the shared 15-minute GPS freshness rule.
- Do not change rental, client, fine, or Telegram-bot behavior.
- Read the installed Next.js 16 route-handler streaming documentation before changing the SSE route.

---

## File Structure

- `src/services/redis/client.server.ts`: bounded server-only Redis connection factory.
- `src/modules/telematics/live-position-events.ts`: validates and publishes tenant-scoped invalidation events.
- `src/modules/telematics/glonasssoft/sync-company.server.ts`: reports exactly which vehicles received a new position.
- `src/modules/telematics/glonasssoft/live-worker.ts`: testable non-overlapping two-second loop with bounded backoff.
- `scripts/run-glonasssoft-live-worker.ts`: production process entrypoint and graceful shutdown.
- `src/app/api/map/live/route.ts`: authenticated no-store SSE stream.
- `src/modules/online-map/components/OnlineMapWorkspace.tsx`: owns the live EventSource snapshot and existing UI state.
- `deploy/pilot-plus-glonasssoft-worker.service`: hardened systemd unit template.
- `docs/runbooks/live-glonasssoft-map.md`: deployment, health, rollback, and smoke-test procedure.

### Task 1: Idempotent position change signal

**Files:**
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.ts`
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.test.ts`
- Create: `src/modules/telematics/live-position-events.ts`
- Create: `src/modules/telematics/live-position-events.test.ts`
- Create: `src/services/redis/client.server.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `LivePositionEvent { companyId: string; vehicleIds: string[]; emittedAt: string }`.
- Produces: `publishLivePositionEvent(event, publisher?): Promise<void>`.
- Changes `syncCompanyLatestPositions()` result to `{ requested, saved, skipped, changedVehicleIds }` where `saved` and `changedVehicleIds` include only newly inserted provider messages.

- [ ] **Step 1: Write failing synchronizer and event tests**

Assert that an existing idempotency key returns no changed vehicle, a newly created key returns its vehicle ID once, payload validation rejects malformed tenant/vehicle IDs, and the publisher writes only to `pilot:map:<companyId>` without credentials or raw provider data.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/telematics/glonasssoft/sync-company.server.test.ts src/modules/telematics/live-position-events.test.ts`

Expected: failures for missing `changedVehicleIds`, missing create-result handling, and missing event module.

- [ ] **Step 3: Implement the minimal insertion/event boundary**

Use Prisma `createMany({ data: [position], skipDuplicates: true })` or an equivalent transaction result that distinguishes a new message from a duplicate. Return sorted unique changed vehicle IDs. Add a server-only Redis publisher configured by `REDIS_URL` or existing `REDIS_HOST`/`REDIS_PORT`, with connect and operation timeouts and no secret-bearing logs.

- [ ] **Step 4: Verify GREEN and commit**

Run the focused command again, then `npm run typecheck`, scoped ESLint/Prettier, and `git diff --check`.

Commit: `feat(telematics): publish fresh gps positions`

### Task 2: Continuous non-overlapping GPS worker

**Files:**
- Create: `src/modules/telematics/glonasssoft/live-worker.ts`
- Create: `src/modules/telematics/glonasssoft/live-worker.test.ts`
- Create: `scripts/run-glonasssoft-live-worker.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `syncCompanyLatestPositions(companyId)` and `publishLivePositionEvent(event)`.
- Produces: `runLiveWorker(options, dependencies): Promise<void>` with `intervalMs: 2000`, abort signal, injected clock/delay, repository, synchronizer, and publisher.

- [ ] **Step 1: Write failing worker tests**

Cover one packet request per company per tick, no overlap when a tick exceeds two seconds, publish only changed IDs, continue after one company fails, bounded exponential backoff for repeated transient errors, and graceful abort without another cycle.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/telematics/glonasssoft/live-worker.test.ts`

Expected: module-not-found failure.

- [ ] **Step 3: Implement worker and process entrypoint**

Use a sequential `while (!signal.aborted)` loop; calculate the remaining delay after every completed cycle instead of `setInterval`. Reset failure delay after a successful company sync, cap backoff, publish one event per company/cycle, handle `SIGTERM` and `SIGINT`, disconnect Prisma/Redis, and set a failing exit code only for fatal configuration errors.

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests, typecheck, scoped lint/format, and diff check.

Commit: `feat(telematics): run continuous gps worker`

### Task 3: Tenant-safe SSE snapshot stream

**Files:**
- Create: `src/modules/online-map/server/live-stream.ts`
- Create: `src/modules/online-map/server/live-stream.test.ts`
- Create: `src/app/api/map/live/route.ts`
- Create: `src/app/api/map/live/route.test.ts`
- Modify: `src/modules/online-map/server/queries.ts`

**Interfaces:**
- Consumes: existing auth/session access and `listOnlineMapVehicles(user)`.
- Produces SSE events `event: snapshot\ndata: {"vehicles": OnlineMapVehicle[]}\n\n` and comment heartbeats.

- [ ] **Step 1: Read the installed Next.js streaming guide**

Read the relevant files under `node_modules/next/dist/docs/` for route handlers, Web Streams, dynamic behavior, abort handling, and Node runtime.

- [ ] **Step 2: Write failing route/stream tests**

Prove unauthenticated and unauthorized requests fail before Redis subscription, company staff subscribe only to their tenant channel, super-admin snapshot scope is explicit, the first event is an authoritative database snapshot, Redis invalidation triggers a fresh database snapshot, heartbeat is emitted, and request abort unsubscribes/closes resources.

- [ ] **Step 3: Run tests and verify RED**

Run: `npx vitest run src/modules/online-map/server/live-stream.test.ts src/app/api/map/live/route.test.ts`

Expected: missing route/stream modules.

- [ ] **Step 4: Implement bounded SSE stream**

Return Node-runtime `text/event-stream` with `Cache-Control: private, no-cache, no-store`, `X-Accel-Buffering: no`, and `Connection: keep-alive`. Encode only validated `OnlineMapVehicle[]`, refresh from PostgreSQL on each tenant invalidation, serialize refreshes to prevent overlap, coalesce bursts, emit heartbeat comments, and clean up timers/subscriber on abort.

- [ ] **Step 5: Verify GREEN and commit**

Run focused tests, typecheck, scoped lint/format, and diff check.

Commit: `feat(map): stream live fleet snapshots`

### Task 4: Live client state and moving markers

**Files:**
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

**Interfaces:**
- Consumes SSE `snapshot` messages from `/api/map/live`.
- Keeps the existing `OnlineMapVehicle` DTO and shared `deriveVehicleGpsStatus` calculation.

- [ ] **Step 1: Write failing browser-component tests**

Inject a fake EventSource factory. Assert that a snapshot moves the marker coordinates and updates speed/address/fuel/time without reload, keeps selection/filter state, ignores malformed events, closes the source on unmount, and leaves the last snapshot visible after an error.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

Expected: EventSource is never created and incoming snapshots do not change map props.

- [ ] **Step 3: Implement live snapshot ownership and marker transition**

Initialize state from the server prop, open EventSource after hydration, validate the snapshot shape before replacement, and continue recomputing GPS freshness client-side. Update existing MapLibre marker positions in place; apply a short CSS/MapLibre transition when reduced motion is not requested and immediate movement otherwise.

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests, typecheck, scoped lint/format, and diff check.

Commit: `feat(map): update vehicles without reload`

### Task 5: VPS service and release verification

**Files:**
- Create: `deploy/pilot-plus-glonasssoft-worker.service`
- Create: `docs/runbooks/live-glonasssoft-map.md`
- Modify: `.env.example`
- Modify: `docs/PROJECT_GUIDE.md`

**Interfaces:**
- Consumes the worker package script, application environment, PostgreSQL, Redis, and GLONASSSoft encrypted integration.
- Produces a restart-safe systemd service and an operator smoke/rollback procedure.

- [ ] **Step 1: Add static deployment tests/checks**

Extend or create a focused test that reads the unit template and asserts `Restart=always`, a non-root service user, protected env file, working directory, production environment, start-rate limits, and the live-worker command.

- [ ] **Step 2: Run static test and verify RED**

Run its focused Vitest command and expect failure because the service file does not exist.

- [ ] **Step 3: Add service, safe env contract, and runbook**

Document secret generation, `EnvironmentFile=/etc/pilot-plus.env`, Redis connectivity, installation, start/status/log commands, freshness SQL, SSE smoke request, provider rate-limit handling, restart test, rollback, and alerting when `lastSuccessAt` is older than one minute.

- [ ] **Step 4: Run repository verification**

Run focused telematics/map suites, `npm run typecheck`, `npm run lint`, `npm run build`, scoped Prettier, and `git diff --check`. Do not claim live success until the worker runs against the intended server and a real position timestamp advances.

- [ ] **Step 5: Deploy and smoke test on VPS**

Back up the current `/opt/pilot-plus` deployment and env, install the reviewed application build and worker service, preserve secrets outside Git, start Redis/application/worker, and confirm:

1. `lastAttemptAt` advances every cycle and `lastSuccessAt` remains current.
2. At least one real `VehiclePosition.recordedAt` advances when Sputnik Vision shows a new point.
3. The protected SSE connection receives a subsequent snapshot.
4. The map updates speed and marker position without page reload.
5. `systemctl restart` and a VPS reboot return the worker to active state.

- [ ] **Step 6: Commit operational files**

Commit: `docs(telematics): operate live gps worker`


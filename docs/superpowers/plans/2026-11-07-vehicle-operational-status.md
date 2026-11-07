# Vehicle Operational Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect a 40-minute stay in the Supa Pro service geofence, notify only the staff bot once per visit, and show one consistent operational badge on fleet cards and vehicle details.

**Architecture:** A persisted `VehicleServiceVisit` records entry, confirmation, exit, and notification state. The GLONASSSoft position sync calls a focused service-zone processor after saving each fresh point; fleet queries map persisted state, rentals, park address, and manual maintenance into a single `operationalStatus` DTO consumed by UI components.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, Vitest, React Testing Library, GLONASSSoft worker, Telegram notification outbox.

## Global Constraints

- Product copy uses **Supa Pro** or **СУПА ПРО** only.
- Service center: `55.616017, 37.716422`, radius 150 meters, minimum continuous dwell 40 minutes.
- Staff bot only; no client notification.
- Status priority: `IN_SERVICE` → `RENTED` → `IN_PARK` → `AVAILABLE`.
- Badge colors use design-system tones: service purple, rental orange, park blue, available green.
- Cards do not show movement, stop state, GPS freshness, last signal, or last trip.
- Active and overdue `ACTIVE` rentals remain `RENTED` until explicitly closed.
- Follow TDD: every behavior test must fail for the expected reason before implementation.

---

### Task 1: Persist service visits and define the geofence state machine

**Files:**
- Create: `src/modules/vehicles/service-zone.ts`
- Create: `src/modules/vehicles/service-zone.test.ts`
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20261107100000_add_vehicle_service_visits/migration.sql`
- Test: `src/database/prisma/schema.test.ts`

**Interfaces:**
- Produces `SERVICE_ZONE`, `SERVICE_DWELL_MS`, `SERVICE_MAX_POINT_GAP_MS`.
- Produces `distanceFromServiceMeters(latitude, longitude): number`.
- Produces `nextServiceVisitState(input): ServiceVisitTransition` with transitions `IGNORE`, `ENTER`, `CONTINUE`, `CONFIRM`, and `EXIT`.

- [ ] **Step 1: Write failing domain and schema tests**

```ts
it('does not confirm a stay before 40 minutes', () => {
  expect(nextServiceVisitState(insideAtMinute(39))).toEqual({ type: 'CONTINUE' });
});

it('confirms a continuous 40 minute stay', () => {
  expect(nextServiceVisitState(insideAtMinute(40))).toEqual({ type: 'CONFIRM' });
});

it('exits immediately on a fresh point outside the zone', () => {
  expect(nextServiceVisitState(outsidePoint())).toEqual({ type: 'EXIT' });
});
```

Add schema assertions for `model VehicleServiceVisit`, relations on `Company` and `Vehicle`, and the partial unique active-visit index.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/vehicles/service-zone.test.ts src/database/prisma/schema.test.ts`

Expected: FAIL because the module and Prisma model do not exist.

- [ ] **Step 3: Implement the pure state machine and schema**

```ts
export const SERVICE_ZONE = {
  name: 'Сервис СУПА ПРО',
  address: 'Каширское шоссе, 61 к3А',
  latitude: 55.616017,
  longitude: 37.716422,
  radiusMeters: 150,
} as const;
export const SERVICE_DWELL_MS = 40 * 60_000;
export const SERVICE_MAX_POINT_GAP_MS = 15 * 60_000;
```

The model contains `companyId`, `vehicleId`, `enteredAt`, `lastInsideAt`, `confirmedAt`, `exitedAt`, `notificationQueuedAt`, timestamps, relations, and indexes. The SQL migration adds a partial unique index for one row where `exitedAt IS NULL` per vehicle.

- [ ] **Step 4: Generate Prisma client and verify GREEN**

Run: `npx prisma format && npx prisma generate && npx vitest run src/modules/vehicles/service-zone.test.ts src/database/prisma/schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/vehicles/service-zone.ts src/modules/vehicles/service-zone.test.ts src/database/prisma/schema.prisma src/database/prisma/schema.test.ts src/database/prisma/migrations/20261107100000_add_vehicle_service_visits/migration.sql
git commit -m "feat: model vehicle service visits"
```

### Task 2: Process each fresh GPS position and persist visit transitions

**Files:**
- Create: `src/modules/vehicles/server/service-visit.ts`
- Create: `src/modules/vehicles/server/service-visit.test.ts`
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.ts`
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.test.ts`

**Interfaces:**
- Consumes the Task 1 state machine.
- Produces `processServiceZonePosition(database, input): Promise<{ confirmedVisitId: string | null }>`.
- Consumes a repository exposing `vehicleServiceVisit.findFirst/create/update`.

- [ ] **Step 1: Write failing processor tests**

Cover entry creation, 39-minute continuation, 40-minute confirmation, gap reset, stale-point ignore, and exit closure. Assert that confirmation is returned once and a confirmed visit is not re-confirmed.

- [ ] **Step 2: Run processor tests and verify RED**

Run: `npx vitest run src/modules/vehicles/server/service-visit.test.ts`

Expected: FAIL because `processServiceZonePosition` is missing.

- [ ] **Step 3: Implement minimal persistence service**

```ts
export async function processServiceZonePosition(database: ServiceVisitRepository, input: {
  companyId: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  recordedAt: Date;
  observedAt: Date;
}) {
  // Ignore points older than 15 minutes, load the active visit,
  // apply nextServiceVisitState, persist one transition, and return
  // the visit id only on the first CONFIRM transition.
}
```

- [ ] **Step 4: Integrate after successful position insertion**

Extend `SyncTransaction` with `vehicleServiceVisit`, pass the sync attempt time into `savePoint`, and call `processServiceZonePosition` only after `inserted.count === 1`.

- [ ] **Step 5: Run focused synchronization tests and verify GREEN**

Run: `npx vitest run src/modules/vehicles/server/service-visit.test.ts src/modules/telematics/glonasssoft/sync-company.server.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/vehicles/server/service-visit.ts src/modules/vehicles/server/service-visit.test.ts src/modules/telematics/glonasssoft/sync-company.server.ts src/modules/telematics/glonasssoft/sync-company.server.test.ts
git commit -m "feat: detect confirmed service stays"
```

### Task 3: Queue and format one staff-bot notification per confirmed visit

**Files:**
- Create: `src/modules/bot-api/service-visit-notifications.ts`
- Create: `src/modules/bot-api/service-visit-notifications.test.ts`
- Modify: `src/modules/bot-api/notification-routing.ts`
- Modify: `src/modules/bot-api/notification-routing.test.ts`
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`
- Modify: `src/modules/bot-api/operational-alerts.ts`
- Modify: `src/modules/bot-api/operational-alerts.test.ts`
- Modify: `src/modules/vehicles/server/service-visit.ts`

**Interfaces:**
- Produces `queueServiceVisitNotification({ companyId, vehicleId, visitId, confirmedAt, prisma })`.
- Adds operational alert kind `SERVICE_ZONE_STAY`.
- Uses event key `service-zone:staff:<visitId>` and `skipDuplicates: true`.

- [ ] **Step 1: Write failing queue and formatter tests**

```ts
expect(formatOperationalAlert({
  kind: 'SERVICE_ZONE_STAY',
  vehicle: 'Toyota Camry',
  registrationNumber: 'Н541АК997',
  eventRecordedAt: new Date('2026-11-07T08:00:00Z'),
  stationLabel: 'Каширское шоссе, 61 к3А',
})).toContain('🔧 <b>Автомобиль в сервисе</b>');
```

Assert one staff outbox row, no client identity, and idempotent event key.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/bot-api/service-visit-notifications.test.ts src/modules/bot-api/operational-alerts.test.ts src/modules/bot-api/notification-routing.test.ts src/modules/bot-api/notifications.test.ts`

Expected: FAIL because the template kind and queue helper are absent.

- [ ] **Step 3: Implement staff-only queueing and formatting**

Add `SERVICE_ZONE_STAY` to internal `OPERATIONAL_ALERT` hydration and render exactly:

```text
🔧 Автомобиль в сервисе

🚗 Авто
└ <vehicle> · <plate>

📍 Сервис
└ Каширское шоссе, 61 к3А

🕒 Событие
└ Автомобиль находится в зоне сервиса более 40 минут.
```

Set `notificationQueuedAt` only when `createMany` inserts the outbox row.

- [ ] **Step 4: Run focused notification tests and verify GREEN**

Run: `npx vitest run src/modules/bot-api/service-visit-notifications.test.ts src/modules/bot-api/operational-alerts.test.ts src/modules/bot-api/notification-routing.test.ts src/modules/bot-api/notifications.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/bot-api src/modules/vehicles/server/service-visit.ts
git commit -m "feat: notify staff about confirmed service visits"
```

### Task 4: Derive one operational status for list and detail queries

**Files:**
- Create: `src/modules/vehicles/operational-status.ts`
- Create: `src/modules/vehicles/operational-status.test.ts`
- Modify: `src/modules/vehicles/types.ts`
- Modify: `src/modules/vehicles/server/queries.ts`
- Modify: `src/modules/vehicles/server/queries.test.ts`

**Interfaces:**
- Produces `VehicleOperationalStatusKey = 'IN_SERVICE' | 'RENTED' | 'IN_PARK' | 'AVAILABLE'`.
- Produces `deriveVehicleOperationalStatus(input): { key, label, tone }`.
- Adds `operationalStatus` to `VehicleCardDto` and `VehicleDetailDto`.

- [ ] **Step 1: Write failing priority tests**

Assert service overrides rental, active or confirmed rental overrides park, park overrides available, `MAINTENANCE` and open maintenance records mean service, and an overdue `ACTIVE` rental remains rented.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/vehicles/operational-status.test.ts src/modules/vehicles/server/queries.test.ts`

Expected: FAIL because `operationalStatus` is absent.

- [ ] **Step 3: Implement status derivation and query projection**

```ts
const OPERATIONAL_STATUS = {
  IN_SERVICE: { key: 'IN_SERVICE', label: 'В сервисе', tone: 'service' },
  RENTED: { key: 'RENTED', label: 'В аренде', tone: 'warning' },
  IN_PARK: { key: 'IN_PARK', label: 'В парке', tone: 'primary' },
  AVAILABLE: { key: 'AVAILABLE', label: 'Свободна', tone: 'success' },
} as const;
```

Select an unclosed confirmed service visit and active maintenance data. Treat any rental whose status is `ACTIVE` or `CONFIRMED` as rented without filtering out an overdue end time.

- [ ] **Step 4: Run focused query tests and verify GREEN**

Run: `npx vitest run src/modules/vehicles/operational-status.test.ts src/modules/vehicles/server/queries.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/vehicles/operational-status.ts src/modules/vehicles/operational-status.test.ts src/modules/vehicles/types.ts src/modules/vehicles/server/queries.ts src/modules/vehicles/server/queries.test.ts
git commit -m "feat: expose fleet operational statuses"
```

### Task 5: Replace technical GPS UI with the four business badges

**Files:**
- Modify: `src/shared/ui/Badge.tsx`
- Modify: `src/shared/ui/Badge.test.ts`
- Modify: `src/app/globals.css`
- Modify: `src/modules/vehicles/components/VehicleCard.tsx`
- Modify: `src/modules/vehicles/components/VehicleCard.test.tsx`
- Modify: `src/modules/vehicles/components/VehicleOverview.tsx`
- Modify: `src/modules/vehicles/components/VehicleDetailPage.test.ts`
- Modify: `src/modules/vehicles/components/VehicleListPage.tsx`

**Interfaces:**
- Consumes `vehicle.operationalStatus` from Task 4.
- Adds a semantic `service` badge tone backed by light/dark design tokens.

- [ ] **Step 1: Write failing component tests**

Assert exactly one operational badge, all four labels and semantic tones, no GPS badge, no «Последний сигнал», no «Последняя поездка», and consistent detail status.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npx vitest run src/shared/ui/Badge.test.ts src/modules/vehicles/components/VehicleCard.test.tsx src/modules/vehicles/components/VehicleDetailPage.test.ts`

Expected: FAIL because the old GPS UI remains.

- [ ] **Step 3: Implement minimal UI changes**

Render:

```tsx
<Badge tone={vehicle.operationalStatus.tone} data-testid="vehicle-operational-status">
  {vehicle.operationalStatus.label}
</Badge>
```

Remove the `useMinuteNow` re-derivation in `VehicleListPage`; remove movement/signal labels and the two telemetry rows while preserving address, odometer, fuel, and service plan.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npx vitest run src/shared/ui/Badge.test.ts src/modules/vehicles/components/VehicleCard.test.tsx src/modules/vehicles/components/VehicleDetailPage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/Badge.tsx src/shared/ui/Badge.test.ts src/app/globals.css src/modules/vehicles/components
git commit -m "feat: show fleet business badges"
```

### Task 6: Regression, migration, and production deployment

**Files:**
- Modify only files required by failures discovered in this task.

**Interfaces:**
- Verifies all previous tasks as a single deployable unit.

- [ ] **Step 1: Run project checks**

Run:

```bash
npx prisma validate
npx prisma generate
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Review the complete diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended files are modified or committed. Preserve the owner's unrelated untracked files.

- [ ] **Step 3: Create and verify a production backup**

Use `pg_dump -Fc`, verify it with `pg_restore -l`, and keep the absolute backup path in deployment output.

- [ ] **Step 4: Deploy application and migration through the existing blue/green workflow**

Run the repository's established production deployment scripts, migrate once, switch traffic only after the candidate slot health check succeeds, and keep the previous slot available for rollback.

- [ ] **Step 5: Run production canary checks**

Verify:

- `/login` returns HTTP 200;
- the active web unit and GLONASSSoft worker are running;
- N541АК997 receives `IN_SERVICE` only after a persisted 40-minute confirmed visit;
- the staff notification outbox contains at most one job for that visit;
- no client notification job is created;
- fleet cards show one of the four approved labels and no technical GPS copy.

- [ ] **Step 6: Commit any final targeted fixes**

```bash
git add <only-files-fixed-in-task-6>
git commit -m "fix: complete service status rollout"
```

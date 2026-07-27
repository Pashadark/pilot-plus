# Vehicle Events History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить tenant-safe общую историю автопарка и автомобиля из поездок, телематики, топлива, ТО, моек, устройств, прошивок и ручных записей.

**Architecture:** Существующие доменные таблицы остаются источниками истины. Серверный модуль событий проецирует записи разных типов в единый сериализуемый DTO, объединяет и стабильно сортирует их. Новые Prisma-модели хранят только ручные записи и пользовательские отметки прочтения.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Prisma 6/PostgreSQL, Zod, Tailwind CSS 4, Pilot+ UI kit, Vitest, Playwright.

## Global Constraints

- Весь интерфейс, сообщения и комментарии на русском языке.
- Все чтения и записи ограничены `companyId` авторизованного пользователя.
- Prisma-модели, `Decimal` и `Date` не передаются в Client Components.
- Использовать Pilot+ `StatCard`, `Badge`, `Button`, `IconButton`, `Card`, `Modal`, `BottomSheet`, toast и `Skeleton`.
- Loading UI повторяет геометрию итогового экрана и не заменяется одним спиннером.
- URL хранит фильтры; desktop и mobile имеют функциональный паритет.
- Не добавлять новые UI-зависимости.
- Перед Next.js-изменениями читать релевантные файлы `node_modules/next/dist/docs/`.
- Любая Prisma-схема сопровождается additive SQL-миграцией и идемпотентным seed.
- Каждый task выполняется через RED → GREEN → проверки → отдельный commit → review.

---

### Task 1: Prisma-модели ручных событий и прочтения

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260727180000_add_event_timeline/migration.sql`
- Create: `src/database/prisma/event-timeline-schema.test.ts`

**Interfaces:**
- Produces: `ManualVehicleEvent`, `EventReadReceipt`, `ManualVehicleEventKind`.
- `EventReadReceipt.eventKey` хранит стабильный ключ длиной до 191 символа.

- [ ] **Step 1: Write failing schema tests**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('src/database/prisma/schema.prisma', 'utf8');
const migration = readFileSync(
  'src/database/prisma/migrations/20260727180000_add_event_timeline/migration.sql',
  'utf8',
);

describe('схема единой истории', () => {
  it.each(['ManualVehicleEvent', 'EventReadReceipt'])('содержит модель %s', (model) => {
    expect(schema).toContain(`model ${model} {`);
  });

  it('делает прочтение пользователя идемпотентным', () => {
    expect(schema).toContain('@@unique([userId, eventKey])');
  });

  it('индексирует tenant и хронологию', () => {
    expect(schema).toContain('@@index([companyId, recordedAt])');
    expect(schema).toContain('@@index([companyId, userId, readAt])');
  });

  it('ограничивает координаты и длину ключа на уровне SQL', () => {
    expect(migration).toContain('ManualVehicleEvent_latitude_check');
    expect(migration).toContain('ManualVehicleEvent_longitude_check');
    expect(migration).toContain('EventReadReceipt_eventKey_length_check');
  });
});
```

- [ ] **Step 2: Confirm RED**

Run:

```powershell
npx vitest run src/database/prisma/event-timeline-schema.test.ts
```

Expected: FAIL because the models and migration do not exist.

- [ ] **Step 3: Add exact Prisma models**

```prisma
enum ManualVehicleEventKind {
  NOTE
  INCIDENT
  ASSIGNMENT
}

model ManualVehicleEvent {
  id          String                 @id @default(cuid())
  companyId   String
  company     Company                @relation(fields: [companyId], references: [id], onDelete: Cascade)
  vehicleId   String
  vehicle     Vehicle                @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  authorId    String
  author      User                   @relation(fields: [authorId], references: [id], onDelete: Restrict)
  kind        ManualVehicleEventKind
  severity    TelemetrySeverity      @default(INFO)
  title       String
  description String?
  location    String?
  latitude    Decimal?               @db.Decimal(9, 6)
  longitude   Decimal?               @db.Decimal(9, 6)
  recordedAt  DateTime
  createdAt   DateTime               @default(now())
  updatedAt   DateTime               @updatedAt

  @@index([companyId, recordedAt])
  @@index([vehicleId, recordedAt])
  @@index([authorId, createdAt])
}

model EventReadReceipt {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  eventKey  String   @db.VarChar(191)
  readAt    DateTime @default(now())

  @@unique([userId, eventKey])
  @@index([companyId, userId, readAt])
}
```

Add relation arrays to `Company`, `User` and `Vehicle`. Do not rename existing relations.

- [ ] **Step 4: Create additive SQL migration**

The migration must create the enum, both tables, all indexes and foreign keys, then add:

```sql
ALTER TABLE "public"."ManualVehicleEvent"
ADD CONSTRAINT "ManualVehicleEvent_latitude_check"
CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90)),
ADD CONSTRAINT "ManualVehicleEvent_longitude_check"
CHECK ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180));

ALTER TABLE "public"."EventReadReceipt"
ADD CONSTRAINT "EventReadReceipt_eventKey_length_check"
CHECK (char_length("eventKey") BETWEEN 3 AND 191);
```

- [ ] **Step 5: Verify and commit**

```powershell
npx prisma format
$env:DATABASE_URL='postgresql://pilot:pilot@127.0.0.1:5432/pilot'; npx prisma validate
npx prisma generate
npx vitest run src/database/prisma/event-timeline-schema.test.ts src/database/prisma/schema.test.ts
npm run typecheck
git diff --check
git add src/database/prisma/schema.prisma src/database/prisma/event-timeline-schema.test.ts src/database/prisma/migrations/20260727180000_add_event_timeline/migration.sql
git commit -m "feat: add unified event timeline schema"
```

---

### Task 2: Идемпотентный seed истории

**Files:**
- Create: `src/database/prisma/event-timeline-seed.ts`
- Create: `src/database/prisma/event-timeline-seed.test.ts`
- Modify: `src/database/prisma/seed.ts`

**Interfaces:**

```ts
export async function seedVehicleEventTimeline(
  database: EventTimelineSeedDatabase,
  companyId: string,
  adminUserId: string,
  vehicles: Array<{ id: string; internalNumber: string }>,
): Promise<{ trips: number; events: number; fuelRecords: number; manualEvents: number }>;
```

- [ ] **Step 1: Write failing idempotency test**

Test two consecutive calls and assert:

```ts
expect(first).toEqual({ trips: 18, events: 24, fuelRecords: 12, manualEvents: 8 });
expect(second).toEqual(first);
expect(fake.trips.size).toBe(18);
expect(fake.events.size).toBe(24);
expect(fake.fuelRecords.size).toBe(12);
expect(fake.manualEvents.size).toBe(8);
```

Also assert at least three `DANGER`, one fuel drain, one assignment and one incident.

- [ ] **Step 2: Confirm RED**

```powershell
npx vitest run src/database/prisma/event-timeline-seed.test.ts
```

Expected: FAIL because the seed module is absent.

- [ ] **Step 3: Implement deterministic definitions**

Use explicit stable ids:

```ts
const stableId = (kind: string, internalNumber: string, index: number) =>
  `seed-${kind}-${internalNumber.toLowerCase()}-${String(index).padStart(2, '0')}`;
```

Use fixed ISO timestamps in July 2026, realistic Russian titles and locations. Upsert every
record by explicit `id`. Do not use random values or `new Date()` for seeded event time.

- [ ] **Step 4: Wire after fleet and Pilot Connect seed**

```ts
const timeline = await seedVehicleEventTimeline(prisma, company.id, admin.id, fleetVehicles);
console.info(
  `История: ${timeline.trips} поездок, ${timeline.events} событий, ` +
    `${timeline.fuelRecords} операций с топливом, ${timeline.manualEvents} ручных записей`,
);
```

- [ ] **Step 5: Verify and commit**

```powershell
npx vitest run src/database/prisma/event-timeline-seed.test.ts src/database/prisma/seed.test.ts
npm run typecheck
npm run db:seed
npm run db:seed
git add src/database/prisma/event-timeline-seed.ts src/database/prisma/event-timeline-seed.test.ts src/database/prisma/seed.ts
git commit -m "feat: seed vehicle event history"
```

Both seed runs must report the same counts.

---

### Task 3: Доменные контракты и нормализация источников

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/modules/events/types.ts`
- Create: `src/modules/events/event-key.ts`
- Create: `src/modules/events/event-key.test.ts`
- Create: `src/modules/events/normalizers.ts`
- Create: `src/modules/events/normalizers.test.ts`
- Create: `src/modules/events/validation.ts`
- Create: `src/modules/events/validation.test.ts`

**Interfaces:**

```ts
export type TimelineCategory =
  | 'MOVEMENT' | 'TRIP' | 'STOP' | 'ALERT' | 'FUEL'
  | 'MAINTENANCE' | 'WASH' | 'DEVICE' | 'FIRMWARE' | 'MANUAL';

export type TimelineSeverity = 'INFO' | 'WARNING' | 'DANGER';

export interface TimelineEventDto {
  key: string;
  category: TimelineCategory;
  severity: TimelineSeverity;
  title: string;
  description: string | null;
  recordedAt: string;
  isRead: boolean;
  isManual: boolean;
  vehicle: { id: string; internalNumber: string; model: string; imagePath: string | null };
  location: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  telemetry: {
    speedKph: number | null;
    heading: number | null;
    odometerKm: number | null;
    fuelLevelPercent: number | null;
    fuelVolumeLiters: number | null;
  };
  source: { type: string; id: string; href: string | null };
}
```

- [ ] **Step 1: Declare the already-used validation dependency**

The repository already imports Zod from device validation but does not declare it as a direct
dependency. Fix package ownership before adding another consumer:

```powershell
npm install zod
npm ls zod --depth=0
```

Expected: `zod` appears as a direct production dependency in `package.json` and lockfile.

- [ ] **Step 2: Write event-key tests**

```ts
expect(createEventKey('vehicle-event', 'abc')).toBe('vehicle-event:abc');
expect(parseEventKey('device-command:xyz')).toEqual({
  source: 'device-command',
  id: 'xyz',
});
expect(parseEventKey('../bad')).toBeNull();
```

- [ ] **Step 3: Write normalizer tests**

Cover all sources:

- latest moving position → `MOVEMENT/INFO`;
- Trip completed → `TRIP/INFO`;
- active trip → `MOVEMENT/INFO`;
- telemetry danger → `ALERT/DANGER`;
- fuel refill → `FUEL/INFO`;
- fuel drain → `FUEL/DANGER`;
- overdue maintenance → `MAINTENANCE/WARNING`;
- completed wash → `WASH/INFO`;
- failed command → `DEVICE/WARNING`;
- completed update command → `FIRMWARE/INFO`;
- manual incident → `MANUAL/DANGER`.

Every test must assert exact key, Russian title, ISO time, href and numeric conversion.

- [ ] **Step 4: Implement pure normalizers**

Export one function per source:

```ts
normalizeVehiclePosition
normalizeTrip
normalizeVehicleEvent
normalizeFuelRecord
normalizeMaintenanceRecord
normalizeWashRecord
normalizeDeviceCommand
normalizeManualVehicleEvent
```

No function imports Prisma Client. Raw input interfaces live beside the normalizers.

- [ ] **Step 5: Add Zod validation**

```ts
export const createManualEventSchema = z.object({
  vehicleId: entityIdSchema,
  kind: z.enum(['NOTE', 'INCIDENT', 'ASSIGNMENT']),
  severity: z.enum(['INFO', 'WARNING', 'DANGER']),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(240).optional(),
  latitude: optionalCoordinate(-90, 90),
  longitude: optionalCoordinate(-180, 180),
  recordedAt: z.string().datetime({ offset: true }),
}).strict().superRefine(requireBothCoordinates);
```

Add schemas for one key and a bounded array of 1–100 keys.

- [ ] **Step 6: Verify and commit**

```powershell
npx vitest run src/modules/events/event-key.test.ts src/modules/events/normalizers.test.ts src/modules/events/validation.test.ts
npm run typecheck
npx eslint src/modules/events
git add package.json package-lock.json src/modules/events
git commit -m "feat: define unified event contracts"
```

---

### Task 4: Tenant-safe объединённые запросы и курсор

**Files:**
- Create: `src/modules/events/server/queries.ts`
- Create: `src/modules/events/server/queries.test.ts`

**Interfaces:**

```ts
export interface TimelineFilters {
  search?: string;
  vehicleId?: string;
  categories?: TimelineCategory[];
  severities?: TimelineSeverity[];
  read?: 'all' | 'read' | 'unread';
  from?: string;
  to?: string;
  before?: string;
  beforeKey?: string;
  limit?: number;
}

export async function getEventTimeline(
  filters: TimelineFilters,
): Promise<{
  events: TimelineEventDto[];
  nextCursor: { before: string; beforeKey: string } | null;
  stats: { total: number; danger: number; unread: number; vehicles: number };
  vehicles: Array<{ id: string; label: string }>;
}>;
```

- [ ] **Step 1: Write tenant tests**

Mock `{ userId: 'user-1', companyId: 'company-1' }`. Assert every source query reaches the
company through one of these exact conditions:

```ts
{ vehicle: { companyId: 'company-1' } }
{ companyId: 'company-1' }
{ device: { companyId: 'company-1' } }
```

Assert a requested `vehicleId` is combined with, not substituted for, company scope.

- [ ] **Step 2: Write merge/cursor tests**

Use interleaved fixtures from all sources. Assert:

```ts
expect(result.events.map((event) => event.key)).toEqual([
  'vehicle-event:event-new',
  'trip:trip-same-time',
  'manual:manual-old',
]);
expect(result.nextCursor).toEqual({
  before: '2026-07-20T10:00:00.000Z',
  beforeKey: 'manual:manual-old',
});
```

Also cover read/unread, category, severity, period, search and vehicle filters.

- [ ] **Step 3: Implement bounded source reads**

Fetch at most `limit + 1` rows per source, with `limit` clamped to 10–50. Use the same
`before` time on all sources, normalize, merge, apply the stable `(recordedAt desc, key asc)`
order, then return the first `limit`.

`VehiclePosition` participates only when `speedKph > 0` and becomes the factual current-movement
item. It does not infer a destination. Stale positions retain their recorded time and the UI
labels them as stale.

Read receipts are fetched in one query for the returned keys and current user.

- [ ] **Step 4: Implement stats**

Stats describe the filtered period and vehicle/category/severity scope but ignore the
read/unread selector so the unread KPI remains informative. Use database counts where possible;
do not load an unbounded event history into memory.

- [ ] **Step 5: Verify and commit**

```powershell
npx vitest run src/modules/events/server/queries.test.ts
npm run typecheck
npx eslint src/modules/events/server
git add src/modules/events/server
git commit -m "feat: query tenant-safe event timeline"
```

---

### Task 5: Ручные записи и отметки прочтения

**Files:**
- Create: `src/modules/events/actions.ts`
- Create: `src/modules/events/actions.test.ts`

**Interfaces:**

```ts
export type EventActionState = { status: 'idle' | 'success' | 'error'; message: string };

export async function createManualEventAction(
  previous: EventActionState,
  formData: FormData,
): Promise<EventActionState>;

export async function markEventReadAction(eventKey: string): Promise<EventActionState>;
export async function markEventsReadAction(eventKeys: string[]): Promise<EventActionState>;
export async function markAllEventsReadAction(filters: TimelineFilters): Promise<EventActionState>;
```

- [ ] **Step 1: Write failing authorization tests**

Cover:

- unauthenticated rejected;
- vehicle from another company rejected;
- event key for inaccessible source rejected;
- 101 keys rejected;
- repeated receipt succeeds without duplicate;
- mass action only uses keys returned by tenant-safe query.

- [ ] **Step 2: Implement source-key verification**

Create an internal `verifyAccessibleEventKeys` that groups parsed keys by source and performs
bounded tenant-scoped `findMany` queries. Return a set of verified keys; reject if counts differ.

- [ ] **Step 3: Implement actions**

Manual create stores authenticated `companyId` and `userId`; it never trusts these values from
the form. Read receipt uses:

```ts
await prisma.eventReadReceipt.upsert({
  where: { userId_eventKey: { userId, eventKey } },
  create: { companyId, userId, eventKey },
  update: { readAt: new Date() },
});
```

Use a transaction for bounded batches. Revalidate `/events` and the affected vehicle route.

- [ ] **Step 4: Verify and commit**

```powershell
npx vitest run src/modules/events/actions.test.ts
npm run typecheck
npx eslint src/modules/events/actions.ts src/modules/events/actions.test.ts
git add src/modules/events/actions.ts src/modules/events/actions.test.ts
git commit -m "feat: manage manual and read events"
```

---

### Task 6: Адаптивная страница `/events`

**Files:**
- Create: `src/app/(protected)/events/page.tsx`
- Create: `src/app/(protected)/events/loading.tsx`
- Create: `src/app/(protected)/events/error.tsx`
- Create: `src/modules/events/components/EventsPage.tsx`
- Create: `src/modules/events/components/EventsWorkspace.tsx`
- Create: `src/modules/events/components/EventsWorkspace.test.tsx`
- Create: `src/modules/events/components/EventTimelineCard.tsx`
- Create: `src/modules/events/components/EventFilters.tsx`
- Create: `src/modules/events/components/ManualEventDialog.tsx`
- Create: `src/modules/events/components/EventTimelineSkeleton.tsx`

**Interfaces:**
- Consumes `getEventTimeline`, event actions and Pilot+ UI primitives.
- Produces reusable `EventTimelineCard` and `EventTimelineSkeleton`.

- [ ] **Step 1: Read Next 16 docs and write workspace tests**

Read the local App Router pages/layouts, loading and Server Actions guides. Tests must cover:

- URL-backed search and all filters;
- four KPI values;
- danger and unread visual states;
- one read and mass read;
- manual dialog success → one toast → close → refresh;
- error keeps dialog and values;
- desktop filter area and mobile `BottomSheet`;
- load-more cursor preservation;
- empty history and empty filtered result.

- [ ] **Step 2: Implement server route**

`page.tsx` awaits Next 16 `searchParams`, validates them into `TimelineFilters`, calls
`getEventTimeline`, and renders `EventsPage`. No Prisma import appears in client files.

- [ ] **Step 3: Build UI from `/ui-kit`**

Use:

```tsx
<StatCard label="Непрочитанные" value={String(stats.unread)} />
<Badge tone={severityTone[event.severity]}>{severityLabel[event.severity]}</Badge>
<Card className={event.isRead ? '' : 'border-[var(--color-primary)]'} />
```

The event card follows the `/ui-kit` `EventCard` tone/icon language, expanded with vehicle,
description, telemetry, source link and read button.

- [ ] **Step 4: Add exact loading geometry**

`loading.tsx` renders `EventTimelineSkeleton` with:

- four KPI placeholders;
- one filter-panel placeholder;
- eight timeline-card placeholders;
- desktop/mobile responsive widths.

The skeleton uses only shared `Skeleton`, reserves final heights, and contains no spinner.

- [ ] **Step 5: Add accessible interactions**

All icon buttons have Russian `aria-label`; unread state is not color-only; filters are labelled;
mobile touch targets are at least 44×44 px; focus returns after modal/sheet close.

- [ ] **Step 6: Verify and commit**

```powershell
npx vitest run src/modules/events/components/EventsWorkspace.test.tsx
npm run typecheck
npm run lint
npx prettier --check "src/app/(protected)/events/**/*.{ts,tsx}" "src/modules/events/**/*.{ts,tsx}"
git diff --check
git add "src/app/(protected)/events" src/modules/events/components
git commit -m "feat: add unified event timeline"
```

---

### Task 7: История в карточке автомобиля

**Files:**
- Modify: `src/modules/vehicles/components/vehicle-tabs.ts`
- Modify: `src/modules/vehicles/components/vehicle-tabs.test.ts`
- Modify: `src/modules/vehicles/components/VehicleDetailPage.tsx`
- Modify: `src/modules/vehicles/components/VehicleDetailPage.test.ts`
- Create: `src/modules/events/components/VehicleEventHistory.tsx`
- Create: `src/modules/events/components/VehicleEventHistory.test.tsx`

**Interfaces:**

```ts
export interface VehicleEventHistoryProps {
  vehicleId: string;
  initialEvents: TimelineEventDto[];
  nextCursor: { before: string; beforeKey: string } | null;
}
```

- [ ] **Step 1: Write failing tab tests**

Change the existing `events` tab label to `История` while keeping the stable URL value
`events` for backward compatibility. Assert the tab renders mixed trip, fuel, maintenance,
wash, firmware and manual fixtures.

- [ ] **Step 2: Replace specialized event-only view**

The `events` tab renders `VehicleEventHistory` fixed to the current vehicle. It reuses
`EventTimelineCard`, load-more and read actions. It does not expose a vehicle selector.

Existing `trips`, `maintenance` and `wash` tabs remain unchanged.

- [ ] **Step 3: Handle movement summary**

When the newest normalized item is active movement, show current speed, direction, location and
last-seen time. When stale or absent, render `Нет актуальной телеметрии` explicitly.

- [ ] **Step 4: Verify and commit**

```powershell
npx vitest run src/modules/vehicles/components/vehicle-tabs.test.ts src/modules/vehicles/components/VehicleDetailPage.test.ts src/modules/events/components/VehicleEventHistory.test.tsx
npm run typecheck
npx eslint src/modules/vehicles/components src/modules/events/components
git add src/modules/vehicles/components src/modules/events/components/VehicleEventHistory.tsx src/modules/events/components/VehicleEventHistory.test.tsx
git commit -m "feat: add unified vehicle history"
```

---

### Task 8: E2E, документация и финальная регрессия

**Files:**
- Create: `tests/events.spec.ts`
- Modify: `README.md`
- Modify: `docs/PROJECT_GUIDE.md`

**Interfaces:**
- Produces a complete verified events vertical.

- [ ] **Step 1: Add desktop E2E**

Test:

1. login with existing environment-backed helper;
2. open `/events`;
3. assert seeded categories and KPI;
4. filter one vehicle and `DANGER`;
5. create a manual incident;
6. assert success toast and event presence;
7. mark it read and reload;
8. assert read state persists;
9. follow vehicle link and assert the same event under its `events` tab.

- [ ] **Step 2: Add mobile E2E**

At 390×844 verify:

- no horizontal overflow;
- filters open in bottom sheet;
- event cards and actions have touch targets;
- manual dialog is usable;
- load-more preserves filters.

- [ ] **Step 3: Apply migration and seed twice**

```powershell
npx prisma migrate deploy
npm run db:seed
npm run db:seed
```

Expected: no duplicates and stable event counts.

- [ ] **Step 4: Update docs**

Document:

- actual event sources;
- manual/read behavior;
- no workflow, push or real-time stream yet;
- `/events` and vehicle history routes;
- skeleton/UI-kit reuse.

- [ ] **Step 5: Run full verification**

```powershell
npm run test:unit
npm run lint
npm run typecheck
npx prettier --check README.md docs/PROJECT_GUIDE.md
npm run build
npx playwright test tests/events.spec.ts tests/vehicles.spec.ts tests/devices.spec.ts tests/maintenance.spec.ts tests/wash.spec.ts --workers=1
git diff --check
```

Expected: all commands PASS. If Turbopack build fails with a proven environment transport error,
run `npx next build --webpack`, record both results, and do not describe the original command as
passing.

- [ ] **Step 6: Commit**

```powershell
git add tests/events.spec.ts README.md docs/PROJECT_GUIDE.md
git commit -m "test: verify unified vehicle event history"
```

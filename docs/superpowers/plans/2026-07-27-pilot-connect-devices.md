# Pilot Connect Devices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать полноценный модуль Pilot Connect с PostgreSQL, 24 seed-устройствами, tenant-safe запросами, очередью команд, адаптивным списком и детальной страницей.

**Architecture:** Prisma хранит устройства, версии прошивок и очередь команд. Серверный слой получает обязательную сессию и всегда фильтрует по компании. React Server Components загружают данные, client-workspace управляет фильтрами, формами и exactly-once toast/refresh lifecycle. Реальная публикация MQTT не входит в эту вертикаль.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript strict, Tailwind CSS 4, Prisma 6/PostgreSQL, Vitest, Testing Library, Playwright, существующая Pilot+ UI-библиотека.

## Global Constraints

- Перед изменением Next.js читать релевантные файлы `node_modules/next/dist/docs/`.
- Весь UI, пользовательские сообщения и комментарии — на русском языке.
- Использовать существующие семантические токены, `src/shared/ui` и `react-icons/fi`.
- Минимальный touch target — 44×44 px; цвет не является единственным признаком статуса.
- Все запросы и мутации изолируются по `companyId`; клиентское скрытие не является защитой.
- Не добавлять MQTT-отправщик, бинарные прошивки, массовые команды, удаление устройств и новые роли.
- Не менять существующие автомобили, ТО, мойки и авторизацию вне необходимых связей Prisma.
- Все изменения выполняются TDD; каждая задача заканчивается отдельным коммитом и ревью.

---

## Task 1: Prisma-модели и безопасная миграция

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260727120000_add_pilot_connect_devices/migration.sql`
- Create: `src/database/prisma/device-schema.test.ts`

**Interfaces:**

- Produces Prisma enums: `DeviceStatus`, `DeviceConnectionType`, `DevicePowerSource`, `FirmwareChannel`, `DeviceCommandType`, `DeviceCommandStatus`.
- Produces models: `Device`, `FirmwareRelease`, `DeviceCommand`.
- Extends relations on `User`, `Company`, and `Vehicle`.

- [ ] **Step 1: Write failing schema contract tests**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('src/database/prisma/schema.prisma', 'utf8');

describe('схема Pilot Connect', () => {
  it.each(['Device', 'FirmwareRelease', 'DeviceCommand'])('содержит модель %s', (model) => {
    expect(schema).toContain(`model ${model} {`);
  });

  it('защищает одну активную привязку устройства к автомобилю', () => {
    expect(schema).toContain('vehicleId');
    expect(schema).toContain('@unique');
  });

  it('индексирует tenant и состояние очереди', () => {
    expect(schema).toContain('@@index([companyId, status])');
    expect(schema).toContain('@@index([deviceId, status, createdAt])');
  });
});
```

- [ ] **Step 2: Run test and confirm RED**

Run:

```powershell
npx vitest run src/database/prisma/device-schema.test.ts
```

Expected: FAIL because the models are absent.

- [ ] **Step 3: Add exact Prisma enums and relations**

Add enums:

```prisma
enum DeviceStatus {
  ONLINE
  OFFLINE
  WARNING
  UNASSIGNED
  DISABLED
}

enum DeviceConnectionType {
  LTE
  GSM
  NONE
}

enum DevicePowerSource {
  VEHICLE
  BATTERY
}

enum FirmwareChannel {
  STABLE
  BETA
}

enum DeviceCommandType {
  REBOOT
  SHUTDOWN
  UPDATE_FIRMWARE
}

enum DeviceCommandStatus {
  PENDING
  SENT
  COMPLETED
  FAILED
  CANCELLED
}
```

Add relations:

```prisma
// User
deviceCommands DeviceCommand[]

// Company
devices        Device[]
deviceCommands DeviceCommand[]

// Vehicle
device Device?
```

- [ ] **Step 4: Add exact models**

```prisma
model Device {
  id                     String               @id @default(cuid())
  companyId              String
  company                Company              @relation(fields: [companyId], references: [id], onDelete: Cascade)
  vehicleId              String?              @unique
  vehicle                Vehicle?             @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  name                   String
  serialNumber           String               @unique
  imei                   String               @unique
  hardwareVersion        String
  firmwareVersion        String
  status                 DeviceStatus         @default(UNASSIGNED)
  connectionType         DeviceConnectionType @default(NONE)
  mobileOperator         String?
  signalStrength         Int?
  satellitesCount        Int?
  positionAccuracyMeters Decimal?             @db.Decimal(8, 2)
  powerSource            DevicePowerSource    @default(VEHICLE)
  externalVoltage        Decimal?             @db.Decimal(5, 2)
  batteryLevel           Int?
  ignitionOn             Boolean              @default(false)
  isMoving               Boolean              @default(false)
  latitude               Decimal?             @db.Decimal(9, 6)
  longitude              Decimal?             @db.Decimal(9, 6)
  lastSeenAt             DateTime?
  installedAt            DateTime?
  commands               DeviceCommand[]
  createdAt              DateTime             @default(now())
  updatedAt              DateTime             @updatedAt

  @@index([companyId, status])
  @@index([companyId, firmwareVersion])
  @@index([companyId, lastSeenAt])
}

model FirmwareRelease {
  id           String          @id @default(cuid())
  version      String          @unique
  channel      FirmwareChannel @default(STABLE)
  releaseNotes String
  isRequired   Boolean         @default(false)
  releasedAt   DateTime
  createdAt    DateTime        @default(now())
  commands     DeviceCommand[]
}

model DeviceCommand {
  id                    String              @id @default(cuid())
  companyId             String
  company               Company             @relation(fields: [companyId], references: [id], onDelete: Cascade)
  deviceId              String
  device                Device              @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  createdByUserId       String
  createdByUser         User                @relation(fields: [createdByUserId], references: [id], onDelete: Restrict)
  firmwareReleaseId     String?
  firmwareRelease       FirmwareRelease?    @relation(fields: [firmwareReleaseId], references: [id], onDelete: Restrict)
  type                  DeviceCommandType
  status                DeviceCommandStatus @default(PENDING)
  targetFirmwareVersion String?
  payload               Json?
  errorMessage          String?
  sentAt                DateTime?
  completedAt           DateTime?
  cancelledAt           DateTime?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  @@index([companyId, status])
  @@index([deviceId, status, createdAt])
  @@index([createdByUserId, createdAt])
}
```

- [ ] **Step 5: Create additive SQL migration**

Generate with:

```powershell
npx prisma migrate dev --create-only --name add_pilot_connect_devices
```

Inspect SQL and add check constraints:

```sql
ALTER TABLE "Device"
ADD CONSTRAINT "Device_signalStrength_check"
CHECK ("signalStrength" IS NULL OR ("signalStrength" BETWEEN 0 AND 100)),
ADD CONSTRAINT "Device_batteryLevel_check"
CHECK ("batteryLevel" IS NULL OR ("batteryLevel" BETWEEN 0 AND 100)),
ADD CONSTRAINT "Device_satellitesCount_check"
CHECK ("satellitesCount" IS NULL OR "satellitesCount" >= 0),
ADD CONSTRAINT "Device_latitude_check"
CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90)),
ADD CONSTRAINT "Device_longitude_check"
CHECK ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180));
```

- [ ] **Step 6: Validate and test**

Run:

```powershell
npx prisma format
npx prisma validate
npx prisma generate
npx vitest run src/database/prisma/device-schema.test.ts src/database/prisma/schema.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/database/prisma/schema.prisma src/database/prisma/migrations/20260727120000_add_pilot_connect_devices/migration.sql src/database/prisma/device-schema.test.ts
git commit -m "feat: add Pilot Connect data model"
```

---

## Task 2: Идемпотентный seed 24 устройств

**Files:**

- Create: `src/database/prisma/device-seed.ts`
- Create: `src/database/prisma/device-seed.test.ts`
- Modify: `src/database/prisma/seed.ts`

**Interfaces:**

- Consumes: `companyId`, `adminUserId`, existing fleet vehicles.
- Produces:

```ts
export type DeviceSeedDatabase = {
  firmwareRelease: Pick<PrismaClient['firmwareRelease'], 'upsert'>;
  device: Pick<PrismaClient['device'], 'upsert'>;
  deviceCommand: Pick<PrismaClient['deviceCommand'], 'upsert'>;
};

export async function seedPilotConnectDevices(
  database: DeviceSeedDatabase,
  companyId: string,
  adminUserId: string,
  vehicles: Array<{ id: string; internalNumber: string }>,
): Promise<{ devices: number; firmwareReleases: number; commands: number }>;
```

- [ ] **Step 1: Write failing idempotency tests**

Test must assert:

```ts
expect(first).toEqual({ devices: 24, firmwareReleases: 3, commands: 6 });
expect(second).toEqual(first);
expect(fake.devicesBySerial.size).toBe(24);
expect(
  [...fake.devicesBySerial.values()].filter((device) => device.vehicleId === null),
).toHaveLength(1);
expect(new Set([...fake.devicesBySerial.values()].map((device) => device.imei)).size).toBe(24);
```

- [ ] **Step 2: Confirm RED**

```powershell
npx vitest run src/database/prisma/device-seed.test.ts
```

- [ ] **Step 3: Implement deterministic seed definitions**

Use serials `PC-2026-0001` through `PC-2026-0024`, IMEI `860000000000001` through `860000000000024`, firmware distribution `2.3.8`, `2.4.0`, `2.4.1`, and the approved mixture of statuses and power sources.

The 24th device must be:

```ts
{
  name: 'Pilot Connect 0024',
  serialNumber: 'PC-2026-0024',
  imei: '860000000000024',
  vehicleId: null,
  status: 'UNASSIGNED',
  connectionType: 'NONE',
  firmwareVersion: '2.4.1',
  powerSource: 'BATTERY',
  batteryLevel: 65,
}
```

- [ ] **Step 4: Add firmware releases and historical commands**

Create:

```ts
[
  { version: '2.3.8', channel: 'STABLE', isRequired: false },
  { version: '2.4.0', channel: 'STABLE', isRequired: false },
  { version: '2.4.1', channel: 'STABLE', isRequired: true },
];
```

Create six deterministic completed commands using stable IDs derived from serial + type, so a repeated seed updates instead of duplicates.

- [ ] **Step 5: Wire seed into `main()`**

After `seedFleet`, load the first 23 vehicles ordered by `internalNumber` and call:

```ts
const devices = await seedPilotConnectDevices(prisma, company.id, admin.id, fleetVehicles);
console.info(
  `Pilot Connect: ${devices.devices} устройств, ${devices.firmwareReleases} прошивки, ${devices.commands} команд`,
);
```

- [ ] **Step 6: Verify**

```powershell
npx vitest run src/database/prisma/device-seed.test.ts src/database/prisma/seed.test.ts
npm run typecheck
npm run db:seed
npm run db:seed
```

Expected: both seed runs report 24 devices without duplicates.

- [ ] **Step 7: Commit**

```powershell
git add src/database/prisma/device-seed.ts src/database/prisma/device-seed.test.ts src/database/prisma/seed.ts
git commit -m "feat: seed Pilot Connect devices"
```

---

## Task 3: Domain contracts, status and validation

**Files:**

- Create: `src/modules/devices/types.ts`
- Create: `src/modules/devices/status.ts`
- Create: `src/modules/devices/status.test.ts`
- Create: `src/modules/devices/validation.ts`
- Create: `src/modules/devices/validation.test.ts`
- Create: `src/modules/devices/firmware.ts`
- Create: `src/modules/devices/firmware.test.ts`

**Interfaces:**

- Produces `DeviceListItem`, `DeviceDetails`, `DeviceCommandItem`, `FirmwareReleaseItem`.
- Produces `getEffectiveDeviceStatus`, `getDeviceStatusMeta`, `canUpdateFirmware`.
- Produces Zod schemas `createDeviceSchema`, `bindDeviceSchema`, `createDeviceCommandSchema`, `cancelDeviceCommandSchema`.

- [ ] **Step 1: Write status and staleness tests**

```ts
it('считает онлайн-устройство офлайн после 15 минут без связи', () => {
  expect(
    getEffectiveDeviceStatus(
      { status: 'ONLINE', vehicleId: 'v1', lastSeenAt: new Date('2026-07-27T09:00:00Z') },
      new Date('2026-07-27T09:16:00Z'),
    ),
  ).toBe('OFFLINE');
});

it('оставляет свободное устройство непривязанным независимо от lastSeenAt', () => {
  expect(
    getEffectiveDeviceStatus(
      { status: 'ONLINE', vehicleId: null, lastSeenAt: new Date('2026-07-27T09:00:00Z') },
      new Date('2026-07-27T09:01:00Z'),
    ),
  ).toBe('UNASSIGNED');
});
```

- [ ] **Step 2: Write validation tests**

Cover:

- name 2–80 characters;
- serial 4–64, uppercase Latin/digits/hyphen;
- IMEI exactly 15 digits;
- hardware/firmware semantic numeric versions;
- command update requires `firmwareReleaseId`;
- reboot/shutdown reject firmware fields;
- UUID/CUID-like IDs are non-empty bounded strings.

- [ ] **Step 3: Implement status metadata**

Exact Russian labels:

```ts
export const DEVICE_STATUS_META = {
  ONLINE: { label: 'Онлайн', tone: 'success', icon: FiWifi },
  OFFLINE: { label: 'Офлайн', tone: 'danger', icon: FiWifiOff },
  WARNING: { label: 'Требует внимания', tone: 'warning', icon: FiAlertTriangle },
  UNASSIGNED: { label: 'Не привязано', tone: 'neutral', icon: FiLink },
  DISABLED: { label: 'Отключено', tone: 'neutral', icon: FiPower },
} as const;
```

- [ ] **Step 4: Implement firmware comparison**

`canUpdateFirmware(current, target)` parses exactly three numeric segments and returns true only when target is newer. Invalid versions return false.

- [ ] **Step 5: Verify and commit**

```powershell
npx vitest run src/modules/devices/status.test.ts src/modules/devices/validation.test.ts src/modules/devices/firmware.test.ts
npm run typecheck
git add src/modules/devices
git commit -m "feat: define Pilot Connect domain contracts"
```

---

## Task 4: Tenant-safe queries

**Files:**

- Create: `src/modules/devices/server/queries.ts`
- Create: `src/modules/devices/server/queries.test.ts`

**Interfaces:**

```ts
export async function getDevicePageData(): Promise<{
  devices: DeviceListItem[];
  firmwareReleases: FirmwareReleaseItem[];
  availableVehicles: Array<{ id: string; label: string }>;
}>;

export async function getDeviceDetails(id: string): Promise<DeviceDetails | null>;
```

- [ ] **Step 1: Write failing tenant tests**

Mock the authenticated context as:

```ts
{ userId: 'admin-1', companyId: 'company-1', companyRole: 'ADMIN' }
```

Assert every Prisma device query contains:

```ts
where: {
  companyId: 'company-1';
}
```

Assert details use:

```ts
where: { id: 'device-1', companyId: 'company-1' }
```

Assert available vehicles include:

```ts
where: {
  companyId: 'company-1',
  OR: [{ device: null }, { device: { id: 'device-1' } }],
}
```

- [ ] **Step 2: Confirm RED**

```powershell
npx vitest run src/modules/devices/server/queries.test.ts
```

- [ ] **Step 3: Implement DTO mapping**

Never return Prisma Decimal or model instances to client components. Convert coordinates, voltage, accuracy, dates and command timestamps to number/string DTO fields.

Order:

- devices by effective severity, then `lastSeenAt desc`, then `serialNumber asc`;
- commands by `createdAt desc`, limit 50;
- firmware by release date descending.

- [ ] **Step 4: Add summary calculation**

Summary counts use effective status at query time:

```ts
{
  total: devices.length,
  online: devices.filter((device) => device.effectiveStatus === 'ONLINE').length,
  offline: devices.filter((device) => device.effectiveStatus === 'OFFLINE').length,
  updateAvailable: devices.filter((device) => device.updateAvailable).length,
}
```

- [ ] **Step 5: Verify and commit**

```powershell
npx vitest run src/modules/devices/server/queries.test.ts
npm run typecheck
git add src/modules/devices/server
git commit -m "feat: query Pilot Connect devices safely"
```

---

## Task 5: Server Actions and command queue

**Files:**

- Create: `src/modules/devices/actions.ts`
- Create: `src/modules/devices/actions.test.ts`

**Interfaces:**

```ts
export async function createDeviceAction(
  previousState: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState>;

export async function bindDeviceAction(
  previousState: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState>;

export async function createDeviceCommandAction(
  previousState: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState>;

export async function cancelDeviceCommandAction(
  previousState: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState>;
```

- [ ] **Step 1: Write failing authorization and tenant tests**

Cover:

- missing session returns generic authorization error;
- device from another company cannot be mutated;
- vehicle from another company cannot be linked;
- duplicate serial and IMEI return field errors without exposing database details;
- only `PENDING` commands can be cancelled.

- [ ] **Step 2: Write command conflict tests**

For `PENDING` or `SENT` existing command:

```ts
expect(await createDeviceCommandAction(initial, rebootForm)).toEqual({
  success: false,
  message: 'Для устройства уже выполняется команда.',
});
expect(database.deviceCommand.create).not.toHaveBeenCalled();
```

- [ ] **Step 3: Implement create and binding transaction**

Binding transaction must verify company for both records and update one device only. When binding to a vehicle already used by another device, return:

```text
К этому автомобилю уже привязано устройство Pilot Connect.
```

- [ ] **Step 4: Implement command transaction**

Within one transaction:

1. load tenant-scoped device;
2. check active command;
3. validate firmware release for update;
4. create `PENDING` command with `createdByUserId`;
5. revalidate `/devices` and `/devices/${deviceId}`.

Payloads:

```ts
{ command: 'reboot' }
{ command: 'shutdown' }
{ command: 'update_firmware', version: target.version }
```

- [ ] **Step 5: Verify and commit**

```powershell
npx vitest run src/modules/devices/actions.test.ts
npm run typecheck
npm run lint
git add src/modules/devices/actions.ts src/modules/devices/actions.test.ts
git commit -m "feat: queue Pilot Connect commands"
```

---

## Task 6: Responsive device list and create flow

**Files:**

- Create: `src/app/(protected)/devices/page.tsx`
- Create: `src/app/(protected)/devices/loading.tsx`
- Create: `src/app/(protected)/devices/error.tsx`
- Create: `src/modules/devices/components/DevicesPage.tsx`
- Create: `src/modules/devices/components/DevicesWorkspace.tsx`
- Create: `src/modules/devices/components/DevicesWorkspace.test.tsx`
- Create: `src/modules/devices/components/DeviceTable.tsx`
- Create: `src/modules/devices/components/DeviceCard.tsx`
- Create: `src/modules/devices/components/DeviceForm.tsx`
- Create: `src/modules/devices/components/DeviceStatusBadge.tsx`

**Interfaces:**

- Consumes `getDevicePageData`, create/bind/command actions, Pilot+ UI primitives.
- Produces route `/devices`, `data-testid="devices-table"` and `data-testid="devices-mobile-list"`.

- [ ] **Step 1: Write failing workspace tests**

Testing Library must verify:

- summary values;
- search by serial, IMEI, vehicle plate and name;
- status, power, update and binding filters;
- desktop table and mobile list are both published with responsive classes;
- query parameters initialize and update filters without removing unrelated parameters;
- form errors stay open;
- each success causes one toast, close and `router.refresh()`.

- [ ] **Step 2: Implement page and system states**

`page.tsx` calls `getDevicePageData()`. `loading.tsx` uses existing skeleton primitives. `error.tsx` uses Pilot+ error state with retry. Empty results distinguish an empty company from filters with zero matches.

- [ ] **Step 3: Implement toolbar**

Controls:

- search input;
- status select;
- power select;
- update select;
- binding select;
- clear filters;
- add device button.

All labels remain visible, not placeholder-only.

- [ ] **Step 4: Implement desktop table**

Use semantic `<table>`. Action menu must expose:

- «Открыть устройство»;
- «Перезагрузить»;
- «Выключить»;
- «Обновить прошивку» when available;
- «Привязать автомобиль» or «Изменить привязку».

Disabled conflict state includes text «Команда ожидает отправки».

- [ ] **Step 5: Implement mobile cards**

Cards show:

- status;
- serial and firmware;
- vehicle/plate;
- LTE operator and percentage;
- satellites;
- power/voltage/battery;
- last seen;
- compact actions.

No card relies on hover.

- [ ] **Step 6: Implement create form lifecycle**

Use a client action wrapper inside `useActionState`, matching maintenance/wash:

```ts
const submitAction = useCallback(
  async (previousState: DeviceActionState, formData: FormData) => {
    const nextState = await createDeviceAction(previousState, formData);
    if (nextState.success) {
      formRef.current?.reset();
      onSuccess(nextState.message);
    }
    return nextState;
  },
  [onSuccess],
);
```

Workspace owns `showToast → close dialog → router.refresh()`.

- [ ] **Step 7: Verify and commit**

```powershell
npx vitest run src/modules/devices/components/DevicesWorkspace.test.tsx
npm run typecheck
npm run lint
git add src/app/(protected)/devices src/modules/devices/components
git commit -m "feat: add Pilot Connect device list"
```

---

## Task 7: Device details, mini-map and command dialogs

**Files:**

- Create: `src/app/(protected)/devices/[id]/page.tsx`
- Create: `src/app/(protected)/devices/[id]/loading.tsx`
- Create: `src/app/(protected)/devices/[id]/not-found.tsx`
- Create: `src/modules/devices/components/DeviceDetailPage.tsx`
- Create: `src/modules/devices/components/DeviceDetailPage.test.tsx`
- Create: `src/modules/devices/components/DeviceCommandDialog.tsx`
- Create: `src/modules/devices/components/DeviceBindingDialog.tsx`
- Create: `src/modules/devices/components/DeviceMiniMap.tsx`
- Create: `src/modules/devices/components/DeviceCommandHistory.tsx`

**Interfaces:**

- Consumes `getDeviceDetails(id)`, binding and command actions.
- Produces route `/devices/[id]`.

- [ ] **Step 1: Write failing details tests**

Verify:

- device identity and vehicle link;
- LTE, GLONASS, power, ignition, moving and last-seen sections;
- no-position fallback;
- mini-map receives numeric coordinates;
- firmware update appears only for newer releases;
- pending command blocks conflicting actions;
- all command history statuses have Russian text and icons;
- 404 for null details.

- [ ] **Step 2: Implement Server Component route**

```tsx
export default async function DeviceRoute({ params }: PageProps<'/devices/[id]'>) {
  const { id } = await params;
  const device = await getDeviceDetails(id);
  if (!device) notFound();
  return <DeviceDetailPage device={device} />;
}
```

- [ ] **Step 3: Implement detail layout**

Desktop: two-column dashboard with identity/connectivity left and power/firmware/commands right. Mobile: single column. The map has reserved height to prevent CLS.

- [ ] **Step 4: Implement command dialogs**

- reboot: normal confirmation;
- shutdown: danger confirmation with device name + serial;
- update: required firmware selection;
- cancel: only pending command.

Every dialog has focus trap, Escape close, labelled title/description, disabled pending submit and inline errors.

- [ ] **Step 5: Implement mini-map**

Reuse existing MapLibre client loading pattern. Render one device marker. When coordinates are absent, render:

```text
Координаты ещё не получены
```

Do not add a new map provider.

- [ ] **Step 6: Verify and commit**

```powershell
npx vitest run src/modules/devices/components/DeviceDetailPage.test.tsx
npm run typecheck
npm run lint
git add src/app/(protected)/devices/[id] src/modules/devices/components
git commit -m "feat: add Pilot Connect device details"
```

---

## Task 8: Production acceptance, documentation and final review

**Files:**

- Create: `tests/devices.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `docs/CURRENT_STATE.md`
- Modify: `README.md`

**Interfaces:**

- Verifies public behavior and documents the module boundaries.

- [ ] **Step 1: Add desktop acceptance**

Playwright covers:

- list has 24 devices after seed;
- search by serial and vehicle;
- filter online/offline/update/unassigned;
- open detail;
- create a uniquely named device;
- bind it to a free vehicle;
- queue reboot, shutdown and firmware update;
- duplicate active command is blocked;
- cancel pending command;
- exactly one success-toast per action.

- [ ] **Step 2: Add mobile acceptance**

At 390×844:

```ts
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('/devices');
await expect(page.getByTestId('devices-mobile-list')).toBeVisible();
await expect(page.getByTestId('devices-table')).toBeHidden();
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
```

Verify action buttons are at least 44×44 and command dialog opens with keyboard.

- [ ] **Step 3: Verify tenant isolation through E2E seam**

Use test-only authenticated company context seam already accepted by the project. A device from another company must produce 404 and mutations must return a generic denial without disclosing its serial.

- [ ] **Step 4: Update documentation**

Document:

- routes;
- models and command state machine;
- 15-minute effective offline rule;
- seed count;
- MQTT boundary;
- migration and rollback considerations;
- known non-goals.

- [ ] **Step 5: Run final gate**

```powershell
npm run db:preflight:maintenance
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run test:unit
npm run typecheck
npm run lint
npm run build
npx playwright test tests/devices.spec.ts --project=desktop --workers=1
```

Repeat targeted production Playwright once against `next build --webpack` + `next start` if Turbopack dev shows the known worker panic.

- [ ] **Step 6: Independent whole-branch review**

Review from merge-base against:

- tenant isolation;
- migration safety;
- command conflict rules;
- exactly-once lifecycle;
- mobile accessibility;
- Prisma/Next supported patterns;
- absence of MQTT fabrication.

Fix all Critical and Important findings before integration.

- [ ] **Step 7: Commit documentation**

```powershell
git add tests/devices.spec.ts docs/PROJECT_GUIDE.md docs/CURRENT_STATE.md README.md
git commit -m "test: verify Pilot Connect device management"
```

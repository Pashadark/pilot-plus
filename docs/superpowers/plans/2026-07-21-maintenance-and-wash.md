# Pilot+ Maintenance and Wash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать полноценные модули технического обслуживания и мойки с хранением в PostgreSQL, реальными автомобилями компании, рабочими формами и адаптивными страницами.

**Architecture:** Оба модуля строятся вертикально: Prisma-модель → чистые контракты и валидация → защищённые серверные запросы и действия → клиентская рабочая область → тонкий App Router route. Все мутации повторно проверяют администратора и принадлежность автомобиля компании; `AppShell` остаётся единственной оболочкой desktop/mobile.

**Tech Stack:** Next.js 16.2 App Router, React 19 Server Actions, TypeScript, Prisma 6/PostgreSQL, Tailwind CSS v4, Vitest, Playwright.

## Global Constraints

- Весь пользовательский текст и комментарии в исходном коде пишутся по-русски.
- Использовать реальные автомобили текущей компании и локальные WebP-фотографии.
- Все интерактивные области на мобильных имеют размер не меньше 44×44 px.
- Нельзя полагаться только на цвет: каждый статус содержит текст.
- Новые UI-примитивы не создаются, если задача решается компонентами `src/shared/ui`.
- Каждая Server Action самостоятельно проверяет авторизацию и доступ к автомобилю.
- Управление пользователями и ролями не входит в этот план.

---

### Task 1: Схема PostgreSQL и доменные контракты

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260721230000_add_maintenance_and_wash/migration.sql`
- Create: `src/modules/maintenance/types.ts`
- Create: `src/modules/maintenance/validation.ts`
- Create: `src/modules/maintenance/validation.test.ts`
- Create: `src/modules/wash/types.ts`
- Create: `src/modules/wash/validation.ts`
- Create: `src/modules/wash/validation.test.ts`
- Modify: `src/database/prisma/schema.test.ts`

**Interfaces:**
- Produces: `MaintenanceStatus`, `MaintenanceKind`, `WashStatus`, `WashKind`, `OperationActionState`.
- Produces: `parseMaintenanceInput(formData)` and `parseWashInput(formData)` returning discriminated `{ ok: true, data } | { ok: false, state }`.

- [ ] **Step 1: Write failing schema and validation tests**

```ts
it('требует автомобиль, вид работы и плановую дату ТО', () => {
  const result = parseMaintenanceInput(new FormData());
  expect(result).toEqual({
    ok: false,
    state: expect.objectContaining({
      status: 'error',
      fieldErrors: expect.objectContaining({ vehicleId: expect.any(String) }),
    }),
  });
});

it('не принимает отрицательную стоимость мойки', () => {
  const form = new FormData();
  form.set('vehicleId', 'vehicle-1');
  form.set('kind', 'COMPLEX');
  form.set('scheduledAt', '2026-07-22T10:00');
  form.set('costRubles', '-1');
  expect(parseWashInput(form)).toEqual({
    ok: false,
    state: expect.objectContaining({ fieldErrors: { costRubles: expect.any(String) } }),
  });
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx vitest run src/database/prisma/schema.test.ts src/modules/maintenance/validation.test.ts src/modules/wash/validation.test.ts`

Expected: FAIL because the models and parsers do not exist.

- [ ] **Step 3: Add explicit enums and models**

```prisma
enum MaintenanceStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  OVERDUE
  CANCELLED
}
enum MaintenanceKind {
  OIL
  FILTERS
  BRAKES
  TIRES
  TIMING
  INSPECTION
  OTHER
}
enum WashStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
enum WashKind {
  BODY
  COMPLEX
  INTERIOR
  MATS
  ENGINE
  OTHER
}

model WashRecord {
  id          String     @id @default(cuid())
  vehicleId   String
  vehicle     Vehicle    @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  kind        WashKind
  status      WashStatus @default(PLANNED)
  scheduledAt DateTime
  startedAt   DateTime?
  completedAt DateTime?
  provider    String?
  costMinor   Int?
  notes       String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  @@index([vehicleId, scheduledAt])
  @@index([status, scheduledAt])
}
```

Extend `MaintenanceRecord` with `kind MaintenanceKind`, typed `status MaintenanceStatus`, `targetOdometerKm Decimal?`, `provider String?`, `costMinor Int?`, and `notes String?`. Add `washRecords WashRecord[]` to `Vehicle`.

- [ ] **Step 4: Implement strict parsers**

```ts
export type OperationActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export function parseCostMinor(value: FormDataEntryValue | null) {
  if (value === null || value === '') return { ok: true as const, value: null };
  const rubles = Number(value);
  if (!Number.isFinite(rubles) || rubles < 0 || rubles > 10_000_000)
    return { ok: false as const, error: 'Укажите стоимость от 0 до 10 000 000 ₽.' };
  return { ok: true as const, value: Math.round(rubles * 100) };
}
```

Reject invalid enum values, invalid dates, text longer than 500 characters, negative odometer values and missing required fields.

- [ ] **Step 5: Create and verify migration**

Run: `npx prisma format && npx prisma generate`, затем read-only
`npm run db:preflight:maintenance` и только после его успеха `npx prisma migrate deploy`.

Expected: schema formats, client generates, migration applies once.

- [ ] **Step 6: Run tests and commit**

Run: `npx vitest run src/database/prisma/schema.test.ts src/modules/maintenance/validation.test.ts src/modules/wash/validation.test.ts`

Expected: PASS.

Commit: `feat: add maintenance and wash data models`

---

### Task 2: Защищённые запросы и переходы статусов ТО

**Files:**
- Create: `src/modules/maintenance/status.ts`
- Create: `src/modules/maintenance/status.test.ts`
- Create: `src/modules/maintenance/server/queries.ts`
- Create: `src/modules/maintenance/server/queries.test.ts`
- Create: `src/modules/maintenance/actions.ts`
- Create: `src/modules/maintenance/actions.test.ts`

**Interfaces:**
- Consumes: Prisma `MaintenanceRecord`, `parseMaintenanceInput`.
- Produces: `listMaintenanceForUser(userId)`, `createMaintenanceAction(previous, formData)`, `transitionMaintenanceAction(previous, formData)`.

- [ ] **Step 1: Write failing transition and ownership tests**

```ts
expect(canTransitionMaintenance('PLANNED', 'IN_PROGRESS')).toBe(true);
expect(canTransitionMaintenance('COMPLETED', 'IN_PROGRESS')).toBe(false);

it('создаёт ТО только для автомобиля компании администратора', async () => {
  repository.vehicle.findFirst.mockResolvedValue(null);
  const state = await createMaintenanceAction(initialState, validFormData);
  expect(state).toEqual({ status: 'error', message: 'Автомобиль недоступен.' });
  expect(repository.maintenanceRecord.create).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run src/modules/maintenance/status.test.ts src/modules/maintenance/server/queries.test.ts src/modules/maintenance/actions.test.ts`

- [ ] **Step 3: Implement status state machine**

```ts
const allowed: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  OVERDUE: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};
export const canTransitionMaintenance = (from: MaintenanceStatus, to: MaintenanceStatus) =>
  allowed[from].includes(to);
```

- [ ] **Step 4: Implement company-scoped queries and actions**

Use `getAuthenticatedSession()` in every action. Query vehicles with:

```ts
where: { id: vehicleId, company: { members: { some: { userId: session.user.id } } } }
```

Transition with one guarded `updateMany` containing record id, current status and company membership. Set `startedAt`/`completedAt` according to the target status and call `revalidatePath('/maintenance')` only after success.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run src/modules/maintenance/status.test.ts src/modules/maintenance/server/queries.test.ts src/modules/maintenance/actions.test.ts`

Expected: PASS including unauthorized, cross-company and invalid-transition cases.

Commit: `feat: add protected maintenance workflows`

---

### Task 3: Полноценная страница технического обслуживания

**Files:**
- Create: `src/modules/maintenance/components/MaintenancePage.tsx`
- Create: `src/modules/maintenance/components/MaintenanceWorkspace.tsx`
- Create: `src/modules/maintenance/components/MaintenanceForm.tsx`
- Create: `src/modules/maintenance/components/MaintenanceRecordCard.tsx`
- Create: `src/app/(protected)/maintenance/page.tsx`
- Create: `src/app/(protected)/maintenance/loading.tsx`
- Create: `src/app/(protected)/maintenance/error.tsx`
- Create: `tests/maintenance.spec.ts`

**Interfaces:**
- Consumes: maintenance DTOs/actions plus vehicle option `{ id, label, image }`.
- Produces: `/maintenance` with `data-testid="maintenance-page"` and `data-testid="maintenance-record"`.

- [ ] **Step 1: Write failing Playwright acceptance test**

```ts
test('администратор планирует и фильтрует ТО', async ({ page }) => {
  await openAuthenticatedRoute(page, '/maintenance');
  await expect(page.getByRole('heading', { name: 'Техническое обслуживание' })).toBeVisible();
  await page.getByRole('button', { name: 'Запланировать ТО' }).click();
  await page.getByLabel('Автомобиль').selectOption({ index: 1 });
  await page.getByLabel('Вид работы').selectOption('OIL');
  await page.getByLabel('Плановая дата').fill('2026-07-23T10:00');
  await page.getByRole('button', { name: 'Сохранить ТО' }).click();
  await expect(page.getByText('ТО запланировано')).toBeVisible();
});
```

- [ ] **Step 2: Implement the server route**

```tsx
export default async function MaintenanceRoute() {
  const user = await requireAdmin();
  const [records, vehicles] = await Promise.all([
    listMaintenanceForUser(user.id),
    listVehicleOptionsForUser(user.id),
  ]);
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Техническое обслуживание' }]}>
      <MaintenancePage records={records} vehicles={vehicles} />
    </AppShell>
  );
}
```

- [ ] **Step 3: Implement desktop/mobile workspace**

Render four stat cards, urgent warnings, accessible search, status/type filters, desktop table (`hidden md:block`) and mobile cards (`md:hidden`). Derive the visible list client-side from immutable DTO props. Show textual EmptyState after filtering.

- [ ] **Step 4: Implement form and mutation feedback**

Use `useActionState(createMaintenanceAction, { status: 'idle' })`, visible labels, field errors, pending button and `useToast`. Close/reset the modal only after `state.status === 'success'`.

- [ ] **Step 5: Verify and commit**

Run: `npx playwright test tests/maintenance.spec.ts --project=desktop --workers=1`

Expected: create, filter, state transition and 390 px overflow checks PASS.

Commit: `feat: add maintenance workspace`

---

### Task 4: Защищённые запросы и переходы статусов мойки

**Files:**
- Create: `src/modules/wash/status.ts`
- Create: `src/modules/wash/status.test.ts`
- Create: `src/modules/wash/server/queries.ts`
- Create: `src/modules/wash/server/queries.test.ts`
- Create: `src/modules/wash/actions.ts`
- Create: `src/modules/wash/actions.test.ts`

**Interfaces:**
- Consumes: Prisma `WashRecord`, `parseWashInput`.
- Produces: `listWashRecordsForUser(userId)`, `createWashAction(previous, formData)`, `transitionWashAction(previous, formData)`.

- [ ] **Step 1: Write failing workflow tests**

```ts
expect(canTransitionWash('PLANNED', 'IN_PROGRESS')).toBe(true);
expect(canTransitionWash('COMPLETED', 'CANCELLED')).toBe(false);
```

Add explicit cases asserting: missing session returns `Сессия истекла. Войдите снова.`, inaccessible vehicle returns `Автомобиль недоступен.`, valid create calls `washRecord.create`, guarded transition requires `count === 1`, and repository failure returns `Не удалось сохранить мойку.`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx vitest run src/modules/wash/status.test.ts src/modules/wash/server/queries.test.ts src/modules/wash/actions.test.ts`

- [ ] **Step 3: Implement state machine and guarded repository**

```ts
const allowed: Record<WashStatus, readonly WashStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};
```

Scope every read/write through `vehicle.company.members.some.userId`. A completed record sets `completedAt`; only success calls `revalidatePath('/wash')`.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run src/modules/wash/status.test.ts src/modules/wash/server/queries.test.ts src/modules/wash/actions.test.ts`

Expected: PASS.

Commit: `feat: add protected wash workflows`

---

### Task 5: Полноценная страница мойки

**Files:**
- Create: `src/modules/wash/components/WashPage.tsx`
- Create: `src/modules/wash/components/WashWorkspace.tsx`
- Create: `src/modules/wash/components/WashForm.tsx`
- Create: `src/modules/wash/components/WashRecordCard.tsx`
- Create: `src/app/(protected)/wash/page.tsx`
- Create: `src/app/(protected)/wash/loading.tsx`
- Create: `src/app/(protected)/wash/error.tsx`
- Create: `tests/wash.spec.ts`

**Interfaces:**
- Consumes: wash DTOs/actions plus vehicle options.
- Produces: `/wash` with `data-testid="wash-page"` and `data-testid="wash-record"`.

- [ ] **Step 1: Write failing Playwright acceptance test**

```ts
test('администратор планирует мойку', async ({ page }) => {
  await openAuthenticatedRoute(page, '/wash');
  await page.getByRole('button', { name: 'Запланировать мойку' }).click();
  await page.getByLabel('Автомобиль').selectOption({ index: 1 });
  await page.getByLabel('Тип мойки').selectOption('COMPLEX');
  await page.getByLabel('Плановая дата').fill('2026-07-23T12:00');
  await page.getByRole('button', { name: 'Сохранить мойку' }).click();
  await expect(page.getByText('Мойка запланирована')).toBeVisible();
});
```

- [ ] **Step 2: Implement route, workspace and form**

Implement this route contract:

```tsx
export default async function WashRoute() {
  const user = await requireAdmin();
  const [records, vehicles] = await Promise.all([
    listWashRecordsForUser(user.id),
    listVehicleOptionsForUser(user.id),
  ]);
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Мойка' }]}>
      <WashPage records={records} vehicles={vehicles} />
    </AppShell>
  );
}
```

`WashWorkspace` renders stat cards «Сегодня», «В работе», «Завершено за месяц», «Требуют мойки», search input, `kind`/`status` selects, `hidden md:block` table, `md:hidden` cards and badges containing both icon and Russian status label.

- [ ] **Step 3: Add loading/error/empty states**

`loading.tsx` renders four `Skeleton` stat blocks plus a table skeleton. `error.tsx` is a client error boundary rendering `<ErrorState title="Мойка временно недоступна" description="Повторите попытку." />`. An empty filtered array renders `<EmptyState title="Записи не найдены" description="Измените поиск или фильтры." />`; raw exception text is never rendered.

- [ ] **Step 4: Verify and commit**

Run: `npx playwright test tests/wash.spec.ts --project=desktop --workers=1`

Expected: create, start, complete, filter and mobile overflow checks PASS.

Commit: `feat: add wash workspace`

---

### Task 6: Меню, интеграция автопарка и финальная регрессия

**Files:**
- Modify: `src/shared/components/app-shell/navigation.ts`
- Modify: `src/shared/components/app-shell/Sidebar.test.ts`
- Modify: `src/modules/vehicles/server/queries.ts`
- Modify: `src/modules/vehicles/types.ts`
- Modify: `src/modules/vehicles/components/VehicleDetailPage.tsx`
- Modify: `tests/dashboard.spec.ts`
- Modify: `tests/vehicles.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`

**Interfaces:**
- Adds navigation entries `{ label: 'Техническое обслуживание', href: '/maintenance' }` and `{ label: 'Мойка', href: '/wash' }`.
- Extends vehicle detail DTO with typed maintenance and wash history summaries.

- [ ] **Step 1: Write failing navigation tests**

```ts
expect(navigation.map(({ href }) => href)).toEqual(
  expect.arrayContaining(['/maintenance', '/wash']),
);
```

Add exact expectations in desktop and mobile menu tests:

```ts
await expect(page.getByRole('link', { name: 'Техническое обслуживание' })).toBeVisible();
await expect(page.getByRole('link', { name: 'Мойка' })).toBeVisible();
```

- [ ] **Step 2: Add menu entries with Lucide-compatible React Icons**

Use `FiTool` for maintenance and `FiDroplet` for wash. The shared `Sidebar` automatically supplies both desktop and mobile menus; do not create separate navigation arrays.

- [ ] **Step 3: Show real histories in vehicle details**

Select the latest wash records and typed maintenance fields in `vehicleSelect`. Render read-only history sections using shared badges and Russian status labels.

- [ ] **Step 4: Update canonical project guide**

Document routes, database models, action authorization rules, current completion state and the deferred admin-controlled role system.

- [ ] **Step 5: Run full verification**

Run:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npx playwright test tests/dashboard.spec.ts tests/vehicles.spec.ts tests/maintenance.spec.ts tests/wash.spec.ts --project=desktop --workers=1
npm run build
git diff --check
```

Expected: zero lint/type errors, all unit/E2E tests pass, production build succeeds, no whitespace errors.

- [ ] **Step 6: Commit the integrated result**

Commit: `feat: integrate maintenance and wash navigation`

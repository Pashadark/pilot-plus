# Rental Contracts and Database Fleet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить в Pilot+ полностью базовый автопарк и сквозное создание аренды из карточки клиента с программной генерацией согласованных DOCX/PDF.

**Architecture:** PostgreSQL является единственным источником истины для компаний, клиентов, машин, аренд и версий договоров. Серверные модули разделяют RBAC, расчёт, доступность, снимки и генерацию; Next.js Server Actions выполняют мутации с повторной авторизацией, а Route Handlers отдают только защищённые версии файлов. Excel используется один раз через валидируемый preview/apply-конвейер и не участвует в дальнейшей работе.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Prisma 6/PostgreSQL, Zod 4, Tailwind/Pilot+ UI, Vitest, Playwright, `docx` для OOXML, LibreOffice headless для PDF на сервере.

## Global Constraints

- Весь интерфейс и комментарии на русском языке.
- `SUPER_ADMIN` работает со всеми компаниями; `COMPANY_ADMIN` и `DISPATCHER` — только со своими.
- `DRIVER` и `VIEWER` не получают паспортные данные и не создают договоры.
- Excel — только пример и одноразовый импорт; источник истины — PostgreSQL.
- Машины архивируются, а не удаляются физически.
- DOCX и PDF строятся из одного неизменяемого снимка и сохраняются парой версий.
- Денежные значения хранятся целыми minor units, даты — UTC.
- Серверные действия повторно проверяют сессию, роль и `companyId`.
- Паспортные данные, содержимое документов и секреты не попадают в аудит или логи.
- Каждый новый маршрут получает геометрический skeleton, error boundary и мобильную адаптацию от 390 px.
- До Next.js-изменений использовать локальные руководства `node_modules/next/dist/docs/` для Next 16.2.
- Не изменять пользовательские незавершённые файлы `ui-kit/sections.tsx`, `VehicleDetailPage.tsx`, `VehicleOverview.tsx` без отдельного согласования.

---

## File Structure

- `src/modules/vehicles/manage/` — RBAC, формы, CRUD и Excel preview/apply.
- `src/modules/rentals/domain/` — типы, расчёт цены, пересечения и снимок.
- `src/modules/rentals/server/` — tenant queries, actions, подтверждение и генерация.
- `src/modules/rentals/documents/` — независимые DOCX-компоненты и PDF-конвертер.
- `src/modules/rentals/components/` — мастер создания и списки договоров.
- `src/app/(protected)/rentals/` — список, создание, detail/loading/error.
- `src/app/(protected)/clients/[id]/rentals/` — запуск мастера из клиента.
- `src/app/(protected)/rentals/[id]/documents/[version]/[format]/route.ts` — защищённая выдача файлов.
- `scripts/import-example-fleet.ts` — только явный локальный перенос предоставленного примера.

### Task 1: Database domain and rolling migration

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260813090000_add_rentals_and_vehicle_legal_fields/migration.sql`
- Test: `src/database/prisma/rental-schema.test.ts`

**Interfaces:**

- Produces: `Rental`, `RentalDriver`, `RentalDocumentVersion`, `ContractTemplateVersion`, расширенные `Company` и `Vehicle`.

- [ ] **Step 1: Write the failing schema test**

```ts
expect(schema).toContain('model Rental {');
expect(schema).toContain('@@index([companyId, vehicleId, startsAt, endsAt])');
expect(schema).toContain('model RentalDocumentVersion {');
expect(schema).toContain('contractTemplateVersionId String');
expect(schema).toContain('archivedAt DateTime?');
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/database/prisma/rental-schema.test.ts`  
Expected: FAIL because rental models do not exist.

- [ ] **Step 3: Add enums and models**

```prisma
enum RentalStatus { DRAFT CONFIRMED ACTIVE COMPLETED CANCELLED }
enum RentalDocumentFormat { DOCX PDF }

model Rental {
  id String @id @default(cuid())
  companyId String
  clientId String
  vehicleId String
  status RentalStatus @default(DRAFT)
  startsAt DateTime
  endsAt DateTime
  currency String @db.Char(3)
  calculatedTotalMinor Int
  agreedTotalMinor Int
  depositMinor Int
  snapshot Json?
  contractTemplateVersionId String?
  contractNumber String?
  confirmedAt DateTime?
  cancelledAt DateTime?
  createdByUserId String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([companyId, vehicleId, startsAt, endsAt])
  @@index([companyId, clientId, createdAt])
}
```

Add explicit relations, company legal/bank fields, vehicle legal/rental fields, normalized registration index, insurance dates, odometer, readiness and `archivedAt`. Create an add-only migration with indexes and foreign keys; do not alter old migrations.

- [ ] **Step 4: Verify schema and migration**

Run: `npx prisma format && npx prisma generate && npx prisma validate && npx vitest run src/database/prisma/rental-schema.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/database/prisma
git commit -m "feat(rentals): add database rental domain"
```

### Task 2: Vehicle and rental RBAC

**Files:**

- Modify: `src/modules/admin/access/permissions.ts`
- Create: `src/modules/vehicles/manage/access.ts`
- Create: `src/modules/rentals/server/access.ts`
- Test: `src/modules/vehicles/manage/access.test.ts`
- Test: `src/modules/rentals/server/access.test.ts`

**Interfaces:**

- Produces: `requireVehicleManagementAccess(companyId)`, `requireRentalAccess(companyId, mode)`.

- [ ] **Step 1: Write failing matrix tests**

```ts
expect(hasCompanyPermission('DISPATCHER', [], 'MANAGE_VEHICLES')).toBe(true);
expect(canManageRentals('COMPANY_ADMIN')).toBe(true);
expect(canManageRentals('DISPATCHER')).toBe(true);
expect(canManageRentals('VIEWER')).toBe(false);
expect(canManageRentals('DRIVER')).toBe(false);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/vehicles/manage/access.test.ts src/modules/rentals/server/access.test.ts`  
Expected: dispatcher vehicle assertion fails and rental module is missing.

- [ ] **Step 3: Implement exact tenant scope**

Add `MANAGE_VEHICLES` and `MANAGE_DOCUMENTS` to dispatcher defaults. Access functions must return either `{ scope: 'SYSTEM' }` or `{ scope: 'COMPANY'; companyIds: string[] }` and reject a passed `companyId` outside scope.

- [ ] **Step 4: Run GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/admin/access src/modules/vehicles/manage src/modules/rentals/server/access*
git commit -m "feat(rentals): authorize fleet and rental managers"
```

### Task 3: Vehicle validation and database CRUD

**Files:**

- Create: `src/modules/vehicles/manage/validation.ts`
- Create: `src/modules/vehicles/manage/actions.ts`
- Create: `src/modules/vehicles/manage/queries.ts`
- Test: `src/modules/vehicles/manage/validation.test.ts`
- Test: `src/modules/vehicles/manage/actions.test.ts`

**Interfaces:**

- Produces: `normalizeRegistrationNumber(value)`, `createVehicleAction`, `updateVehicleAction`, `archiveVehicleAction`.

- [ ] **Step 1: Write failing normalization and tenant tests**

```ts
expect(normalizeRegistrationNumber('а 429 ау 97')).toBe('А429АУ97');
expect(normalizeRegistrationNumber('A429AY97')).toBe('А429АУ97');
await expect(createVehicleForCompany('foreign-company', input)).rejects.toThrow('Доступ запрещён');
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/vehicles/manage`  
Expected: missing modules.

- [ ] **Step 3: Implement Zod input and transactional mutations**

```ts
export const vehicleInputSchema = z.object({
  companyId: z.string().min(1),
  make: z.string().trim().min(1),
  model: z.string().trim().min(1),
  registrationNumber: z.string().trim().min(6),
  vin: z.string().trim().length(17).optional().or(z.literal('')),
  year: z.coerce
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear() + 1),
  dailyPriceMinor: z.coerce.number().int().nonnegative(),
  depositMinor: z.coerce.number().int().nonnegative(),
});
```

Each mutation reauthorizes, checks normalized plate/VIN inside the company, writes vehicle and sanitized audit in one transaction. Archive sets `archivedAt`; no delete action is exposed.

- [ ] **Step 4: Run GREEN and typecheck**

Run: `npx vitest run src/modules/vehicles/manage && npm run typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/vehicles/manage
git commit -m "feat(vehicles): add tenant vehicle management"
```

### Task 4: One-time Excel preview and apply

**Files:**

- Create: `src/modules/vehicles/manage/import/types.ts`
- Create: `src/modules/vehicles/manage/import/parse-example-fleet.ts`
- Create: `src/modules/vehicles/manage/import/preview.ts`
- Create: `src/modules/vehicles/manage/import/apply.ts`
- Create: `scripts/import-example-fleet.ts`
- Test: `src/modules/vehicles/manage/import/parse-example-fleet.test.ts`
- Test: `src/modules/vehicles/manage/import/apply.test.ts`

**Interfaces:**

- Produces: `previewFleetImport(bytes, companyId): FleetImportPreview`, `applyFleetImport(previewId, decisions)`.

- [ ] **Step 1: Write RED fixture tests for four canonical vehicles**

```ts
expect(result.rows.map((row) => row.registrationNumber)).toEqual([
  'А429АУ97',
  'Е435АН997',
  'М283АМ997',
  'А156АХ997',
]);
expect(result.errors).toEqual([]);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/vehicles/manage/import`  
Expected: parser missing.

- [ ] **Step 3: Implement bounded parser and idempotent apply**

Accept `.xlsx` only, enforce a bounded byte/row limit, read the canonical «Автомобили» sheet, ignore formulas/month sheets and create a server-side preview token. Apply uses normalized plate then VIN, upserts inside one company and archives only explicit user selections.

- [ ] **Step 4: Verify duplicate-free second apply**

Run the tests from Step 2. Expected: first apply creates 4; second apply creates 0 and updates/unchanged only.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/vehicles/manage/import scripts/import-example-fleet.ts
git commit -m "feat(vehicles): import example fleet into database"
```

### Task 5: Vehicle management UI

**Files:**

- Create: `src/modules/vehicles/manage/components/VehicleForm.tsx`
- Create: `src/modules/vehicles/manage/components/FleetImportDialog.tsx`
- Modify: `src/modules/vehicles/components/VehicleListPage.tsx`
- Create: `src/app/(protected)/vehicles/new/page.tsx`
- Create: `src/app/(protected)/vehicles/new/loading.tsx`
- Test: `src/modules/vehicles/manage/components/VehicleForm.test.tsx`
- Test: `src/modules/vehicles/manage/components/FleetImportDialog.test.tsx`

**Interfaces:**

- Consumes Task 2–4 actions; produces accessible manual/import UI.

- [ ] **Step 1: Write RED UI tests**

```tsx
expect(screen.getByRole('button', { name: 'Добавить автомобиль' })).toBeVisible();
expect(screen.getByRole('button', { name: 'Импортировать Excel' })).toBeVisible();
expect(screen.getByText('Будет добавлено: 4')).toBeVisible();
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/vehicles/manage/components`.

- [ ] **Step 3: Implement with existing Pilot+ UI primitives**

Use `useActionState`, HTML validation plus server Zod errors, Russian toast, keyboard focus return, 390 px layout and preview table. Do not edit the user's dirty vehicle detail files.

- [ ] **Step 4: Run GREEN**

Run Step 2 and `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/vehicles/manage/components src/app/\(protected\)/vehicles/new src/modules/vehicles/components/VehicleListPage.tsx
git commit -m "feat(vehicles): add fleet management interface"
```

### Task 6: Rental calculation, availability and snapshot domain

**Files:**

- Create: `src/modules/rentals/domain/types.ts`
- Create: `src/modules/rentals/domain/calculate-rental.ts`
- Create: `src/modules/rentals/domain/availability.ts`
- Create: `src/modules/rentals/domain/build-snapshot.ts`
- Test: corresponding `*.test.ts` files.

**Interfaces:**

- Produces: `calculateRental(input)`, `intervalsOverlap(a,b)`, `buildRentalSnapshot(data)`.

- [ ] **Step 1: Write RED boundary tests**

```ts
expect(
  calculateRental({ startsAt: at('12:00'), endsAt: nextDay('12:00'), dailyMinor: 470000 }).days,
).toBe(1);
expect(
  calculateRental({ startsAt: at('12:00'), endsAt: nextDay('12:01'), dailyMinor: 470000 }).days,
).toBe(2);
expect(intervalsOverlap([d1, d2], [d2, d3])).toBe(false);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/rentals/domain`.

- [ ] **Step 3: Implement deterministic pure functions**

Round any positive partial 24-hour period up to a paid day; use half-open intervals `[start,end)`. Return calculated total, agreed total, discount, services and warnings. Snapshot schema is versioned (`schemaVersion: 1`) and contains only required company/client/vehicle/rental fields.

- [ ] **Step 4: Run GREEN**

Run Step 2. Expected: PASS including timezone and invalid-date cases.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/rentals/domain
git commit -m "feat(rentals): calculate and snapshot rentals"
```

### Task 7: Rental queries, drafts and atomic confirmation

**Files:**

- Create: `src/modules/rentals/server/queries.ts`
- Create: `src/modules/rentals/server/actions.ts`
- Create: `src/modules/rentals/server/confirm-rental.ts`
- Test: `src/modules/rentals/server/actions.test.ts`
- Test: `src/modules/rentals/server/confirm-rental.test.ts`

**Interfaces:**

- Produces: `createRentalDraftAction`, `updateRentalDraftAction`, `confirmRentalAction`, `cancelRentalAction`.

- [ ] **Step 1: Write RED transaction/race tests**

```ts
await confirm(firstRental);
await expect(confirm(overlappingRental)).rejects.toThrow('Автомобиль уже занят');
expect(auditAndRentalWereCommittedTogether()).toBe(true);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/rentals/server`.

- [ ] **Step 3: Implement Serializable confirmation**

Inside one `Serializable` transaction: reauthorize, reload tenant entities, validate state and documents, query overlapping `CONFIRMED|ACTIVE`, assign company-scoped number, build immutable snapshot, confirm rental and write sanitized audit. Retry Prisma `P2034` a bounded three times.

- [ ] **Step 4: Run GREEN**

Run Step 2. Expected: PASS for cross-tenant, duplicate confirmation and concurrent overlap.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/rentals/server
git commit -m "feat(rentals): confirm rentals atomically"
```

### Task 8: Versioned legal content and DOCX component generator

**Files:**

- Modify: `package.json`, `package-lock.json`
- Create: `src/modules/rentals/documents/legal-content-v1.ts`
- Create: `src/modules/rentals/documents/docx/sections/*.ts`
- Create: `src/modules/rentals/documents/docx/generate-docx.ts`
- Test: `src/modules/rentals/documents/docx/generate-docx.test.ts`

**Interfaces:**

- Produces: `generateRentalDocx(snapshot, template): Promise<Uint8Array>`.

- [ ] **Step 1: Add `docx` dependency and write RED structural test**

```ts
const bytes = await generateRentalDocx(snapshot, template);
expect(await extractText(bytes)).toContain('Договор №ME-2026-0001-BK');
expect(await extractText(bytes)).toContain('А156АХ997');
expect(await countTables(bytes)).toBeGreaterThanOrEqual(6);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/rentals/documents/docx`.

- [ ] **Step 3: Implement focused sections**

Build exact page geometry, styles, headers, vehicle/driver/document/term/requisite/penalty tables and signature blocks. Legal prose comes from `legal-content-v1.ts`; all variable values come from the snapshot. No component reads Prisma.

- [ ] **Step 4: Run GREEN and inspect generated DOCX structure**

Run Step 2. Expected: PASS and no unresolved `{{...}}` text.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json src/modules/rentals/documents
git commit -m "feat(rentals): generate rental DOCX from components"
```

### Task 9: PDF conversion and durable document pair

**Files:**

- Create: `src/modules/rentals/documents/pdf/convert-docx-to-pdf.ts`
- Create: `src/modules/rentals/server/generate-rental-documents.ts`
- Modify: `compose.yaml`, `compose.dev.yaml`, `.env.example`
- Test: `src/modules/rentals/server/generate-rental-documents.test.ts`
- Create: `docs/runbooks/rental-document-generation.md`

**Interfaces:**

- Produces: `generateRentalDocumentPair(rentalId, actor): Promise<{version:number}>`.

- [ ] **Step 1: Write RED all-or-nothing tests**

```ts
await expect(generatePair(pdfConverterFails)).rejects.toThrow('PDF');
expect(await repository.listReadyVersions()).toHaveLength(0);
expect(await storage.listTemporary()).toHaveLength(0);
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/rentals/server/generate-rental-documents.test.ts`.

- [ ] **Step 3: Implement bounded LibreOffice process and pair promotion**

Use a dedicated temp directory, hard timeout, no shell interpolation, fixed executable path/config and stdout sanitization. Generate DOCX once, convert that exact byte stream, verify `%PDF-`, hash both, promote both private files, then atomically create two format rows for one version. Cleanup on every failure.

- [ ] **Step 4: Run GREEN and live converter smoke test**

Run unit tests plus documented local container/runtime smoke test. Expected: DOCX/PDF contain the same contract number, plate, dates and total.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/rentals/documents/pdf src/modules/rentals/server/generate-rental-documents* compose* .env.example docs/runbooks/rental-document-generation.md
git commit -m "feat(rentals): persist DOCX and PDF contract pairs"
```

### Task 10: Protected download routes

**Files:**

- Create: `src/app/(protected)/rentals/[id]/documents/[version]/[format]/route.ts`
- Test: sibling `route.test.ts`

**Interfaces:**

- Consumes document version metadata; returns exact tenant-scoped attachment.

- [ ] **Step 1: Write RED authorization/version tests**

Test own-company admin/dispatcher success, foreign company and driver 404/403, nonexistent version, invalid format, safe RFC 5987 filename and sanitized audit.

- [ ] **Step 2: Run RED**

Run the route test. Expected: module missing.

- [ ] **Step 3: Implement exact-version route**

Read params asynchronously per Next 16.2, authorize before storage access, select exact `rentalId+version+format`, stream with `private, no-store` and audit only identifiers.

- [ ] **Step 4: Run GREEN**

Run route test and `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add "src/app/(protected)/rentals/[id]/documents"
git commit -m "feat(rentals): protect contract downloads"
```

### Task 11: Rental wizard and client integration

**Files:**

- Create: `src/modules/rentals/components/RentalWizard.tsx`
- Create: `src/modules/rentals/components/steps/*.tsx`
- Create: `src/app/(protected)/clients/[id]/rentals/new/page.tsx`
- Create: sibling `loading.tsx`, `error.tsx`
- Modify: current client detail component through its exported extension point.
- Test: component and route tests.

**Interfaces:**

- Consumes Tasks 6–9; produces six-step Russian wizard.

- [ ] **Step 1: Write RED accessibility/state tests**

```tsx
expect(screen.getByRole('heading', { name: 'Новый договор аренды' })).toBeVisible();
expect(screen.getByText('Шаг 1 из 6')).toBeVisible();
expect(screen.getByRole('button', { name: 'Подтвердить и занять автомобиль' })).toBeDisabled();
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/rentals/components`.

- [ ] **Step 3: Implement wizard with server actions**

Autofill client/company/vehicle data, show unavailable reasons, live deterministic calculation, warning summary, draft save and confirm action. Use existing Button/Input/Card/Toast/Skeleton; preserve focus and data between steps.

- [ ] **Step 4: Run GREEN and mobile component test**

Run Step 2 and typecheck. Expected: PASS, no horizontal overflow at 390 px fixture.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/rentals/components "src/app/(protected)/clients/[id]/rentals"
git commit -m "feat(rentals): create contracts from client cards"
```

### Task 12: Rental list, calendar and detail

**Files:**

- Create: `src/app/(protected)/rentals/page.tsx`, `loading.tsx`, `error.tsx`
- Create: `src/app/(protected)/rentals/[id]/page.tsx`, `loading.tsx`, `error.tsx`
- Create: `src/modules/rentals/components/RentalListPage.tsx`
- Create: `src/modules/rentals/components/RentalCalendar.tsx`
- Create: `src/modules/rentals/components/RentalDetailPage.tsx`
- Modify: navigation configuration.
- Test: page/component tests.

- [ ] **Step 1: Write RED list/calendar tests**

Verify Russian statuses, filters, tenant scope, contract downloads, day entries with vehicle/client and mobile list fallback.

- [ ] **Step 2: Run RED**

Run focused rental page tests.

- [ ] **Step 3: Implement pages and skeleton geometry**

Use server queries, links for navigation, buttons for mutations, accessible calendar grid and detail history. The navigation item is hidden for driver/viewer without qualifying access.

- [ ] **Step 4: Run GREEN**

Run focused tests and typecheck. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add "src/app/(protected)/rentals" src/modules/rentals/components src/shared
git commit -m "feat(rentals): add rental calendar and history"
```

### Task 13: Seed the four database vehicles and company contract defaults

**Files:**

- Modify: `src/database/prisma/seed.ts`
- Test: `src/database/prisma/fleet-seed.test.ts`
- Test: `src/database/prisma/rental-seed.test.ts`

- [ ] **Step 1: Write RED idempotency test**

```ts
await seedRentalFixtures(env, db);
await seedRentalFixtures(env, db);
expect(await db.vehicle.count({ where: { companyId } })).toBe(4);
```

- [ ] **Step 2: Run RED**

Run seed tests. Expected: missing new seed behavior.

- [ ] **Step 3: Implement explicit demo fixtures**

Seed four approved vehicles into the demo company, including Polo legal fields from the sample contract. Do not seed real client passport data. Company contract defaults must use environment/explicit demo values and be marked demo.

- [ ] **Step 4: Run GREEN without touching shared DB**

Run tests only. Apply `npm run db:seed` later after migration backup/approval.

- [ ] **Step 5: Commit**

```powershell
git add src/database/prisma/seed.ts src/database/prisma/*seed.test.ts
git commit -m "feat(rentals): seed four example fleet vehicles"
```

### Task 14: End-to-end verification, docs and deployment gate

**Files:**

- Create: `tests/rentals.spec.ts`
- Extend: `tests/vehicles.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`, `docs/CURRENT_STATE.md`

- [ ] **Step 1: Write E2E scenarios**

Cover admin/dispatcher add vehicle, four-row preview/apply, create client rental, overlap rejection, confirm, download DOCX/PDF, cross-tenant denial, driver denial, 390 px overflow and skeleton route.

- [ ] **Step 2: Run focused RED then fix code defects only**

Run: `npx playwright test tests/vehicles.spec.ts tests/rentals.spec.ts --workers=1`.

- [ ] **Step 3: Run full quality gate**

```powershell
npm run lint
npm run typecheck
npm run test:unit
npx prisma validate
npm run build
npx playwright test tests/auth.spec.ts tests/clients.spec.ts tests/vehicles.spec.ts tests/rentals.spec.ts --workers=1
npx prettier --check docs/PROJECT_GUIDE.md docs/CURRENT_STATE.md
git diff --check
```

Expected: all commands PASS; baseline warnings documented, no new errors.

- [ ] **Step 4: Backup, deploy migration, reconcile and seed**

Create a timestamped PostgreSQL dump, run `npx prisma migrate deploy`, `npx prisma generate`, existing client-document reconciliation, then `npm run db:seed`. Verify exactly four approved demo fleet records and no duplicate normalized plates.

- [ ] **Step 5: Visual document gate**

Generate the reference Polo contract, render every DOCX/PDF page to PNG, inspect tables, signatures, wrapping, Cyrillic fonts and equality of contract number, dates, plate and amounts. Fix and repeat until clean.

- [ ] **Step 6: Commit**

```powershell
git add tests docs/PROJECT_GUIDE.md docs/CURRENT_STATE.md
git commit -m "test(rentals): verify fleet contract workflow"
```

## Self-review result

- Spec coverage: database ownership, four vehicles, RBAC, manual CRUD, one-time Excel example, company data, rental lifecycle, calculation, availability, DOCX/PDF, protected storage, client/list/calendar UI, audit and recovery are mapped to Tasks 1–14.
- Placeholder scan: no TBD/TODO or unspecified implementation steps remain.
- Type consistency: `Rental` snapshot, `generateRentalDocx`, `generateRentalDocumentPair` and protected version routes are produced before their consumers.
- Scope: electronic signature, messaging, online payment, OCR and visual legal editor remain excluded from this first release.

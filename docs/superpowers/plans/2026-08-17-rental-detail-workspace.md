# Rental Detail Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, responsive Pilot+ rental detail workspace that exposes every real rental field, distinguishes imported legacy records from immutable confirmed snapshots, and presents documents and lifecycle history honestly.

**Architecture:** Keep the route as a Server Component and move presentation normalization into a pure typed mapper. Expand the tenant-scoped Prisma projection, render the workspace through small rental components built from existing Pilot+ primitives, and keep copy-ID/toast behavior in a narrow client island. No schema migration is required because all necessary financial and lifecycle fields already exist.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript strict mode, Prisma 6.16, Tailwind CSS 4, Pilot+ shared UI, Vitest.

## Global Constraints

- Preserve the existing tenant boundary in `getRentalDetailForCurrentUser`; foreign IDs must remain indistinguishable from missing IDs.
- Show the business contract number as primary and the PostgreSQL technical ID to every authorized employee.
- Use only persisted fields or the immutable snapshot; never invent missing addresses, documents, audit events, or user attribution.
- Render every rental status in Russian and never expose raw enum values in the UI.
- Use existing semantic CSS variables and shared `Card`, `Badge`, `Button`, and skeleton primitives.
- Every interactive target must be at least 44×44 px and work from the keyboard.
- Desktop uses a responsive grid; 390 px mobile uses one column without horizontal overflow.
- Do not modify the user's existing unstaged changes in `docs/PROJECT_GUIDE.md`, `src/app/(protected)/ui-kit/sections.tsx`, `VehicleDetailPage.tsx`, or `VehicleOverview.tsx`.
- Before editing Next.js route files, read the relevant App Router guides under `node_modules/next/dist/docs/`.

---

## File Structure

- Modify `src/modules/rentals/server/queries.ts` — tenant-scoped detail projection containing only fields needed by the workspace.
- Modify `src/modules/rentals/components/rental-detail-presentation.ts` — pure normalization of live fields, immutable snapshots, imported records, labels, money, dates, lifecycle, and issuance data.
- Modify `src/modules/rentals/components/rental-detail-presentation.test.ts` — mapper regression coverage.
- Create `src/modules/rentals/components/RentalIdentityHeader.tsx` — heading, Russian status, technical ID and client-side copy control.
- Create `src/modules/rentals/components/RentalSummaryCards.tsx` — term, total, deposit, client and vehicle summary.
- Create `src/modules/rentals/components/RentalFinancialCard.tsx` — complete financial breakdown.
- Create `src/modules/rentals/components/RentalHandoverCard.tsx` — issue/return and operating conditions.
- Create `src/modules/rentals/components/RentalLifecycle.tsx` — system milestone timeline distinct from audit.
- Create `src/modules/rentals/components/RentalDetailWorkspace.tsx` — server-friendly composition of the detail sections.
- Create `src/modules/rentals/components/RentalDetailWorkspace.test.tsx` — rendered UI coverage.
- Modify `src/modules/rentals/components/RentalDetailPanel.tsx` — consistent document actions, Russian generation states, honest empty copy, and translated audit actions.
- Modify `src/modules/rentals/components/RentalDetailPanel.test.tsx` — document/audit behavior.
- Modify `src/app/(protected)/rentals/[id]/page.tsx` — route composition and links.
- Modify `src/app/(protected)/rentals/loading.tsx` — geometry-matched skeleton.
- Modify `src/app/(protected)/rentals/[id]/route-states.test.tsx` if present; otherwise create it — not-found and loading structure assertions.

---

### Task 1: Tenant-Scoped Detail Projection and Pure Presentation Model

**Files:**

- Modify: `src/modules/rentals/server/queries.ts`
- Modify: `src/modules/rentals/components/rental-detail-presentation.ts`
- Modify: `src/modules/rentals/components/rental-detail-presentation.test.ts`

**Interfaces:**

- Consumes: `Rental`, immutable `snapshot`, related `client`, `vehicle`, `drivers`, `documentVersions`, and `documentGenerations` from Prisma.
- Produces: `RentalDetailView` and `rentalDetailPresentation(input: RentalDetailInput): RentalDetailView` for Tasks 2–4.

- [ ] **Step 1: Add failing mapper tests for the imported completed rental**

Add a fixture equivalent to `ME-2026-0001-BK` and assert the persisted values:

```ts
const imported = rentalDetailPresentation({
  id: 'cmswhu2sq0001tu0ghdiulou2',
  contractNumber: 'ME-2026-0001-BK',
  status: 'COMPLETED',
  snapshot: { importedFrom: 'contracts-001-010', contractNumber: 'ME-2026-0001-BK' },
  clientId: 'client-1',
  clientLabel: 'Барышева Кристина Олеговна',
  vehicleId: 'vehicle-1',
  vehicleLabel: "Kia · Cee'd · А429АУ997",
  startsAt: '2026-08-11T21:00:00.000Z',
  endsAt: '2026-08-13T21:00:00.000Z',
  createdAt: '2026-08-11T21:00:00.000Z',
  updatedAt: '2026-08-13T21:00:00.000Z',
  confirmedAt: '2026-08-11T21:00:00.000Z',
  activatedAt: '2026-08-11T21:00:00.000Z',
  completedAt: '2026-08-13T21:00:00.000Z',
  cancelledAt: null,
  currency: 'RUB',
  dailyRateMinor: 470000n,
  billableDays: 2,
  basePriceMinor: 940000n,
  discountMinor: 0n,
  servicesMinor: 0n,
  totalPriceMinor: 940000n,
  depositMinor: 1500000n,
  includedMileageKm: 250,
  overageMileagePriceMinor: 1000n,
  missingFuelPriceMinor: 10000n,
  priceOverrideReason: null,
  drivers: [],
});

expect(imported.source.label).toBe('Импортированный договор');
expect(imported.status.label).toBe('Завершён');
expect(imported.finance.deposit).toBe('15 000 ₽');
expect(imported.finance.dailyRate).toBe('4 700 ₽');
expect(imported.finance.total).toBe('9 400 ₽');
expect(imported.term.billableDaysLabel).toBe('2 дня');
expect(imported.lifecycle.at(-1)?.label).toBe('Аренда завершена');
```

- [ ] **Step 2: Run the mapper tests and verify RED**

Run:

```powershell
npx vitest run src/modules/rentals/components/rental-detail-presentation.test.ts
```

Expected: FAIL because the current mapper lacks identifiers, finance, Russian statuses, imported-source detection, and lifecycle milestones.

- [ ] **Step 3: Define the typed presentation model and normalization helpers**

Implement explicit exported types:

```ts
export type RentalDetailInput = {
  id: string;
  contractNumber: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  snapshot: unknown;
  clientId: string;
  clientLabel: string;
  vehicleId: string;
  vehicleLabel: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  currency: string;
  dailyRateMinor: bigint;
  billableDays: number;
  basePriceMinor: bigint;
  discountMinor: bigint;
  servicesMinor: bigint;
  totalPriceMinor: bigint;
  depositMinor: bigint | null;
  includedMileageKm: number | null;
  overageMileagePriceMinor: bigint | null;
  missingFuelPriceMinor: bigint | null;
  priceOverrideReason: string | null;
  drivers: readonly { id: string; label: string }[];
};

export type RentalDetailView = {
  id: string;
  contractNumber: string;
  status: { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' };
  source: { label: string; description: string };
  client: { id: string; label: string };
  vehicle: { id: string; label: string };
  term: { startsAt: string; endsAt: string; billableDaysLabel: string };
  finance: Record<
    'dailyRate' | 'basePrice' | 'discount' | 'services' | 'total' | 'deposit',
    string
  >;
  operations: {
    includedMileage: string;
    overagePrice: string;
    missingFuelPrice: string;
    pickupAddress: string;
    returnAddress: string;
    startMileage: string;
    returnMileage: string;
    startFuel: string;
    returnFuel: string;
    territory: string;
    paymentTerms: string;
    allowedDrivers: readonly string[];
    conditions: string;
  };
  lifecycle: readonly { key: string; label: string; occurredAt: string }[];
};
```

Use `Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })`, Moscow time, explicit Russian pluralization, and `Не указано` for absent optional values. Detect an imported record from `snapshot.importedFrom` without treating its lifecycle status as DRAFT.

- [ ] **Step 4: Expand the Prisma projection**

In `getRentalDetailForCurrentUser`, replace broad relation inclusion with an explicit `select` that includes the Task 1 fields, relation IDs, safe labels, drivers' safe snapshots, document metadata, and lifecycle timestamps. Preserve:

```ts
where: {
  id,
  ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
}
```

Do not select encrypted client fields, private document paths, hashes, or generation diagnostics.

- [ ] **Step 5: Run mapper and query tests GREEN**

Run:

```powershell
npx vitest run src/modules/rentals/components/rental-detail-presentation.test.ts src/modules/rentals/server/queries.test.ts
```

Expected: both files PASS and the imported completed rental remains `Завершён`.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/modules/rentals/server/queries.ts src/modules/rentals/components/rental-detail-presentation.ts src/modules/rentals/components/rental-detail-presentation.test.ts
git commit -m "feat(rentals): project complete rental details"
```

---

### Task 2: Rental Identity, Summary, Finance, and Handover Components

**Files:**

- Create: `src/modules/rentals/components/RentalIdentityHeader.tsx`
- Create: `src/modules/rentals/components/RentalSummaryCards.tsx`
- Create: `src/modules/rentals/components/RentalFinancialCard.tsx`
- Create: `src/modules/rentals/components/RentalHandoverCard.tsx`
- Create: `src/modules/rentals/components/RentalLifecycle.tsx`
- Create: `src/modules/rentals/components/RentalDetailWorkspace.tsx`
- Create: `src/modules/rentals/components/RentalDetailWorkspace.test.tsx`

**Interfaces:**

- Consumes: `RentalDetailView` from Task 1.
- Produces: `<RentalDetailWorkspace detail={detail} />` and an internal copy-ID client island.

- [ ] **Step 1: Write a failing rendered workspace test**

Render the Task 1 imported fixture and assert:

```tsx
expect(screen.getByRole('heading', { name: 'ME-2026-0001-BK' })).toBeTruthy();
expect(screen.getByText('cmswhu2sq0001tu0ghdiulou2')).toBeTruthy();
expect(screen.getByRole('button', { name: 'Копировать ID договора' })).toBeTruthy();
expect(screen.getByText('Завершён')).toBeTruthy();
expect(screen.getByText('15 000 ₽')).toBeTruthy();
expect(screen.getByText('4 700 ₽')).toBeTruthy();
expect(screen.getByText('250 км')).toBeTruthy();
expect(screen.getByText('Аренда завершена')).toBeTruthy();
expect(container.innerHTML).not.toMatch(/COMPLETED|undefined|null/u);
```

Also assert the component root uses `min-w-0`, summary cards use responsive grid classes, and buttons use the shared `Button` API rather than local height classes.

- [ ] **Step 2: Run the workspace test and verify RED**

Run:

```powershell
npx vitest run src/modules/rentals/components/RentalDetailWorkspace.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the identity header and copy interaction**

Build the header with `PageHeader`, `Badge`, links to `/clients/${detail.client.id}` and `/vehicles/${detail.vehicle.id}`, plus a client-only copy button:

```ts
await navigator.clipboard.writeText(id);
showToast({ tone: 'success', title: 'ID договора скопирован.' });
```

The copy action uses `Button size="sm" variant="secondary"` with a text label and an icon marked `aria-hidden`.

- [ ] **Step 4: Implement the summary and finance cards**

Compose `Card`, `CardHeader`, and `CardContent`. Use one semantic data-list pattern for labels and values. Render missing values as `Не указано`; never coerce nullable deposit or tariffs to zero.

- [ ] **Step 5: Implement handover, operating conditions, and lifecycle**

Render issue and return as sibling sections on desktop and stacked sections on mobile. Keep lifecycle events in timestamp order and label them only from system timestamps:

```ts
const labels = {
  created: 'Договор создан',
  confirmed: 'Договор подтверждён',
  activated: 'Автомобиль выдан',
  completed: 'Аренда завершена',
  cancelled: 'Договор отменён',
} as const;
```

Do not attach an actor to lifecycle milestones.

- [ ] **Step 6: Run the workspace test GREEN**

Run:

```powershell
npx vitest run src/modules/rentals/components/RentalDetailWorkspace.test.tsx
```

Expected: PASS with Russian status, technical ID, full finance, mobile-safe classes, and no raw nullish values.

- [ ] **Step 7: Commit Task 2**

```powershell
git add src/modules/rentals/components/RentalIdentityHeader.tsx src/modules/rentals/components/RentalSummaryCards.tsx src/modules/rentals/components/RentalFinancialCard.tsx src/modules/rentals/components/RentalHandoverCard.tsx src/modules/rentals/components/RentalLifecycle.tsx src/modules/rentals/components/RentalDetailWorkspace.tsx src/modules/rentals/components/RentalDetailWorkspace.test.tsx
git commit -m "feat(rentals): add complete rental workspace"
```

---

### Task 3: Documents, Generation States, and Honest Audit Timeline

**Files:**

- Modify: `src/modules/rentals/components/RentalDetailPanel.tsx`
- Modify: `src/modules/rentals/components/RentalDetailPanel.test.tsx`
- Modify: `src/modules/rentals/server/queries.ts`

**Interfaces:**

- Consumes: rental source mode, safe document versions, safe generation status, and PII-free audit projection.
- Produces: `<RentalDetailPanel rental documents history generations source />` with translated actions and consistent controls.

- [ ] **Step 1: Add failing document and audit tests**

Cover three states:

```tsx
// Imported completed rental with no pair
expect(screen.getByText('Для импортированного договора файлы не формировались.')).toBeTruthy();

// CLEAN pair
expect(screen.getByRole('link', { name: 'Скачать DOCX, версия 1' })).toBeTruthy();
expect(screen.getByRole('link', { name: 'Скачать PDF, версия 1' })).toBeTruthy();

// PII-free audit
expect(screen.getByText('Договор подтверждён')).toBeTruthy();
expect(screen.queryByText('CONFIRM')).toBeNull();
```

Assert that an empty audit says `Для этого договора действия пользователей не зафиксированы.` and does not synthesize system timestamps as user actions.

- [ ] **Step 2: Run the panel test and verify RED**

Run:

```powershell
npx vitest run src/modules/rentals/components/RentalDetailPanel.test.tsx
```

Expected: FAIL on untranslated actions, generic empty copy, and inconsistent link buttons.

- [ ] **Step 3: Translate safe generation and audit codes**

Use explicit exhaustive maps:

```ts
const generationLabels = {
  PENDING: 'Ожидает подготовки',
  PROMOTED: 'Проверяется',
  COMMITTED: 'Готово',
  ERROR: 'Не удалось подготовить',
  CLEANING: 'Удаляется',
} as const;

const auditLabels: Record<string, string> = {
  CREATE: 'Черновик создан',
  UPDATE: 'Договор изменён',
  CONFIRM: 'Договор подтверждён',
  CANCEL: 'Договор отменён',
  GENERATE_DOCUMENTS: 'Документы сформированы',
  DOWNLOAD: 'Документ скачан',
};
```

Unknown safe action codes render as `Действие с договором`, never as the raw code.

- [ ] **Step 4: Normalize document controls**

Render protected links using the same `min-h-11`, radius, typography, focus outline, and icon/text arrangement as `Button size="md"`. Keep the route unchanged:

```ts
`/rentals/${rental.id}/documents/${document.version}/${document.format}`;
```

Use precise accessible names and display version metadata separately.

- [ ] **Step 5: Keep audit projection PII-free**

Select only `id`, `action`, and `createdAt` from `AuditLog`. Do not add `metadata`, document filenames, actor email, client name, or decrypted identity fields.

- [ ] **Step 6: Run panel tests GREEN**

Run:

```powershell
npx vitest run src/modules/rentals/components/RentalDetailPanel.test.tsx src/modules/rentals/server/queries.test.ts
```

Expected: PASS for imported empty state, protected pair, generation labels, and audit translation.

- [ ] **Step 7: Commit Task 3**

```powershell
git add src/modules/rentals/components/RentalDetailPanel.tsx src/modules/rentals/components/RentalDetailPanel.test.tsx src/modules/rentals/server/queries.ts
git commit -m "feat(rentals): clarify documents and rental audit"
```

---

### Task 4: Route Composition, Skeleton, and Complete Verification

**Files:**

- Modify: `src/app/(protected)/rentals/[id]/page.tsx`
- Modify: `src/app/(protected)/rentals/loading.tsx`
- Create or modify: `src/app/(protected)/rentals/[id]/route-states.test.tsx`
- Modify: `docs/PROJECT_GUIDE.md` only if the user's existing unstaged version can be updated without overwriting unrelated changes.

**Interfaces:**

- Consumes: `RentalDetailView`, `RentalDetailWorkspace`, and `RentalDetailPanel` from Tasks 1–3.
- Produces: completed `/rentals/[id]` route with a geometry-matched loading state.

- [ ] **Step 1: Read the installed Next.js guides before route edits**

Read the full relevant local pages found under `node_modules/next/dist/docs/` for App Router dynamic segments, `notFound()`, loading UI, and Server Components. Record no code changes in this step.

- [ ] **Step 2: Write failing route/loading tests**

Mock the tenant-scoped query and assert:

```tsx
expect(markup).toContain('data-testid="rental-detail-page"');
expect(markup).toContain('ME-2026-0001-BK');
expect(markup).toContain('cmswhu2sq0001tu0ghdiulou2');
expect(markup).toContain('15 000 ₽');
expect(markup).not.toContain('COMPLETED');
```

For loading, assert reserved blocks for the identity header, four summary cards, finance, handover, documents, and timeline. Keep foreign/missing records on the existing `notFound()` path.

- [ ] **Step 3: Run route tests and verify RED**

Run:

```powershell
npx vitest run "src/app/(protected)/rentals/[id]/route-states.test.tsx"
```

Expected: FAIL because the route still renders its legacy technical `<dl>` and the skeleton does not match the final geometry.

- [ ] **Step 4: Compose the new route**

Keep data loading on the server:

```tsx
const rental = await getRentalDetailForCurrentUser(id);
if (!rental) notFound();
const detail = rentalDetailPresentation(toRentalDetailInput(rental));

return (
  <AppShell breadcrumbs={breadcrumbs}>
    <main className="grid min-w-0 gap-5 p-4 sm:p-6" data-testid="rental-detail-page">
      <RentalDetailWorkspace detail={detail} />
      <RentalDetailPanel
        rental={panelRental}
        documents={documents}
        generations={generations}
        history={history}
        source={detail.source.label}
      />
    </main>
  </AppShell>
);
```

Do not fetch from Client Components and do not expose Prisma records directly to the browser.

- [ ] **Step 5: Implement the geometry-matched skeleton**

Use existing skeleton classes/tokens to reserve the same vertical structure as the completed page: one header block, four summary blocks, two large content cards, documents, and history. Add `aria-label="Загрузка договора аренды"`.

- [ ] **Step 6: Run all rental-focused tests**

Run:

```powershell
npx vitest run src/modules/rentals "src/app/(protected)/rentals/[id]/route-states.test.tsx"
```

Expected: all rental module and route-state tests PASS.

- [ ] **Step 7: Verify the real imported record in the browser**

Open:

```text
http://127.0.0.1:3001/rentals/cmswhu2sq0001tu0ghdiulou2
```

Confirm `ME-2026-0001-BK`, technical ID, `Завершён`, 15 000 ₽ deposit, 4 700 ₽ daily rate, 2 billable days, 9 400 ₽ total, 250 km allowance, 14.08.2026 completion, honest missing documents, and honest missing audit. Check desktop and 390 px layouts without horizontal overflow.

- [ ] **Step 8: Run repository quality gates**

Run sequentially:

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx prettier --check src/modules/rentals "src/app/(protected)/rentals/[id]"
git diff --check
```

Expected: TypeScript and build succeed; unit tests pass; lint has no errors; changed files pass Prettier; diff check is clean except any explicitly documented pre-existing user whitespace outside this task.

- [ ] **Step 9: Update the project guide without overwriting user changes**

Append one concise bullet under the working rental features stating that `/rentals/[id]` now exposes full finance, deposit, issue/return conditions, documents, lifecycle, and audit. If `docs/PROJECT_GUIDE.md` still contains unrelated unstaged user changes, patch only the exact rental paragraph and inspect the resulting diff before staging.

- [ ] **Step 10: Commit Task 4**

```powershell
git add "src/app/(protected)/rentals/[id]/page.tsx" src/app/(protected)/rentals/loading.tsx "src/app/(protected)/rentals/[id]/route-states.test.tsx" docs/PROJECT_GUIDE.md
git commit -m "feat(rentals): finish rental detail experience"
```

Before committing, use `git diff --cached --name-only` and remove any unrelated user file or hunk from the index.

---

## Final Review Checklist

- [ ] Every requirement in `docs/superpowers/specs/2026-08-17-rental-detail-workspace-design.md` maps to Tasks 1–4.
- [ ] No migration or seed is introduced.
- [ ] Tenant access remains server-enforced.
- [ ] Imported snapshot fallback never changes persisted legal data.
- [ ] Lifecycle timestamps and user audit remain visually and semantically separate.
- [ ] No raw enum, `undefined`, `null`, storage key, hash, or encrypted PII appears in rendered output.
- [ ] The real imported record is checked without mutating it.
- [ ] Existing user changes remain unstaged and preserved.

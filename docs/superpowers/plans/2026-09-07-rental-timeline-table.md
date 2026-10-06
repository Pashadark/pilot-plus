# Rental Timeline Table Implementation Plan

> **Execution:** Implement this plan task-by-task in the current workspace. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current wide rental list with the approved time-first table, using real vehicle images, operational urgency, payment/deposit facts, responsive mobile rows, and working contextual actions.

**Architecture:** Extend the tenant-scoped rental list projection with the minimum vehicle image, client phone, payment, operation, and deposit-settlement data. Keep pure presentation calculations in focused helpers and render desktop/mobile views from the same view model. Reuse existing protected vehicle image routes and rental actions; do not create a second source of truth.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Prisma 6.16, Tailwind CSS 4, React Icons, Vitest, Playwright.

## Global Constraints

- Use real tenant-scoped database data only; never hardcode Горбунов, Статун, payments, deposits, or images.
- An expired end date never auto-closes an active rental.
- Vehicle images use the existing primary-image route and existing placeholder behavior.
- All visible dates use `Europe/Moscow`.
- Desktop body text stays at 14–16 px; mobile has no horizontal page overflow at 375 px.
- One primary action per row; secondary actions remain in a compact menu.
- Do not change rental operation, payment, settlement, or authorization semantics.

---

### Task 1: Extend the rental list projection

**Files:**
- Modify: `src/modules/rentals/server/queries.ts`
- Modify: `src/app/(protected)/rentals/page.tsx`
- Test: `src/modules/rentals/server/queries.test.ts`

**Interfaces:**
- Produces: list rows with `client.phoneEncrypted`, `vehicle.internalNumber`, `vehicle.city`, `vehicle.images`, confirmed `payments`, committed `operations`, and latest committed return settlement.
- Consumes: existing `listFilteredRentalsForCurrentUser(filters)` route contract.

- [x] **Step 1: Write a failing query-contract test**

Assert that the Prisma select includes:

```ts
expect(select.client.select).toEqual(
  expect.objectContaining({ firstName: true, lastName: true, phoneEncrypted: true }),
);
expect(select.vehicle.select).toEqual(
  expect.objectContaining({
    internalNumber: true,
    city: true,
    images: expect.objectContaining({
      orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
      take: 1,
    }),
  }),
);
expect(select.payments).toBeTruthy();
expect(select.operations).toBeTruthy();
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/modules/rentals/server/queries.test.ts`  
Expected: FAIL because the additional projection is absent.

- [x] **Step 3: Add the minimal Prisma projection**

Use the existing rental relationships and return only fields required by the table. Restrict payments to `CONFIRMED`; restrict operations to `COMMITTED`. Select the primary image first and expose its existing local path metadata through the route mapper.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run src/modules/rentals/server/queries.test.ts`  
Expected: PASS.

### Task 2: Build the time-first presentation model

**Files:**
- Modify: `src/modules/rentals/components/rental-list-presentation.ts`
- Test: `src/modules/rentals/components/rental-list-presentation.test.ts`

**Interfaces:**
- Produces: `presentRentalListRow(row, now)` with `urgency`, `progressPercent`, `remainingLabel`, `paymentLabel`, `paymentPercent`, `depositLabel`, `primaryAction`, and `vehicleImage`.
- Consumes: the enriched server projection from Task 1.

- [x] **Step 1: Add failing presentation tests**

Cover these exact behaviors:

```ts
expect(todayRow.primaryAction).toBe('EXTEND');
expect(todayRow.remainingLabel).toMatch(/сегодня|осталось/u);
expect(overdueRow.primaryAction).toBe('EXTEND');
expect(overdueRow.remainingLabel).toMatch(/просрочено/u);
expect(activeRow.progressPercent).toBeGreaterThanOrEqual(0);
expect(activeRow.progressPercent).toBeLessThanOrEqual(100);
expect(paidRow.paymentLabel).toContain('оплачено');
expect(returnedDepositRow.depositLabel).toContain('Возвращён');
```

Also assert that an ended `ACTIVE` rental remains `ACTIVE` and is never presented as completed.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/modules/rentals/components/rental-list-presentation.test.ts`  
Expected: FAIL because the approved fields do not exist.

- [x] **Step 3: Implement pure Moscow-time calculations**

Add focused helpers for bounded progress, human remaining time, confirmed payment totals, deposit state, urgency priority, and primary action. Do not inspect browser time directly; accept `now` as the existing function already does.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run src/modules/rentals/components/rental-list-presentation.test.ts`  
Expected: PASS.

### Task 3: Rebuild the responsive rental workspace

**Files:**
- Modify: `src/modules/rentals/components/RentalListPage.tsx`
- Modify: `src/modules/rentals/components/RentalListPage.test.tsx`
- Create: `src/modules/rentals/components/RentalVehicleThumbnail.tsx`
- Create: `src/modules/rentals/components/RentalTimelineBar.tsx`

**Interfaces:**
- `RentalVehicleThumbnail({ image, model, city, href })` renders the real image or the existing branded fallback without layout shift.
- `RentalTimelineBar({ startsAt, endsAt, progressPercent, urgency, remainingLabel })` renders the accessible time scale.
- `RentalListPage` keeps its existing props and URLs.

- [x] **Step 1: Write failing component tests**

Assert the approved hierarchy and interactions:

```ts
expect(screen.getByRole('heading', { name: 'Договоры аренды' })).toBeTruthy();
expect(screen.getByText(/Сегодня требуют действия/u)).toBeTruthy();
expect(screen.getByRole('link', { name: 'Продлить' })).toHaveAttribute(
  'href',
  expect.stringContaining('#rental-actions'),
);
expect(screen.getByRole('img', { name: /Kia Ceed/u })).toBeTruthy();
expect(screen.getByText(/Залог/u)).toBeTruthy();
```

Include a missing-image fixture and assert the branded fallback remains visible.

- [x] **Step 2: Run the component test and verify RED**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx`  
Expected: FAIL because the new timeline workspace is absent.

- [x] **Step 3: Implement the desktop table**

Replace the four large KPI cards with the compact attention strip and tabs. Render real vehicle thumbnails, license-plate text, the time scale, payment/deposit facts, and a single contextual action. Preserve archive/search query parameters in generated links.

- [x] **Step 4: Implement the mobile rows**

Below `md`, render compact rows with `72 × 48 px` thumbnails, visible plate/client/term information, a full-width time scale, finance lines, and one 44 px primary action. Keep detailed filters behind the existing URL form and avoid horizontal page overflow.

- [x] **Step 5: Run the component test and verify GREEN**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx`  
Expected: PASS.

### Task 4: Verify, compare, and deploy

**Files:**
- Modify: `design-qa.md`
- Test: `tests/rentals.spec.ts`

**Interfaces:**
- Consumes the selected mock `exec-7d6b5a99-88d9-4a1e-9076-4c72ca700e7d.png` as visual truth.
- Produces a verified production deployment at `/rentals`.

- [x] **Step 1: Add/adjust browser assertions**

Cover the attention strip, real vehicle image, timeline, archive tab, contextual action, and 375 px no-overflow behavior. Do not create or delete shared production records from Playwright.

- [x] **Step 2: Run focused and full checks**

Run:

```powershell
npx vitest run src/modules/rentals/components/rental-list-presentation.test.ts src/modules/rentals/components/RentalListPage.test.tsx src/modules/rentals/server/queries.test.ts
npm run test:unit
npm run lint
npm run typecheck
npm run build
```

Expected: all commands exit `0`; lint may retain only documented pre-existing warnings.

- [x] **Step 3: Capture desktop and mobile screenshots**

Capture the authenticated `/rentals` page at `1440 × 1024` and `375 × 812`. Compare the desktop image to the selected mock and record any P0/P1/P2 differences in `design-qa.md`. Fix all P0/P1/P2 findings before deployment.

- [x] **Step 4: Deploy atomically with backup**

Create a timestamped PostgreSQL backup, build a new release directory, apply only additive migrations if any, switch the current symlink, restart `pilot-plus`, and preserve the previous release for rollback.

- [x] **Step 5: Verify production**

Confirm `https://supapro.ru/login` and authenticated `/rentals` load, vehicle thumbnails resolve, Горбунов and Статун remain active and offer `Продлить`, archive works, and the service journal has no new application errors from the smoke test.

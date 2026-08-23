# Rental Smart Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the complicated `/rentals` list/calendar stack with a fast, tenant-safe smart table that exposes operational status, dates, money, deposit, documents, and actions.

**Architecture:** Extend the existing server query with only the projections needed by the list and derive a presentation-only lifecycle from persisted rental status plus committed extension operations. Keep filtering in the Server Component URL flow; render one desktop table and one mobile card layout from a shared presentation helper. Calendar remains available as an explicit URL-selected view.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript strict mode, Prisma 6, Tailwind CSS 4, Vitest.

## Global Constraints

- Preserve tenant-scoped rental authorization and do not expose client PII beyond names already present in the list.
- Green means active, yellow means extended, red means completed/cancelled, blue means confirmed, and gray means draft; every color must also have a text label.
- `Продлён` is derived from a committed `EXTENSION` operation and is not a new Prisma `RentalStatus`.
- Default view is the list; calendar is only rendered when `view=calendar`.
- Desktop rows and mobile cards expose the same information and 44 px minimum interactive targets.
- Do not change rental pricing, confirmation, handover/return, DOCX/PDF generation, or persisted rental records.

---

### Task 1: Tenant-safe list projection and presentation lifecycle

**Files:**

- Modify: `src/modules/rentals/server/queries.ts`
- Modify: `src/modules/rentals/server/queries.test.ts`
- Create: `src/modules/rentals/components/rental-list-presentation.ts`
- Create: `src/modules/rentals/components/rental-list-presentation.test.ts`

**Interfaces:**

- Produces: `RentalListLifecycle = 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'EXTENDED' | 'COMPLETED' | 'CANCELLED'`.
- Produces: `presentRentalListRow(row, now)` returning label, tone, priority, amount/deposit strings, exact date range, and urgency copy.
- Extends query rows with `depositMinor`, latest committed `EXTENSION` operation, and ready document formats.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
expect(presentRentalListRow(activeExtendedRow, now)).toMatchObject({
  lifecycle: 'EXTENDED',
  label: 'Продлён',
  tone: 'warning',
});
expect(presentRentalListRow(overdueActiveRow, now).priority).toBeLessThan(
  presentRentalListRow(futureConfirmedRow, now).priority,
);
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npx vitest run src/modules/rentals/components/rental-list-presentation.test.ts src/modules/rentals/server/queries.test.ts`

Expected: failure because the presentation module and added query projection do not exist.

- [ ] **Step 3: Implement the pure presentation helper**

```ts
export function deriveRentalListLifecycle(row: RentalListSource): RentalListLifecycle {
  if (row.status === 'ACTIVE' && row.operations.length > 0) return 'EXTENDED';
  return row.status;
}
```

Add explicit maps for Russian labels and Pilot+ semantic tones. Give overdue active rows priority `0`, returns today `1`, other active/extended `2`, confirmed `3`, draft `4`, and archive `5`. Format money from minor units and dates in `Europe/Moscow` without reading browser locale.

- [ ] **Step 4: Extend the exact tenant-scoped Prisma projection**

```ts
depositMinor: true,
operations: {
  where: { type: 'EXTENSION', status: 'COMMITTED' },
  select: { id: true, occurredAt: true, nextEndsAt: true },
  orderBy: { occurredAt: 'desc' },
  take: 1,
},
documentVersions: {
  select: { format: true, version: true },
  orderBy: { version: 'desc' },
  take: 2,
},
```

Keep the existing company scope, query whitelist, half-open date boundaries, and stable database ordering. Add query assertions that the nested operation filter is exactly `EXTENSION + COMMITTED` and no free-text/identity fields are selected.

- [ ] **Step 5: Run focused tests and commit**

Run the Task 1 focused command. Expected: PASS.

Commit: `feat(rentals): derive operational list status`

---

### Task 2: Smart desktop table and mobile cards

**Files:**

- Modify: `src/modules/rentals/components/RentalListPage.tsx`
- Modify: `src/modules/rentals/components/RentalListPage.test.tsx`
- Modify: `src/app/(protected)/rentals/page.tsx`

**Interfaces:**

- Consumes: `presentRentalListRow(row, now)` from Task 1.
- Produces: one accessible list UI with summary counters, URL-backed filters, desktop rows, mobile cards, and right-aligned actions.

- [ ] **Step 1: Write failing component tests**

```tsx
expect(screen.getByRole('link', { name: 'Новый договор' })).toHaveAttribute('href', '/clients');
expect(screen.getByText('Продлён')).toHaveClass(expect.stringContaining('warning'));
expect(screen.getByText('125 000 ₽')).toBeInTheDocument();
expect(screen.getByText('DOCX')).toBeInTheDocument();
expect(screen.queryByTestId('rental-calendar')).not.toBeInTheDocument();
```

Cover green/yellow/red/blue/gray status copy, operational ordering, document-disabled copy, empty filter result, and identical desktop/mobile content.

- [ ] **Step 2: Run component test and confirm RED**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx`

Expected: failures for the missing summary, status badges, money/deposit columns, and view switch.

- [ ] **Step 3: Implement the header, summary, and filters**

Render a single header row with `Договоры аренды`, `Список / Календарь`, and `Новый договор`. Build summary counts from presented rows. Keep GET inputs and add compact status shortcuts whose links preserve `query`, `from`, and `to`.

- [ ] **Step 4: Implement desktop rows and mobile cards**

```tsx
<Link href={`/rentals/${row.id}`} className="group grid min-h-16 ...">
  <RentalStatusBadge lifecycle={view.lifecycle} />
  <span>{view.total}</span>
  <span>{view.deposit}</span>
</Link>
```

Use semantic Pilot+ tokens rather than raw saturated backgrounds. Place the primary `Открыть` action and document links in a right-aligned action cell. On mobile use `sm:hidden` cards with the same number, client, vehicle, dates, money, deposit, and status.

- [ ] **Step 5: Render only the requested view**

In the Server Component, parse `view` from awaited `searchParams`. Pass a stable server `now`. Render `RentalCalendar` only for `view=calendar`; otherwise render the smart list. Preserve all filter parameters across the view switch.

- [ ] **Step 6: Run focused tests and commit**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx src/modules/rentals/components/RentalCalendar.test.tsx src/app/(protected)/rentals/route-states.test.tsx`

Expected: PASS.

Commit: `feat(rentals): add smart contract table`

---

### Task 3: Loading geometry and final browser verification

**Files:**

- Modify: `src/app/(protected)/rentals/loading.tsx`
- Test: `src/modules/rentals/components/RentalListPage.test.tsx`

**Interfaces:**

- Consumes: final geometry from Task 2.
- Produces: layout-stable loading and verified desktop/mobile behavior.

- [ ] **Step 1: Add a loading-state assertion**

Assert that the loading route exposes summary skeletons, a filter row, and at least five row skeletons rather than a single spinner.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx`

Expected: failure until loading geometry matches the smart table.

- [ ] **Step 3: Implement the matching skeleton**

Use existing Pilot+ skeleton primitives and reserve the final summary, toolbar, and table heights. Do not fetch data or render interactive controls in `loading.tsx`.

- [ ] **Step 4: Run all scoped verification**

```text
npx vitest run src/modules/rentals/components/rental-list-presentation.test.ts src/modules/rentals/components/RentalListPage.test.tsx src/modules/rentals/components/RentalCalendar.test.tsx src/modules/rentals/server/queries.test.ts src/app/(protected)/rentals/route-states.test.tsx
npm run typecheck
npm run lint
npx prettier --check <touched files>
git diff --check
```

Expected: focused tests and typecheck pass; lint exits zero aside from already documented unrelated warnings; formatting and diff checks pass.

- [ ] **Step 5: Verify the real page**

Open `http://127.0.0.1:3001/rentals` in the signed-in local browser. Verify desktop table, filters, status colors/copy, ordering, actions, list/calendar switching, and a 390 px mobile viewport. Confirm there are no console or server errors.

- [ ] **Step 6: Commit**

Commit: `test(rentals): verify smart contract workspace`

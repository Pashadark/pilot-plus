# Operational Client List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client card grid with an operational table that starts with the client photo and shows phone, rating, rental history, selected rental vehicle, rental price, deposit amount, deposit status, and client status.

**Architecture:** Extend the existing tenant-scoped Prisma client query with small rental projections and map them into a dedicated list summary DTO. Render the DTO through one adaptive component: a semantic table on desktop and compact cards on mobile, reusing the current photo, rating, badge, filtering, and pagination primitives.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- The visible brand is `СУПА ПРО`; technical identifiers remain `pilot-plus`.
- Real tenant-scoped data only; no demo or invented values.
- Photo is the first piece of client content.
- Desktop uses a table and mobile uses cards with the same information order.
- Existing masking, access control, URL-backed filters, and pagination remain intact.

---

### Task 1: Client rental summary DTO and query

**Files:**
- Modify: `src/modules/clients/types.ts`
- Modify: `src/modules/clients/server/queries.ts`
- Modify: `src/modules/clients/server/queries.test.ts`

**Interfaces:**
- Produces: `ClientCardDto.rentalSummary` containing `total`, `active`, `current`, and `last`.
- `current` and `last` contain rental id, contract number, dates, status, and vehicle label/registration number.
- Each rental summary also contains the contract deposit amount and the latest committed deposit status from its operations.
- Each rental summary contains the final contract price used for the separate rental-cost column.

- [ ] **Step 1: Write the failing query test**

Add a repository result with `_count.rentals`, ordered rental projections, and assert that `getClients()` maps the current active rental separately from the last historical rental.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run src/modules/clients/server/queries.test.ts`

Expected: FAIL because `rentalSummary` is absent.

- [ ] **Step 3: Extend the DTO and Prisma projection**

Add this shape to `ClientCardDto`:

```ts
rentalSummary: {
  total: number;
  active: number;
  current: ClientListRentalSummary | null;
  last: ClientListRentalSummary | null;
};
```

Define `ClientListRentalSummary` with stable serializable fields. Select `_count.rentals` and a bounded ordered rental list including `vehicle.model` and `vehicle.registrationNumber`. Map current statuses `CONFIRMED` and `ACTIVE`, and fall back to the first ordered rental for `last`.

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run src/modules/clients/server/queries.test.ts`

Expected: PASS.

### Task 2: Adaptive operational client list

**Files:**
- Modify: `src/modules/clients/components/ClientGrid.tsx`
- Modify: `src/modules/clients/components/ClientCard.tsx`
- Modify: `src/modules/clients/components/ClientGrid.test.tsx`
- Modify: `src/modules/clients/components/ClientCard.test.tsx`

**Interfaces:**
- Consumes: `ClientCardDto.rentalSummary` and existing `ClientRatingSummary`.
- Produces: desktop table with columns `Клиент`, `Телефон`, `Рейтинг`, `Аренды`, `Машина`, `Стоимость аренды`, `Депозит`, `Статус депозита`, `Статус клиента`, `Действия`, plus mobile cards.
- Applies green to an active rental, blue to a completed rental with resolved deposit, yellow to an ended rental with unresolved deposit, and neutral styling when no rental exists.

- [ ] **Step 1: Add failing component tests**

Assert that photo/initials precede the client name, table headers are accessible, total rentals and current vehicle are rendered, empty history says `Нет аренд`, and the explicit `Открыть` link remains.

- [ ] **Step 2: Run component tests and verify failure**

Run: `npx vitest run src/modules/clients/components/ClientGrid.test.tsx src/modules/clients/components/ClientCard.test.tsx`

Expected: FAIL because the current grid lacks operational columns.

- [ ] **Step 3: Implement the desktop table and mobile card**

Keep one status presentation map. Render a hidden-below-`md` card list and a `md` table. Use `ClientPhoto`, `ClientRatingStars`, and `Badge`; show the current vehicle with its contract/date context and `Сейчас не арендует` when absent. Keep action controls aligned right and 44px high.

- [ ] **Step 4: Run component tests**

Run: `npx vitest run src/modules/clients/components/ClientGrid.test.tsx src/modules/clients/components/ClientCard.test.tsx`

Expected: PASS.

### Task 3: Page polish and verification

**Files:**
- Modify: `src/modules/clients/components/ClientPage.tsx`
- Modify: `src/modules/clients/components/ClientPage.test.tsx`

**Interfaces:**
- Consumes: the adaptive client list from Task 2.
- Produces: page header and count summary matching the rentals workspace.

- [ ] **Step 1: Add a page-level expectation**

Assert the heading, operational description, result count, add-client action, and list landmark.

- [ ] **Step 2: Update the page copy and result summary**

Use `Клиентская база` as the eyebrow, `Клиенты` as the heading, and a concise description explaining history, current rentals, and reliability.

- [ ] **Step 3: Run focused and static verification**

Run:

```powershell
npx vitest run src/modules/clients
npm run typecheck
git diff --check
```

Expected: all focused tests pass, typecheck exits 0, and diff check prints nothing.

- [ ] **Step 4: Verify in the local browser**

Open `http://127.0.0.1:3001/clients`, confirm real photos/initials lead every row, important data is readable, status colors are correct, and the mobile layout remains usable.

# Rental Table Compact Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the active-rental text action with two compact vertically stacked buttons that directly open extension or return.

**Architecture:** The rental list creates explicit action URLs with an `action=extend|return` query. The rental detail server page validates that query and passes a typed initial dialog kind into `RentalActionRail`, which opens the existing tested operation dialog without duplicating operation logic.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- «Продлить» is above «Завершить» in a vertical compact stack.
- Reuse the existing SУПА ПРО colors, radii, focus treatment, dialogs, and toast behavior.
- Show the pair only for active rentals; preserve existing actions for drafts, confirmed and completed rentals.
- Keep touch targets usable and avoid horizontal overflow on mobile.

---

### Task 1: Direct operation opening on the rental detail

**Files:**
- Modify: `src/modules/rentals/components/RentalActionRail.tsx`
- Modify: `src/app/(protected)/rentals/[id]/page.tsx`
- Test: `src/modules/rentals/components/RentalActionRail.test.tsx`

**Interfaces:**
- Consumes: `RentalOperationDialogKind = 'HANDOVER' | 'EXTENSION' | 'RETURN'`.
- Produces: optional `initialAction: RentalOperationDialogKind | null` prop on `RentalActionRail`.

- [x] **Step 1: Write the failing component test**

Render an active `RentalActionRail` with `initialAction="RETURN"` and assert that the dialog named `Принять возврат` is present without clicking.

- [x] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run src/modules/rentals/components/RentalActionRail.test.tsx`
Expected: FAIL because `initialAction` is not accepted and no dialog opens automatically.

- [x] **Step 3: Implement typed initial opening**

Initialize `openKind` from `initialAction` only when it is included in `actionsFor(rental.status)`. Extend the detail page signature with `searchParams: Promise<{ action?: string }>` and map only `extend` to `EXTENSION` and `return` to `RETURN`; all other input maps to `null`.

- [x] **Step 4: Run the focused test**

Run: `npx vitest run src/modules/rentals/components/RentalActionRail.test.tsx`
Expected: PASS.

### Task 2: Compact vertical actions in the rental table

**Files:**
- Modify: `src/modules/rentals/components/RentalListPage.tsx`
- Test: `src/modules/rentals/components/RentalListPage.test.tsx`

**Interfaces:**
- Consumes: active row lifecycle from `presentRentalListRow`.
- Produces: `/rentals/:id?action=extend#rental-actions` and `/rentals/:id?action=return#rental-actions` links.

- [x] **Step 1: Write the failing table test**

Assert that the active row contains links named `Продлить` and `Завершить`, that their parent stack contains `flex-col`, and that the URLs contain the correct `action` query.

- [x] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx`
Expected: FAIL because only the old text link exists.

- [x] **Step 3: Implement the compact action stack**

For active rows render a `flex flex-col gap-1.5` group. Use compact `min-h-8`, rounded design-system borders, a secondary outlined «Продлить» link and a primary blue «Завершить» link. Preserve the existing single-action link for every other lifecycle. Render the same stack in the mobile card without exceeding its width.

- [x] **Step 4: Run focused tests**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx src/modules/rentals/components/RentalActionRail.test.tsx`
Expected: PASS.

### Task 3: Verification and production deployment

**Files:**
- Verify changed files only; no schema migration.

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: live compact actions at `https://supapro.ru/rentals`.

- [x] **Step 1: Run static and module verification**

Run: `npm run typecheck`, `npx vitest run src/modules/rentals`, and `npm run build`.
Expected: all commands pass; only the already-known NFT trace warning may remain.

- [x] **Step 2: Build and switch an atomic production release**

Copy the current production release, overlay only the changed source files, build under the production service environment, switch `/opt/pilot-plus/current`, and restart `pilot-plus.service`.

- [x] **Step 3: Verify production health**

Check `https://supapro.ru/login` returns 200, `/rentals` redirects unauthenticated users, the service is active, and the recent error journal is empty.

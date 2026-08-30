# Vehicle Popularity Medals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show gold, silver, and bronze SVG medals on the three `/vehicles` cards with the most confirmed, active, or completed rental orders.

**Architecture:** The tenant-scoped vehicle query selects only aggregate rental facts needed for ranking. A pure ranking helper assigns `popularityRank`, and `VehicleCard` renders a decorative, accessible SVG overlay on the existing `VehiclePhoto` without changing card actions or filters.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 6, Tailwind CSS 4, Vitest and Testing Library.

## Global Constraints

- Count only `CONFIRMED`, `ACTIVE`, and `COMPLETED` rentals.
- Exclude `DRAFT` and `CANCELLED` rentals.
- Break count ties by newest qualifying rental, then vehicle id.
- Rank only vehicles with at least one qualifying order and expose at most ranks 1–3.
- Keep ranking inside the current user's tenant-scoped vehicle query.
- Use a local 40–44 px SVG overlay with no new dependency.
- Preserve all existing uncommitted vehicle-card, gallery, document, dashboard, and rental changes.

---

### Task 1: Tenant-scoped popularity ranking

**Files:**
- Modify: `src/modules/vehicles/types.ts`
- Modify: `src/modules/vehicles/server/queries.ts`
- Test: `src/modules/vehicles/server/queries.test.ts`

**Interfaces:**
- Produces: `VehicleCardDto.popularityRank: 1 | 2 | 3 | null`.
- Consumes: Prisma `_count.rentals` and the newest qualifying rental selected by the existing tenant-scoped vehicle query.

- [ ] **Step 1: Write failing query tests**

Add fixtures covering ranks 1–3, no-rental `null`, filtering to the three allowed statuses, the newest-rental tie breaker, stable id tie breaker, and the existing membership boundary.

- [ ] **Step 2: Run the query tests and verify RED**

Run: `npx vitest run src/modules/vehicles/server/queries.test.ts`

Expected: failure because `popularityRank` and aggregate rental selection do not exist.

- [ ] **Step 3: Implement minimal server ranking**

Extend the card select with a filtered rental count and newest qualifying rental date. Add a pure mapper that sorts ranking candidates by count descending, newest date descending, and id ascending; assign ranks only to the first three positive-count vehicles while preserving the original card-list order.

- [ ] **Step 4: Run the query tests and verify GREEN**

Run: `npx vitest run src/modules/vehicles/server/queries.test.ts`

Expected: all query tests pass and the selected aggregate remains tenant scoped through the vehicle membership filter.

### Task 2: SVG medals on vehicle photos

**Files:**
- Create: `src/modules/vehicles/components/VehiclePopularityMedal.tsx`
- Create: `src/modules/vehicles/components/VehiclePopularityMedal.test.tsx`
- Modify: `src/modules/vehicles/components/VehicleCard.tsx`
- Modify: `src/modules/vehicles/components/VehicleCard.test.tsx`

**Interfaces:**
- Consumes: `rank: 1 | 2 | 3`.
- Produces: a non-interactive SVG with accessible label `N место по количеству заказов`.

- [ ] **Step 1: Write failing component tests**

Assert gold/silver/bronze labels and rank numbers, assert the medal appears inside the card photo wrapper, and assert no medal exists when `popularityRank` is `null`.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npx vitest run src/modules/vehicles/components/VehiclePopularityMedal.test.tsx src/modules/vehicles/components/VehicleCard.test.tsx`

Expected: failure because the medal component and card overlay do not exist.

- [ ] **Step 3: Implement the SVG overlay**

Create one local SVG medal component using semantic gold, silver, and bronze gradients. Wrap the existing `VehiclePhoto` in a relative container and position the 40–44 px medal at the upper-right with `pointer-events-none`, a subtle shadow, and responsive inset.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npx vitest run src/modules/vehicles/components/VehiclePopularityMedal.test.tsx src/modules/vehicles/components/VehicleCard.test.tsx`

Expected: both test files pass.

### Task 3: Regression and visual verification

**Files:**
- Modify only if a verified defect is found: the files from Tasks 1–2.

**Interfaces:**
- Consumes: completed server ranking and SVG overlay.
- Produces: verified desktop and mobile `/vehicles` behavior.

- [ ] **Step 1: Run proportional automated gates**

Run:

```powershell
npx vitest run src/modules/vehicles/server/queries.test.ts src/modules/vehicles/components/VehiclePopularityMedal.test.tsx src/modules/vehicles/components/VehicleCard.test.tsx
npm run typecheck
npx eslint src/modules/vehicles/types.ts src/modules/vehicles/server/queries.ts src/modules/vehicles/components/VehiclePopularityMedal.tsx src/modules/vehicles/components/VehicleCard.tsx
npx prettier --check src/modules/vehicles/types.ts src/modules/vehicles/server/queries.ts src/modules/vehicles/components/VehiclePopularityMedal.tsx src/modules/vehicles/components/VehiclePopularityMedal.test.tsx src/modules/vehicles/components/VehicleCard.tsx src/modules/vehicles/components/VehicleCard.test.tsx
npm run build
git diff --check
```

Expected: all scoped tests, types, lint, formatting, build and diff checks pass, apart from separately proven pre-existing repository failures.

- [ ] **Step 2: Verify in the browser**

Open `/vehicles` at desktop and mobile widths. Confirm the top three cards show 1/2/3 medals at the photo's right edge, medals do not cover the vehicle, filters do not change assigned ranks, and cards/actions remain usable.

- [ ] **Step 3: Commit only feature files**

Stage only the medal/ranking files and commit with `feat: rank popular fleet vehicles` without staging unrelated dirty-worktree changes.

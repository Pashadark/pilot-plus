# Low Fuel Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an accessible fuel gauge on vehicle cards and surface low-fuel vehicles in the command center and Telegram.

**Architecture:** A small shared presentation component owns fuel ranges and accessibility. Dashboard normalization receives the current fuel reading already resolved from telemetry with a committed rental-operation fallback. The existing operational-notification worker emits a deduplicated `LOW_FUEL` alert without adding a new database table.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Prisma 6, Vitest, Testing Library.

## Global Constraints

- Low-fuel threshold is exactly 20%.
- Existing vehicle, dashboard and bot flows remain compatible.
- Use semantic Pilot+ color tokens where possible and preserve mobile layout.
- Alerts must not repeat while the vehicle remains in the same low-fuel episode.

---

### Task 1: Accessible fuel indicator

**Files:**
- Create: `src/modules/vehicles/components/FuelLevelBar.tsx`
- Create: `src/modules/vehicles/components/FuelLevelBar.test.tsx`
- Modify: `src/modules/vehicles/components/VehicleCard.tsx`
- Modify: `src/modules/vehicles/components/VehicleCard.test.tsx`

**Interfaces:**
- Produces: `FuelLevelBar({ value, label? }: { value: number | null; label?: string })`.
- Consumes: `VehicleCardDto.telemetry.fuelLevelPercent`.

- [ ] Write failing rendering and ARIA tests for null, 20%, 55% and 100%.
- [ ] Run `npx vitest run src/modules/vehicles/components/FuelLevelBar.test.tsx src/modules/vehicles/components/VehicleCard.test.tsx` and confirm the new assertions fail.
- [ ] Implement the minimal indicator and replace the numeric fuel value in `VehicleCard`.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Low fuel in Workday

**Files:**
- Modify: `src/modules/dashboard/overview-types.ts`
- Modify: `src/modules/dashboard/server/queries.ts`
- Modify: `src/modules/dashboard/normalizers.ts`
- Modify: `src/modules/dashboard/normalizers.test.ts`
- Modify: `src/modules/dashboard/server/queries.test.ts`
- Modify: `src/modules/dashboard/WorkdayBoard.tsx`

**Interfaces:**
- Produces: `DashboardWorkItemKind` value `LOW_FUEL`.
- Consumes: current position fuel, falling back to the latest committed rental-operation fuel.

- [ ] Write failing tests proving 20% is included, 21% is excluded, null is excluded, and tomorrow does not show a current warning.
- [ ] Run the focused dashboard tests and confirm the new assertions fail.
- [ ] Extend the tenant-scoped vehicle query and normalize low-fuel work items.
- [ ] Render the exact fuel percentage and action label in `WorkdayBoard`.
- [ ] Run the focused dashboard tests and confirm they pass.

### Task 3: Deduplicated Telegram alert

**Files:**
- Modify: `src/modules/bot-api/operational-alerts.ts`
- Modify: `src/modules/bot-api/operational-alerts.test.ts`
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`

**Interfaces:**
- Produces: operational alert kind `LOW_FUEL` with `fuelLevelPercent`.
- Consumes: existing `BotNotificationJob` unique `eventKey` delivery lifecycle.

- [ ] Write failing formatter tests for 20% and safe vehicle text.
- [ ] Write failing enqueue tests for a low operation reading and a stable telemetry low-fuel episode key.
- [ ] Run the bot tests and confirm the new assertions fail.
- [ ] Add low-fuel classification, hydration and episode-key generation.
- [ ] Run the focused bot tests and confirm they pass.

### Task 4: Release verification

**Files:**
- Modify only files required by failures found in verification.

- [ ] Run focused tests for vehicle cards, dashboard and bot alerts.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] Deploy the verified release using the existing Pilot+ release workflow.
- [ ] Verify `/vehicles` at desktop and mobile widths, the current-day Workday board, production health, and Telegram job creation with a read-only database query.

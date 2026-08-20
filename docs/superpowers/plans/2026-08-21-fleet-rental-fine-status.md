# Fleet Rental Fine Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide obsolete fine candidates after confirmation, make the 10 active real vehicles usable in rental drafts, and show «В парке» from the GLONASSSoft address.

**Architecture:** Keep confirmation and legal readiness as server-side boundaries. Filter presentation DTOs at their source, separate draft eligibility from confirmation eligibility, and carry a nullable provider address through `VehiclePosition` into a pure status-label helper.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 6/PostgreSQL, Zod, Vitest.

## Global Constraints

- Preserve company/tenant and RBAC checks on every server query and action.
- Do not set `isRentalReady=true` to bypass missing legal data.
- Confirming a rental still requires VIN, СТС, ПТС, ОСАГО, КАСКО and valid policy dates.
- Do not add a reverse-geocoding service or dependency.
- Preserve user-owned changes in `docs/PROJECT_GUIDE.md` and untracked runtime artifacts.

---

### Task 1: Confirmed fine presentation

**Files:**

- Modify: `src/modules/fines/server/queries.ts`
- Modify: `src/modules/fines/components/FineAssignmentReview.tsx`
- Test: `src/modules/fines/server/queries.test.ts`
- Test: `src/modules/fines/components/FineAssignmentReview.test.tsx`

**Interfaces:**

- Consumes: `Fine.clientId`, `Fine.rentalId`, existing `assignmentCandidates` DTO.
- Produces: `assignmentCandidates: []` whenever a confirmed client exists.

- [ ] **Step 1: Write failing tests**

Add a component case with both `confirmedClientLabel="Барышева Кристина"` and a candidate and assert the candidate name and confirmation button are absent. Extend the query fixture with a confirmed fine and assert `assignmentCandidates` is empty.

- [ ] **Step 2: Run RED**

Run:

```powershell
npx vitest run src/modules/fines/components/FineAssignmentReview.test.tsx src/modules/fines/server/queries.test.ts
```

Expected: confirmed fine still exposes/renders candidates.

- [ ] **Step 3: Implement the minimal rule**

In the query, return candidates only when `fine.clientId` is null. In the component, guard the candidate block with `!confirmedClientLabel` as defense in depth:

```tsx
{
  !confirmedClientLabel && candidates.length ? <CandidateList /> : null;
}
```

- [ ] **Step 4: Run GREEN and commit**

Run the focused command above and commit only fine files with `fix(fines): hide candidates after assignment`.

### Task 2: Active real vehicles in rental drafts

**Files:**

- Modify: `src/app/(protected)/clients/[id]/rentals/new/page.tsx`
- Modify: `src/modules/rentals/server/actions.ts`
- Modify: `src/modules/rentals/components/RentalWizard.tsx`
- Test: `src/modules/rentals/components/RentalWizard.test.tsx`
- Test: `src/modules/rentals/server/actions.test.ts`
- Create: `src/app/(protected)/clients/[id]/rentals/new/page.test.tsx` only if the route query cannot be covered through an extracted pure mapper.

**Interfaces:**

- Consumes: active vehicle rows, rental interval DTOs and existing confirmation validation.
- Produces: selectable draft options plus `legalReady` warning; confirmation remains unchanged.

- [ ] **Step 1: Write failing tests**

Assert a real active vehicle with `isRentalReady=false` is selectable, its warning is visible, and draft save accepts the vehicle. Assert archived/demo rows are excluded by the route query or an extracted query helper.

- [ ] **Step 2: Run RED**

Run:

```powershell
npx vitest run src/modules/rentals/components/RentalWizard.test.tsx src/modules/rentals/server/actions.test.ts
```

Expected: the option is disabled and the draft action rejects it.

- [ ] **Step 3: Separate draft and confirmation readiness**

Use this database filter in the route:

```ts
where: { companyId: client.companyId, archivedAt: null, isDemoImport: false }
```

Set draft `available` from operational conflicts only, show legal readiness as a warning, and change draft validation from `isRentalReady: true` to `archivedAt: null, isDemoImport: false`. Do not change `confirm-rental.ts`.

- [ ] **Step 4: Run GREEN and commit**

Run focused tests and commit only rental files with `fix(rentals): allow real fleet draft selection`.

### Task 3: GLONASSSoft park address status

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/<timestamp>_add_vehicle_position_address/migration.sql`
- Modify: `src/modules/telematics/glonasssoft/schemas.ts`
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.ts`
- Modify: `src/modules/vehicles/types.ts`
- Modify: `src/modules/vehicles/server/queries.ts`
- Modify: `src/modules/vehicles/components/VehicleCard.tsx`
- Create: `src/modules/vehicles/park-status.ts`
- Test: `src/modules/telematics/glonasssoft/client.server.test.ts`
- Test: `src/modules/telematics/glonasssoft/sync-company.server.test.ts`
- Create: `src/modules/vehicles/park-status.test.ts`

**Interfaces:**

- Produces: `VehiclePosition.address: string | null`, `VehicleTelemetrySummary.address`, and `vehicleStatusLabel(status, address): string`.

- [ ] **Step 1: Write failing tests**

Use a provider response with `address: "г. Москва, Зелёный проспект, д. 22"`, assert sync writes the address, and assert:

```ts
expect(vehicleStatusLabel('IDLE', 'Москва, Зеленый проспект, 22')).toBe('В парке');
expect(vehicleStatusLabel('MOVING', 'Москва, Зеленый проспект, 22')).toBe('В движении');
expect(vehicleStatusLabel('IDLE', 'другой адрес')).toBe('Стоит');
```

- [ ] **Step 2: Run RED**

Run focused telematics and park-status tests. Expected: address is discarded and helper is absent.

- [ ] **Step 3: Add nullable persistence and pure label rule**

Add `address String?` to `VehiclePosition`, an additive `ALTER TABLE ... ADD COLUMN "address" TEXT`, map the bounded optional provider address, persist it, expose it in telemetry, and render the helper result in `VehicleCard`.

- [ ] **Step 4: Generate, migrate locally, sync and verify**

Run Prisma format/generate/validate, apply the additive migration to the local development database, sync all 10 GLONASSSoft positions, and verify cards at `/vehicles` in the signed-in browser.

- [ ] **Step 5: Final verification and commit**

Run all focused tests, `npm run typecheck`, scoped Prettier, `git diff --check`, then commit with `feat(vehicles): show fleet park status`.

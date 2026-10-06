# Rental Core Fields Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow dispatchers to edit draft and confirmed rental terms, while super administrators can edit every rental status with audit-safe document versioning.

**Architecture:** Add a tenant-scoped edit policy and edit DTO, a dedicated server use case that validates and atomically updates terms plus audit data, and a separate `/rentals/[id]/edit` form. Existing rental calculation, availability, snapshot, and document-generation services remain the sources of truth.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript strict mode, Prisma 6.16, PostgreSQL, Tailwind CSS 4, Vitest 3.

## Global Constraints

- `DISPATCHER` and `COMPANY_ADMIN` may edit only `DRAFT` and `CONFIRMED` rentals.
- `SUPER_ADMIN` may edit `DRAFT`, `CONFIRMED`, `ACTIVE`, `COMPLETED`, and `CANCELLED` rentals.
- Client, contract number, company, status, operations, evidence, and telemetry remain immutable.
- Confirmed and later rentals create a new document version after saving; old versions remain downloadable.
- No new dependency and no Prisma migration.
- All mutations are tenant-scoped, audited, and protected by `updatedAt` optimistic concurrency.
- Preserve unrelated dirty-worktree changes and deploy only verified files.

---

### Task 1: Rental edit authorization policy

**Files:**
- Modify: `src/modules/rentals/server/access.ts`
- Test: `src/modules/rentals/server/access.test.ts`

**Interfaces:**
- Produces: `canEditRental(access: RentalAccess, companyId: string, status: RentalStatus): boolean`.

- [ ] **Step 1: Write failing policy tests** covering company operators on `DRAFT`/`CONFIRMED`, rejection on later statuses, system access on every status, and cross-company rejection.
- [ ] **Step 2: Run** `npx vitest run src/modules/rentals/server/access.test.ts`; expect failures because `canEditRental` is absent.
- [ ] **Step 3: Implement the pure policy** using `access.scope`, `access.companyIds`, and explicit status sets.
- [ ] **Step 4: Re-run the test** and expect all policy cases to pass.

### Task 2: Edit data contract and server query

**Files:**
- Create: `src/modules/rentals/edit/rental-edit-types.ts`
- Create: `src/modules/rentals/edit/server/get-rental-edit.ts`
- Create: `src/modules/rentals/edit/server/get-rental-edit.test.ts`

**Interfaces:**
- Produces: `RentalEditDto`, `RentalEditVehicleOption`, and `getRentalEditForCurrentUser(rentalId)`.
- Consumes: `canEditRental`.

- [ ] **Step 1: Write a failing query test** requiring an authorized DTO with immutable client/number/status context, editable values, `updatedAt`, parsed issuance snapshot fields, vehicle options, and self-excluding rental intervals.
- [ ] **Step 2: Run the new test** and verify it fails because the query does not exist.
- [ ] **Step 3: Implement the tenant-scoped query** selecting only required rental, vehicle, client, snapshot, and availability fields.
- [ ] **Step 4: Verify** unauthorized status/company cases return `null`, then run the test to green.

### Task 3: Validated transactional edit use case

**Files:**
- Create: `src/modules/rentals/edit/server/update-rental-terms.ts`
- Create: `src/modules/rentals/edit/server/update-rental-terms.test.ts`
- Modify: `src/modules/rentals/server/actions.ts`

**Interfaces:**
- Produces: `createRentalTermsUpdater(database)` and `updateRentalTermsAction(previous, formData)`.
- Consumes: `calculateRental`, `canEditRental`, current snapshot, vehicle terms, and `updatedAt` revision.

- [ ] **Step 1: Write failing tests** for role/status policy, valid recalculation, self-excluding overlap detection, stale revision rejection, unchanged client/number/status, audit before/after diff, and preserved operation records.
- [ ] **Step 2: Run the tests** and verify the expected missing-use-case failure.
- [ ] **Step 3: Implement strict form parsing** for dates, money, text lengths, vehicle ID, drivers, and revision.
- [ ] **Step 4: Implement the serializable transaction**: authorize, reload by company and revision, validate availability excluding current ID, recalculate, update snapshot fields and rental columns, and append `AuditLog`.
- [ ] **Step 5: Add the Server Action** returning stable Russian error codes/messages and revalidating `/rentals` plus `/rentals/[id]`.
- [ ] **Step 6: Run the use-case and action tests** to green.

### Task 4: Versioned documents after edits

**Files:**
- Modify: `src/modules/rentals/server/actions.ts`
- Test: `src/modules/rentals/server/actions.test.ts`
- Test: `src/modules/rentals/server/generate-rental-documents.test.ts`

**Interfaces:**
- Consumes: successful edit result with `status` and `rentalId`.
- Produces: `documentVersion` on successful regeneration or `confirmedNeedsDocuments` when regeneration fails.

- [ ] **Step 1: Write failing action tests** proving draft edits skip generation and all later statuses call `generateRentalDocumentPair` after commit without overwriting old versions.
- [ ] **Step 2: Run tests** and verify the missing behavior fails.
- [ ] **Step 3: Trigger document generation after successful non-draft update** and preserve the saved update when generation fails.
- [ ] **Step 4: Run action and document tests** to green.

### Task 5: Dedicated edit route and form

**Files:**
- Create: `src/app/(protected)/rentals/[id]/edit/page.tsx`
- Create: `src/app/(protected)/rentals/[id]/edit/loading.tsx`
- Create: `src/modules/rentals/edit/components/RentalTermsEditor.tsx`
- Create: `src/modules/rentals/edit/components/RentalTermsEditor.test.tsx`
- Modify: `src/modules/rentals/components/RentalActionRail.tsx`
- Modify: `src/modules/rentals/components/RentalActionRail.test.tsx`
- Modify: `src/app/(protected)/rentals/[id]/page.tsx`

**Interfaces:**
- Consumes: `RentalEditDto`, `updateRentalTermsAction`, and `canEdit` passed to the action rail.
- Produces: accessible edit form and `/rentals/[id]/edit` navigation.

- [ ] **Step 1: Write failing component tests** for prefilled values, immutable contract/client context, grouped editable fields, live total preview, pending button, and error rendering.
- [ ] **Step 2: Write failing action-rail tests** for visible/hidden edit links by `canEdit`.
- [ ] **Step 3: Run component tests** and verify failures because components/links do not exist.
- [ ] **Step 4: Implement the server page** with async params, `notFound()` for inaccessible rentals, Pilot+ breadcrumbs, and DTO loading.
- [ ] **Step 5: Implement the client form** with existing `Input`, `Select`, `Button`, `Card`, Moscow date conversion, server action state, and mobile/desktop calculation summary.
- [ ] **Step 6: Implement the geometry-matching skeleton** and edit link in `RentalActionRail`.
- [ ] **Step 7: Run all component and route tests** to green.

### Task 6: Verification and production deployment

**Files:**
- Verify every file modified above.
- Deploy only verified files to `/opt/pilot-plus/current` on `201.24.51.103`.

**Interfaces:**
- Produces: production route `/rentals/[id]/edit` and audited edits.

- [ ] **Step 1: Run targeted tests** for access, query, update use case, actions, editor, action rail, and document generation; expect zero failures.
- [ ] **Step 2: Run** `npm run typecheck`; expect exit code 0.
- [ ] **Step 3: Run** `npm run lint`; expect exit code 0 or stop for feature-related errors.
- [ ] **Step 4: Run** `npm run build`; expect exit code 0.
- [ ] **Step 5: Back up matching production files**, transfer only verified source files, build on the VPS, and restart `pilot-plus` only after a successful build.
- [ ] **Step 6: Verify** service active state, HTTPS authentication redirect, deployed hashes, and absence of new error-level journal entries.

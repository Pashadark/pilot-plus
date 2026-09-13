# Vehicle Maintenance and Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class repairs, damage evidence, work items, documents, and vehicle history to the existing Pilot+ maintenance workflow, then import the real Camry Х069АЕ997 repair.

**Architecture:** Extend `MaintenanceRecord` with a record type and repair lifecycle fields, add tenant-owned child tables for work items and private attachments, and keep `/maintenance` as one unified workspace. Server Actions own mutations, authorized Route Handlers stream private files, and the vehicle detail query exposes only safe attachment metadata and authorized URLs.

**Tech Stack:** Next.js 16.2 App Router, React 19.2 Server Actions, TypeScript strict mode, Prisma 6.16/PostgreSQL 17, Tailwind CSS 4, Vitest 3, Playwright.

## Global Constraints

- Preserve existing maintenance records by backfilling `recordType = MAINTENANCE`.
- Photos and documents are optional and must never block starting or finishing a repair.
- Never invent cost, provider, completed work, mileage, or completion date.
- Every query and mutation must enforce company membership on the server.
- Store attachments outside `public` and serve them only through an authorized route.
- Use Pilot+ semantic design tokens and shared UI components in both themes.
- All Next.js mutations must revalidate `/maintenance` and the affected `/vehicles/[id]` route.
- Implement every behavior test-first and run Prisma, unit, TypeScript, lint, build, and focused browser checks before deployment.

---

### Task 1: Persist maintenance and repair records

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260913193000_add_vehicle_repairs/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`
- Modify: `src/database/prisma/rental-schema.test.ts`

**Interfaces:**
- Produces: `MaintenanceRecordType`, extended `MaintenanceStatus`, `MaintenanceWorkItem`, `MaintenanceAttachment`, `MaintenanceAttachmentKind`.

- [ ] **Step 1: Write the failing schema tests** asserting that maintenance records expose `recordType`, repair dates, optional rental/client relations, `workItems`, and `attachments`, and that rental/client/vehicle reverse relations exist.
- [ ] **Step 2: Run `npm run test:unit -- src/database/prisma/schema.test.ts src/database/prisma/rental-schema.test.ts`** and verify the new assertions fail because the fields do not exist.
- [ ] **Step 3: Add the Prisma models and enum values.** The central shape is:

```prisma
enum MaintenanceRecordType { MAINTENANCE REPAIR }
enum MaintenanceAttachmentKind { DAMAGE_BEFORE REPAIR_AFTER DOCUMENT RECEIPT }

model MaintenanceRecord {
  recordType      MaintenanceRecordType @default(MAINTENANCE)
  damageReportedAt DateTime?
  startedAt       DateTime?
  rentalId        String?
  clientId        String?
  rental          Rental? @relation(fields: [rentalId], references: [id], onDelete: SetNull)
  client          Client? @relation(fields: [clientId], references: [id], onDelete: SetNull)
  workItems       MaintenanceWorkItem[]
  attachments     MaintenanceAttachment[]
}
```

Add `DAMAGE_REPORTED` and `WAITING_REPAIR` to `MaintenanceStatus`. Store each work item with `title`, optional `description`, optional `costMinor`, and stable `position`. Store each attachment with category, original name, MIME, bytes, SHA-256, private storage key, optional caption, and timestamps.
- [ ] **Step 4: Write additive SQL** that creates enum values/tables/indexes, adds nullable repair fields and relations, and backfills the non-null record type without deleting or rewriting existing records.
- [ ] **Step 5: Run `npx prisma format`, `npx prisma validate`, and the focused schema tests** and verify all pass.
- [ ] **Step 6: Commit the schema and migration** with message `feat: add vehicle repair persistence`.

### Task 2: Define repair validation and lifecycle rules

**Files:**
- Modify: `src/modules/maintenance/types.ts`
- Modify: `src/modules/maintenance/status.ts`
- Modify: `src/modules/maintenance/status.test.ts`
- Modify: `src/modules/maintenance/validation.ts`
- Modify: `src/modules/maintenance/validation.test.ts`
- Create: `src/modules/maintenance/attachments.ts`
- Create: `src/modules/maintenance/attachments.test.ts`

**Interfaces:**
- Produces: `MaintenanceRecordType`, `RepairInput`, `RepairWorkItemInput`, `parseRepairInput(formData)`, `validateMaintenanceAttachment(file)`.

- [ ] **Step 1: Add failing tests** for repair creation with no files, a started repair with `damageReportedAt`, linked rental, multiple work items, optional values, invalid dates, cross-field status rules, JPEG/PNG/WebP/PDF/DOCX signatures, and 15 MiB size limits.
- [ ] **Step 2: Run the focused tests** and verify failures identify missing repair parsing and attachment validation.
- [ ] **Step 3: Implement repair parsing** so `vehicleId`, title, damage date, and status are required; provider, cost, odometer, circumstances, rental, work items, and files remain optional. Parse repeated work item fields by stable client-generated row key.
- [ ] **Step 4: Implement status transitions**:

```ts
const repairTransitions = {
  DAMAGE_REPORTED: ['WAITING_REPAIR', 'IN_PROGRESS', 'CANCELLED'],
  WAITING_REPAIR: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
} as const;
```

- [ ] **Step 5: Implement binary-signature attachment validation** returning `{ mime, extension, bytes, sha256 }` without trusting browser MIME or filename.
- [ ] **Step 6: Run the focused tests** and verify all pass.
- [ ] **Step 7: Commit** with message `feat: validate repair records and attachments`.

### Task 3: Create repairs and store optional attachments

**Files:**
- Modify: `src/modules/maintenance/actions.ts`
- Modify: `src/modules/maintenance/actions.test.ts`
- Create: `src/modules/maintenance/server/create-repair.ts`
- Create: `src/modules/maintenance/server/create-repair.test.ts`

**Interfaces:**
- Produces: `createRepairAction(previousState, formData)` and injectable `createRepair(deps, input)`.
- Consumes: `parseRepairInput`, `validateMaintenanceAttachment`, Prisma repair models, `LocalPrivateStorage`.

- [ ] **Step 1: Write failing tests** for unauthenticated rejection, tenant mismatch, rental/vehicle mismatch, client derived from rental, optional files, successful atomic row creation, storage cleanup after DB failure, and revalidation of both affected routes.
- [ ] **Step 2: Run the focused tests** and verify they fail because `createRepairAction` is absent.
- [ ] **Step 3: Implement the domain operation**: resolve the member company, fetch the vehicle, verify the linked rental belongs to the same vehicle/company, derive `clientId`, validate all supplied files, stage them in private storage, and create the record/work items/attachment metadata in one transaction.
- [ ] **Step 4: Promote staged files** under `companies/{companyId}/vehicles/{vehicleId}/maintenance/{recordId}/{attachmentId}.{ext}` and remove staged/final files on failure.
- [ ] **Step 5: Return Russian field errors and safe top-level messages**, then call `revalidatePath('/maintenance')` and `revalidatePath('/vehicles/' + vehicleId)` on success.
- [ ] **Step 6: Run the focused tests** and verify all pass.
- [ ] **Step 7: Commit** with message `feat: create repairs with private evidence`.

### Task 4: Read repair details and stream private attachments

**Files:**
- Modify: `src/modules/maintenance/server/queries.ts`
- Modify: `src/modules/maintenance/server/queries.test.ts`
- Create: `src/app/(protected)/maintenance/[recordId]/attachments/[attachmentId]/route.ts`
- Create: `src/app/(protected)/maintenance/[recordId]/attachments/[attachmentId]/route.test.ts`

**Interfaces:**
- Produces: safe `MaintenanceRecordDto` fields `recordType`, `rental`, `client`, `workItems`, `attachments`; authorized `GET` route.

- [ ] **Step 1: Write failing query tests** asserting safe DTO projection, ordering of work items/attachments, linked client/contract labels, and absence of `storageKey`/`sha256` in browser DTOs.
- [ ] **Step 2: Write failing route tests** for unauthenticated access, wrong tenant, missing file, stable ETag, inline images, attachment documents, and `X-Content-Type-Options: nosniff`.
- [ ] **Step 3: Run the focused tests** and confirm expected failures.
- [ ] **Step 4: Extend the tenant-scoped query** and map only authorized display metadata plus URLs built from record and attachment IDs.
- [ ] **Step 5: Implement the dynamic Route Handler** using awaited `RouteContext` params, a second authorization check immediately before streaming, private storage, content disposition, cache prevention, and no leaked storage paths.
- [ ] **Step 6: Run the focused tests** and verify all pass.
- [ ] **Step 7: Commit** with message `feat: expose authorized repair history`.

### Task 5: Build the unified maintenance and repairs workspace

**Files:**
- Modify: `src/modules/maintenance/components/MaintenanceWorkspace.tsx`
- Modify: `src/modules/maintenance/components/MaintenanceWorkspace.test.ts`
- Modify: `src/modules/maintenance/components/MaintenanceRecordCard.tsx`
- Create: `src/modules/maintenance/components/RepairForm.tsx`
- Create: `src/modules/maintenance/components/RepairForm.test.tsx`
- Create: `src/modules/maintenance/components/MaintenanceDetails.tsx`

**Interfaces:**
- Produces: two creation buttons, repair modal, record-type filtering, repair-aware cards/table rows, and details modal.

- [ ] **Step 1: Write failing component tests** for two visible actions, preselected vehicle, repair-specific labels/statuses, optional file inputs, repeated work items, linked rental display, attachment counters, mobile layout, and details gallery.
- [ ] **Step 2: Run the focused tests** and verify expected UI failures.
- [ ] **Step 3: Implement `RepairForm`** with accessible labels, a compact two-column desktop/one-column mobile layout, repeatable work rows, multiple optional uploads grouped as «До ремонта», «После ремонта», and «Документы», pending state, inline errors, and success toast.
- [ ] **Step 4: Update the workspace summary and filters** to show «Ожидают ТО», «Скоро ТО», «В ремонте», «Просрочено», plus record type and context-aware status/kind labels.
- [ ] **Step 5: Update table and mobile cards** with a blue maintenance marker or orange repair marker, client/contract links, attachment counts, and compact actions. Clicking the title opens `MaintenanceDetails` without navigation loss.
- [ ] **Step 6: Implement details** with description, timeline, work list, cost, related entities, before/after galleries, and document downloads.
- [ ] **Step 7: Run component tests** and verify all pass.
- [ ] **Step 8: Commit** with message `feat: add repair workspace experience`.

### Task 6: Show repairs in the vehicle card

**Files:**
- Modify: `src/modules/vehicles/types.ts`
- Modify: `src/modules/vehicles/server/queries.ts`
- Modify: `src/modules/vehicles/server/queries.test.ts`
- Modify: `src/modules/vehicles/components/vehicle-tabs.ts`
- Modify: `src/modules/vehicles/components/VehicleDetailPage.tsx`
- Modify: `src/modules/vehicles/components/VehicleDetailPage.test.ts`
- Modify: `src/modules/vehicles/components/VehicleTabs.test.tsx`

**Interfaces:**
- Produces: «ТО и ремонты» tab, active repair summary, unified history, galleries/documents, linked rental/client, and `Добавить ремонт` vehicle action.

- [ ] **Step 1: Write failing vehicle query and component tests** for safe repair metadata, tab copy, active repair prominence, photos, documents, links, costs, and separate maintenance/repair action URLs.
- [ ] **Step 2: Run the focused tests** and confirm failures.
- [ ] **Step 3: Extend vehicle DTO/query** with repair fields and attachment display URLs while preserving existing maintenance and wash history.
- [ ] **Step 4: Render a unified reverse-chronological history** with distinct semantic markers, an active repair panel above history, and photo/document affordances.
- [ ] **Step 5: Add `Добавить ремонт` linking to `/maintenance?vehicleId={id}&create=repair`** and rename the tab without changing its stable query value.
- [ ] **Step 6: Run focused tests** and verify all pass.
- [ ] **Step 7: Commit** with message `feat: show repairs in vehicle history`.

### Task 7: Import the real Camry damage case

**Files:**
- Create: `scripts/import-camry-repair-2026-09-12.ts`
- Create: `scripts/import-camry-repair-2026-09-12.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: idempotent command `npm run maintenance:import-camry-repair`.

- [ ] **Step 1: Write a failing idempotency test** using repository/storage fakes and the exact natural key `vehicle + damageReportedAt + rental`.
- [ ] **Step 2: Run the focused test** and verify the importer is missing.
- [ ] **Step 3: Implement the importer** to resolve Х069АЕ997, rental `ME-2026-0030-GA`, and client Горбунов from the database; create an `IN_PROGRESS` repair dated `2026-09-12`; ingest exactly the three user-provided JPEG paths as `DAMAGE_BEFORE`; and leave cost/provider/work items/completion empty.
- [ ] **Step 4: Make reruns non-destructive**: reuse the existing repair and skip attachments with matching SHA-256.
- [ ] **Step 5: Run the focused test** and verify pass.
- [ ] **Step 6: Commit** with message `feat: add idempotent Camry repair import`.

### Task 8: Verify and deploy

**Files:**
- Modify if required: `tests/maintenance.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`

- [ ] **Step 1: Add focused Playwright coverage** for desktop and 390 px mobile creation, filter, details, optional files, and vehicle history.
- [ ] **Step 2: Run `npx prisma generate`, `npx prisma validate`, focused unit tests, `npm run typecheck`, `npm run lint`, `npm run test:unit`, focused Playwright, and `npm run build`; fix only failures introduced by this feature.
- [ ] **Step 3: Update `docs/PROJECT_GUIDE.md`** with the completed repair capability and private attachment routes.
- [ ] **Step 4: Create a production database backup**, build a new timestamped release, apply the additive migration, switch the current symlink, and restart the service.
- [ ] **Step 5: Run the idempotent Camry importer against production** with the three provided files and verify database relations and attachment counts without printing private paths or personal data.
- [ ] **Step 6: Verify live `/maintenance?view=list` and `/vehicles/cmtdgxote000ttu18133knumk?tab=maintenance`** on desktop and mobile: both creation buttons, active repair, Горбунов and ME-2026-0030-GA links, and three authorized damage photos.
- [ ] **Step 7: Commit verification/docs changes** with message `docs: record maintenance repair rollout`.

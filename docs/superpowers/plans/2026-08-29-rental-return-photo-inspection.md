# Rental Return Photo Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current compact «Принять возврат» dialog with a resumable five-step return wizard that requires six private photos, supports damage markers, calculates charges and atomically completes the rental with the selected vehicle disposition.

**Architecture:** Extend the existing `RentalOperation` draft/commit flow and `RentalOperationMedia` quarantine pipeline instead of creating another rental subsystem. The return button inside `RentalActionRail` opens a client-side wizard; every completed step persists into the existing draft operation, while final completion remains a serializable PostgreSQL transaction. Confirmed operations and files are immutable; corrections create another inspection version.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict mode, Prisma 6.16, PostgreSQL 17, Tailwind CSS 4, existing private storage/ClamAV pipeline, Vitest 3, Playwright.

## Global Constraints

- The only entry point is «Принять возврат» on an active rental contract.
- The new return flow uses six required photos and no video.
- Preserve legacy `INSPECTION_VIDEO` records and routes for read-only compatibility.
- Do not add a new dependency.
- Every query and mutation must enforce `companyId` at the server boundary.
- Originals remain private; preview WebP files use the existing quarantine and promotion pipeline.
- A confirmed inspection is immutable; a correction creates a new version with a reason.
- The main photo changes by clicking one of six labeled thumbnails; no arrow navigation.
- All Next.js work must follow the installed documentation under `node_modules/next/dist/docs/`.

---

## File Structure

### Create

- `src/modules/rentals/operations/photo-set.ts` — required angle constants and completeness checks.
- `src/modules/rentals/operations/settlement.ts` — combines mileage, fuel, damage and deposit calculations.
- `src/modules/rentals/operations/server/save-return-inspection.ts` — tenant-scoped draft step persistence.
- `src/modules/rentals/components/RentalReturnWizard.tsx` — wizard state and step navigation.
- `src/modules/rentals/components/return-wizard/ReturnPhotoStep.tsx` — six-slot photo gallery and upload state.
- `src/modules/rentals/components/return-wizard/DamageMarkerEditor.tsx` — normalized point creation and damage form.
- `src/modules/rentals/components/return-wizard/ReturnConditionStep.tsx` — mileage, fuel and disposition.
- `src/modules/rentals/components/return-wizard/ReturnSettlementStep.tsx` — deposit and charge review.
- `src/modules/rentals/components/return-wizard/ReturnReviewStep.tsx` — validation summary and commit action.
- `src/app/(protected)/rentals/[id]/return-media/[mediaId]/route.ts` — authorized clean preview stream.
- `src/database/prisma/migrations/20260829010000_add_rental_return_photo_inspections/migration.sql` — schema migration.
- Focused `.test.ts` or `.test.tsx` files beside every new domain/server/component file.

### Modify

- `src/database/prisma/schema.prisma` — photo angles, disposition, operation version, damages and relations.
- `src/modules/rentals/operations/types.ts` — matching strict TypeScript unions.
- `src/modules/rentals/operations/validation.ts` — return step and commit validation.
- `src/modules/rentals/operations/media/admit-operation-media.ts` — admit six image kinds.
- `src/modules/rentals/operations/media/file-validation.ts` — image-only rules for new return media.
- `src/modules/rentals/operations/media/scan-operation-media.ts` — generate promoted WebP preview metadata.
- `src/modules/rentals/operations/server/prepare-operation.ts` — resume one owned return draft.
- `src/modules/rentals/operations/server/return-rental.ts` — commit complete photo inspection and disposition atomically.
- `src/modules/rentals/server/actions.ts` — draft-save and final commit actions.
- `src/modules/rentals/server/queries.ts` — return wizard DTO including handover evidence.
- `src/modules/rentals/components/RentalActionRail.tsx` — open wizard for `RETURN`; retain dialog for handover/extension.
- `src/modules/rentals/components/RentalOperationTimeline.tsx` — show six photos and damage history.
- `tests/rentals.spec.ts` — browser coverage for the active-contract entry point and full return.

---

### Task 1: Persist six-angle inspections and damage markers

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260829010000_add_rental_return_photo_inspections/migration.sql`
- Modify: `src/database/prisma/rental-schema.test.ts`
- Modify: `src/modules/rentals/operations/types.ts`

**Interfaces:**
- Produces: `rentalReturnPhotoKinds`, `RentalReturnPhotoKind`, `RentalReturnDisposition`, `RentalDamageType`.
- Produces: `RentalOperation.inspectionVersion`, `RentalOperation.returnDisposition`, `RentalOperation.damages`.

- [ ] **Step 1: Write the failing schema tests**

Assert that the Prisma schema contains six additive media enum values, `RentalReturnDisposition`, `RentalDamageType`, the `RentalOperationDamage` model, a unique version key, normalized decimal coordinates, non-negative estimated cost and tenant-scoped indexes.

```ts
expect(schema).toContain('RETURN_FRONT')
expect(schema).toContain('RETURN_REAR')
expect(schema).toContain('RETURN_LEFT')
expect(schema).toContain('RETURN_RIGHT')
expect(schema).toContain('RETURN_INTERIOR')
expect(schema).toContain('RETURN_DASHBOARD')
expect(schema).toContain('model RentalOperationDamage')
expect(schema).toContain('@@unique([rentalId, type, inspectionVersion])')
```

- [ ] **Step 2: Run the schema test and verify RED**

Run: `npx vitest run src/database/prisma/rental-schema.test.ts`

Expected: FAIL because the photo enums and damage model do not exist.

- [ ] **Step 3: Add the Prisma and TypeScript model**

Use additive enum values so legacy video rows remain valid:

```prisma
enum RentalOperationMediaKind {
  INSPECTION_VIDEO
  DASHBOARD_PHOTO
  RETURN_FRONT
  RETURN_REAR
  RETURN_LEFT
  RETURN_RIGHT
  RETURN_INTERIOR
  RETURN_DASHBOARD
}

enum RentalReturnDisposition { READY WASH MAINTENANCE }
enum RentalDamageType { SCRATCH DENT CRACK CHIP INTERIOR OTHER }

model RentalOperationDamage {
  id                 String           @id @default(cuid())
  companyId          String
  operationId        String
  mediaId            String
  type               RentalDamageType
  description        String
  markerX            Decimal          @db.Decimal(6, 5)
  markerY            Decimal          @db.Decimal(6, 5)
  estimatedCostMinor BigInt?
  createdAt          DateTime         @default(now()) @db.Timestamptz(3)
  operation          RentalOperation  @relation(fields: [companyId, operationId], references: [companyId, id], onDelete: Restrict)
  media              RentalOperationMedia @relation(fields: [companyId, mediaId], references: [companyId, id], onDelete: Restrict)

  @@unique([companyId, id])
  @@index([companyId, operationId, createdAt])
  @@index([companyId, mediaId])
}
```

Add `inspectionVersion Int @default(1)` and `returnDisposition RentalReturnDisposition?` to `RentalOperation`, relations on operation/media, and `@@unique([rentalId, type, inspectionVersion])`. Mirror enum values as `as const` unions in `operations/types.ts`.

- [ ] **Step 4: Write the SQL migration explicitly**

The migration must add enum values, create new enums/table/check constraints for `markerX`/`markerY` in `[0,1]` and non-negative cost, add columns and indexes, then add tenant-scoped foreign keys. Do not edit generated Prisma client files.

- [ ] **Step 5: Validate and test GREEN**

Run: `npx prisma format && npx prisma validate && npx vitest run src/database/prisma/rental-schema.test.ts`

Expected: Prisma validation succeeds and the focused test passes.

- [ ] **Step 6: Commit**

```powershell
git add src/database/prisma/schema.prisma src/database/prisma/migrations/20260829010000_add_rental_return_photo_inspections/migration.sql src/database/prisma/rental-schema.test.ts src/modules/rentals/operations/types.ts
git commit -m "feat: model rental return photo inspections"
```

### Task 2: Validate photo completeness, damage markers and settlement

**Files:**
- Create: `src/modules/rentals/operations/photo-set.ts`
- Create: `src/modules/rentals/operations/photo-set.test.ts`
- Create: `src/modules/rentals/operations/settlement.ts`
- Create: `src/modules/rentals/operations/settlement.test.ts`
- Modify: `src/modules/rentals/operations/validation.ts`
- Modify: `src/modules/rentals/operations/validation.test.ts`

**Interfaces:**
- Produces: `inspectReturnPhotoSet(media): ReturnPhotoSetResult`.
- Produces: `validateDamageDraft(input): ValidatedDamageDraft`.
- Produces: `calculateReturnSettlement(input): ReturnSettlement`.

- [ ] **Step 1: Write failing photo-set tests**

Cover complete six-photo input, duplicate angle, missing angle, non-clean media and legacy media ignored.

```ts
expect(inspectReturnPhotoSet(cleanSix)).toEqual({ complete: true, missing: [], blocked: [] })
expect(inspectReturnPhotoSet(cleanSix.slice(1))).toEqual({
  complete: false,
  missing: ['RETURN_FRONT'],
  blocked: [],
})
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/modules/rentals/operations/photo-set.test.ts`

Expected: FAIL because `inspectReturnPhotoSet` does not exist.

- [ ] **Step 3: Implement the pure photo contract**

```ts
export const requiredReturnPhotoKinds = [
  'RETURN_FRONT', 'RETURN_REAR', 'RETURN_LEFT',
  'RETURN_RIGHT', 'RETURN_INTERIOR', 'RETURN_DASHBOARD',
] as const;

export function inspectReturnPhotoSet(media: readonly { kind: string; status: string }[]) {
  const clean = new Set(media.filter((item) => item.status === 'CLEAN').map((item) => item.kind));
  return {
    complete: requiredReturnPhotoKinds.every((kind) => clean.has(kind)),
    missing: requiredReturnPhotoKinds.filter((kind) => !clean.has(kind)),
    blocked: requiredReturnPhotoKinds.filter((kind) =>
      media.some((item) => item.kind === kind && ['BLOCKED', 'ERROR'].includes(item.status)),
    ),
  };
}
```

- [ ] **Step 4: Write failing settlement and damage tests**

Test marker bounds, required description, optional cost, return mileage below handover rejection, damage totals, recommended withholding capped to collected deposit, and mandatory manual override reason.

- [ ] **Step 5: Implement settlement without floating money arithmetic**

Compose existing `calculateReturnCharges` and use integer minor units:

```ts
export type ReturnSettlement = {
  mileageChargeMinor: number;
  fuelChargeMinor: number;
  damageChargeMinor: number;
  totalChargeMinor: number;
  recommendedWithheldMinor: number;
};
```

`recommendedWithheldMinor` is `min(totalChargeMinor, depositAmountMinor)`. A differing confirmed withholding requires a non-empty reason.

- [ ] **Step 6: Run focused tests GREEN**

Run: `npx vitest run src/modules/rentals/operations/photo-set.test.ts src/modules/rentals/operations/settlement.test.ts src/modules/rentals/operations/validation.test.ts`

Expected: all focused tests pass.

- [ ] **Step 7: Commit**

```powershell
git add src/modules/rentals/operations/photo-set* src/modules/rentals/operations/settlement* src/modules/rentals/operations/validation*
git commit -m "feat: validate rental return inspections"
```

### Task 3: Extend private photo admission and preview

**Files:**
- Modify: `src/modules/rentals/operations/media/file-validation.ts`
- Modify: `src/modules/rentals/operations/media/file-validation.test.ts`
- Modify: `src/modules/rentals/operations/media/admit-operation-media.ts`
- Modify: `src/modules/rentals/operations/media/admit-operation-media.test.ts`
- Modify: `src/modules/rentals/operations/media/scan-operation-media.ts`
- Modify: `src/modules/rentals/operations/media/scan-operation-media.test.ts`
- Create: `src/app/(protected)/rentals/[id]/return-media/[mediaId]/route.ts`
- Create: `src/app/(protected)/rentals/[id]/return-media/[mediaId]/route.test.ts`

**Interfaces:**
- Consumes: `RentalReturnPhotoKind` from Task 1.
- Produces: `admitOperationMedia({ kind, file, ... }): { mediaId, uploadId }` for six image kinds.
- Produces: authenticated `GET /rentals/:id/return-media/:mediaId`.

- [ ] **Step 1: Write failing admission tests**

For each new kind, accept JPEG/PNG/WebP up to 15 MiB; reject MP4, MIME/signature mismatch, wrong tenant, duplicate clean angle and over-quota uploads. Preserve existing legacy video tests.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/modules/rentals/operations/media/file-validation.test.ts src/modules/rentals/operations/media/admit-operation-media.test.ts`

Expected: new photo kinds are rejected or unknown.

- [ ] **Step 3: Extend admission and scanning**

Map all six new kinds to the existing image policy. Keep `INSPECTION_VIDEO` readable but do not expose it in the new UI. On clean promotion, retain the original private object and the normalized WebP preview keys already used by the image pipeline.

- [ ] **Step 4: Implement tenant-scoped preview route**

The route must authenticate the current member, query by `{ companyId, rentalId, mediaId, status: 'CLEAN' }`, stream the promoted preview with `Content-Type: image/webp`, and return 404 for another tenant or unclean media.

- [ ] **Step 5: Run focused tests GREEN**

Run: `npx vitest run src/modules/rentals/operations/media src/app/(protected)/rentals/[id]/return-media/[mediaId]/route.test.ts`

Expected: image upload/scan/preview tests pass; legacy video tests remain green.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/rentals/operations/media src/app/(protected)/rentals/[id]/return-media
git commit -m "feat: secure rental return photos"
```

### Task 4: Persist and resume return drafts

**Files:**
- Create: `src/modules/rentals/operations/server/save-return-inspection.ts`
- Create: `src/modules/rentals/operations/server/save-return-inspection.test.ts`
- Modify: `src/modules/rentals/operations/server/prepare-operation.ts`
- Modify: `src/modules/rentals/operations/server/prepare-operation.test.ts`
- Modify: `src/modules/rentals/server/actions.ts`
- Modify: `src/modules/rentals/server/actions.test.ts`
- Modify: `src/modules/rentals/server/queries.ts`
- Modify: `src/modules/rentals/server/queries.test.ts`

**Interfaces:**
- Produces: `saveReturnInspectionDraft(database)(input)`.
- Produces: `getReturnInspectionDraft(companyId, rentalId, actorId)` DTO.
- Produces server actions: `saveReturnInspectionStepAction` and `commitReturnInspectionAction`.

- [ ] **Step 1: Write failing server tests**

Cover authorized active rental, non-active rejection, tenant denial, one resumable draft per actor/rental, stale update rejection, damage/media ownership, immutable committed operation and idempotent retry.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/modules/rentals/operations/server/save-return-inspection.test.ts src/modules/rentals/operations/server/prepare-operation.test.ts`

Expected: save/resume functions are missing.

- [ ] **Step 3: Implement serializable draft persistence**

Use `RentalOperation` with `type: 'RETURN'`, `status: 'DRAFT'` and an actor-bound idempotency key. Upsert only allowed mutable fields and replace draft damage rows in the same transaction after checking that every referenced `mediaId` belongs to the operation and company.

```ts
export type SaveReturnInspectionInput = {
  companyId: string;
  rentalId: string;
  actorId: string;
  idempotencyKey: string;
  occurredAt: Date;
  mileageKm: number;
  fuelLevelPercent: number;
  disposition: RentalReturnDisposition;
  damages: readonly ValidatedDamageDraft[];
};
```

- [ ] **Step 4: Expose typed actions and query DTO**

Return field errors keyed by `occurredAt`, `mileageKm`, `fuelLevelPercent`, `photos`, `damages`, `deposit` and `disposition`. Query the handover operation and its clean photo evidence for side-by-side comparison without exposing storage keys.

- [ ] **Step 5: Run focused tests GREEN**

Run: `npx vitest run src/modules/rentals/operations/server/save-return-inspection.test.ts src/modules/rentals/operations/server/prepare-operation.test.ts src/modules/rentals/server/actions.test.ts src/modules/rentals/server/queries.test.ts`

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/rentals/operations/server src/modules/rentals/server/actions* src/modules/rentals/server/queries*
git commit -m "feat: persist rental return drafts"
```

### Task 5: Build the return wizard from «Принять возврат»

**Files:**
- Create: `src/modules/rentals/components/RentalReturnWizard.tsx`
- Create: `src/modules/rentals/components/RentalReturnWizard.test.tsx`
- Create: `src/modules/rentals/components/return-wizard/ReturnPhotoStep.tsx`
- Create: `src/modules/rentals/components/return-wizard/ReturnPhotoStep.test.tsx`
- Create: `src/modules/rentals/components/return-wizard/DamageMarkerEditor.tsx`
- Create: `src/modules/rentals/components/return-wizard/DamageMarkerEditor.test.tsx`
- Create: `src/modules/rentals/components/return-wizard/ReturnConditionStep.tsx`
- Create: `src/modules/rentals/components/return-wizard/ReturnSettlementStep.tsx`
- Create: `src/modules/rentals/components/return-wizard/ReturnReviewStep.tsx`
- Modify: `src/modules/rentals/components/RentalActionRail.tsx`
- Modify: `src/modules/rentals/components/RentalActionRail.test.tsx`
- Modify: `src/modules/rentals/components/RentalOperationDialog.tsx`

**Interfaces:**
- Consumes: return draft DTO and actions from Task 4.
- Produces: `RentalReturnWizard({ rental, initialDraft, open, onOpenChange })`.

- [ ] **Step 1: Read installed Next.js modal/action guidance**

Read the relevant installed files under `node_modules/next/dist/docs/01-app` for Server Actions, forms and route handlers before editing client/server boundaries.

- [ ] **Step 2: Write failing entry-point and navigation tests**

Assert that an active rental displays «Принять возврат», clicking it opens the wizard (not `RentalOperationDialog`), confirmed/completed rentals have no return action, steps cannot advance without required data, and Back preserves draft state.

- [ ] **Step 3: Implement the wizard shell**

Use five labeled steps: `Данные`, `Фото`, `Состояние`, `Оплата`, `Проверка`. Keep the rental/client/vehicle identity fixed in the header. Autosave only on successful step transition, show pending/error states, and restore `initialDraft` when reopened.

- [ ] **Step 4: Write failing gallery interaction tests**

Assert exactly six labeled slots, a click changes the main image, the selected thumbnail has `aria-pressed="true"`, no next/previous arrows exist, upload status is announced, and Continue is disabled until six media records are clean.

- [ ] **Step 5: Implement gallery and damage editor**

Use normalized coordinates from pointer position:

```ts
const markerX = (event.clientX - rect.left) / rect.width;
const markerY = (event.clientY - rect.top) / rect.height;
```

Keyboard users add a marker through a visible «Добавить повреждение» button that defaults to image center and can edit numeric position through the same form. Every marker requires type and description; estimated cost remains optional.

- [ ] **Step 6: Implement comparison, settlement and review steps**

Desktop shows handover and return for the selected angle side by side. Mobile uses labeled `Выдача`/`Возврат` tabs. The settlement step shows formula rows and requires a reason when confirmed withholding differs from recommendation. Review lists all validation blockers with links to their step.

- [ ] **Step 7: Run component tests GREEN**

Run: `npx vitest run src/modules/rentals/components/RentalActionRail.test.tsx src/modules/rentals/components/RentalReturnWizard.test.tsx src/modules/rentals/components/return-wizard`

Expected: entry point, photo interaction, damage and review tests pass.

- [ ] **Step 8: Commit**

```powershell
git add src/modules/rentals/components
git commit -m "feat: add rental return inspection wizard"
```

### Task 6: Commit return and disposition atomically

**Files:**
- Modify: `src/modules/rentals/operations/server/return-rental.ts`
- Modify: `src/modules/rentals/operations/server/return-rental.test.ts`
- Modify: `src/modules/rentals/operations/server/execute-with-evidence.ts`
- Modify: `src/modules/rentals/operations/server/execute-with-evidence.test.ts`
- Modify: `src/modules/rentals/components/RentalOperationTimeline.tsx`
- Modify: `src/modules/rentals/components/RentalOperationTimeline.test.tsx`

**Interfaces:**
- Consumes: `inspectReturnPhotoSet`, `calculateReturnSettlement`, committed draft and disposition.
- Produces: one immutable committed return plus optional wash/maintenance record in one PostgreSQL transaction.

- [ ] **Step 1: Write failing commit tests**

Cover missing/scanning/blocked angle rejection, complete six-photo commit, return mileage below handover rejection, damage settlement, withholding cap, manual override reason, second-return idempotency, `READY`, `WASH`, `MAINTENANCE`, and rollback when follow-up creation fails.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/modules/rentals/operations/server/return-rental.test.ts src/modules/rentals/operations/server/execute-with-evidence.test.ts`

Expected: current video/dashboard evidence behavior fails new requirements.

- [ ] **Step 3: Replace new-return evidence derivation**

For a draft return, load all media and call `inspectReturnPhotoSet`; require `complete === true`. Keep legacy committed operations displayable but never permit new returns through `VIDEO_MISSING`, `DASHBOARD_PHOTO_MISSING` or `MISSING` exceptions.

- [ ] **Step 4: Commit settlement and disposition**

Inside the existing serializable transaction: validate active rental and handover, compute settlement, update operation to `COMMITTED`, update rental to `COMPLETED`, write damages and audit details, then either leave vehicle ready, create `WashRecord(status: 'PLANNED')`, or create `MaintenanceRecord(status: 'PLANNED')`. Any failure rolls back all changes.

- [ ] **Step 5: Render immutable history**

Timeline displays each return version, six authorized thumbnails, damage markers/descriptions, settlement formula, disposition and correction reason. Legacy video remains a read-only timeline attachment.

- [ ] **Step 6: Run focused tests GREEN**

Run: `npx vitest run src/modules/rentals/operations/server/return-rental.test.ts src/modules/rentals/operations/server/execute-with-evidence.test.ts src/modules/rentals/components/RentalOperationTimeline.test.tsx`

Expected: all commit/history tests pass.

- [ ] **Step 7: Commit**

```powershell
git add src/modules/rentals/operations/server src/modules/rentals/components/RentalOperationTimeline*
git commit -m "feat: complete inspected rental returns"
```

### Task 7: Verify the full contract return flow

**Files:**
- Modify: `tests/rentals.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `design-qa.md`

**Interfaces:**
- Consumes: complete feature from Tasks 1–6.
- Produces: regression evidence and operational documentation.

- [ ] **Step 1: Add browser scenarios**

Using disposable rental fixtures, cover opening «Принять возврат» from an active contract, restoring a draft after reload, uploading all six photos, replacing a blocked file, selecting thumbnails, marking damage, automatic charges, choosing wash, confirming, and observing completed rental plus planned wash. Add a mobile viewport assertion for comparison tabs and keyboard traversal.

- [ ] **Step 2: Run targeted browser tests**

Run: `$env:PILOT_RENTALS_E2E='1'; npx playwright test tests/rentals.spec.ts --workers=1`

Expected: all rental scenarios pass on the disposable test database.

- [ ] **Step 3: Update product and QA documentation**

Document the active-contract entry point, six required angles, no-video rule, immutable history, private storage/ClamAV behavior, disposition transaction and the exact verification date/result.

- [ ] **Step 4: Run the full proportional verification gate**

```powershell
npx prisma format
npx prisma validate
npm run lint
npm run typecheck
npm run test:unit
npm run build
git diff --check
```

Expected: every command exits `0`; lint contains no new warning from touched files; build completes successfully.

- [ ] **Step 5: Commit**

```powershell
git add tests/rentals.spec.ts docs/PROJECT_GUIDE.md design-qa.md
git commit -m "test: verify rental return photo inspections"
```


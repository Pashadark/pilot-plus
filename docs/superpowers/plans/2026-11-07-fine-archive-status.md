# Fine Archive Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe `ARCHIVED` fine status for provider records missing from both paid and unpaid lists, exclude archived fines from debt workflows, and archive the confirmed fine `73166758`.

**Architecture:** Persist provider-absence evidence on `Fine`, let the provider pagination layer report a complete set of seen external IDs, and reconcile missing active fines only after a fully valid two-endpoint sync. Treat `ARCHIVED` as closed but not paid across UI, deposits, reports, and bot queries; restore the provider status if the record reappears.

**Tech Stack:** Next.js 16.2, TypeScript, Prisma 6.16/PostgreSQL, React 19, Vitest.

## Global Constraints

- Product copy uses **Supa Pro** / **СУПА ПРО** only.
- UI label is **«Архив»** with a neutral grey badge.
- One missing sync never archives; two consecutive complete missing syncs do.
- Partial or failed provider reads never advance absence evidence.
- Archived fines are retained, searchable, exportable, and restorable.
- Follow TDD and preserve unrelated user changes.

---

### Task 1: Persist archive state

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20261107143000_add_fine_archive_status/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`

**Interfaces:**
- Produces: `FineStatus.ARCHIVED`, `FineArchiveReason`, and nullable/archive evidence fields on `Fine`.

- [ ] **Step 1: Write the failing schema test**

Assert that `FineStatus` contains `ARCHIVED`, the model exposes `providerMissingSince`, `providerMissingSyncCount`, `archivedAt`, and `archiveReason`, and the migration adds the enum value and columns without rewriting existing rows.

- [ ] **Step 2: Run the schema test and verify failure**

Run: `npx vitest run src/database/prisma/schema.test.ts`

Expected: FAIL because `ARCHIVED` and the evidence columns do not exist.

- [ ] **Step 3: Add the Prisma model and additive SQL migration**

Use these exact fields:

```prisma
enum FineArchiveReason {
  MISSING_FROM_PROVIDER
  MANUAL_CONFIRMED
}

model Fine {
  providerMissingSince     DateTime?          @db.Timestamptz(3)
  providerMissingSyncCount Int                @default(0)
  archivedAt               DateTime?          @db.Timestamptz(3)
  archiveReason            FineArchiveReason?
}
```

The SQL migration adds `ARCHIVED` to `FineStatus`, creates `FineArchiveReason`, and adds nullable/defaulted columns.

- [ ] **Step 4: Regenerate and validate Prisma**

Run: `npx prisma format && npx prisma generate && npx prisma validate`

Expected: all commands exit 0.

- [ ] **Step 5: Run the schema test and commit**

Run: `npx vitest run src/database/prisma/schema.test.ts`

Commit: `feat: persist archived fine status`

### Task 2: Reconcile complete provider snapshots

**Files:**
- Modify: `src/modules/fines/sync/sync-company-fines.ts`
- Modify: `src/modules/fines/sync/sync-company-fines.test.ts`
- Modify: `src/modules/fines/sync/sync-company-fines.server.ts`
- Modify: `src/modules/fines/sync/sync-company-fines.server.test.ts`

**Interfaces:**
- Produces: `reconcileMissing(companyId: string, seenExternalIds: readonly string[]): Promise<void>` dependency called only when `skipped === 0`.
- Consumes: archive fields and `FineStatus.ARCHIVED` from Task 1.

- [ ] **Step 1: Write failing pure-sync tests**

Cover: all paid/unpaid IDs are deduplicated and passed to `reconcileMissing`; a skipped/invalid normalized fine suppresses reconciliation; a thrown page request suppresses reconciliation naturally.

- [ ] **Step 2: Run the pure-sync tests and verify failure**

Run: `npx vitest run src/modules/fines/sync/sync-company-fines.test.ts`

Expected: FAIL because `reconcileMissing` is not part of the dependency contract.

- [ ] **Step 3: Add the complete-snapshot callback**

After all pages normalize and upsert successfully:

```ts
if (skipped === 0) {
  await dependencies.reconcileMissing(companyId, [...normalizedFines.keys()]);
}
```

- [ ] **Step 4: Write failing server reconciliation tests**

Cover these state transitions:

```text
UNPAID + first absence  -> UNPAID, count 1
UNPAID + second absence -> ARCHIVED, reason MISSING_FROM_PROVIDER
ARCHIVED + reappears    -> provider status, evidence cleared
PAID/CANCELLED absent   -> unchanged
```

Also assert an archive audit entry and deposit-reservation reconciliation on the second absence.

- [ ] **Step 5: Implement transactional reconciliation**

Query eligible Driver Helper fines (`NEW`, `UNPAID`, `OVERDUE`, `ARCHIVED`) not present in `seenExternalIds`. For each active missing fine, atomically increment evidence; on count 2 set `ARCHIVED`, `archivedAt`, and `MISSING_FROM_PROVIDER`. On every provider upsert clear evidence and archive fields before saving the real provider status.

- [ ] **Step 6: Run sync tests and commit**

Run: `npx vitest run src/modules/fines/sync/sync-company-fines.test.ts src/modules/fines/sync/sync-company-fines.server.test.ts`

Commit: `feat: archive fines missing from provider`

### Task 3: Treat archived fines as closed everywhere

**Files:**
- Modify: `src/modules/deposits/server/fine-reservation.ts`
- Modify: `src/modules/deposits/server/fine-reservation.test.ts`
- Modify: `src/modules/fines/deadline-queue.ts`
- Modify: `src/modules/fines/deadline-queue.test.ts`
- Modify: `src/modules/fines/server/queries.ts`
- Modify: `src/modules/fines/server/queries.test.ts`
- Modify: `src/modules/fines/server/sidebar-count.test.ts`
- Modify: `src/modules/fines/components/FinesPage.tsx`
- Modify: `src/modules/fines/components/FinesPage.test.tsx`
- Modify: `src/modules/fines/components/FineCard.tsx`
- Modify: `src/modules/fines/components/FineCard.test.tsx`
- Modify: `src/modules/clients/types.ts`
- Modify: `src/modules/clients/server/client-fines.ts`
- Modify: `src/modules/clients/server/client-fines.test.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`

**Interfaces:**
- Consumes: `FineStatus.ARCHIVED` from Task 1.
- Produces: consistent closed-state semantics and visible **«Архив»** filtering.

- [ ] **Step 1: Write failing closed-state tests**

Assert `ARCHIVED` releases an existing fine reservation, is excluded from deadline groups, client unpaid totals, sidebar counts, urgent metrics, payment selection, and daily unpaid bot queries.

- [ ] **Step 2: Run targeted tests and verify failure**

Run: `npx vitest run src/modules/deposits/server/fine-reservation.test.ts src/modules/fines/deadline-queue.test.ts src/modules/fines/server/queries.test.ts src/modules/fines/server/sidebar-count.test.ts src/modules/clients/server/client-fines.test.ts src/modules/bot-api/notifications.test.ts`

- [ ] **Step 3: Implement closed-state semantics**

Use a shared closed set where practical:

```ts
const closedFineStatuses = new Set(['PAID', 'CANCELLED', 'ARCHIVED']);
```

`ARCHIVED` releases reservation/debt like `CANCELLED`, but uses reason `Штраф перенесён в архив: провайдер больше не возвращает запись`.

- [ ] **Step 4: Add archive UI and filter tests**

Assert the status selector contains `ARCHIVED`, cards/table show **«Архив»** with `neutral` tone, archived cards have no payment action, and archived records remain searchable/filterable.

- [ ] **Step 5: Implement archive UI**

Extend `FineItem.status`, query status parsing, filter options, status labels, card closed logic, and export DTOs. Add `archivedAt` to the query/DTO so the detail surface can show the archive date.

- [ ] **Step 6: Run UI/domain tests and commit**

Run: `npx vitest run src/modules/fines src/modules/clients/server/client-fines.test.ts src/modules/deposits/server/fine-reservation.test.ts src/modules/bot-api/notifications.test.ts`

Commit: `feat: show archived fines as closed`

### Task 4: Safe manual archive and production rollout

**Files:**
- Create: `scripts/archive-confirmed-fine.ts`
- Create: `scripts/archive-confirmed-fine.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run fines:archive-confirmed -- --external-id <id> --confirm ARCHIVE_CONFIRMED`.

- [ ] **Step 1: Write failing script planner tests**

Test exact confirmation, numeric external ID validation, idempotent `ARCHIVED` handling, archive field update, deposit release, and audit write without exposing provider tokens or personal data.

- [ ] **Step 2: Implement the guarded script**

Require the explicit confirmation literal `ARCHIVE_CONFIRMED`; find exactly one Driver Helper fine by company/external ID; archive it with reason `MANUAL_CONFIRMED`; reconcile its deposit reservation; write an audit event; print only fine ID, decree number, previous status, and result.

- [ ] **Step 3: Run complete local verification**

Run:

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run build
git diff --check
```

Expected: relevant checks pass; unrelated pre-existing failures, if any, are recorded without changing unrelated files.

- [ ] **Step 4: Commit the guarded operation**

Commit: `feat: add guarded fine archive operation`

- [ ] **Step 5: Deploy safely**

Create and verify PostgreSQL/private-storage backups, upload an immutable release, run `prisma migrate deploy`, use `/usr/local/sbin/supapro-zero-downtime-deploy`, and verify web/worker health.

- [ ] **Step 6: Archive the confirmed fine**

Run the guarded command for external ID `73166758`, verify status `ARCHIVED`, archive reason `MANUAL_CONFIRMED`, exclusion from unpaid counts, and any reservation release.

- [ ] **Step 7: Production canary**

Verify `/login` 200, no new web/worker errors, the fine appears under **«Архив»**, no payment button is rendered, and no unpaid notification job includes the archived fine.

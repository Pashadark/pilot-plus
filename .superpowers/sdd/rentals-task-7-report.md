# Rentals Task 7 report

- Hardened the inherited confirmation core to reload only a tenant-scoped DRAFT, use vehicle-scoped half-open overlap predicates, atomically mark it confirmed and write a sanitized audit record.
- Serializable retries remain bounded at three `P2034` attempts.

## Verification

- Focused confirmation test and TypeScript check run before commit.

## Second wave

- Added tenant-scoped rental list query and cancellation action. Cancellation reauthorizes, limits state transitions to DRAFT/CONFIRMED, and records a sanitized audit entry atomically.

- Added create/update draft actions with server-side company ownership checks for client, rental-ready vehicle and published template, deterministic calculation and atomic audit.

## Final confirmation hardening

- Added the rolling-safe additive `RentalNumberCounter` keyed by company and calendar year. The counter has a positive-value database check and is advanced with `upsert` inside the confirmation `Serializable` transaction; no database was applied.
- Confirmation now reauthorizes inside that transaction, reloads the tenant-scoped draft and all legal inputs, requires current `CLEAN` passport and driver-license documents, checks required vehicle registration/insurance fields and policy coverage, creates the versioned legal snapshot, assigns `ME-YYYY-NNNN-BK`, sets the confirmation instant, and writes a PII-free audit record atomically.
- The confirmation action now routes only the submitted company/rental pair through that hardened transaction. P2034 retries remain bounded to three attempts; a counter-creation P2002 race is retried through the same transaction path.

### TDD and verification

- RED: counter schema/migration test failed before the model/migration existed; confirmation tests failed before number/snapshot/documents behavior and action wiring existed; the counter check test then failed before its SQL constraint was added.
- GREEN: `npx vitest run src/modules/rentals/server` (14 tests), `npx vitest run src/database/prisma/rental-schema.test.ts` (18 tests), `npm run typecheck`, and `npx prisma validate` with a dummy non-connecting URL pass. `git diff --check` is clean.
- `npm run format:check` remains blocked by pre-existing unrelated formatting in `src/modules/vehicles/manage/components/FleetImportDialog.test.tsx`; Task 7 TypeScript files were individually formatted and checked.

## Review follow-up

- Added `AuditEntityType.RENTAL` and a nullable `Rental.confirmedByUserId` relation/index through an additive migration; the confirmation update persists the actor in the same transaction.
- Contract sequence years now use `Europe/Moscow`, the counter retry is limited strictly to `P2034`, and a `P2002` collision maps to a stable, PII-free confirmation result.
- Draft price bases use `BigInt(days) * BigInt(dailyMinor)`, and draft updates use one tenant- and DRAFT-scoped `updateMany` check inside the transaction.
- A current client document is accepted only when its `ClientDocumentVersion` at `currentVersion` has `scanVerdict: CLEAN`; stale parent status or an older clean version is rejected. Added regression coverage for cross-tenant/idempotent no-op, incomplete snapshot rollback, policy expiry, Moscow New Year numbering, P2002, and PII-free audit changes.

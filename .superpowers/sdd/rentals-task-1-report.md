# Task 1 report: rental database domain and rolling migration

## Scope and TDD evidence

- Work was performed only in `C:\Users\pasahdark\Projects\pilot-plus\.worktrees\rental-contracts-database`.
- Added `src/database/prisma/rental-schema.test.ts` before the implementation. Its initial run failed as expected: 10/10 assertions failed because the rental enums, four models, expanded fields, and migration did not exist.
- A later RED check caught timestamp-without-time-zone in the initial design; the final migration uses `TIMESTAMPTZ(3)` and `tstzrange` for exact UTC rental intervals.
- A later RED check caught the missing explicit `Company.rentalDocumentVersions` relation; it was added and the test passed.

## Changed files

- `src/database/prisma/schema.prisma`: rental enums and models; tenant-scoped composite relations; versioned JSON snapshots; legal/bank/contract company fields; vehicle legal/rental/insurance/archive fields; compound keys and indexes.
- `src/database/prisma/migrations/20260813090000_add_vehicle_legal_columns` through `20260813090010_validate_vehicle_archived_by_user_foreign_key`: ordered add-only rolling waves for vehicle metadata/backfill, one-index concurrent legacy operations, rental structures, foreign keys, and deferred Vehicle FK validation.
- `src/database/prisma/rental-schema.test.ts`: focused schema/migration contract tests.
- `src/database/prisma/schema.test.ts`: whitespace-sensitive legacy assertions changed to semantic regex assertions because Prisma formatting realigns columns after fields are added.

## Rolling-migration decisions

- No existing migration, table, column, enum, or data row is modified or removed.
- New company and vehicle fields are nullable except `isRentalReady`, defaulting to `false`; existing vehicles remain non-rentable until completed explicitly.
- Existing `Vehicle.model` is retained; normalized make/model fields are additive.
- Company-scoped uniqueness for normalised plate and VIN permits multiple legacy `NULL` values in PostgreSQL.
- Rentals use `TIMESTAMPTZ(3)` / Prisma `@db.Timestamptz(3)`; calendar-only legal dates use PostgreSQL `DATE` / Prisma `@db.Date`.
- The partial exclusion constraint is the database guard for concurrent confirmation/activation. Draft and cancelled rentals do not occupy the vehicle interval.

## Self-review

- `AuditLog` was not modified and no new audit payload is introduced, so this change does not write PII to audit records.
- Company/client/vehicle/template and rental child links carry tenant identifiers with composite foreign keys where the referenced model exposes a tenant composite key.
- `RentalDocumentVersion` has tenant/client/document/version compound foreign keys plus a unique `clientDocumentVersionId`, so one client-document version can be used by exactly one immutable rental-document history record.
- The task did not apply the migration, create a DB, or run seed.

## Verification

All commands exited with code 0 in the rental worktree:

- `npx prisma format --schema src/database/prisma/schema.prisma`
- `DATABASE_URL=<non-connecting validation URL>; npx prisma validate --schema src/database/prisma/schema.prisma`
- `DATABASE_URL=<non-connecting validation URL>; npx prisma generate --schema src/database/prisma/schema.prisma`
- `npx vitest run src/database/prisma/rental-schema.test.ts` — 10/10 passed.
- `npx vitest run src/database/prisma/schema.test.ts` — 14/14 passed.
- `npx prettier --check src/database/prisma/rental-schema.test.ts src/database/prisma/schema.test.ts`
- `npm run typecheck`

## Final rolling-invariants wave

### RED → GREEN evidence

- RED: expanded focused tests first and observed 5 failures: no `vinNormalized` compatibility invariant, no one-to-one client-document-version link, no second concurrent-index migration, no immutable-history triggers, and no numeric calculation check. The expected failures were recorded before the second-wave SQL/schema edits.
- A subsequent Prisma validation exposed the one-to-one relation requirement: a unique scalar alone is insufficient when the relation references `(documentId, id)`. The schema and migration now contain both the single-version uniqueness and compound `(clientDocumentId, clientDocumentVersionId)` key required by Prisma/PostgreSQL.
- GREEN: `npx vitest run src/database/prisma/rental-schema.test.ts` passed 16/16 after the final edits. Tests cover the two-wave migration contract, legacy VIN variants `VIN123` / `vin123` / surrounding spaces, a non-override `4 × 1000 != 2000` calculation rejection, lifecycle transition guards, immutable snapshots/templates, and reverse source-document mutation guards.

### Corrected rolling plan

- This historical two-wave description is superseded by the current numbered sequence documented below and in `docs/runbooks/rental-migration-recovery.md`.

### Final invariants

- `Vehicle.vinNormalized` is `NULLIF(upper(btrim(vin)), '')`; the same function is used by trigger, deterministic backfill, duplicate preflight, and company-scoped unique index. Server code can dual-write it later, while the trigger preserves old-writer compatibility now.
- The calculation check requires positive billable days and, absent `NULLIF(btrim(priceOverrideReason), '')`, requires `dailyRateMinor × billableDays = basePriceMinor` and the total formula. It casts operands to `numeric` inside the check to avoid bigint-multiplication overflow in validation.
- Published contract templates reject update/delete. Confirmed/active/completed rentals freeze company/client/vehicle/interval/contract/snapshot/template fields while allowing only documented forward or cancellation status transitions; the lifecycle check enforces timestamp ordering and stronger cancelled-state consistency.
- Rental document history has a one-to-one `clientDocumentVersionId`; CONTRACT category and verified DOCX/PDF MIME are checked on association. Reverse triggers reject a later category/MIME edit that would invalidate an already-linked rental document. File metadata and scan status remain a single source on `ClientDocumentVersion`; this change does not claim a separate rental scan status.

### Final verification and limitations

- PASS: `npx prisma format --schema src/database/prisma/schema.prisma`, `npx prisma generate --schema src/database/prisma/schema.prisma`, and `npx prisma validate --schema src/database/prisma/schema.prisma` using a non-connecting disposable URL.
- PASS: focused Vitest 16/16 and `git diff --check`.
- A disposable PostgreSQL container was attempted but could not be started because Docker API access required an approval that was interrupted. No migration, seed, or SQL was applied to a shared database. Database-execution semantics therefore remain an operational integration check, not a claimed PASS.
- `git diff --check`

Prettier was run only on TypeScript tests: the repository does not configure Prisma/SQL parsers, so applying Prettier to `schema.prisma` or `migration.sql` fails with “No parser could be inferred”. Prisma formatting is the schema formatter; SQL was inspected manually and `git diff --check` passed.

## Concerns

- No disposable database was supplied for end-to-end `prisma migrate deploy` or fresh-migration verification. This task deliberately did not use the common database. Apply the migration first to a disposable PostgreSQL/PostGIS database in the later integration task.
- Prisma warns that `package.json#prisma` is deprecated ahead of Prisma 7; this is pre-existing and outside this migration task.

## Finalization verification (2026-08-13)

- PASS: `npx vitest run src/database/prisma/rental-schema.test.ts src/database/prisma/schema.test.ts` — 2 test files, 30/30 tests passed (16 rental-schema and 14 legacy-schema assertions).
- PASS: `npx prettier --check src/database/prisma/rental-schema.test.ts src/database/prisma/schema.test.ts`. The initial targeted check found a Prettier-only deviation in `rental-schema.test.ts`; it was mechanically formatted with `npx prettier --write src/database/prisma/rental-schema.test.ts`, then the check passed.
- PASS: `git -C <rental worktree> diff --check`.
- The current diff uses the numbered `20260813090000`–`20260813090010` sequence; its failure recovery is documented in the rental migration recovery runbook.
- Docker-based disposable-PostgreSQL validation remains unavailable: the prior Docker API approval attempt was interrupted. No Docker command was retried, no shared database was touched, and migration execution remains an integration gap rather than a claimed verification result.

## Prisma-deploy rolling split fix wave

### RED → GREEN evidence

- RED: the focused rental schema contract was extended before the migration rewrite. It failed in four expected places because the required structural files and one-statement concurrent migrations did not exist.
- GREEN: the rewritten sequence passes the focused rental and legacy schema suites. The test now verifies that every populated-table concurrent-index migration has exactly one `CREATE INDEX CONCURRENTLY` statement and no `BEGIN`, `COMMIT`, `DO`, `SET`, `ALTER`, or table creation; it also checks that a later transactional foreign-key wave follows them.
- The rental immutability contract was extended before the guard change. It now asserts `OLD.confirmedAt IS NOT NULL` and the frozen minor-unit calculation fields, so a confirmed rental remains immutable even after its status becomes `CANCELLED`.

### Exact normal deploy sequence

1. `20260813090000_add_vehicle_legal_columns`: short transactional Vehicle metadata ALTER plus normalizer functions/trigger. `SET LOCAL lock_timeout = '5s'` and `SET LOCAL statement_timeout = '60s'` bound this short migration only.
2. `20260813090001_backfill_vehicle_legal_identifiers`: committed separately, performs the deterministic identifier backfill and duplicate preflight with a ten-minute statement timeout. It no longer holds the earlier Vehicle `ALTER TABLE` ACCESS EXCLUSIVE lock.
3. `20260813090002` through `20260813090007`: each migration contains exactly one concurrent index statement for a populated legacy table. If one fails, use the explicit targeted recovery runbook before rerunning `prisma migrate deploy`; do not treat a failed concurrent build as an automatic retry.
4. `20260813090008_add_rental_domain_structures`: transactional company legal fields, rental enums/tables, constraints, immutable-history functions/triggers, and ordinary indexes only on newly created empty tables.
5. `20260813090009_add_rental_domain_foreign_keys`: short transactional foreign-key wave after all required legacy supporting keys exist, with five-second lock and sixty-second statement timeouts. The populated Vehicle FK is attached `NOT VALID`.
6. `20260813090010_validate_vehicle_archived_by_user_foreign_key`: separately validates that Vehicle FK with five-second lock and ten-minute statement timeouts.

The previous multi-statement `20260813090100` concurrent wave and monolithic `20260813090000` wave were removed before deployment; they were never applied to any database. There is no custom runner, but a failed concurrent index requires the targeted Prisma migration-history recovery in the runbook.

### Final constraints and concern

- The immutable rental trigger permits only documented lifecycle transitions. Once `confirmedAt` is present, it freezes tenant/client/vehicle, exact interval, contract/snapshot/template identity, currency, every calculation and tariff minor-unit value, plus any override reason; this persists for a subsequently cancelled rental. The lifecycle CHECK keeps all timestamp order and cancellation consistency rules.
- A disposable PostgreSQL/PostGIS execution of the full migration sequence remains unverified because Docker approval was unavailable. No Docker command was retried, and no shared database, migration deployment, or seed was touched. The migration SQL remains an integration concern until it is exercised against a disposable database.

## Review hardening wave

Review findings were addressed in a separate fix wave without applying the migration or running seed.

### RED → GREEN evidence

- Extended `rental-schema.test.ts` before changing the schema/migration. The RED run failed in four independent assertions: rental documents had no client-scoped ownership link, rentals used timestamp-without-time-zone and `Int` money, legacy plate migration had no normalization/preflight/trigger, and lifecycle/version/document-category constraints were absent.
- After the first implementation pass, a focused test added for verified MIME-to-format consistency failed because a rental `DOCX`/`PDF` association could be mislabeled. The migration now has a second trigger that checks the linked immutable client-document version has the exact DOCX or PDF MIME type.
- GREEN: `rental-schema.test.ts` now passes 14/14, including migration ordering (`trigger → deterministic backfill → duplicate preflight → unique index`), duplicate guards, lock timeout, composite document ownership, UTC types, bigint minor units, lifecycle/calculation checks, and CONTRACT/MIME triggers.

### Database-bound document association

- `RentalDocumentVersion` no longer duplicates mutable storage key, checksum, byte count, or scan status. Those remain solely on `ClientDocumentVersion`.
- Each rental-document association has required `companyId`, `clientId`, `rentalId`, `clientDocumentId`, and `clientDocumentVersionId`.
- Composite foreign keys enforce that the rental belongs to the same company/client, the client document belongs to that company/client, and the selected version belongs to that same document. A trigger additionally requires category `CONTRACT`; another trigger requires the declared DOCX/PDF format to match the version’s verified MIME type.

### Legacy vehicle and operational safety

- Deterministic plate and VIN normalizers plus `BEFORE INSERT OR UPDATE OF registrationNumber, vin` trigger preserve derived values for legacy writers.
- Existing rows are backfilled before uniqueness. A `DO` preflight aborts with a clear message if normalized plates or case/whitespace-insensitive VINs are duplicated; it never resolves or deletes rows automatically.
- Superseded by the final numbered sequence and targeted recovery runbook above.

## Recovery and FK safeguard fix wave

- RED: focused tests failed because the rental-document unique constraints had duplicate explicit indexes, confirmed history did not freeze creator/timestamps, Vehicle FK attachment was fully validating, and no targeted concurrent-index recovery runbook existed.
- GREEN: the duplicate index declarations were removed; the table's named `UNIQUE` constraints remain the only definitions. The immutable trigger now freezes `createdByUserId`, `confirmedAt`, and any historical lifecycle timestamp once set, while permitting exactly the valid `CONFIRMED → ACTIVE`, `ACTIVE → COMPLETED`, or confirmed/active → cancelled timestamp assignment.
- `Vehicle_archivedByUserId_fkey` is now attached `NOT VALID` in `20260813090009`; `20260813090010` validates it separately with bounded lock/statement timeouts. New rental-table FKs remain normal because their tables are empty at creation.
- Added `docs/runbooks/rental-migration-recovery.md`. It requires inspecting the exact named `pg_index` row and `indisvalid`, dropping only an invalid/partial target index concurrently, resolving only the named migration as rolled back, rerunning `npx prisma migrate deploy`, and verifying both migration history and index readiness. No shared-DB automation is introduced.

## Concurrent recovery runbook precision fix

- The recovery runbook now requires an exact migration-directory → schema-qualified-index mapping and returns `schemaname`, `indexname`, `indisvalid`, `indisready`, and `pg_get_indexdef` for the one named target.
- Branch A marks the migration applied only when one index is valid, ready, and has an exact expected definition. Branch B drops only the exact `public."<index_name>"` target when invalid or not ready, marks only that migration rolled back, then deploys. Branch C stops for manual DBA review on definition mismatch or any ambiguity; it explicitly forbids dropping or resolving in that case.
- RED: the existing focused runbook contract was extended and failed because the former runbook did not inspect `pg_get_indexdef` or describe the applied/ambiguity branches. GREEN: `npx vitest run src/database/prisma/rental-schema.test.ts` passed 16/16 after the documentation update.

### Type and invariant hardening

- Rental interval and lifecycle instants use `TIMESTAMPTZ(3)` / `@db.Timestamptz(3)`; birth and insurance calendar dates use `DATE` / `@db.Date`.
- New rental and vehicle monetary columns use `BIGINT` / Prisma `BigInt`. Existing `Vehicle.dailyPriceMinor Int` remains unchanged for compatibility.
- Added positive snapshot/template/document versions, nonnegative driver ordering, template publishing consistency, lifecycle timestamp/contract-number consistency, nonnegative amounts, and calculation consistency unless a manual override reason is recorded.

### Additional verification after hardening

- `npx prisma format --schema src/database/prisma/schema.prisma`
- `DATABASE_URL=<non-connecting validation URL>; npx prisma validate --schema src/database/prisma/schema.prisma`
- `DATABASE_URL=<non-connecting validation URL>; npx prisma generate --schema src/database/prisma/schema.prisma`
- `npx vitest run src/database/prisma/rental-schema.test.ts` — 14/14 passed.
- `npx vitest run src/database/prisma/schema.test.ts` — 14/14 passed.
- `npm run typecheck`

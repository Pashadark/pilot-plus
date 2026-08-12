# Task 1 report: rental database domain and rolling migration

## Scope and TDD evidence

- Work was performed only in `C:\Users\pasahdark\Projects\pilot-plus\.worktrees\rental-contracts-database`.
- Added `src/database/prisma/rental-schema.test.ts` before the implementation. Its initial run failed as expected: 10/10 assertions failed because the rental enums, four models, expanded fields, and migration did not exist.
- A later RED check caught timestamp-without-time-zone in the initial design; the final migration uses `TIMESTAMPTZ(3)` and `tstzrange` for exact UTC rental intervals.
- A later RED check caught the missing explicit `Company.rentalDocumentVersions` relation; it was added and the test passed.

## Changed files

- `src/database/prisma/schema.prisma`: rental enums and models; tenant-scoped composite relations; versioned JSON snapshots; legal/bank/contract company fields; vehicle legal/rental/insurance/archive fields; compound keys and indexes.
- `src/database/prisma/migrations/20260813090000_add_rentals_and_vehicle_legal_fields/migration.sql` and `20260813090100_add_rentals_and_vehicle_legal_indexes/migration.sql`: sequential add-only structural and concurrent-index waves, foreign keys, checks, triggers, and a partial GiST exclusion constraint for confirmed/active rentals.
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

- The original one-file migration plan is superseded for correctness because PostgreSQL rejects `CREATE INDEX CONCURRENTLY` inside a transaction block. The un-applied migration was split additively into ordered paths `20260813090000` (explicit `BEGIN`, local five-second lock timeout and ten-minute statement timeout, structural DDL/backfill/preflights/triggers) and `20260813090100` (no `BEGIN`/`COMMIT`, concurrent index wave and restart-aware foreign-key guards).
- The second path must be executed by a runner that does not surround the migration SQL with a transaction. Standard Prisma migration execution behavior must be verified against the deployment runner before production; if it wraps migration SQL, run this explicitly documented path with a PostgreSQL non-transactional runner and reconcile migration history according to the deployment procedure.
- The concurrent wave uses `IF NOT EXISTS` for valid indexes, detects any invalid interrupted index by name before retry, and requires a deliberate `DROP INDEX CONCURRENTLY` of that invalid index. It never deletes or resolves duplicate vehicle data. Foreign-key creation is guarded by `pg_constraint` checks; it still has short lock-timeout operational risk and should be deployed during low write volume.

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
- The current diff retains the deliberate two-wave rolling layout: `20260813090000` is transactional structural/backfill/guard DDL; `20260813090100` contains the non-transactional `CREATE INDEX CONCURRENTLY` wave and must be run by a compatible deployment runner.
- Docker-based disposable-PostgreSQL validation remains unavailable: the prior Docker API approval attempt was interrupted. No Docker command was retried, no shared database was touched, and migration execution remains an integration gap rather than a claimed verification result.

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
- The rolling plan is now explicitly split: the transactional structural wave has `SET LOCAL lock_timeout` and `SET LOCAL statement_timeout`; the subsequent no-`BEGIN` wave builds all indexes with `CREATE INDEX CONCURRENTLY`. Its runner must not wrap the script in a transaction; interrupted invalid concurrent indexes require the explicitly documented `DROP INDEX CONCURRENTLY` repair before retry.

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

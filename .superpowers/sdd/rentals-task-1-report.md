# Task 1 report: rental database domain and rolling migration

## Scope and TDD evidence

- Work was performed only in `C:\Users\pasahdark\Projects\pilot-plus\.worktrees\rental-contracts-database`.
- Added `src/database/prisma/rental-schema.test.ts` before the implementation. Its initial run failed as expected: 10/10 assertions failed because the rental enums, four models, expanded fields, and migration did not exist.
- A later RED check caught the initial use of `tstzrange` against Prisma/PostgreSQL `TIMESTAMP(3)` fields; the migration was corrected to `tsrange` and the assertion passed.
- A later RED check caught the missing explicit `Company.rentalDocumentVersions` relation; it was added and the test passed.

## Changed files

- `src/database/prisma/schema.prisma`: rental enums and models; tenant-scoped composite relations; versioned JSON snapshots; legal/bank/contract company fields; vehicle legal/rental/insurance/archive fields; compound keys and indexes.
- `src/database/prisma/migrations/20260813090000_add_rentals_and_vehicle_legal_fields/migration.sql`: add-only columns, enums, tables, indexes, foreign keys, checks, and a partial GiST exclusion constraint for confirmed/active rentals.
- `src/database/prisma/rental-schema.test.ts`: focused schema/migration contract tests.
- `src/database/prisma/schema.test.ts`: whitespace-sensitive legacy assertions changed to semantic regex assertions because Prisma formatting realigns columns after fields are added.

## Rolling-migration decisions

- No existing migration, table, column, enum, or data row is modified or removed.
- New company and vehicle fields are nullable except `isRentalReady`, defaulting to `false`; existing vehicles remain non-rentable until completed explicitly.
- Existing `Vehicle.model` is retained; normalized make/model fields are additive.
- Company-scoped uniqueness for normalised plate and VIN permits multiple legacy `NULL` values in PostgreSQL.
- Rentals use `TIMESTAMP(3)` to remain consistent with the existing Prisma/PostgreSQL schema. Application code must write and interpret those values as UTC; the interval constraint verifies strict ordering.
- The partial exclusion constraint is the database guard for concurrent confirmation/activation. Draft and cancelled rentals do not occupy the vehicle interval.

## Self-review

- `AuditLog` was not modified and no new audit payload is introduced, so this change does not write PII to audit records.
- Company/client/vehicle/template and rental child links carry tenant identifiers with composite foreign keys where the referenced model exposes a tenant composite key.
- `RentalDocumentVersion` links to existing `ClientDocumentVersion` by its existing global ID. Later server workflow must verify that this document version belongs to the rental client/company before assigning it; the existing client-document version table has no tenant composite key for a database-level composite FK without a separate migration.
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
- `git diff --check`

Prettier was run only on TypeScript tests: the repository does not configure Prisma/SQL parsers, so applying Prettier to `schema.prisma` or `migration.sql` fails with “No parser could be inferred”. Prisma formatting is the schema formatter; SQL was inspected manually and `git diff --check` passed.

## Concerns

- No disposable database was supplied for end-to-end `prisma migrate deploy` or fresh-migration verification. This task deliberately did not use the common database. Apply the migration first to a disposable PostgreSQL/PostGIS database in the later integration task.
- Prisma warns that `package.json#prisma` is deprecated ahead of Prisma 7; this is pre-existing and outside this migration task.

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

- A deterministic plate normalizer plus `BEFORE INSERT OR UPDATE OF registrationNumber` trigger preserves the derived normalized value for legacy writers.
- Existing rows are backfilled before uniqueness. A `DO` preflight aborts with a clear message if normalized plates or case/whitespace-insensitive VINs are duplicated; it never resolves or deletes rows automatically.
- Prisma migration transactions cannot use `CREATE INDEX CONCURRENTLY`. The migration sets a five-second local lock timeout and documents that index creation must be deployed in a low-write window; lock contention fails rather than causing an unbounded wait.

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

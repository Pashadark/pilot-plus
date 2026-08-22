# Client reliability rating — Task 2 report

## Scope delivered

- Added a server-only tenant-scoped client-rating projection. Detail reads return `null`
  outside the caller's company scope, and list aggregation performs one bounded query for
  the requested IDs without selecting encrypted client fields.
- Added the automatic rating-event writer. It writes only `AUTOMATIC` events with a
  nullable actor, a deterministic idempotency key, and the Task 1 machine reason enum;
  there is no free-text rating-event or audit payload.
- Wired clean completion (`+8`) and on-time return (`+2`) into the existing serializable
  rental-return transaction after the return operation is committed. Clean completion also
  requires `GOOD` vehicle condition and no open, non-hidden problem linked to that rental.
- Wired confirmed unpaid overdue fines (`-15`) into the existing serializable manual fine
  assignment transaction after its exact tenant/vehicle rental binding is confirmed.
  Candidate, cleared, non-overdue, and synchronization paths do not write score events.

## Test-first evidence

1. The new projection and writer tests were created before their production modules.
   `npx vitest run src/modules/client-rating/queries.test.ts src/modules/client-rating/automatic-events.test.ts`
   failed because both modules were absent.
2. After the minimal implementations, that same command passed with 4 tests.
3. Return/fine boundary tests were then added before integrating the writer. Their focused
   run failed because no ledger records were created.
4. A rental-open-problem test was added before the clean-completion gate; it failed because
   no comment lookup occurred, then passed after the narrow transaction-local lookup.

## Verification

- Focused Vitest: 4 files, 13 tests passed.
- `npm run typecheck` passed.
- Scoped Prettier check passed.
- `git diff --check` passed using the worktree safe-directory override.

## Safety notes

- No Prisma schema changes, migration, generate, seed, reset, or shared-database action was
  performed.
- Event relationships carry the company, client, rental/fine, and optional vehicle IDs, so
  Task 1 composite tenant foreign keys validate provenance at write time.
- The `OVERDUE` fine status is the current persisted unpaid-deadline signal; if a later worker
  transitions a fine to `OVERDUE`, it must call the same idempotent writer only after confirmed
  rental/client attribution.

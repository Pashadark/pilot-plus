# Client reliability rating — Task 3 report

## Scope delivered

- Expanded tenant-scoped client-comment DTOs and reads with problem lifecycle,
  explicit rating-impact, delta, and resolution fields.
- Added explicit validation for ordinary score-neutral notes and admin-only manual
  score impact: integer `+1…+10` or `−1…−30`, excluding zero.
- Creates problem statuses only for problem, damage, payment, and violation
  categories. General and positive notes retain no problem status.
- Creates a comment, one append-only manual rating event, and a PII-safe audit
  entry in the same transaction. The event uses `MANUAL_COMMENT` (a fixed reason
  enum), links to the comment, and has deterministic key `manual-comment:<id>`;
  it contains no free-text comment content.
- Only `SYSTEM` scope or the exact `COMPANY_ADMIN` membership may create or
  submit a rating-impacting note. A dispatcher cannot introduce rating impact by
  editing a comment. Existing tenant-scoped comment creation, editing, pinning,
  and self-only dispatcher hiding remain available.
- Added `resolveClientCommentAction`. It resolves only visible, open problems
  through a company/client/comment-scoped `updateMany`, records the resolver when
  the actor has a company membership, writes an audit entry, and never changes
  the rating ledger.

## Test-first evidence

1. Added validation, transaction/RBAC/resolve, and DTO tests before the
   implementation.
2. Confirmed RED with:

   ```powershell
   npx vitest run src/modules/client-comments/validation.test.ts src/modules/client-comments/actions.test.ts src/modules/client-comments/queries.test.ts
   ```

   Result: 7 expected failures for missing lifecycle/rating fields, invalid
   rating ranges being accepted, absent manual-event authorization/writing,
   missing resolve action, and omitted DTO fields.
3. Added the dispatcher edit-escalation regression test, confirmed its expected
   RED failure, then added the exact-company-admin guard.

## Verification

- Focused Vitest: 3 files, 13 tests passed.
- `npm run typecheck` passed.
- Scoped ESLint passed.
- Scoped Prettier check passed.
- `git diff --check` passed.

## Safety notes

- No Prisma schema, migration, generate, seed, reset, or shared database command
  was run.
- Audit and rating-event payloads contain only category, severity, lifecycle,
  boolean, integer delta, and fixed machine-reason values; comment text is never
  copied into either payload.
- The ledger's immutable event is the score source of truth. Resolving or hiding
  a comment does not delete, update, or reverse its historical rating impact.

## I1 follow-up: category lifecycle synchronization

- `updateClientCommentAction` now re-reads the exact visible tenant-scoped
  comment before updating it.
- Changing a general or positive note to a problem category opens the problem.
  Changing an open problem to general or positive clears all problem lifecycle
  fields. Editing a resolved problem within problem categories deliberately
  preserves `RESOLVED`, its timestamp, and resolver provenance.
- RED: three new lifecycle transition regressions failed because the update did
  not include lifecycle fields. GREEN: `actions.test.ts` passed 9/9, typecheck
  and scoped Prettier passed, and `git diff --check` passed.

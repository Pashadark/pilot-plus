# Task 11 — Rental wizard and client integration

## Delivered

- Added the protected client route `/clients/[id]/rentals/new`, including tenant checks for both
  client visibility and rental-management capability, plus loading skeleton and safe error boundary.
- Added a Russian six-step responsive rental wizard: client, vehicle, Moscow term, price/services,
  legal readiness, and review/confirmation. It keeps entered values when moving backwards, returns
  focus to the step heading, uses 44px controls, semantic tokens and reduced-motion-safe shared UI.
- The vehicle list explains static readiness/archive/maintenance/wash reasons and recomputes rental
  overlap for the selected Moscow interval in the browser. Server confirmation remains authoritative.
- Added client-card `Создать договор` entry only for server-provided rental capability.
- Added `confirmAndGenerateRentalAction`: confirmation runs first, then the existing idempotent pair
  generator; result exposes safe DOCX/PDF download links or a safe retry message.

## TDD evidence

- RED: `RentalWizard.test.tsx` first failed because the component did not exist; generation action
  test first failed because `confirmAndGenerateRentalAction` did not exist.
- GREEN: focused tests below pass.

## Verification

- `npx vitest run src/modules/rentals/components/RentalWizard.test.tsx src/modules/rentals/server/actions.test.ts src/modules/clients/components/ClientDetailPage.test.tsx` — 7 passed.
- `npm run typecheck` — passed.
- `npx prettier --check` on all Task 11 source/test files — passed.
- `git diff --check` — passed.

## Self-review

- No Prisma schema, migration, shared database, dependency, or vehicle-management file changes.
- Form actions retain server authorization through the existing hardened Task 7/9 APIs; browser state
  only informs UX and cannot bypass confirmation validation or document-generation authorization.
- Known scope boundary: route tests cover the wizard and client entry; no browser E2E is included in
  Task 11's focused suite.

## Review follow-up

- Draft persistence now reads `dailyPriceMinor` and rental policy money from the tenant-scoped vehicle
  inside the transaction; hidden form tariff data is ignored.
- The route checks required passport and licence documents as current `CLEAN` document versions and
  carries vehicle legal/policy readiness separately from client PII.
- A confirmation that succeeds before pair generation now returns an explicit recoverable
  `confirmedNeedsDocuments` result with the rental id. The wizard displays the occupied/incomplete
  state and invokes the idempotent generator-only retry action.
- Issuance/return addresses, mileage, fuel, territory, payment, drivers and notes are collected in
  the six fixed steps; schema-supported price/deposit/policy values are persisted on the draft and
  operational notes are retained in its draft JSON snapshot.

## P1 issuance retention follow-up

- Wizard issuance controls are state-backed and mirrored into hidden form fields, so moving between
  conditional steps cannot drop mileage, fuel, payment, territory or driver selections.
- Confirmation reads the persisted draft JSON only, validates a bounded allowlist (text length/control
  characters and safe integer mileage/fuel bounds), then merges allowed addresses/conditions into the
  typed rental snapshot and records the full validated issuance selection immutably.
- Added confirmation regression coverage for custom issue/return details surviving into the confirmed
  snapshot. Focused server/wizard suite: 21 passing tests.

## P1 deposit follow-up

- Deposit input is converted to canonical non-negative safe `depositMinor` before draft persistence.
  Confirmation validates and carries that exact value into both issuance and immutable rental snapshot;
  discount and services already use server-calculated minor-unit fields.

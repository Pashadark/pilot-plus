# Task 5 — Fines payment and attribution workspace

## Scope

- Added server-backed URL filters, stable 24-item pagination, six KPI cards, payment-only selection controls, and responsive fine cards.
- Added the attribution review and sandbox payment panels, wired only to the existing Task 3/4 server actions.
- Preserved the photo route and existing sync action. Payment controls are rendered only for `SUPER_ADMIN`/`COMPANY_ADMIN`; dispatchers can review and confirm attribution but cannot see payment controls.

## RED / GREEN evidence

- RED: `npx vitest run src/modules/fines/components/FinePaymentPanel.test.tsx src/modules/fines/components/FineAssignmentReview.test.tsx src/modules/fines/components/FinesPage.test.tsx` initially failed because the two new components did not exist and the risk KPI labels were absent.
- GREEN: `npx vitest run src/modules/fines/components/FinePaymentPanel.test.tsx src/modules/fines/components/FineAssignmentReview.test.tsx src/modules/fines/components/FinesPage.test.tsx src/modules/fines/server/queries.test.ts` passed: 4 files, 7 tests.

## Verification

- `npm run typecheck` passed.
- Scoped `npx eslint` passed for all changed files.
- Scoped `npx prettier --write` completed, then focused tests passed again.
- `git diff --check` passed.

## Self-review and concerns

- Payment links are never stored in component props or query DTOs; the server action returns one only to the immediate authorised client response, which renders a vetted navigation link.
- The panel clearly states sandbox-only behavior and shows invoice creation/reuse, status/history guidance, and retry guidance. A persisted invoice-history list remains intentionally out of scope for this UI task because Task 3/4 exposes no list interface.
- No live integration, migrations, seed, or full suite was run.

## Follow-up: filtered KPI aggregation

- Added a page-two regression with 49 filtered fines and a one-card second page. It proves the six summary values remain full-result values (including amount, assignment, discount, and bailiff metrics).
- The query now keeps the exact tenant and URL filter `where` inside an `AND` for separate database counts and an aggregate. It does not load all fines to calculate summary cards.
- Follow-up focused test command passed: 4 files, 8 tests.

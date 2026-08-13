# Task 12 — rental list, calendar and detail

Implemented protected rental list and detail routes with loading/error boundaries, tenant-scoped current-user query projections, Russian lifecycle presentation, desktop list/mobile calendar agenda, versioned private document links, and navigation capability gating for rental managers only.

Verification:

- `npx vitest run src/modules/rentals/components/RentalCalendar.test.tsx src/modules/rentals/components/RentalWizard.test.tsx src/modules/rentals/server/actions.test.ts src/modules/rentals/server/confirm-rental.test.ts` — 4 files, 22 tests passed.
- `npm run typecheck` — passed.
- `git diff --check` — passed.

## Completion follow-up

- The detail route now loads tenant-scoped rental audit events, maps them to a fixed non-PII label, and displays a Moscow-time timeline.
- Added document version status display, safe exact-version download links, and a retry action for a confirmed rental whose DOCX/PDF pair is incomplete or failed.
- Added a two-step cancellation control for draft/confirmed rentals. It uses the existing server action, `useActionState`, a Russian toast, and refreshes the server state after success.
- The list query now supports server-side URL status/date/query filtering; its query searches the linked vehicle and client fields without requiring PII in URLs.
- RED/GREEN: a new jsdom detail-panel test covered history, download links, missing-pair retry, generation-error state, and cancellation confirmation.
- Verification: `RentalDetailPanel`, calendar, and wizard component tests (4/4); focused rental actions (6/6); `npm run typecheck`; Prettier; and `git diff --check` pass.

# Task 12 — rental list, calendar and detail

Implemented protected rental list and detail routes with loading/error boundaries, tenant-scoped current-user query projections, Russian lifecycle presentation, desktop list/mobile calendar agenda, versioned private document links, and navigation capability gating for rental managers only.

Verification:

- `npx vitest run src/modules/rentals/components/RentalCalendar.test.tsx src/modules/rentals/components/RentalWizard.test.tsx src/modules/rentals/server/actions.test.ts src/modules/rentals/server/confirm-rental.test.ts` — 4 files, 22 tests passed.
- `npm run typecheck` — passed.
- `git diff --check` — passed.

Known scope boundary: filter controls are present as accessible UI controls; server-side query-parameter filtering and mutation controls remain follow-up work.

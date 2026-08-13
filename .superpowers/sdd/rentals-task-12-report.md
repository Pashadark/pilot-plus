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

## Calendar and snapshot review follow-up

- Replaced the event-only calendar with a true Monday-first seven-column Moscow month grid, including complete leading/trailing weeks and accessible date cells. Each in-month day shows every half-open rental occupancy interval intersecting that Moscow day; the mobile agenda is month-scoped and start-time sorted.
- Strict `YYYY-MM-DD` filter parsing validates calendar dates in Moscow, silently ignores malformed values, and uses the next Moscow midnight as an exclusive end bound.
- Confirmed/non-draft detail data now comes from the persisted immutable snapshot (client, vehicle, term, agreed price, pickup/return and issuance terms). Drafts retain live values and an explicit `Текущие данные черновика` source label.
- RED/GREEN coverage: full-week/month exclusion/multi-day/millisecond boundary calendar test; immutable snapshot stability test; invalid date and exclusive next-day parsing test.
- Verification: focused Vitest (4/4), `npm run typecheck`, targeted Prettier, and `git diff --check` pass.

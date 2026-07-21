# Task 3 report — maintenance workspace

## Result

- Added the protected `/maintenance` route with the existing `requireAdmin()` guard, parallel tenant-scoped maintenance and vehicle-option reads, the shared `AppShell`, breadcrumbs, and Russian UI copy.
- Added a complete responsive workspace: four summary cards, urgent/overdue warning, accessible search, status and maintenance-kind filters, a desktop table, mobile cards, honest filtered empty states, and a navigation entry.
- Added an accessible planning modal with visible labels, native field semantics, inline server validation errors, a pending submit state, real vehicle options and primary-image preview, and global toast feedback. The form closes and resets after a successful Server Action response; failed submissions remain open.
- Added guarded status controls for `PLANNED`/`OVERDUE` → `IN_PROGRESS`, `IN_PROGRESS` → `COMPLETED`, and cancellation. The UI consumes the existing authenticated Server Actions without weakening their tenant or transition checks.
- Added compact `VehicleOptionDto` data and `listVehicleOptionsForUser()`. The query selects only the vehicle identity, display label fields, and primary image while preserving the existing company-membership boundary.
- Added route-level loading and error states consistent with the existing Pilot+ vehicle and system pages.
- Added Playwright coverage for creation, search, status/type filtering, both state transitions, toast feedback, mobile card rendering, 44 px primary action height, desktop/mobile layout switching, and 390 px horizontal-overflow protection.

## Scope safeguards

- No Prisma schema, migration, generated Prisma client, wash module, auth implementation, role model, or role checks were changed.
- Database access remains in server query/action modules; client components receive serializable DTOs only.
- The page derives filtered results from immutable DTO props and does not create client-side copies of persisted records.

## UI and accessibility review

- Reused Pilot+ semantic color, radius, shadow, motion, form, modal, badge, card, button, empty-state, skeleton, system-state, and toast primitives.
- Applied the relevant `ui-ux-pro-max` rules: one primary page action, visible labels, inline `role="alert"` errors, keyboard-native controls, visible focus behavior inherited from the UI kit, status text in addition to color, 44 px controls, mobile-first wrapping, responsive table/card substitution, and no page-level horizontal scrolling at 390 px.
- Used React Icons from the existing icon family; no emoji or hard-coded page colors were introduced.

## TDD evidence

| Stage | Command | Result |
| --- | --- | --- |
| Acceptance RED | `npx playwright test tests/maintenance.spec.ts --project=desktop --workers=1` with root `.env` loaded | Failed as expected: both new tests could not find the missing `/maintenance` page/header contract. |
| Vehicle options RED | `npx vitest run src/modules/vehicles/server/queries.test.ts` | Failed as expected: `listVehicleOptionsForUser` did not exist. |
| Vehicle options GREEN | Same focused Vitest command | PASS: 1 file, 5 tests. |
| Acceptance GREEN | Focused Playwright command above | PASS: 2 tests. |

The first GREEN attempt exposed a legitimate test race: applying the `PLANNED` filter caused the row to unmount immediately after a successful transition, before its local toast effect could run. The test now clears the status filter before mutation while retaining explicit assertions for every filter and status. A second attempt exposed the expected transient overlap between the route `loading.tsx` shell and the final shell; the test waits for `maintenance-page` before asserting the header. No production behavior was weakened for either adjustment.

## Final verification

- `npx vitest run src/modules/maintenance/status.test.ts src/modules/maintenance/validation.test.ts src/modules/maintenance/server/queries.test.ts src/modules/maintenance/actions.test.ts src/modules/vehicles/server/queries.test.ts src/shared/components/app-shell/Sidebar.test.ts` — PASS: 6 files, 23 tests. The sandboxed attempt hit the known esbuild `Access is denied` configuration-resolution error; the approved non-sandbox rerun passed.
- `npx playwright test tests/maintenance.spec.ts --project=desktop --workers=1` with the root `.env` loaded — PASS: 2 tests.
- `npm run typecheck` — PASS.
- `npx eslint` for all changed TypeScript/TSX files — PASS.
- `npx prettier --check` for all changed source and test files — PASS.
- `git diff --check` and staged diff check — PASS.

## Self-review

- Confirmed `/maintenance` authenticates before querying and both reads remain tenant-scoped by `user.id` membership.
- Confirmed form and transition components import only the existing Server Actions, which independently authenticate and authorize each write.
- Confirmed vehicle options do not expose company IDs, source URLs, or full vehicle/telemetry records.
- Confirmed desktop rows and mobile cards expose the same status, vehicle, schedule, cost, and available transitions.
- Confirmed the modal supports Escape/focus trapping/body scroll locking through the existing Pilot+ primitive and keeps validation errors adjacent to their fields.
- Confirmed filtered empty states remain visible on both layouts and all long user/database text uses wrapping or constrained cells.
- Confirmed no unrelated dirty worktree changes were overwritten.

## Concerns and known warnings

- Playwright creates real maintenance rows in the configured local database. Test titles include a timestamp so repeated runs remain deterministic, but the local dataset accumulates test records until it is reseeded or cleaned intentionally.
- Next.js emits the existing multi-lockfile/Turbopack workspace-root warning when Playwright starts the worktree dev server. It did not affect the tests and was not changed in this task.
- The `ui-ux-pro-max` Python search helper could not run because the environment only exposes the Windows Store Python aliases without an installed interpreter. The complete local quick-reference rules were read and applied directly instead.

## Commit

- `43e48a6 feat: add maintenance workspace`

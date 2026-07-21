# Task 2 report — protected maintenance workflows

## Result

- Added an explicit maintenance state machine: `PLANNED` and `OVERDUE` can move to `IN_PROGRESS` or `CANCELLED`; `IN_PROGRESS` can move to `COMPLETED` or `CANCELLED`; terminal states cannot be reopened.
- Added tenant-scoped maintenance queries. The query only reads records whose vehicle belongs to a company where the supplied user has membership, and serializes only the UI DTO fields.
- Added server actions for creation and transition. Both authenticate independently; creation verifies the submitted vehicle belongs to the authenticated user's company, and transitions use one guarded `updateMany` with record ID, expected current status, and company membership.
- `revalidatePath('/maintenance')` runs only after a successful write. Failed, stale, or cross-company transitions return one non-enumerating error and do not revalidate.

## Approved ambiguity

Task 2 originally said to populate both `startedAt` and `completedAt`. The Task 1 schema and generated Prisma client deliberately do **not** contain `MaintenanceRecord.startedAt` (that field exists only on `WashRecord`). Owner decision: do not add a migration or workaround. Therefore `PLANNED`/`OVERDUE` → `IN_PROGRESS` updates only `status`, while a transition to `COMPLETED` also sets `completedAt`. A focused regression test asserts this behavior.

## TDD evidence

| Stage | Command | Result |
| --- | --- | --- |
| RED | `npx vitest run src/modules/maintenance/status.test.ts src/modules/maintenance/server/queries.test.ts src/modules/maintenance/actions.test.ts` | Failed as expected: all three new suites could not import their missing production modules. |
| GREEN | Same focused Vitest command | PASS: 3 files, 13 tests. |

## Verification

- `npx vitest run src/modules/maintenance/status.test.ts src/modules/maintenance/server/queries.test.ts src/modules/maintenance/actions.test.ts` — PASS: 3 files, 13 tests. The final run required the approved non-sandbox execution because sandboxed esbuild intermittently failed with `Access is denied` while resolving `vitest.config.ts`; the non-sandbox run passed.
- `npm run typecheck` — PASS.
- `npx eslint` for all six changed TypeScript files — PASS.
- `npx prettier --check` for all six changed TypeScript files — PASS.
- `git diff --check` — PASS.

## Self-review

- Confirmed every action independently calls `getAuthenticatedSession()`.
- Confirmed creation filters the submitted vehicle with company membership before `maintenanceRecord.create`.
- Confirmed the transition guard combines record ID, current status, and company membership in the same `updateMany`.
- Confirmed the action does not reveal whether a zero-update record was foreign or concurrently changed.
- Confirmed no UI, wash module, Prisma schema, migration, or generated Prisma files were changed.

## Commits

- `f94be62 feat: add protected maintenance workflows`

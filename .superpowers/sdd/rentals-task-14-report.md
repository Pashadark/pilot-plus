# Task 14 report: rental workflow E2E and deployment gate

- Added opt-in Playwright coverage for the administrator vehicle creation/import entry points and a four-row Excel preview/apply fixture.
- Added a two-page dispatcher lifecycle scenario: both drafts save only after Moscow dates are entered, the first confirms and downloads DOCX/PDF, and the second submits the same vehicle/interval to receive the server rejection. Foreign-company credentials and driver credentials are separate fixture inputs.
- Added a 390 px calendar overflow assertion and a labelled rentals loading-skeleton assertion.
- The E2E suite is disabled unless `PILOT_RENTALS_E2E=1` and requires a disposable prepared tenant, fixture IDs, workbook and role credentials. Import targets a separate disposable company; its harness teardown removes that company and only its marker-scoped records. The test itself does not migrate, seed or clean any database.
- Updated deployment/handoff docs with the isolated E2E gate and the production sequence: backup, deploy migration, generate Prisma client, reconcile uploads, then seed after verification.
- Verification intentionally excludes runtime Playwright and shared database operations: only Playwright test discovery, TypeScript, targeted Prettier and diff checks are run for this task.

## Review follow-up

- Removed new explicit `any` uses from the rental seed adapter/tests and DOCX sections; DOCX now shares an explicit immutable `RentalSnapshot` type. The PDF converter no longer uses a discarded ternary expression.
- Reworked the wizard’s draft response flow so its action wrapper stores the successful draft ID, avoiding an effect-driven state update and retaining the ID for later updates after an error.
- Final lint has no errors; six pre-existing warnings remain in unrelated schema/rental tests, vehicle import action destructuring, and the shared legacy image component.

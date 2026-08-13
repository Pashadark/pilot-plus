# Task 13 report: approved rental fleet seed

- Added a marker-scoped `example-fleet:` rental seed adapter with exactly four approved vehicles: Kia Cee'd, Skoda Octavia, Mercedes-Benz E 220 d 4MATIC, and Volkswagen Polo.
- The adapter upserts by immutable source key, normalizes plates, sets rental readiness/tariff/deposit/mileage/policy defaults, and uses demo-only identifiers for Polo’s legal vehicle fields. No client data or real passport data is seeded.
- It archives only stale active `isDemoImport` records in the demo company that carry the `example-fleet:` ownership marker; user/manual records and other sources are untouched.
- The normal seed entrypoint invokes the adapter but this task did not run `db:seed`, migrations, or any shared database command.
- RED/GREEN test invokes the adapter twice, requires four active marked records with unique normalized plates, and verifies a manual vehicle remains unarchived.
- Verification: focused Vitest (1/1), `npm run typecheck`, Prettier, and `git diff --check` pass.

## P1 follow-up

- All four `example-fleet:` fixtures now receive distinct `DEMO…` 17-character VINs, paired `DEMO-STS`/`DEMO-PTS` identifiers, OSAGO and CASCO `DEMO ONLY Insurance` policies, and the stable 2026-01-01 through 2030-12-31 coverage period. They retain positive tariffs/deposits and rental readiness.
- The demo company is created with clearly synthetic `DEMO ONLY` legal/contact values. Existing fixture-company updates now change only `isDemo`; contract defaults are filled only into absent fields after a fresh `isDemo` check, preserving configured values and never writing an encrypted passport.
- RED/GREEN covered the vehicle legal field set, all contract-default fields, configured-value preservation, and non-demo no-op behavior. No shared database, migration, or `db:seed` command was run.

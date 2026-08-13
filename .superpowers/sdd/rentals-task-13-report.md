# Task 13 report: approved rental fleet seed

- Added a marker-scoped `example-fleet:` rental seed adapter with exactly four approved vehicles: Kia Cee'd, Skoda Octavia, Mercedes-Benz E 220 d 4MATIC, and Volkswagen Polo.
- The adapter upserts by immutable source key, normalizes plates, sets rental readiness/tariff/deposit/mileage/policy defaults, and uses demo-only identifiers for Polo’s legal vehicle fields. No client data or real passport data is seeded.
- It archives only stale active `isDemoImport` records in the demo company that carry the `example-fleet:` ownership marker; user/manual records and other sources are untouched.
- The normal seed entrypoint invokes the adapter but this task did not run `db:seed`, migrations, or any shared database command.
- RED/GREEN test invokes the adapter twice, requires four active marked records with unique normalized plates, and verifies a manual vehicle remains unarchived.
- Verification: focused Vitest (1/1), `npm run typecheck`, Prettier, and `git diff --check` pass.

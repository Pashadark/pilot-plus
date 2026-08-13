# Rentals Task 6 report

- Added pure, Prisma-independent rental domain modules for calculation, availability and versioned immutable legal snapshots.
- Moscow local timestamps are explicitly converted to UTC+03:00 instants; paid days are ceiling 24-hour periods; all money uses safe integer minor units.
- Availability is half-open and returns explicit archive, readiness, maintenance and overlap reasons.
- Snapshot is serializable, frozen and versioned (`schemaVersion: 1`).

## TDD and checks

- RED: missing domain modules; GREEN: calculation, half-open availability and snapshot tests.
- Focused unit suite: 4 tests across 3 files passing.
- Typecheck remains blocked by concurrent Task 5 `ManageableCompany.canArchive` integration changes, not Task 6 domain code.

## Review hardening

- Moscow local input now round-trips through `Europe/Moscow`, rejecting normalized impossible calendar dates.
- Price arithmetic uses `BigInt` for multiplication/subtraction/addition and only returns a verified safe integer; calculation exposes discount and services minor-unit breakdowns.
- Snapshot input and frozen output now cover company requisites/signatory, client identity/license/addresses, vehicle legal/policy/spec/tariff details and rental billable amounts, conditions, timestamps and creator.

# Task 14 — E2E and deployment gate

Added `tests/rentals.spec.ts` with a uniquely marked, opt-in Prisma fixture harness. It creates isolated tenant A, tenant B and role fixtures only when `PILOT_RENTALS_E2E=1`, rejects a non-test/e2e `DATABASE_URL`, and removes rental-dependent rows before tenants/users. It never runs migration or seed.

The overlap server action now returns the safe stable `OVERLAP` code and Russian message `Автомобиль уже занят на выбранный период.`; the focused unit test proves it.

Runtime Playwright is intentionally not run by this change. Static listing/runtime needs a healthy disposable DB plus dev server; prior controller attempts hung before returning output. No shared DB mutation was performed.

Deployment runbook: backup first; then migrate deploy, Prisma generate, client document reconciliation, controlled seed, and visual DOCX/PDF rendering with LibreOffice/ClamAV.

## P1 issuance follow-up

- Draft parsing now includes the canonical hidden `depositMinor` field and keeps it as a validated integer; an absent optional deposit remains absent instead of silently becoming zero.
- The generated DOCX uses confirmed immutable `snapshot.issuance` for pickup/return locations, odometer and fuel readings, territory, payment terms and allowed drivers. It shows an em dash for an empty driver list and never substitutes the primary client.
- RED/GREEN coverage verifies the persisted draft issuance deposit and structural DOCX XML values. The E2E helper’s unused authenticated-route import was removed.

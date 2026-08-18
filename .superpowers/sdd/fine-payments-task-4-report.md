# Task 4 report: idempotent sandbox payment use cases

## Status

Implemented the tenant-scoped Driver Helper sandbox payment check/create workflow, HMAC-signed outcome-bound callback state, one-time success/fail consumption, and safe callback redirects. No live API, migration, or seed command was run.

## RED evidence

1. Initial focused run:
   `npx vitest run src/modules/fines/integrations/driver-helper/client.test.ts src/modules/fines/server/payment-state.test.ts src/modules/fines/server/payment-actions.test.ts 'src/app/(protected)/fines/payment/payment-callback.test.ts'`
   failed because both payment modules and both routes were absent, and the existing client omitted server-supplied callback state.
2. ERROR-settlement test:
   `npx vitest run src/modules/fines/server/payment-actions.test.ts`
   failed because a persisted `PENDING` invoice was not transitioned to `ERROR` after external creation failed.
3. Active-invoice preflight test:
   `npx vitest run src/modules/fines/server/payment-actions.test.ts`
   failed because the action contacted Driver Helper before reusing the canonical active invoice.

Each failure was observed before its corresponding production change; the focused suites were then rerun GREEN.

## Changed files

- `src/modules/fines/server/payment-actions.ts`
- `src/modules/fines/server/payment-actions.test.ts`
- `src/modules/fines/server/payment-state.ts`
- `src/modules/fines/server/payment-state.test.ts`
- `src/app/(protected)/fines/payment/success/route.ts`
- `src/app/(protected)/fines/payment/fail/route.ts`
- `src/app/(protected)/fines/payment/payment-callback.test.ts`
- `src/modules/fines/integrations/driver-helper/client.ts`
- `src/modules/fines/integrations/driver-helper/client.test.ts`

The Task 2 client gained only server-supplied `successState`/`failState` handling. Callback base URLs still reject existing query strings, fragments, credentials, ports, and non-HTTPS schemes.

## Exact verification

- Focused tests: 4 files, 41 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Scoped Prettier write/check target: all Task 4 source/test files and the narrow Task 2 client seam.
- Final `git diff --check`: run after this report is formatted.

## Self-review

- Payment authorization is stricter than fine management: only `SUPER_ADMIN` and tenant `COMPANY_ADMIN`; dispatcher is denied before DB/API work.
- Selected IDs are bounded, unique, canonicalized, and reloaded under `companyId`; missing, foreign, paid, cancelled, invalid external, and duplicate selections fail closed.
- The canonical company/user/sorted-ID hash reuses `PENDING`/`CREATED` before provider access and converges after `P2002` by rereading the unique row.
- `PENDING`, `CREATED`, `ERROR`, `SUCCEEDED`, and `FAILED` DB changes and their audits share Serializable transactions. Audits contain invoice/fine IDs, counts, exact minor-unit strings, status, and sandbox only; callback state, token, payment URL, and client PII are excluded from changes.
- Full payment URLs are revalidated and returned only to the immediate caller; only the allowlisted hostname is persisted.
- Callback verification uses canonical base64url, HMAC-SHA256, constant-time signature comparison, expiry, expected outcome, fresh tenant/payment authorization, initiating-user binding, and a conditional `CREATED` transition. Success never updates a fine.

## Concerns

- Deployment must provide a trusted HTTPS `FINE_PAYMENT_CALLBACK_BASE_URL` and a high-entropy `FINE_PAYMENT_STATE_SECRET` of at least 32 UTF-8 bytes before invoice creation can succeed.
- Full operational configuration/runbook and stale-`PENDING` reconciliation remain explicitly scoped to Task 6.

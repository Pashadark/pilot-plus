# Task 9 report: durable rental DOCX/PDF pair

- RED: the focused rental-document-pair test initially failed because the server module was absent.
  GREEN: the generator now produces one DOCX byte stream, converts those exact bytes to PDF, hashes both,
  sends both through private-storage/ClamAV promotion, and commits the two `CONTRACT` client documents and
  two `RentalDocumentVersion` records in one Serializable transaction with a sanitized `RENTAL` audit.
- The converter launches only an absolute configured `soffice` executable with `shell: false`, fixed
  arguments, an isolated temp/profile/output directory, a 45 second hard timeout, 64 KiB process-output
  cap, 15 MiB input/output cap, DOCX ZIP validation and `%PDF-` validation. All temporary files are
  removed in `finally`; errors do not return subprocess output or paths.
- All-or-nothing tests cover converter failure, database failure cleanup, an already complete pair,
  transaction-race convergence, no foreign/absent confirmed rental, and the exact DOCX byte identity passed
  to the converter. The converter unit tests cover malformed DOCX rejection and fixed no-shell invocation.
- Added the opt-in `rental-document-runtime` Compose profile, environment settings, Dockerfile and runbook.
  It installs LibreOffice/Poppler and runs a real generated-DOCX-to-PDF smoke test when
  `RUN_RENTAL_DOCUMENT_CONVERTER_INTEGRATION=1`; it is not a network-facing converter service.

## Verification

- PASS: focused pair/converter tests: 8 passed, 1 integration test skipped without opt-in runtime.
- PASS: all explicit rental server test files: 29 passed.
- PASS: `npm run typecheck`, targeted Prettier check, `docker compose ... --profile rental-documents config --quiet`, and `git diff --check`.
- Environment gap: local `soffice` is not installed, so the real LibreOffice conversion and Poppler visual PDF review were not run on the host. The Docker profile/runbook provides the required repeatable smoke path; no shared database or migration was applied.

## Important review fixes

- Added rolling-safe `RentalDocumentGeneration` lifecycle plus migration. The tenant/client/rental tuple,
  version, unique quarantine/final keys, hashes, scan metadata, actor-independent lease and state are durable
  before storage writes. Flow is `PENDING` → `PROMOTED` → `COMMITTED`; failed work stays bounded for the
  reconciler rather than becoming an untracked artifact.
- `npm run client-documents:reconcile` now processes expired uncommitted generation rows. It removes only
  that generation's private/quarantine keys and uses a bounded retry before terminal `ERROR`.
- P2002 now re-reads an exact complete DOCX+PDF pair before returning an idempotent success; the losing
  attempt cleans only unique generation-scoped keys. Focused tests cover lifecycle order, failure cleanup,
  existing pair, concurrent/losing result and stale reconciler cleanup.
- `ContractTemplateVersion.legalContentVersion` is additively persisted and confirmation copies the selected
  supported value into immutable rental snapshot. Generation reads that snapshot value rather than a mutable
  live template and passes it to DOCX composition.
- Added `.dockerignore` excluding `.env`/`.env.*` except `.env.example`, private storage, logs and git from
  the rental-document runtime image context.

Verification after fixes: `npx prisma format`, `npx prisma generate`, `npx prisma validate` (with a local
validation URL only), `npm run typecheck`, focused Vitest 55/55, targeted Prettier, `git diff --check` and
Compose profile config all pass. Migration was not applied; local LibreOffice visual smoke remains the
documented environment gap.

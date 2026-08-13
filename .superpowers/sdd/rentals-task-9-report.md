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

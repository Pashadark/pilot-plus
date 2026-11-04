# Rental wizard document scan implementation plan

> Execute inline in the current feature branch. Preserve unrelated dirty changes.

## Task 1: OCR portrait extraction contract

- Add failing unit tests for passport portrait extraction and OCR response shape.
- Implement deterministic passport-spread crop with Sharp and a reviewable WebP result.
- Extend the authenticated OCR route to return parsed fields plus portrait metadata for passport scans.
- Verify focused OCR tests.

## Task 2: Three-step wizard UI

- Add failing component tests for three steps, document uploads, progress states, and no six-step copy.
- Refactor `RentalWizard` into Documents, Rental, Review while preserving all existing rental fields and readiness rules.
- Add scan cards, extracted-data review, portrait preview, responsive layout and reduced-motion-safe transitions.
- Keep existing draft/update/confirm/generate server actions and prevent duplicate drafts.
- Verify focused component tests.

## Task 3: Persist reviewed client documents

- Reuse existing secure document/photo upload actions.
- Add a focused, authorized action that merges reviewed OCR fields into the existing client without overwriting unrelated fields.
- Upload passport, license and extracted portrait only after explicit confirmation.
- Revalidate client and rental routes and audit changed field names only.
- Verify action/parser tests.

## Task 4: Route data and end-to-end verification

- Pass existing photo and identity readiness into the wizard.
- Run typecheck, focused unit tests and build.
- Open the route in a browser, verify desktop/mobile layout and run design QA against the approved mockups.
- Report any environment-only blocker without claiming completion.

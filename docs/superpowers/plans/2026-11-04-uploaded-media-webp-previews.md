# Uploaded Media WebP Previews Implementation Plan

> **For Supa Pro:** Execute this plan task-by-task with strict RED/GREEN tests. Preserve uploaded originals; generate WebP only as a derived private preview.

**Goal:** Reduce traffic and render cost for uploaded client-document images and rental-operation car photos without changing legal originals, static site assets, logos, PDFs, or videos.

**Architecture:** A shared Sharp-based normalizer creates bounded, metadata-free WebP buffers after malware scanning succeeds. Each database record stores optional preview identity and integrity metadata beside the canonical original. Existing protected routes serve the preview only for explicit inline viewing and keep downloads on the original. An idempotent backfill repairs missing previews for existing CLEAN images.

**Tech Stack:** Next.js 16 route handlers, TypeScript strict mode, Prisma/PostgreSQL, Sharp, Vitest, private local storage.

---

## Task 1: Shared image-preview normalizer

**Files:**
- Create: `src/services/media/webp-preview.ts`
- Test: `src/services/media/webp-preview.test.ts`

1. Write failing tests for document and vehicle-photo profiles, EXIF rotation, no enlargement, WebP output, metadata stripping, and rejection of unsupported MIME types.
2. Run the focused test and confirm RED because the module does not exist.
3. Implement the smallest Sharp wrapper with document profile `2200x2200 q82`, vehicle profile `1920x1080 q82`, `fit: inside`, `withoutEnlargement`, `rotate`, sRGB, bounded input pixels, and SHA-256 metadata.
4. Run the focused test and confirm GREEN.

## Task 2: Additive preview metadata schema

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20261104120000_add_uploaded_media_webp_previews/migration.sql`

1. Add nullable `previewStorageKey`, `previewMime`, `previewBytes`, `previewSha256`, and `previewGeneratedAt` fields to `ClientDocumentVersion` and `RentalOperationMedia`; storage keys are unique.
2. Add an additive SQL migration only—no destructive data operations.
3. Run Prisma format, validate, and generate.

## Task 3: Generate client-document previews after CLEAN scan

**Files:**
- Modify: `src/modules/client-documents/actions.ts`
- Modify: `src/modules/client-documents/server/reconcile-stale-uploads.ts`
- Modify: `src/modules/client-documents/server/upload-resource-controls.ts`
- Modify: `src/app/(protected)/clients/[id]/documents/[documentId]/download/route.ts`
- Modify tests beside each module.

1. Add failing tests proving image documents receive a WebP preview after the original becomes CLEAN, PDFs do not, preview failure preserves the CLEAN original, ledger bytes include the preview, and archive/cleanup removes both files.
2. Add failing route tests proving `preview=1` opens the preview when present and otherwise safely falls back to the original while downloads always use the original.
3. Implement preview creation and durable metadata update after original promotion, with a deterministic `.preview.webp` private key and compensation for lost ownership.
4. Extend resource accounting and cleanup/reconciliation for both original and preview.
5. Run the focused client-document tests.

## Task 4: Generate rental-operation photo previews

**Files:**
- Modify: `src/modules/rentals/operations/media/admit-operation-media.ts`
- Modify: `src/modules/rentals/operations/media/scan-operation-media.ts`
- Modify: `src/modules/rentals/operations/media/reconcile-operation-media.ts`
- Modify: `src/modules/rentals/operations/server/execute-operation.ts`
- Modify: `src/app/(protected)/rentals/[id]/operations/[operationId]/media/[kind]/route.ts`
- Modify tests beside each module.

1. Add failing tests proving image kinds receive the vehicle-photo WebP preview, inspection videos do not, preview failure does not discard a clean original, and cleanup removes both keys.
2. Add failing route tests proving inline image viewing uses the preview and video/original fallback remains unchanged.
3. Implement the scan/direct-store integration, metadata persistence, route selection, and cleanup.
4. Run focused rental-operation media tests.

## Task 5: Idempotent backfill and recovery

**Files:**
- Create: `scripts/backfill-uploaded-media-webp-previews.ts`
- Create: `scripts/backfill-uploaded-media-webp-previews.test.ts`
- Modify: `package.json`

1. Write failing tests for dry-run, apply mode, CLEAN image filtering, batching, already-complete records, missing originals, and rerun idempotency.
2. Implement a bounded CLI that reads originals through private storage, creates previews, writes metadata conditionally, and reports repaired/skipped/failed counts without exposing private keys.
3. Add package scripts for dry-run and apply.
4. Run the focused script tests and a local dry-run if the environment is configured.

## Task 6: Documentation, full verification, and production rollout

**Files:**
- Modify: `docs/PROJECT_GUIDE.md`

1. Document the original/preview storage rule, quota semantics, exclusions, recovery, and backfill command.
2. Run `git diff --check`, focused tests, `npm run test:unit`, `npm run lint`, `npm run typecheck`, Prisma validation, and `npm run build`.
3. Create and verify a fresh production database/private-storage/config backup before schema migration.
4. Deploy with the established zero-downtime release procedure.
5. Run production migration, backfill dry-run, apply, and a second dry-run proving zero pending work.
6. Verify Supa Pro HTTP health, service health, protected previews, original downloads, and unchanged PDFs/videos/static assets.


# Rental Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver release-ready rental handover, extension, and return workflows for the website and Telegram bot, with durable evidence media, complete vehicle/client/rental history, and a tidy right-side action rail.

**Architecture:** A single tenant-scoped server operation layer owns all state transitions. The website server actions and authenticated bot API routes call the same use cases. Immutable operation rows store legal/operational facts; private media uses the existing storage, ClamAV, quota, lease, and reconciliation patterns. Rental detail queries project those records into the rental, client, vehicle, calendar, and notification views.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, Vitest, Playwright, Tailwind/Pilot+ UI, local private storage, ClamAV, Python Telegram bot.

## Global Constraints

- Preserve all existing user changes and never stage unrelated files.
- Read the relevant Next.js 16 guides under `node_modules/next/dist/docs/` before editing routes, Server Actions, or forms.
- Every write reauthorizes the current actor and exact company/rental inside the transaction.
- Allowed roles: `SUPER_ADMIN`, `COMPANY_ADMIN`, `DISPATCHER`. Group chats receive notifications only; operations run in the website or private bot chat.
- Missing video/photo is allowed only with an explicit reason and a permanent evidence warning.
- Media is private, scanned, size/type bounded, tenant-scoped, and recoverable after process crashes.
- Database changes are additive. Do not apply migrations to a shared or production database while implementing.
- Each task follows RED -> GREEN -> focused verification -> small commit.

---

## Task 1: Persist Immutable Rental Operations

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260821120000_add_rental_operations/migration.sql`
- Modify: `src/database/prisma/rental-schema.test.ts`
- Create: `src/modules/rentals/operations/types.ts`

- [x] Add failing schema tests for operation enums, relations, indexes, idempotency, immutable facts, media lifecycle, and additive SQL.
- [x] Add `RentalOperationType` (`HANDOVER`, `EXTENSION`, `RETURN`), evidence status, media kind/status, delivery method, deposit status/method, and condition enums.
- [x] Add `RentalOperation` linked to company, rental, client, vehicle, and actor. Store occurred-at, before/after rental dates, mileage/fuel, addresses, price/deposit facts, damage/skip reasons, and an idempotency key.
- [x] Add `RentalOperationMedia` with private/quarantine keys, MIME, byte size, SHA-256, scan status, leases, claim token, and timestamps. Enforce one dashboard photo and one inspection video per operation/kind.
- [x] Add indexes for rental timeline, vehicle timeline, client timeline, media recovery, and unique `(companyId, idempotencyKey)`.
- [x] Add database triggers preventing updates/deletes of completed operation facts while permitting bounded media lifecycle transitions.
- [x] Run `npx vitest run src/database/prisma/rental-schema.test.ts` and expect GREEN.
- [x] Run Prisma format/generate/validate with a non-connecting placeholder `DATABASE_URL`.
- [ ] Commit: `feat(rentals): persist rental operations`.

## Task 2: Validate Evidence and Calculate Operational Money

**Files:**

- Create: `src/modules/rentals/operations/validation.ts`
- Create: `src/modules/rentals/operations/evidence-status.ts`
- Create: `src/modules/rentals/operations/calculation.ts`
- Create: `src/modules/rentals/operations/validation.test.ts`
- Create: `src/modules/rentals/operations/calculation.test.ts`
- Modify: `src/modules/rentals/domain/availability.ts`
- Modify: `src/modules/rentals/domain/availability.test.ts`

- [ ] Add failing tests for strict Moscow timestamps, safe integer money, mileage/fuel bounds, missing-evidence reasons, return damage reasons, and deposit decisions.
- [ ] Define explicit command schemas for handover, extension, and return; reject unknown fields and browser-controlled tenant/price facts.
- [ ] Derive evidence status from stored CLEAN media plus skip reasons: `COMPLETE`, `VIDEO_MISSING`, `DASHBOARD_PHOTO_MISSING`, `MISSING`.
- [ ] Calculate extension surcharge and return mileage/fuel charges with BigInt-safe arithmetic and explicit breakdowns.
- [ ] Extend availability checking to reject rental and maintenance overlaps while returning a bounded list of available replacement vehicles.
- [ ] Run the focused domain tests and typecheck.
- [ ] Commit: `feat(rentals): validate rental operations`.

## Task 3: Build Durable Private Evidence Uploads

**Files:**

- Create: `src/modules/rentals/operations/media/file-validation.ts`
- Create: `src/modules/rentals/operations/media/upload-resource-controls.ts`
- Create: `src/modules/rentals/operations/media/scan-operation-media.ts`
- Create: `src/modules/rentals/operations/media/reconcile-operation-media.ts`
- Create: `src/modules/rentals/operations/media/actions.ts`
- Create corresponding `*.test.ts` files
- Create: `scripts/reconcile-rental-operation-media.ts`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] Add RED tests for MIME/header mismatch, video/photo limits, quota reservation, malware detection, duplicate upload, lost lease, paused worker reclaim, and crash-after-promotion cleanup.
- [ ] Reuse `LocalPrivateStorage`, ClamAV, and company storage ledger conventions; never expose a raw filesystem key to the client.
- [ ] Stage uploads in quarantine, scan them, atomically promote to private storage, and persist the exact hash/size/key with ownership-token CAS.
- [ ] Make admission idempotent and reject media not bound to the exact rental operation/company/actor permit.
- [ ] Implement bounded reconciliation for expired pending, scanning, promoted, cleaning, and error records, including reclaim of crashed cleanup workers.
- [ ] Add the reconciliation CLI and environment documentation.
- [ ] Run focused media tests, ClamAV integration when available, typecheck, and diff check.
- [ ] Commit: `feat(rentals): store operation evidence safely`.

## Task 4: Implement Atomic Handover, Extension, and Return Use Cases

**Files:**

- Create: `src/modules/rentals/operations/server/access.ts`
- Create: `src/modules/rentals/operations/server/handover-rental.ts`
- Create: `src/modules/rentals/operations/server/extend-rental.ts`
- Create: `src/modules/rentals/operations/server/return-rental.ts`
- Create corresponding `*.test.ts` files
- Modify: `src/modules/rentals/server/actions.ts`
- Modify: `src/modules/rentals/server/actions.test.ts`

- [ ] Add RED tests for tenant escape, forbidden roles, stale status, concurrent double-submit, missing reason, media ownership, maintenance/rental overlap, and exact audit facts.
- [ ] Handover: reload the confirmed rental and current CLEAN evidence, persist facts, move rental to `ACTIVE`, record actor/time, and write a PII-safe audit in one Serializable transaction.
- [ ] Extension: reload active rental and current tariffs, check overlap/maintenance, calculate surcharge, append immutable before/after facts, update `endsAt` and totals, and audit atomically.
- [ ] Return: reload active rental, calculate mileage/fuel charges, record condition/damage/deposit resolution, append immutable facts, mark `COMPLETED`, and audit atomically.
- [ ] Use status CAS and retry only PostgreSQL serialization conflicts; converge repeated idempotency keys by returning the committed operation.
- [ ] Expose thin website Server Actions that parse FormData and call these use cases without duplicating rules.
- [ ] Run focused operation/action suites and typecheck.
- [ ] Commit: `feat(rentals): manage handover extension and return`.

## Task 5: Project Operations into Rental, Client, Vehicle, Calendar, and Notifications

**Files:**

- Modify: `src/modules/rentals/server/queries.ts`
- Modify: `src/modules/rentals/server/queries.test.ts`
- Modify: `src/modules/clients/server/client-rentals.ts`
- Modify: `src/modules/clients/server/client-rentals.test.ts`
- Modify vehicle detail/history query files discovered in implementation
- Modify: `src/app/api/bot/v1/daily-operations/route.ts`
- Modify its focused tests

- [ ] Add RED projections proving one operation appears in the rental timeline, client history, and vehicle history without duplicating media.
- [ ] Return latest evidence status, handover/return mileage and fuel, delivery method/address, deposit state, extension history, actor, and occurrence time.
- [ ] Use actual extended return time in calendar availability and daily Telegram reminders.
- [ ] Show maintenance blocks as unavailable and return replacement-vehicle suggestions from the shared availability domain.
- [ ] Preserve tenant scoping and bounded pagination on every history query.
- [ ] Run focused query/API tests and typecheck.
- [ ] Commit: `feat(rentals): expose operational history`.

## Task 6: Build the Release-Quality Rental Action Workspace

**Files:**

- Modify: `src/modules/rentals/components/RentalDetailWorkspace.tsx`
- Modify: `src/modules/rentals/components/RentalDetailWorkspace.test.tsx`
- Modify: `src/modules/rentals/components/RentalDetailPanel.tsx`
- Modify: `src/modules/rentals/components/RentalHandoverCard.tsx`
- Create: `src/modules/rentals/components/RentalActionRail.tsx`
- Create: `src/modules/rentals/components/RentalOperationDialog.tsx`
- Create: `src/modules/rentals/components/RentalOperationTimeline.tsx`
- Create corresponding component tests
- Modify: `src/app/(protected)/rentals/[id]/page.tsx`

- [ ] Read the Next.js 16 Server Components, Server Actions, and forms guides before editing.
- [ ] Add RED component tests for role/status-specific actions, right-rail alignment, keyboard/focus behavior, pending/error states, missing-evidence badges, and 390px mobile overflow.
- [ ] Desktop: use a wide content column plus a fixed-width sticky right action rail. Render equal-height, full-width buttons vertically with consistent gaps: `Выдать / Подать`, `Продлить`, `Принять возврат`, and context-safe secondary actions.
- [ ] Keep actions visually on the right, aligned to the workspace top, never floating over cards, and never scattering buttons inside unrelated content.
- [ ] Mobile: replace the rail with a safe-area-aware sticky bottom action bar and an overflow menu for secondary actions.
- [ ] Build accessible dialogs/wizards for office/delivery, address, mileage, fuel, video, dashboard photo, deposit, condition, damages, costs, and required skip reasons.
- [ ] Render a chronological operation timeline with actor/time/media/evidence warnings and protected media previews.
- [ ] Use shared Pilot+ Button/Input/Select/Modal/Toast primitives and Russian copy.
- [ ] Run focused component tests, typecheck, lint, Prettier, and visual browser checks at desktop and 390px.
- [ ] Commit: `feat(rentals): add operational action workspace`.

## Task 7: Add Private Telegram Operation Flows

**Files:**

- Create: `src/app/api/bot/v1/rentals/[id]/handover/route.ts`
- Create: `src/app/api/bot/v1/rentals/[id]/extend/route.ts`
- Create: `src/app/api/bot/v1/rentals/[id]/return/route.ts`
- Create route tests
- Modify: `bot/keyboards/rentals.py`
- Modify: `bot/handlers/rentals.py`
- Modify: `bot/tests/test_rental_handlers.py`
- Modify: `docs/runbooks/telegram-bot.md`

- [ ] Add RED route and bot tests for private-chat enforcement, permissions, exact rental binding, media steps, skip reason, confirmation summary, retry, and group-chat silence.
- [ ] Authenticate bot requests with the existing service boundary and linked staff identity, then call the same Task 4 use cases.
- [ ] Implement private-chat state machines: select rental -> facts -> media -> review -> confirm. Do not accept operational commands in the group.
- [ ] Upload video/photo through bounded bot endpoints into the same durable media lifecycle.
- [ ] Keep group messages notification-only and deduplicate scheduled reminders.
- [ ] Run TypeScript route tests and Python bot tests.
- [ ] Commit: `feat(bot): manage rental operations privately`.

## Task 8: Release Verification, Deployment, and Rollback

**Files:**

- Create: `tests/rental-operations.spec.ts`
- Create: `docs/runbooks/rental-operations-release.md`
- Modify: `compose.dev.yaml`
- Modify: `compose.yaml`
- Modify: `.env.example`
- Update: `docs/PROJECT_GUIDE.md` only if the user's concurrent edits can be preserved cleanly

- [ ] Add an isolated Playwright fixture and end-to-end scenario: create/confirm rental, handover with evidence, extend, reject overlap, return with charges, inspect client/vehicle histories, and verify protected media.
- [ ] Verify desktop right rail, mobile sticky actions, keyboard navigation, focus return, loading/error states, and no horizontal overflow.
- [ ] Apply all migrations to a fresh disposable PostgreSQL database and run Prisma validation; do not touch shared data.
- [ ] Run focused unit/component/API/bot suites, `npm run typecheck`, lint, formatting, `npm run build`, and `git diff --check`.
- [ ] Smoke-test private storage and ClamAV; document any unavailable external runtime evidence explicitly.
- [ ] Document environment variables, migration order, media reconciler schedule, health checks, deployment commands, forward-only rollback, and recovery from a failed upload/operation.
- [ ] Perform a final code review for tenancy, PII, storage crash safety, idempotency, mobile layout, and spec completeness; fix all Critical/Important findings.
- [ ] Commit: `docs: add rental operations release runbook`.

## Definition of Done

- Website and private Telegram chat complete the same handover, extension, and return operations.
- Every completed operation has immutable facts and either CLEAN evidence or a visible, reasoned evidence gap.
- Rental, client, and vehicle histories agree; calendar/reminders use the current extended return date.
- Desktop actions are evenly aligned in a right sidebar; mobile actions are usable without overflow.
- No demo-only path, browser-trusted price, tenant escape, orphan private media, duplicate transition, or group-chat command handling remains.
- Fresh migration, focused tests, typecheck, lint, formatting, build, desktop/mobile browser checks, storage/ClamAV checks, and release/rollback instructions are complete.

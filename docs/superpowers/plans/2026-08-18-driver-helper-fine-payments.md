# Driver Helper Fine Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить безопасную sandbox-оплату штрафов Driver Helper, расширенный список и подтверждаемую привязку штрафа к аренде и клиенту.

**Architecture:** Driver Helper остаётся внешним источником, а Pilot+ хранит tenant-scoped снимки штрафов, историю назначений и жизненный цикл счетов. Любая мутация повторно авторизуется на сервере; неточное совпадение аренды является только подсказкой, а production-оплата отсутствует в первом выпуске.

**Tech Stack:** Next.js 16.2 Server Actions/Route Handlers, React 19, TypeScript, Prisma 6/PostgreSQL, Zod, Vitest, Tailwind/Pilot+ UI.

## Global Constraints

- Первый выпуск использует только `sandbox=1`; реальные списания запрещены.
- `SUPER_ADMIN` и `COMPANY_ADMIN` могут оплачивать; `DISPATCHER` может синхронизировать, комментировать и подтверждать привязку; `DRIVER`/`VIEWER` не имеют доступа.
- Возможный клиент никогда не назначается автоматически.
- Токены, платёжные URL и PII не пишутся в аудит или логи.
- Все денежные значения хранятся в копейках как `BigInt` и сериализуются строками.
- Миграции add-only; локальная/общая БД применяется только на отдельном финальном шаге.

---

### Task 1: Счета, позиции и расширенные данные штрафа

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260818100000_add_fine_invoice_workflow/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`

**Interfaces:**

- Produces: `FineInvoice`, `FineInvoiceItem`, `FineInvoiceStatus`, поля комментария и подтверждённого источника назначения.

- [ ] **Step 1: Write the failing schema test** — проверить tenant relations, уникальный provider invoice ID, идемпотентный ключ, `BigInt` суммы, sandbox flag, индексы company/status и запрет nullable companyId.
- [ ] **Step 2: Run RED** — `npx vitest run src/database/prisma/schema.test.ts`; ожидается отсутствие моделей.
- [ ] **Step 3: Add Prisma models and add-only SQL** — счёт содержит `companyId`, `providerInvoiceId`, `status`, `sandbox`, три суммы, `initiatedByUserId`, `idempotencyKey`, безопасный host и timestamps; item связывает счёт и штраф уникальной парой.
- [ ] **Step 4: Generate and run GREEN** — `npx prisma format`, `npx prisma generate`, schema test и typecheck должны пройти.
- [ ] **Step 5: Commit** — `feat(fines): add sandbox invoice lifecycle`.

### Task 2: Driver Helper invoice client

**Files:**

- Modify: `src/modules/fines/integrations/driver-helper/schemas.ts`
- Modify: `src/modules/fines/integrations/driver-helper/client.ts`
- Modify: `src/modules/fines/integrations/driver-helper/client.test.ts`
- Create: `src/modules/fines/integrations/driver-helper/payment-url.ts`
- Create: `src/modules/fines/integrations/driver-helper/payment-url.test.ts`

**Interfaces:**

- Produces: `checkInvoice(ids: string[])`, `createSandboxInvoice(input)`, `validateDriverHelperPaymentUrl(url)`.

- [ ] **Step 1: Write RED tests** — exact form encoding, bounded response, 401/402 mapping, malformed money, empty/duplicate IDs and rejection of HTTP/foreign-host URLs.
- [ ] **Step 2: Run RED** — focused client tests fail because methods do not exist.
- [ ] **Step 3: Implement schemas/client** — POST `/v1.0/invoice/check` and `/v1.0/invoice`, always force `sandbox=1`, send success/fail URLs from trusted server config, accept only HTTPS Driver Helper/payment hosts explicitly tested from the API response.
- [ ] **Step 4: Run GREEN** — focused tests and typecheck pass.
- [ ] **Step 5: Commit** — `feat(fines): add Driver Helper sandbox invoices`.

### Task 3: Exact attribution and review candidates

**Files:**

- Modify: `src/modules/fines/sync/attribute-fine.ts`
- Modify: `src/modules/fines/sync/attribute-fine.test.ts`
- Modify: `src/modules/fines/sync/sync-company-fines.server.ts`
- Create: `src/modules/fines/server/assignment-actions.ts`
- Create: `src/modules/fines/server/assignment-actions.test.ts`
- Modify: `src/modules/fines/server/queries.ts`
- Modify: `src/modules/fines/server/queries.test.ts`

**Interfaces:**

- Produces: `selectFineAttribution()` with `MATCHED | AMBIGUOUS | UNMATCHED`; query DTO `assignmentCandidates`; action `assignFineAction`.

- [ ] **Step 1: Write RED domain tests** — one half-open interval auto-matches; boundary at `endsAt` does not; two overlaps are ambiguous; nearest rentals are sorted hints and never returned as `MATCHED`.
- [ ] **Step 2: Write RED action/query tests** — exact tenant/RBAC, dispatcher allowed, foreign rental rejected, manual assignment/history/audit atomic, no candidate mutation.
- [ ] **Step 3: Implement minimal domain and transaction** — auto-write `AUTO_EXACT` history only when assignment changes; manual source records actor; clearing assignment is explicit.
- [ ] **Step 4: Run GREEN** — attribution, sync, query and action suites pass.
- [ ] **Step 5: Commit** — `feat(fines): review rental attribution`.

### Task 4: Idempotent sandbox payment use cases

**Files:**

- Create: `src/modules/fines/server/payment-actions.ts`
- Create: `src/modules/fines/server/payment-actions.test.ts`
- Create: `src/modules/fines/server/payment-state.ts`
- Create: `src/modules/fines/server/payment-state.test.ts`
- Create: `src/app/(protected)/fines/payment/success/route.ts`
- Create: `src/app/(protected)/fines/payment/fail/route.ts`
- Create: `src/app/(protected)/fines/payment/payment-callback.test.ts`

**Interfaces:**

- Produces: `checkFinePaymentAction`, `createSandboxFineInvoiceAction`, signed one-time callback state and callback routes.

- [ ] **Step 1: Write RED authorization/idempotency tests** — only super/company admin pays; same selected IDs/company/user reuse active invoice; mixed tenant, paid, cancelled and missing fines reject before API.
- [ ] **Step 2: Write RED callback tests** — tamper/expiry/reuse rejected, success changes invoice only, fine remains unpaid until sync.
- [ ] **Step 3: Implement transactions** — reload exact tenant fines, calculate canonical sorted-ID idempotency hash, persist PENDING before external create, settle CREATED/ERROR atomically, audit only IDs/counts/amounts.
- [ ] **Step 4: Run GREEN** — payment suites and typecheck pass.
- [ ] **Step 5: Commit** — `feat(fines): create sandbox payment workflow`.

### Task 5: Filters, cards, attribution review and payment UI

**Files:**

- Modify: `src/modules/fines/components/FinesPage.tsx`
- Modify: `src/modules/fines/components/FinesPage.test.tsx`
- Create: `src/modules/fines/components/FinePaymentPanel.tsx`
- Create: `src/modules/fines/components/FinePaymentPanel.test.tsx`
- Create: `src/modules/fines/components/FineAssignmentReview.tsx`
- Create: `src/modules/fines/components/FineAssignmentReview.test.tsx`
- Modify: `src/app/(protected)/fines/page.tsx`
- Modify: `src/app/(protected)/fines/loading.tsx`

**Interfaces:**

- Consumes: query DTOs and payment/assignment actions from Tasks 3–4.

- [ ] **Step 1: Write RED component tests** — filters, discount deadline, bailiff warning, comment/photo, exact attribution, candidate label, checkbox only for payable fines, sandbox warning, amount/commission/total and equal-size actions.
- [ ] **Step 2: Implement server filters** — URL-backed company/status/query/date/vehicle/client filters with tenant constraints and stable pagination.
- [ ] **Step 3: Implement responsive UI** — cards at mobile 390 px, desktop grid, modal/panel with explicit “деньги не списываются”, safe external payment link and invoice history.
- [ ] **Step 4: Run GREEN** — component/page tests, typecheck and lint pass.
- [ ] **Step 5: Commit** — `feat(fines): add payment and attribution workspace`.

### Task 6: Reconciliation, verification and local rollout

**Files:**

- Create: `src/modules/fines/server/reconcile-fine-invoices.ts`
- Create: `src/modules/fines/server/reconcile-fine-invoices.test.ts`
- Create: `docs/runbooks/driver-helper-fine-payments.md`
- Modify: `docs/PROJECT_GUIDE.md`
- Create: `tests/fines-payments.spec.ts`

**Interfaces:**

- Produces: bounded reconciliation command/use case and operational runbook.

- [ ] **Step 1: Write RED reconciliation tests** — stale PENDING becomes ERROR/retryable, created invoice is idempotent, sandbox success does not mark fine paid, later fine sync does.
- [ ] **Step 2: Implement bounded reconciler and runbook** — batches, retry limits, safe error codes and instructions for 401/402/token rotation.
- [ ] **Step 3: Add browser scenarios** — admin sandbox flow, dispatcher no payment, candidate confirmation, photo, foreign tenant denial and 390 px no overflow.
- [ ] **Step 4: Run verification** — focused/full Vitest, typecheck, lint, Prisma validate, production build, Prettier and diff-check; run Playwright discovery and sandbox runtime only against isolated test DB.
- [ ] **Step 5: Apply local migration and smoke** — `npx prisma migrate deploy`, restart port 3001, sync, create sandbox invoice and verify success/fail redirect without real charge.
- [ ] **Step 6: Commit** — `test(fines): verify sandbox payment workflow`.

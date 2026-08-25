# Operations Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать реальные финансовые итоги, контроль депозитов и GPS, безопасные карточки клиентов/машин, риск клиента и единый центр уведомлений СУПА ПРО.

**Architecture:** Денежные и операционные данные разделяются на серверном уровне: пожизненные финансовые итоги загружаются независимо от выбранного периода, а рабочие события остаются периодными. Уведомления строятся серверным агрегатором из доменных событий со стабильными ключами и сохраняют прочтение в `EventReadReceipt`. Все изменения выполняются вертикальными TDD-срезами.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind CSS, Vitest/Testing Library, GLONASSSoft, Redis.

## Global Constraints

- Сохранять tenant isolation по `companyId` и проверять права пользователя.
- Депозит не включать в заработок.
- Дата возврата депозита: 21 будний день после фактического возврата автомобиля.
- Не удалять историю физически; использовать архивирование.
- Не показывать секреты, расшифрованные телефоны в логах и чужие данные.
- Не возвращать демонстрационные машины и уведомления.
- Сохранять существующие незавершённые изменения пользователя.

---

### Task 1: Пожизненные финансовые итоги

**Files:**
- Modify: `src/modules/dashboard/server/queries.ts`
- Modify: `src/modules/dashboard/normalizers.ts`
- Modify: `src/modules/dashboard/overview-types.ts`
- Modify: `src/modules/dashboard/CommandCenterKpis.tsx`
- Test: `src/modules/dashboard/server/queries.test.ts`
- Test: `src/modules/dashboard/normalizers.test.ts`
- Test: `src/modules/dashboard/CommandCenterDashboard.test.tsx`

**Interfaces:**
- Produces: `lifetimeEarnedMinor`, `lifetimeDepositsMinor`, `heldDepositsMinor` as decimal minor-unit strings.

- [ ] **Step 1: Write failing query and normalizer tests**

Assert that a completed historical rental outside the selected period contributes to lifetime totals, a cancelled/draft rental does not, deposits never contribute to earnings, extension charges do, and all contract deposits contribute to `lifetimeDepositsMinor`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/dashboard/server/queries.test.ts src/modules/dashboard/normalizers.test.ts src/modules/dashboard/CommandCenterDashboard.test.tsx`
Expected: FAIL because lifetime fields/query do not exist.

- [ ] **Step 3: Implement separate lifetime rental query and KPI fields**

Load company rentals with statuses `CONFIRMED`, `ACTIVE`, `COMPLETED` without the dashboard date window. Sum `totalPriceMinor` plus committed extension charges for earnings, sum `depositMinor` for all contract deposits, and derive held deposits from the latest committed deposit operation. Keep period rentals for work items and charts.

- [ ] **Step 4: Render precise labels and drill-down links**

Use labels «Заработано за всё время», «Депозиты по договорам», «Сейчас на руках». Link financial cards to the rental list with an appropriate finance filter/query parameter.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/modules/dashboard/server/queries.test.ts src/modules/dashboard/normalizers.test.ts src/modules/dashboard/CommandCenterDashboard.test.tsx`
Expected: PASS.

### Task 2: Восстановление GPS и честная диагностика

**Files:**
- Modify: `src/modules/online-map/server/live-stream.ts`
- Modify: `src/modules/dashboard/normalizers.ts`
- Modify: `src/modules/dashboard/CommandCenterKpis.tsx`
- Modify: `src/modules/dashboard/overview-types.ts`
- Modify: `package.json` only if lockfile proves `redis` is missing from installed dependencies
- Test: `src/modules/online-map/server/live-stream.test.ts`
- Test: `src/modules/dashboard/normalizers.test.ts`
- Test: `src/modules/telematics/glonasssoft/deployment.test.ts`

**Interfaces:**
- Produces: offline vehicle details with vehicle id, label, last recorded time and age; idempotent live-stream cleanup.

- [ ] **Step 1: Capture failing cases**

Add tests proving stream cleanup can run twice without `ERR_INVALID_STATE`, all-fleet staleness becomes one integration incident, and KPI details retain every stale vehicle.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/online-map/server/live-stream.test.ts src/modules/dashboard/normalizers.test.ts src/modules/telematics/glonasssoft/deployment.test.ts`
Expected: FAIL on double close and missing diagnostic fields.

- [ ] **Step 3: Fix live stream and worker prerequisites**

Make cleanup idempotent with a closed flag and guard `controller.close()`. Verify `redis` resolves from the installed workspace; if absent, restore the dependency and lockfile. Keep the GLONASSSoft live worker as the only writer loop.

- [ ] **Step 4: Expose actionable GPS details**

Make «Нет GPS-связи» link to `/vehicles?gps=offline`. Show last signal time in the filtered vehicle list and create a single integration-health item when all active real cars are stale.

- [ ] **Step 5: Run one manual sync and verify timestamps advance**

Run: `npm run telematics:sync-glonasssoft`
Expected: `GLONASSSOFT_SYNC_OK` and newer `VehiclePosition.recordedAt` values for matched real cars.

- [ ] **Step 6: Run targeted tests**

Run the Step 2 command again. Expected: PASS.

### Task 3: Депозит через 21 рабочий день

**Files:**
- Create: `src/modules/rentals/domain/deposit-deadline.ts`
- Create: `src/modules/rentals/domain/deposit-deadline.test.ts`
- Modify: `src/modules/clients/components/client-deposit.ts`
- Modify: `src/modules/dashboard/normalizers.ts`
- Test: `src/modules/clients/components/client-deposit.test.ts`
- Test: `src/modules/dashboard/normalizers.test.ts`

**Interfaces:**
- Produces: `addBusinessDays(date, 21)`, `getDepositReturnState(...)` returning held/due-today/due/overdue/returned/withheld states.

- [ ] **Step 1: Write boundary tests**

Cover Friday plus 21 weekdays, factual return precedence, missing factual return, today, overdue, returned, partially withheld and withheld.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/rentals/domain/deposit-deadline.test.ts src/modules/clients/components/client-deposit.test.ts src/modules/dashboard/normalizers.test.ts`
Expected: FAIL because the domain module does not exist and dashboard returns deposits immediately.

- [ ] **Step 3: Implement pure deadline/state functions**

Count Monday through Friday in Moscow calendar and start after factual return day. Use committed RETURN operation first, then `completedAt`; do not fabricate a deadline while return is unrecorded.

- [ ] **Step 4: Reuse the same state in client and dashboard views**

Render exact due/overdue/returned wording and schedule dashboard work items at the calculated deadline.

- [ ] **Step 5: Run tests**

Run the Step 2 command again. Expected: PASS.

### Task 4: Реальный центр уведомлений

**Files:**
- Create: `src/modules/notifications/server/queries.ts`
- Create: `src/modules/notifications/server/actions.ts`
- Create: `src/modules/notifications/domain/build-notifications.ts`
- Create: `src/modules/notifications/domain/build-notifications.test.ts`
- Modify: `src/modules/notifications/NotificationCenter.tsx`
- Modify: `src/modules/notifications/types.ts`
- Modify: `src/shared/components/app-shell/Header.tsx`
- Test: `src/modules/notifications/NotificationCenter.test.tsx`
- Test: `src/shared/components/app-shell/Header.test.tsx`

**Interfaces:**
- Produces: `listNotificationsForCurrentUser()`, `markNotificationReadAction(eventKey)`, `markAllNotificationsReadAction(eventKeys)`.
- Consumes: deposit deadline states and dashboard/GPS operational events.

- [ ] **Step 1: Write failing domain and component tests**

Cover priority sorting, stable event keys, deduplication, all-fleet GPS aggregation, deposit 3/2/1/today/overdue, direct entity links, one/all read actions, and absence of `Pilot 017/042/023/130`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/notifications/domain/build-notifications.test.ts src/modules/notifications/NotificationCenter.test.tsx src/shared/components/app-shell/Header.test.tsx`
Expected: FAIL because real server aggregator/actions do not exist.

- [ ] **Step 3: Implement tenant-scoped aggregator and read receipts**

Create stable event keys from event type, entity id and state/deadline. Read `EventReadReceipt` for the authenticated user/company and upsert receipts for one/all actions.

- [ ] **Step 4: Replace fixtures in Header**

Load real notifications server-side. Keep focus handling and dialog accessibility. Use optimistic pending state but revalidate server data after read actions.

- [ ] **Step 5: Run tests**

Run the Step 2 command again. Expected: PASS.

### Task 5: Клиентская таблица и безопасное архивирование

**Files:**
- Modify: `src/modules/clients/server/queries.ts`
- Modify: `src/modules/clients/types.ts`
- Modify: `src/modules/clients/components/ClientGrid.tsx`
- Modify: `src/modules/clients/components/ClientCard.tsx`
- Modify: `src/app/(protected)/clients/[id]/page.tsx`
- Modify: `src/app/(protected)/vehicles/[id]/page.tsx`
- Reuse: `src/modules/clients/actions.ts`
- Reuse: `src/modules/vehicles/manage/actions.ts`
- Test: corresponding client and vehicle component/action tests

**Interfaces:**
- Produces: full authorized `phone`, consistent primary/secondary cell typography, archive confirmation controls.

- [ ] **Step 1: Write failing tests**

Assert an authorized list shows the full decrypted phone, unauthorized data stays absent, primary cell text is consistent, archive confirmation is required, and active rentals block archive.

- [ ] **Step 2: Run targeted tests and verify failure**

Run the matching client grid/card/detail and archive action test files discovered with `rg --files`.
Expected: FAIL on phone and missing controls.

- [ ] **Step 3: Implement authorized phone and UI cleanup**

Return the full phone only when `VIEW_CLIENTS` is granted. Keep secondary text smaller/gray and avoid masking in the authorized working table.

- [ ] **Step 4: Add archive controls using existing actions**

Use a confirmation dialog and surface active-rental conflicts. Archive «Проверка Тест» only after querying id, name and rental count immediately before the mutation.

- [ ] **Step 5: Run targeted tests**

Expected: PASS.

### Task 6: Риск клиента в мастере аренды

**Files:**
- Modify: rental wizard client-step component discovered under `src/modules/rentals`
- Modify: final confirmation/action schema under `src/modules/rentals`
- Modify: Prisma schema/migration only if no existing audit metadata can store acknowledgement
- Test: corresponding wizard/action tests

**Interfaces:**
- Consumes: existing client rating summary.
- Produces: visible five-star category and persisted high-risk acknowledgement with actor/time.

- [ ] **Step 1: Locate wizard boundaries and write failing tests**

Assert rating categories at 1.5/2.8/3.8/4.5, high risk blocks final confirmation without acknowledgement, and acknowledgement records actor/time.

- [ ] **Step 2: Run tests and verify failure**

Run the discovered rental wizard/action test files. Expected: FAIL on missing risk UI and validation.

- [ ] **Step 3: Implement rating presentation and server validation**

Show stars/category/reason on client selection. Require acknowledgement both in UI and server action for score below 1.5 so the rule cannot be bypassed.

- [ ] **Step 4: Run tests**

Expected: PASS.

### Task 7: Финальная интеграция и проверка

**Files:**
- Modify only files required by integration failures
- Update: `docs/PROJECT_GUIDE.md` with the completed operational behavior without overwriting unrelated user edits

- [ ] **Step 1: Run focused suites from Tasks 1–6**

Expected: PASS.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: no new errors in touched files; document unrelated pre-existing failures separately.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Verify in the local browser**

Check dashboard totals/drill-down, GPS timestamps, notification persistence/deduplication, deposit deadline, client phone/archive, and high-risk rental confirmation using real local data.

- [ ] **Step 5: Review diff and commit coherent slices**

Run: `git diff --check` and `git status --short`.
Expected: no whitespace errors and no unrelated files staged.


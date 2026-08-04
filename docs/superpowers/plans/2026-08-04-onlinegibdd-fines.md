# Pilot+ OnlineГИБДД Fines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Синхронизировать штрафы каждой компании через официальный API OnlineГИБДД, связать их с автомобилями и клиентами и показать в защищённом рабочем разделе.

**Architecture:** Каждая компания имеет отдельную зашифрованную integration config. Server-only client нормализует API v3/v4 в собственную модель Fine и выполняет идемпотентный upsert по provider+company+УИН. Attribution service связывает штраф с периодом ответственности клиента; UI никогда не обращается к OnlineГИБДД напрямую.

**Tech Stack:** Next.js 16.2, React 19.2, Prisma 6.16, PostgreSQL 17, Node fetch/crypto, Zod 4, Tailwind CSS 4, React Icons, Vitest, Playwright.

## Global Constraints

- Выполнять после core clients; documents plan нужен для локального хранения защищённых фотографий нарушения.
- Штрафы доступны только `SUPER_ADMIN`, `COMPANY_ADMIN`, `DISPATCHER`; `VIEWER` и `DRIVER` получают forbidden на всех границах.
- Использовать официальный `https://api.onlinegibdd.ru/v3/` и v4 photos endpoint; iframe/HTML scraping запрещены.
- API-key отдельный у каждой компании, шифруется, после сохранения не раскрывается и не логируется.
- Один штраф уникален по `companyId + provider + UIN`; повторная синхронизация не создаёт дубликат.
- Первая версия не оплачивает штрафы и не хранит банковские карты.
- Ошибка одной компании не останавливает другие; rate limits, timeout и retry ограничены.

---

### Task 1: Добавить fine permissions, integration и domain schema

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260804190000_add_onlinegibdd_fines/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`
- Modify: `src/modules/admin/access/permissions.ts`
- Modify: `src/modules/admin/access/permissions.test.ts`
- Create: `src/modules/fines/types.ts`
- Create: `src/modules/fines/access.ts`
- Create: `src/modules/fines/access.test.ts`

**Interfaces:**

- Produces: `VIEW_FINES`, `MANAGE_FINES`; `FineProviderConfig`, `Fine`, `FinePhoto`, `FineAssignmentHistory`, `VehicleResponsibilityPeriod`.

- [ ] **Step 1: Написать RED schema/permission tests**

```ts
expect(hasCompanyPermission('DISPATCHER', [], 'MANAGE_FINES')).toBe(true);
expect(hasCompanyPermission('VIEWER', [], 'VIEW_FINES')).toBe(false);
expect(hasCompanyPermission('DRIVER', [], 'VIEW_FINES')).toBe(false);
```

- [ ] **Step 2: Добавить enums/models и миграцию**

```prisma
enum FineStatus { NEW ASSIGNED AWAITING_PAYMENT PAID APPEALED REVOKED OVERDUE }
enum FineSource { ONLINE_GIBDD MANUAL }

model FineProviderConfig {
  id String @id @default(cuid())
  companyId String @unique
  provider String
  apiKeyEncrypted String
  enabled Boolean @default(true)
  lastSuccessAt DateTime?
  lastAttemptAt DateTime?
  lastErrorCode String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Fine {
  id String @id @default(cuid())
  companyId String
  vehicleId String?
  clientId String?
  provider String
  providerVehicleId String?
  uin String
  offenseAt DateTime
  location String?
  latitude Decimal? @db.Decimal(9, 6)
  longitude Decimal? @db.Decimal(9, 6)
  article String?
  description String
  originalAmountMinor Int
  currentAmountMinor Int
  discountExpiresAt DateTime?
  paymentDueAt DateTime?
  status FineStatus @default(NEW)
  source FineSource @default(ONLINE_GIBDD)
  providerUpdatedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([companyId, provider, uin])
  @@index([companyId, status, offenseAt])
}
```

Добавить relations, `FinePhoto` с private storage key и `FineAssignmentHistory` с actor/reason.
Та же миграция добавляет `FINE` и `FINE_INTEGRATION` в `AuditEntityType`.

```prisma
model VehicleResponsibilityPeriod {
  id String @id @default(cuid())
  companyId String
  vehicleId String
  clientId String
  startedAt DateTime
  endedAt DateTime?
  source String
  createdByUserId String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([companyId, vehicleId, startedAt, endedAt])
  @@index([companyId, clientId, startedAt])
}
```

- [ ] **Step 3: Реализовать access policy**

SYSTEM получает все companies; COMPANY — memberships с `VIEW_FINES`/`MANAGE_FINES`; viewer/driver
null. Настройку API-key может менять только SUPER_ADMIN/COMPANY_ADMIN.

- [ ] **Step 4: Проверить и commit**

Run: `npx prisma format && npx prisma generate && npx vitest run src/database/prisma/schema.test.ts src/modules/admin/access/permissions.test.ts src/modules/fines/access.test.ts && npm run typecheck`

```powershell
git add src/database/prisma src/modules/admin/access src/modules/fines
git commit -m "feat: add company fines domain"
```

### Task 2: Реализовать защищённые настройки и OnlineГИБДД client

**Files:**

- Create: `src/modules/fines/integrations/onlinegibdd/schemas.ts`
- Create: `src/modules/fines/integrations/onlinegibdd/client.ts`
- Create: `src/modules/fines/integrations/onlinegibdd/client.test.ts`
- Create: `src/modules/fines/integrations/onlinegibdd/normalizers.ts`
- Create: `src/modules/fines/integrations/onlinegibdd/normalizers.test.ts`
- Create: `src/modules/fines/integration-actions.ts`
- Create: `src/modules/fines/integration-actions.test.ts`

**Interfaces:**

- Produces: `OnlineGibddClient.listVehicles/listFines/getFinePhotos`; `saveFineProviderConfigAction`; normalized `ProviderFine`.

- [ ] **Step 1: Написать RED HTTP tests**

```ts
expect(fetchMock).toHaveBeenCalledWith(
  'https://api.onlinegibdd.ru/v3/partner_fines/',
  expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer secret' }) }),
);
expect(result).toEqual(expect.objectContaining({ uin: '188105...', amountMinor: 250000 }));
```

Проверить timeout, 401, 429, invalid JSON, provider error и abort; error messages не содержат key.

- [ ] **Step 2: Реализовать Zod response boundary**

Внешний JSON не приводить `as`. Схемы разрешают documented optional values, но отклоняют запись без
УИН/суммы/даты. Денежные значения нормализуются в integer minor units.

- [ ] **Step 3: Реализовать HTTP client**

Base URL фиксирован; Authorization только server-side; timeout 15 секунд; максимум 3 retries только
для 429/5xx с bounded backoff. Фото запрашиваются отдельно через v4.

- [ ] **Step 4: Реализовать config action**

Проверить manage integration access и company boundary, выполнить пробный безопасный request,
зашифровать ключ через field-encryption service и вернуть только `configured: true` + masked suffix.

- [ ] **Step 5: Проверить и commit**

Run: `npx vitest run src/modules/fines/integrations src/modules/fines/integration-actions.test.ts && npm run typecheck`

```powershell
git add src/modules/fines
git commit -m "feat: connect onlinegibdd api"
```

### Task 3: Реализовать idempotent sync и client attribution

**Files:**

- Create: `src/modules/fines/sync/sync-company-fines.ts`
- Create: `src/modules/fines/sync/sync-company-fines.test.ts`
- Create: `src/modules/fines/sync/attribute-fine.ts`
- Create: `src/modules/fines/sync/attribute-fine.test.ts`
- Create: `src/modules/fines/sync/run-all-companies.ts`
- Create: `scripts/fines-sync-worker.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `syncCompanyFines(companyId)`, `attributeFine(companyId, vehicleId, offenseAt)`, `runAllCompanyFineSync()`.

- [ ] **Step 1: Написать RED idempotency/isolation tests**

Один payload дважды → одна Fine; status PAID обновляется; неизвестный provider vehicle не связывается
с чужой company; ошибка c1 не останавливает c2; disabled config не вызывается.

- [ ] **Step 2: Реализовать vehicle sync/map**

Связывать provider vehicle только в пределах company по сохранённому external ID, затем exact
registration+STS. Не логировать полный СТС.

- [ ] **Step 3: Реализовать fine transaction**

Upsert `companyId_provider_uin`, сохранить provider timestamps, enqueue/fetch photos только после
основного fine commit. Photo bytes проходят ClamAV/private storage pipeline документов.

- [ ] **Step 4: Реализовать attribution**

Выбрать ровно один период аренды/ответственности, где `startedAt <= offenseAt < endedAt`; при overlap
или отсутствии вернуть `unassigned`. Автоматическая связь пишет AssignmentHistory с reason
`RENTAL_PERIOD` и confidence `EXACT`.

- [ ] **Step 5: Добавить worker command**

```json
"fines:sync": "tsx scripts/fines-sync-worker.ts"
```

Worker делает один bounded cycle и завершается с non-zero только при системной ошибке; scheduler
развёртывания вызывает его по расписанию. Это тестируемее бесконечного loop внутри web process.

- [ ] **Step 6: Проверить и commit**

Run: `npx vitest run src/modules/fines/sync && npm run typecheck`

```powershell
git add src/modules/fines/sync scripts/fines-sync-worker.ts package.json
git commit -m "feat: synchronize and attribute fines"
```

### Task 4: Добавить queries, manual assignment и protected photos

**Files:**

- Create: `src/modules/fines/server/queries.ts`
- Create: `src/modules/fines/server/queries.test.ts`
- Create: `src/modules/fines/actions.ts`
- Create: `src/modules/fines/actions.test.ts`
- Create: `src/app/(protected)/fines/[id]/photos/[photoId]/route.ts`
- Create route test.

- [ ] **Step 1: Написать tenant/RBAC RED tests**

SYSTEM filter optional company; COMPANY exact ids; viewer/driver denied; cross-company fine/photo
denied; dispatcher assigns client only from same company; reassignment preserves history.

- [ ] **Step 2: Реализовать whitelist DTO queries**

DTO содержит fine, masked client, vehicle and photo ids/status, но не API-key/storage path. KPI
aggregates используют тот же tenant where, что list.

- [ ] **Step 3: Реализовать manual assignment action**

Atomic transaction verifies fine/client company match, optimistic `updatedAt`, writes history with
actor and reason `MANUAL`, then revalidates `/fines` and client detail.

В том же action module реализовать создание и завершение `VehicleResponsibilityPeriod` только для
клиента и автомобиля одной разрешённой company. Пересекающиеся периоды разрешено сохранить с
предупреждением, но attribution в таком случае обязан вернуть `unassigned`, а не угадывать.

- [ ] **Step 4: Реализовать protected photo route**

Проверить fine permission + tenant + CLEAN photo, записать audit, stream private object с nosniff.

- [ ] **Step 5: Проверить и commit**

Run: `npx vitest run src/modules/fines/server src/modules/fines/actions.test.ts "src/app/(protected)/fines" && npm run typecheck`

```powershell
git add src/modules/fines "src/app/(protected)/fines"
git commit -m "feat: manage company fine assignments"
```

### Task 5: Добавить меню, fines workspace и client tab

**Files:**

- Create: `src/app/(protected)/fines/page.tsx`
- Create: `src/app/(protected)/fines/loading.tsx`
- Create: `src/app/(protected)/fines/error.tsx`
- Create: `src/modules/fines/components/FinesPage.tsx`
- Create: `src/modules/fines/components/FineKpiGrid.tsx`
- Create: `src/modules/fines/components/FineFilters.tsx`
- Create: `src/modules/fines/components/FineCard.tsx`
- Create: `src/modules/fines/components/AssignClientDialog.tsx`
- Create tests beside components.
- Modify: `src/modules/clients/components/ClientDetailPage.tsx`
- Modify: `src/shared/components/app-shell/navigation.ts`
- Modify: sidebar/navigation tests.
- Create: `tests/fines.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`

- [ ] **Step 1: Написать RED UI/navigation tests**

Проверить menu только для super/admin/dispatcher, KPI, discount warning, photo, client/vehicle links,
manual assignment, sync state, empty/error/loading; viewer/driver не видят menu.

- [ ] **Step 2: Реализовать responsive workspace**

URL params: `company`, `client`, `vehicle`, `status`, `from`, `to`, `page`. SYSTEM видит company
filter; COMPANY нет. Карточка использует semantic tokens и 44px actions; mobile без overflow.

- [ ] **Step 3: Добавить client tab**

Вкладка клиента использует тот же scoped query с fixed clientId и показывает только разрешённым
ролям. Она не отображается viewer/driver.

- [ ] **Step 4: Добавить E2E**

Проверить sync fixture, no duplicates, automatic/manual assignment, provider failure state,
protected photo, three allowed roles, two denied roles и 390×844.

- [ ] **Step 5: Миграция, seed и полная проверка**

Run: `npx prisma migrate deploy && npm run db:seed && npm run lint && npm run typecheck && npm run test:unit && npx playwright test tests/fines.spec.ts --workers=1 && npm run build && git diff --check`
Expected: PASS; tests используют mock provider, а не production API-key.

- [ ] **Step 6: Commit**

```powershell
git add "src/app/(protected)/fines" src/modules/fines src/modules/clients src/shared/components/app-shell tests/fines.spec.ts docs/PROJECT_GUIDE.md
git commit -m "feat: add onlinegibdd fines workspace"
```

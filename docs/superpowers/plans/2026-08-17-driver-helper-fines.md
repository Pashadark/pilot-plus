# Driver Helper Fines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить tenant-safe раздел «Штрафы» с серверной синхронизацией Driver Helper, локальной историей, привязкой к автомобилям/арендам/клиентам и защищёнными фотографиями.

**Architecture:** Для каждой компании хранится отдельная зашифрованная конфигурация интеграции. Server-only API client валидирует и нормализует ответы Driver Helper, а идемпотентный sync записывает whitelist данных в PostgreSQL. UI и поиск читают только локальную базу; фотографии проксируются защищённым серверным маршрутом после повторной авторизации.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript, Prisma 6.16, PostgreSQL 17, Zod 4, Node fetch/crypto, Tailwind CSS 4, React Icons, Vitest, Playwright.

## Global Constraints

- Перед изменениями прочитать `docs/PROJECT_GUIDE.md` полностью и проверить `git status`; не включать чужие изменения в commits.
- Перед изменением Next.js route/page/server-action прочитать релевантные файлы в `node_modules/next/dist/docs/`.
- Первая версия не создаёт invoice и не выполняет sandbox/production-оплату.
- `SUPER_ADMIN` видит все компании; `COMPANY_ADMIN` и `DISPATCHER` — только свои; `DRIVER` и `VIEWER` не получают меню, route, data, action или photo access.
- Токен Driver Helper никогда не попадает в client bundle, HTML, action state, audit, exception text или Git.
- Логин/пароль используются только для контролируемого первоначального обмена на постоянный токен и не сохраняются.
- Суммы хранятся в копейках как безопасные целые числа; raw API payload и банковские реквизиты не сохраняются.
- Все миграции add-only/rolling-safe; общую БД не мигрировать и не seed без отдельного разрешения.
- Реальный Driver Helper не используется в unit/E2E; тесты работают через mock transport.

---

### Task 1: Domain schema, RBAC and encrypted company configuration

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260817150000_add_driver_helper_fines/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`
- Modify: `src/modules/admin/access/permissions.ts`
- Modify: `src/modules/admin/access/permissions.test.ts`
- Create: `src/modules/fines/access.ts`
- Create: `src/modules/fines/access.test.ts`
- Create: `src/modules/fines/types.ts`

**Interfaces:**

- Produces: `VIEW_FINES`, `MANAGE_FINES`, Prisma models `FineIntegration`, `ExternalVehicleLink`, `Fine`, `FineAssignmentHistory`, enums `FineStatus`, `FineAssignmentSource`.
- Produces: `getFineAccess(): Promise<FineAccess | null>`, `requireFineViewAccess(companyId?)`, `requireFineManageAccess(companyId?)`.

- [ ] **Step 1: Write RED schema and role-policy tests**

```ts
expect(hasCompanyPermission('COMPANY_ADMIN', [], 'MANAGE_FINES')).toBe(true);
expect(hasCompanyPermission('DISPATCHER', [], 'MANAGE_FINES')).toBe(true);
expect(hasCompanyPermission('VIEWER', ['VIEW_FINES'], 'VIEW_FINES')).toBe(false);
expect(hasCompanyPermission('DRIVER', ['VIEW_FINES'], 'VIEW_FINES')).toBe(false);
expect(schema).toContain('model FineIntegration');
expect(schema).toContain('@@unique([companyId, provider, externalId])');
```

- [ ] **Step 2: Run RED tests**

Run: `npx vitest run src/database/prisma/schema.test.ts src/modules/admin/access/permissions.test.ts src/modules/fines/access.test.ts`

Expected: FAIL because fine permissions, models and access module do not exist.

- [ ] **Step 3: Add additive schema and migration**

Use these canonical shapes; add relations to `Company`, `Vehicle`, `Rental`, `Client`, and `User`:

```prisma
enum FineStatus { NEW UNPAID PAID CANCELLED OVERDUE }
enum FineAssignmentSource { AUTOMATIC MANUAL }

model FineIntegration {
  id String @id @default(cuid())
  companyId String @unique
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  provider String @default("DRIVER_HELPER")
  tokenEncrypted String
  enabled Boolean @default(true)
  lastAttemptAt DateTime? @db.Timestamptz(3)
  lastSuccessAt DateTime? @db.Timestamptz(3)
  lastErrorCode String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ExternalVehicleLink {
  id String @id @default(cuid())
  companyId String
  vehicleId String?
  provider String @default("DRIVER_HELPER")
  externalId String
  registrationNumberNormalized String?
  registrationCertificateIndex String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([companyId, provider, externalId])
  @@index([companyId, vehicleId])
}

model Fine {
  id String @id @default(cuid())
  companyId String
  vehicleId String?
  rentalId String?
  clientId String?
  provider String @default("DRIVER_HELPER")
  externalId String
  uin String?
  decreeNumber String
  decreeAt DateTime? @db.Timestamptz(3)
  offenseAt DateTime @db.Timestamptz(3)
  discountExpiresAt DateTime? @db.Timestamptz(3)
  originalAmountMinor BigInt
  currentAmountMinor BigInt
  discountPercent Int?
  articleCode String?
  description String?
  address String?
  latitude Decimal? @db.Decimal(9, 6)
  longitude Decimal? @db.Decimal(9, 6)
  status FineStatus @default(NEW)
  toBailiff Boolean @default(false)
  providerComment String?
  photoState String?
  providerUpdatedAt DateTime? @db.Timestamptz(3)
  lastSyncedAt DateTime @db.Timestamptz(3)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([companyId, provider, externalId])
  @@index([companyId, status, offenseAt])
  @@index([companyId, vehicleId, offenseAt])
  @@index([companyId, clientId, offenseAt])
}
```

- [ ] **Step 4: Implement immutable role boundary**

Add permissions to the enum/type, but make `fines/access.ts` reject `DRIVER` and `VIEWER` regardless of `additionalPermissions`. `COMPANY_ADMIN` and `DISPATCHER` receive company-scoped view/manage; only `COMPANY_ADMIN` and `SUPER_ADMIN` may configure a token.

- [ ] **Step 5: Verify and commit**

Run: `npx prisma format && npx prisma generate && npx vitest run src/database/prisma/schema.test.ts src/modules/admin/access/permissions.test.ts src/modules/fines/access.test.ts && npm run typecheck && git diff --check`

Expected: PASS.

Commit: `feat(fines): add tenant fines domain`

---

### Task 2: Strict Driver Helper server client and token configuration

**Files:**

- Create: `src/modules/fines/integrations/driver-helper/schemas.ts`
- Create: `src/modules/fines/integrations/driver-helper/schemas.test.ts`
- Create: `src/modules/fines/integrations/driver-helper/client.ts`
- Create: `src/modules/fines/integrations/driver-helper/client.test.ts`
- Create: `src/modules/fines/integrations/driver-helper/normalizers.ts`
- Create: `src/modules/fines/integrations/driver-helper/normalizers.test.ts`
- Create: `src/modules/fines/server/integration-actions.ts`
- Create: `src/modules/fines/server/integration-actions.test.ts`
- Modify: `.env.example`

**Interfaces:**

- Produces: `DriverHelperClient.listCars(page)`, `listUnpaidFines(page)`, `getFinePhotos(id)`.
- Produces: `normalizeDriverHelperCar`, `normalizeDriverHelperFine`, `parseRublesToMinor`.
- Produces: `saveFineIntegrationTokenAction(companyId, token)` restricted to super/company admin.

- [ ] **Step 1: Write RED contract tests**

```ts
await expect(client.listUnpaidFines(1)).resolves.toMatchObject({ totalCount: 1 });
expect(parseRublesToMinor('250.50')).toBe(25050n);
await expect(client.listUnpaidFines(1)).rejects.toMatchObject({ code: 'AUTH_REJECTED' });
expect(JSON.stringify(actionResult)).not.toContain('secret-token');
```

Cover `401`, `402`, timeout, non-JSON, oversized body, invalid pagination, missing IDs, `post_mum` compatibility, and abort propagation.

- [ ] **Step 2: Run RED tests**

Run: `npx vitest run src/modules/fines/integrations/driver-helper src/modules/fines/server/integration-actions.test.ts`

Expected: FAIL because modules are absent.

- [ ] **Step 3: Implement bounded transport and Zod schemas**

Use `https://api.driver-helper.ru` as the fixed production origin, `Authorization: Bearer <decrypted token>`, `AbortSignal.timeout(10_000)`, a 2 MiB response cap, JSON content-type validation, and page sizes no larger than 50. Map provider failures to the closed union:

```ts
type DriverHelperErrorCode =
  'AUTH_REJECTED' | 'SERVICE_PAYMENT_REQUIRED' | 'TIMEOUT' | 'UNAVAILABLE' | 'INVALID_RESPONSE';
```

Never include request headers, token, raw response body or credentials in thrown messages.

- [ ] **Step 4: Implement exact decimal and whitelist normalization**

Parse decimal strings by splitting rubles/kopecks and rejecting exponent notation, negatives and unsafe length. Normalize plates with the existing vehicle helper. Blind-index STS with the existing security service; never store plaintext STS in `ExternalVehicleLink`.

- [ ] **Step 5: Implement encrypted token action**

Reuse `src/services/security/field-encryption.ts`. Store only encrypted bearer token and audit entity ID/company/result, never the token or account username. `.env.example` may contain only non-secret timeout/base URL documentation.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run src/modules/fines/integrations/driver-helper src/modules/fines/server/integration-actions.test.ts && npm run typecheck && npx prettier --check src/modules/fines .env.example && git diff --check`

Expected: PASS.

Commit: `feat(fines): connect Driver Helper securely`

---

### Task 3: Idempotent sync and automatic attribution

**Files:**

- Create: `src/modules/fines/sync/sync-company-fines.ts`
- Create: `src/modules/fines/sync/sync-company-fines.test.ts`
- Create: `src/modules/fines/sync/attribute-fine.ts`
- Create: `src/modules/fines/sync/attribute-fine.test.ts`
- Create: `src/modules/fines/server/sync-action.ts`
- Create: `src/modules/fines/server/sync-action.test.ts`
- Create: `scripts/fines-sync-worker.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `syncCompanyFines(companyId, actorId): Promise<FineSyncResult>`.
- Produces: `attributeFine(companyId, vehicleId, offenseAt): Promise<AttributionResult>`.
- Produces: `syncFinesAction(companyId): Promise<FineActionState>`.

- [ ] **Step 1: Write RED sync tests**

Test two-page car/fine responses, repeated sync without duplicates, updated fine amount/status, exact STS match, plate fallback, ambiguous link, one rental match, overlapping rentals, provider page failure, and company A failure not affecting company B worker.

```ts
expect(await syncCompanyFines('company-a', 'user-a')).toEqual({
  ok: true,
  received: 2,
  created: 1,
  updated: 1,
  unmatched: 0,
});
```

- [ ] **Step 2: Run RED tests**

Run: `npx vitest run src/modules/fines/sync src/modules/fines/server/sync-action.test.ts`

Expected: FAIL because sync modules are absent.

- [ ] **Step 3: Implement bounded pagination and atomic page upserts**

Stop when `current >= last`, an empty page is received, or 200 pages are reached. For every page, upsert by `(companyId, provider, externalId)` inside a transaction. Update `lastAttemptAt` before the run and `lastSuccessAt` only after all pages succeed. Store safe `lastErrorCode` on failure.

- [ ] **Step 4: Implement attribution**

Match `Vehicle` by blind-indexed STS first and normalized plate second. Only auto-assign when exactly one vehicle matches. Find rentals where `startsAt <= offenseAt` and `endsAt > offenseAt`; only one match may set `rentalId/clientId`. Record `FineAssignmentHistory` with `AUTOMATIC` and no client PII.

- [ ] **Step 5: Add manual action authorization and worker entrypoint**

`syncFinesAction` reauthorizes in the mutation and revalidates `/fines`. Add `"fines:sync": "tsx scripts/fines-sync-worker.ts"`; the worker iterates enabled integrations independently and prints counts/error codes only.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run src/modules/fines/sync src/modules/fines/server/sync-action.test.ts && npm run typecheck && git diff --check`

Expected: PASS.

Commit: `feat(fines): synchronize and attribute company fines`

---

### Task 4: Tenant queries, assignment/comment actions and protected photos

**Files:**

- Create: `src/modules/fines/server/queries.ts`
- Create: `src/modules/fines/server/queries.test.ts`
- Create: `src/modules/fines/server/actions.ts`
- Create: `src/modules/fines/server/actions.test.ts`
- Create: `src/app/(protected)/fines/[id]/photo/route.ts`
- Create: `src/app/(protected)/fines/[id]/photo/route.test.ts`

**Interfaces:**

- Produces: `listFinesForCurrentUser(filters): Promise<FinesPageData>`.
- Produces: `assignFineAction`, `commentFineAction`.
- Produces: protected `GET /fines/:id/photo`.

- [ ] **Step 1: Read Next.js route-handler documentation**

Read the relevant current guides under `node_modules/next/dist/docs/` for route handlers, cookies/authentication, caching and streaming before writing the route.

- [ ] **Step 2: Write RED tenant and action tests**

Cover SYSTEM optional company, company exact membership set, driver/viewer denial, cross-company IDs, archived client/rental rejection, optimistic `updatedAt`, PII-free audit, photo auth before external fetch, safe `404`, `Cache-Control: private, no-store`, and `X-Content-Type-Options: nosniff`.

- [ ] **Step 3: Implement whitelisted local queries**

Return only display fields and opaque IDs. Filters are server-side: status, query, company, vehicle, from/to. Search normalized plate/decree locally; client-name search joins tenant-scoped `Client`. DTO money is serialized as decimal strings, not `BigInt`.

- [ ] **Step 4: Implement atomic assignment/comment mutations**

Inside one Serializable transaction, reauthorize, reload fine and target entities with exact company guards, update, append assignment history/audit, and return a safe action code. The comment sent to Driver Helper is out of first-version scope; store the local operational comment only.

- [ ] **Step 5: Implement protected photo proxy**

Authorize and reload exact fine before calling Driver Helper. Validate provider photo content-type (`image/jpeg`, `image/png`, `image/webp`), cap at 8 MiB and stream/return without exposing upstream URL or headers. Recheck exact fine/company before audit if storage/network work separates the checks.

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run src/modules/fines/server "src/app/(protected)/fines/[id]/photo/route.test.ts" && npm run typecheck && git diff --check`

Expected: PASS.

Commit: `feat(fines): authorize fine operations and photos`

---

### Task 5: Navigation and responsive fines workspace

**Files:**

- Modify: `src/modules/auth/types.ts`
- Modify: session safe-user capability projection and tests in `src/services/auth/`
- Modify: `src/shared/components/app-shell/navigation.ts`
- Modify: `src/shared/components/app-shell/Sidebar.test.ts`
- Create: `src/app/(protected)/fines/page.tsx`
- Create: `src/app/(protected)/fines/loading.tsx`
- Create: `src/app/(protected)/fines/error.tsx`
- Create: `src/modules/fines/components/FinesPage.tsx`
- Create: `src/modules/fines/components/FinesPage.test.tsx`
- Create: `src/modules/fines/components/FineKpiGrid.tsx`
- Create: `src/modules/fines/components/FineFilters.tsx`
- Create: `src/modules/fines/components/FineCard.tsx`
- Create: `src/modules/fines/components/AssignFineDialog.tsx`

**Interfaces:**

- Consumes: `FinesPageData`, `syncFinesAction`, `assignFineAction`, `commentFineAction`.
- Produces: `/fines` desktop/mobile workspace and capability-gated sidebar item.

- [ ] **Step 1: Read current Next.js page/loading/error/server-action documentation**

Use only the installed Next.js 16.2 documentation under `node_modules/next/dist/docs/`; follow its async request API and caching conventions.

- [ ] **Step 2: Write RED navigation and component tests**

```tsx
expect(screen.getByRole('link', { name: 'Штрафы' })).toBeVisible();
expect(driverMarkup).not.toContain('Штрафы');
expect(screen.getByText('Требуют привязки')).toBeVisible();
expect(screen.getAllByRole('button')).toSatisfy(equalPilotButtonHeights);
```

Cover Russian status labels, KPI totals, empty/error/stale-sync states, URL filters, mobile cards, modal focus return, and no raw enum/token/`undefined`/`null`.

- [ ] **Step 3: Add `FINES` safe-user capability and navigation item**

Extend `requiredCapability` with `FINES`; project it only for superadmin/company admin/dispatcher based on server access. Add `FiCreditCard` or `FiAlertCircle` icon and `/fines` item near «Аренда».

- [ ] **Step 4: Implement the workspace from Pilot+ primitives**

Use existing `PageHeader`, `Card`, `Button`, `Badge`, `Input`, `Select`, `Modal`, loading skeleton and system-state components. KPI cards: new, unpaid, amount, expiring discount, bailiff, unassigned. Tabs: new/unpaid/paid/unassigned. Keep primary/secondary buttons at the same design-system size; at 390 px use one-column cards and no horizontal page overflow.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/shared/components/app-shell src/modules/fines/components src/services/auth && npm run typecheck && npm run lint && git diff --check`

Expected: PASS, with only documented pre-existing warnings.

Commit: `feat(fines): add responsive fines workspace`

---

### Task 6: Isolated E2E and operational documentation

**Files:**

- Create: `tests/fines.spec.ts`
- Create: `tests/fixtures/driver-helper-server.ts`
- Create: `docs/runbooks/driver-helper-fines.md`
- Modify: `docs/PROJECT_GUIDE.md`

**Interfaces:**

- Produces: repeatable fake-provider browser flow and operator runbook.

- [ ] **Step 1: Write E2E scenarios against a local fake provider**

Create uniquely marked companies A/B, roles, vehicles, clients and rentals. Fake the exact `/v1.0/cars`, `/v1.0/fines`, and photo endpoints with pagination and no real credentials. Test admin sync, two fines, automatic rental/client attribution, manual correction, search, photo, dispatcher access, driver denial, cross-company denial and 390 px no-overflow. Cleanup all marked rows in FK order.

- [ ] **Step 2: Document safe configuration and recovery**

Runbook must state: obtain token once without logging response; encrypt/save through admin-only action; rotate the exposed password; diagnose `401`, `402`, timeout and invalid response; disable integration; run `npm run fines:sync`; never paste token into browser/localStorage/source; payment is not implemented.

- [ ] **Step 3: Update project guide**

Mark Driver Helper fines as implemented only after all gates pass. Explain current one-company rollout and per-company token architecture. Do not overwrite unrelated user edits in `docs/PROJECT_GUIDE.md`; merge only the fines section.

- [ ] **Step 4: Run final verification**

Run sequentially:

```powershell
npx prisma format
npx prisma generate
npx prisma validate
npm run test:unit
npm run typecheck
npm run lint
npm run format:check
npm run build
npx playwright test tests/fines.spec.ts --workers=1
git diff --check
```

Expected: all commands PASS; only explicitly documented pre-existing warnings may remain. If an isolated DB or browser runtime is unavailable, report the exact unverified gate and do not claim E2E passed.

- [ ] **Step 5: Commit**

Commit: `test(fines): verify Driver Helper workflow`

---

### Task 7: Controlled live smoke and first company activation

**Files:**

- No source files unless the smoke uncovers a verified contract mismatch; any correction must begin with a RED contract test.
- Runtime-only encrypted database record for the selected company after explicit approval.

**Interfaces:**

- Consumes: production server client and admin-only token action.
- Produces: verified token, car pagination and unpaid-fine read for the first company.

- [ ] **Step 1: Confirm runtime prerequisites without revealing secrets**

Check the target company ID, isolated/local DB migration state and ClamAV/storage dependencies used by photos. Do not print credential environment variables.

- [ ] **Step 2: Obtain and store the bearer token securely**

Only after explicit user approval, send the supplied username/password once to `/v1.0/user/bearer-token`, capture the token without stdout, store it through the encrypted admin configuration path, then instruct the user to rotate the password. Never commit `.env` or token output.

- [ ] **Step 3: Perform read-only smoke**

Call token test if supported, fetch page 1 of cars and unpaid fines, report only status and counts, and verify local sync links expected vehicles by STS/plate. Do not create/update/delete provider cars and do not call invoice endpoints.

- [ ] **Step 4: Record safe evidence**

Document timestamp, company ID, endpoint names, status codes and counts only. If the provider schema differs, add sanitized fixtures and RED tests before changing parsers.

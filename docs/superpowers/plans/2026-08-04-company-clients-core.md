# Pilot+ Company Clients Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать защищённую общую базу клиентов каждой компании с карточной сеткой, созданием, редактированием, поиском и точным RBAC.

**Architecture:** Новый доменный модуль `clients` использует server-only access policy и Prisma-запросы, которые всегда ограничены разрешёнными `companyId`. Чувствительные номера шифруются AES-256-GCM, а точный поиск использует HMAC blind indexes. App Router остаётся серверным, интерактивными клиентскими островами являются только фильтры и формы.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Prisma 6.16, PostgreSQL 17, Zod 4, Tailwind CSS 4, React Icons, Vitest 3, Playwright.

## Global Constraints

- Полностью прочитать `AGENTS.md`, `docs/PROJECT_GUIDE.md` и локальные Next.js guides для forms, server actions, authentication и data security до изменения кода.
- Все пользовательские тексты и комментарии — на русском языке.
- `SUPER_ADMIN` видит все компании; `COMPANY_ADMIN` и `DISPATCHER` изменяют клиентов только своих компаний; `VIEWER` только читает; `DRIVER` не получает клиентские данные.
- Каждое чтение и изменение ограничивается на сервере; скрытая навигация не считается авторизацией.
- Паспорт и водительское удостоверение не хранятся открытым текстом и не попадают в audit changes или логи.
- Не добавлять новую npm-зависимость без необходимости; криптография использует `node:crypto`, формы — установленный Zod.
- Любое изменение Prisma schema сопровождается аддитивной SQL-миграцией, `prisma format`, `prisma generate` и schema-тестом.
- Все маршруты с серверными данными получают loading skeleton той же геометрии, empty/error/forbidden states и mobile 390 px без overflow.
- Существующие пользовательские изменения и локальные логи не изменять и не добавлять в Git.

---

### Task 1: Добавить клиентские permissions и server-only access policy

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260804170000_add_client_permissions/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`
- Modify: `src/modules/admin/access/permissions.ts`
- Modify: `src/modules/admin/access/permissions.test.ts`
- Create: `src/modules/clients/access.ts`
- Create: `src/modules/clients/access.test.ts`

**Interfaces:**

- Consumes: `SafeUser`, `CompanyMember`, `CompanyRole`, `additionalPermissions`.
- Produces: `ClientPermission = 'VIEW_CLIENTS' | 'MANAGE_CLIENTS'`; `getClientAccess()`; `requireClientAccess(permission)`.

- [ ] **Step 1: Написать падающие permission/schema tests**

```ts
expect(schema).toContain('VIEW_CLIENTS');
expect(schema).toContain('MANAGE_CLIENTS');
expect(hasCompanyPermission('DISPATCHER', [], 'MANAGE_CLIENTS')).toBe(true);
expect(hasCompanyPermission('VIEWER', [], 'VIEW_CLIENTS')).toBe(true);
expect(hasCompanyPermission('DRIVER', [], 'VIEW_CLIENTS')).toBe(false);
```

- [ ] **Step 2: Подтвердить RED**

Run: `npx vitest run src/database/prisma/schema.test.ts src/modules/admin/access/permissions.test.ts`
Expected: FAIL на отсутствующих enum values.

- [ ] **Step 3: Добавить enum values и миграцию**

```prisma
enum CompanyPermission {
  // существующие значения
  VIEW_CLIENTS
  MANAGE_CLIENTS
}
```

SQL миграции:

```sql
ALTER TYPE "CompanyPermission" ADD VALUE IF NOT EXISTS 'VIEW_CLIENTS';
ALTER TYPE "CompanyPermission" ADD VALUE IF NOT EXISTS 'MANAGE_CLIENTS';
```

Role defaults: `COMPANY_ADMIN` получает оба через `allCompanyPermissions`, `DISPATCHER` — оба,
`VIEWER` — только `VIEW_CLIENTS`, `DRIVER` — ни одного.

- [ ] **Step 4: Написать access tests для SYSTEM/COMPANY/DENIED**

```ts
expect(await getClientAccess('VIEW_CLIENTS')).toEqual({ scope: 'SYSTEM', companyIds: [] });
expect(await getClientAccess('MANAGE_CLIENTS')).toEqual({ scope: 'COMPANY', companyIds: ['c1'] });
expect(await getClientAccess('VIEW_CLIENTS')).toBeNull(); // DRIVER
```

- [ ] **Step 5: Реализовать access contract**

```ts
export interface ClientAccess {
  user: SafeUser;
  scope: 'SYSTEM' | 'COMPANY';
  companyIds: readonly string[];
  canManage: boolean;
}

export async function getClientAccess(
  permission: 'VIEW_CLIENTS' | 'MANAGE_CLIENTS',
): Promise<ClientAccess | null>;
```

Для `SUPER_ADMIN` возвращать SYSTEM. Для MEMBER выбирать только memberships, где роль или grants
дают permission. Не принимать `companyId` из формы как доказательство доступа.

- [ ] **Step 6: Форматировать и проверить**

Run: `npx prisma format && npx prisma generate && npx vitest run src/database/prisma/schema.test.ts src/modules/admin/access/permissions.test.ts src/modules/clients/access.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/database/prisma src/modules/admin/access src/modules/clients/access.ts src/modules/clients/access.test.ts
git commit -m "feat: add client access policy"
```

### Task 2: Добавить Client schema, шифрование и blind indexes

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260804171000_add_company_clients/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`
- Create: `src/services/security/field-encryption.ts`
- Create: `src/services/security/field-encryption.test.ts`
- Create: `src/modules/clients/types.ts`
- Create: `src/modules/clients/validation.ts`
- Create: `src/modules/clients/validation.test.ts`
- Modify: `.env.example`

**Interfaces:**

- Consumes: base64 `CLIENT_DATA_ENCRYPTION_KEY` (32 bytes) and `CLIENT_SEARCH_KEY`.
- Produces: `encryptField`, `decryptField`, `blindIndex`; `ClientInput`; Prisma `Client`.

- [ ] **Step 1: Написать RED crypto/validation/schema tests**

```ts
const encrypted = encryptField('4510 123456', key);
expect(encrypted).not.toContain('123456');
expect(decryptField(encrypted, key)).toBe('4510 123456');
expect(blindIndex(' +7 (999) 123-45-67 ', searchKey)).toBe(blindIndex('79991234567', searchKey));
expect(parseClientInput(validFormData).ok).toBe(true);
```

- [ ] **Step 2: Подтвердить RED**

Run: `npx vitest run src/services/security/field-encryption.test.ts src/modules/clients/validation.test.ts src/database/prisma/schema.test.ts`
Expected: FAIL на отсутствующих contracts.

- [ ] **Step 3: Добавить модель**

```prisma
enum ClientStatus { DRAFT NEW VERIFYING VERIFIED REGULAR BLOCKED ARCHIVED }

model Client {
  id                    String       @id @default(cuid())
  companyId             String
  company               Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  firstName             String
  middleName            String?
  lastName              String
  birthDate             DateTime?
  gender                String?
  phoneEncrypted        String
  phoneIndex            String
  additionalPhoneEncrypted String?
  email                 String?
  telegramUsername      String?
  telegramUserId        String?
  maxUserId             String?
  photoPath             String?
  registrationAddressEncrypted String?
  actualAddressEncrypted String?
  passportEncrypted     String?
  passportIndex         String?
  driverLicenseEncrypted String?
  driverLicenseIndex    String?
  driverCategories      String[]
  driverLicenseIssuedAt DateTime?
  driverLicenseExpiresAt DateTime?
  drivingSince          DateTime?
  emergencyContactEncrypted String?
  source                String?
  note                  String?
  status                ClientStatus @default(NEW)
  createdByUserId       String
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  archivedAt            DateTime?

  @@unique([companyId, phoneIndex])
  @@index([companyId, status, updatedAt])
  @@index([companyId, lastName, firstName])
}
```

Добавить relations в `Company` и `User`; SQL должен быть add-only.

- [ ] **Step 4: Реализовать AES-256-GCM/HMAC**

Payload хранить версионированно: `v1.<iv base64url>.<tag base64url>.<ciphertext base64url>`.
`blindIndex()` нормализует строку по доменному normalizer и возвращает HMAC-SHA256 hex.
Ошибка/отсутствие ключа должна останавливать доступ к sensitive fields, а не возвращать plaintext.

- [ ] **Step 5: Реализовать Zod parser**

```ts
export type ClientInput = {
  companyId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  birthDate: Date | null;
  phone: string;
  email: string | null;
  passport: string | null;
  driverLicense: string | null;
  status: ClientStatus;
};
```

Проверять телефон, email, реальные даты, срок прав после даты выдачи и обязательность ФИО.

- [ ] **Step 6: Проверить миграцию и tests**

Run: `npx prisma format && npx prisma generate && npx vitest run src/services/security/field-encryption.test.ts src/modules/clients/validation.test.ts src/database/prisma/schema.test.ts && npm run typecheck`
Expected: PASS; plaintext passport отсутствует в schema/test snapshots.

- [ ] **Step 7: Commit**

```powershell
git add src/database/prisma src/services/security src/modules/clients/types.ts src/modules/clients/validation* .env.example
git commit -m "feat: add encrypted company clients"
```

### Task 3: Реализовать tenant-scoped queries и mutations

**Files:**

- Create: `src/modules/clients/server/queries.ts`
- Create: `src/modules/clients/server/queries.test.ts`
- Create: `src/modules/clients/actions.ts`
- Create: `src/modules/clients/actions.test.ts`
- Modify: `src/modules/admin/audit/types.ts`
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260804172000_add_client_audit_type/migration.sql`

**Interfaces:**

- Produces: `getClients(access, filters)`, `getClientById(access, id)`, `createClientAction`, `updateClientAction`, `archiveClientAction`.

- [ ] **Step 1: Написать query tests**

```ts
expect(repository.findMany).toHaveBeenCalledWith(
  expect.objectContaining({
    where: { companyId: { in: ['c1'] }, archivedAt: null },
  }),
);
expect(result.items[0].passportMasked).toBe('45•• •••456');
expect(result.items[0]).not.toHaveProperty('passportEncrypted');
```

- [ ] **Step 2: Подтвердить RED и реализовать whitelist DTO**

Run: `npx vitest run src/modules/clients/server/queries.test.ts`
Expected: FAIL; затем реализовать `ClientCardDto` и `ClientDetailDto`, дешифруя только detail fields.

- [ ] **Step 3: Написать mutation tests**

Проверить: диспетчер создаёт в `c1`; попытка передать `c2` отклоняется; viewer/driver отклоняются;
duplicate phone даёт русскую ошибку; audit не содержит plaintext passport; dispatcher не архивирует.

- [ ] **Step 4: Реализовать mutations с optimistic guards**

```ts
await prisma.client.updateMany({
  where: { id, companyId: { in: access.companyIds }, updatedAt: expectedUpdatedAt },
  data: encryptedUpdate,
});
```

Каждый success пишет `AuditEntityType.CLIENT`, revalidate `/clients` и `/clients/[id]`.

- [ ] **Step 5: Проверить**

Run: `npx vitest run src/modules/clients/server/queries.test.ts src/modules/clients/actions.test.ts src/modules/admin/audit && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/clients src/modules/admin/audit src/database/prisma
git commit -m "feat: add tenant scoped client operations"
```

### Task 4: Добавить карточный UI, детальную страницу и формы

**Files:**

- Create: `src/app/(protected)/clients/page.tsx`
- Create: `src/app/(protected)/clients/loading.tsx`
- Create: `src/app/(protected)/clients/error.tsx`
- Create: `src/app/(protected)/clients/[id]/page.tsx`
- Create: `src/app/(protected)/clients/[id]/loading.tsx`
- Create: `src/app/(protected)/clients/[id]/not-found.tsx`
- Create: `src/modules/clients/components/ClientPage.tsx`
- Create: `src/modules/clients/components/ClientGrid.tsx`
- Create: `src/modules/clients/components/ClientCard.tsx`
- Create: `src/modules/clients/components/ClientPhoto.tsx`
- Create: `src/modules/clients/components/ClientPlaceholder.tsx`
- Create: `src/modules/clients/components/ClientFilters.tsx`
- Create: `src/modules/clients/components/ClientForm.tsx`
- Create: `src/modules/clients/components/ClientDetailPage.tsx`
- Create tests beside each production component.
- Modify: `src/shared/components/app-shell/navigation.ts`
- Modify: `src/shared/components/app-shell/Sidebar.tsx`
- Modify: `src/shared/components/app-shell/Sidebar.test.ts`

**Interfaces:**

- Consumes: Task 3 DTO/actions.
- Produces: `/clients`, `/clients/[id]`, role-filtered navigation and accessible client cards.

- [ ] **Step 1: Написать component/navigation RED tests**

```tsx
expect(screen.getByRole('heading', { name: 'Анна Воронова' })).toBeTruthy();
expect(screen.getByTestId('client-photo')).toHaveAttribute('data-source', 'placeholder');
expect(screen.getByRole('link', { name: 'Написать в Telegram' })).toHaveAttribute(
  'href',
  'https://t.me/anna',
);
expect(screen.queryByText('Клиенты')).toBeNull(); // DRIVER sidebar
```

- [ ] **Step 2: Реализовать navigation policy**

Расширить `NavigationItem` до `requiredCapability?: 'CLIENTS'`; фильтровать по безопасному capability,
полученному в protected layout. Не запрашивать memberships из client component.

- [ ] **Step 3: Реализовать карточную сетку**

Карточка — `grid grid-cols-[5.5rem_minmax(0,1fr)]`; фото слева, content справа. Приоритет:
local photo → confirmed messenger avatar → локальный React SVG placeholder. 3–4/2/1 колонки по
breakpoints; touch targets 44 px; внешние мессенджеры открываются безопасными links.

- [ ] **Step 4: Реализовать URL-backed filters и pagination**

Точные params: `q`, `status`, `documents`, `license`, `page`. Невалидные значения нормализуются на
сервере. Фильтр не удаляет посторонние query params.

- [ ] **Step 5: Реализовать пошаговую форму и detail**

Шаги: контакты → документы-данные → будущие файлы placeholder disabled → review. После шага 1
можно сохранить `DRAFT`. Detail показывает Overview и честные вкладки только для реализованных
данных. Success toast и redirect выполняются после server success; error сохраняет values.

- [ ] **Step 6: Loading/error/mobile tests**

Run: `npx vitest run src/modules/clients src/shared/components/app-shell/Sidebar.test.ts && npm run typecheck`
Expected: PASS; skeleton повторяет карточную сетку.

- [ ] **Step 7: Commit**

```powershell
git add "src/app/(protected)/clients" src/modules/clients/components src/shared/components/app-shell
git commit -m "feat: add company clients workspace"
```

### Task 5: Seed, browser regression и документация

**Files:**

- Modify: `src/database/prisma/seed.ts`
- Create: `src/database/prisma/client-seed.test.ts`
- Create: `tests/clients.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `docs/superpowers/specs/2026-08-04-company-clients-design.md`

- [ ] **Step 1: Добавить идемпотентный demo seed**

Создать 6 клиентов `pilot-demo` с разными статусами, сроками прав, Telegram/MAX fallback и без
реальных персональных данных. Повторный seed сохраняет ровно 6 уникальных phone indexes.

- [ ] **Step 2: Добавить Playwright scenarios**

Проверить SYSTEM и COMPANY list/detail/create/edit, viewer read-only, driver forbidden, cross-tenant
404/forbidden, SVG placeholder, карточную сетку и отсутствие overflow при 390×844.

- [ ] **Step 3: Применить миграции после backup и дважды seed**

Run: `npx prisma migrate deploy && npm run db:seed && npm run db:seed`
Expected: миграции применены; demo clients не дублируются.

- [ ] **Step 4: Полная проверка**

Run: `npm run lint && npm run typecheck && npm run test:unit && npx playwright test tests/clients.spec.ts --workers=1 && npm run build && git diff --check`
Expected: exit 0; допустимы только заранее документированные warnings.

- [ ] **Step 5: Обновить guide/spec и commit**

```powershell
git add src/database/prisma tests/clients.spec.ts docs
git commit -m "test: verify tenant client workspace"
```

# Pilot+ Admin Center Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить безопасную основу центра администрирования Pilot+: системного суперадминистратора, расширяемый RBAC-контракт, аудит, защищённый обзор `/admin` и условную навигацию.

**Architecture:** Глобальная роль пользователя отвечает только за системный доступ, а роль и дополнительные разрешения членства — за действия внутри компании. Серверный access-layer вычисляет область доступа и не передаёт клиенту tenant-данные; `/admin` получает агрегаты через отдельный server query. Аудит хранится в PostgreSQL и вызывается через один server-only writer, пригодный для последующих административных действий.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Prisma 6.16, PostgreSQL 17, Tailwind CSS 4, Vitest 3, Playwright.

## Global Constraints

- Перед изменением Next.js-кода прочитать `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` и `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`.
- Все пользовательские тексты и комментарии в коде — на русском языке.
- Павел Седов получает системную роль `SUPER_ADMIN`; остальные пользователи не получают её через членство компании.
- Права проверяются на сервере до чтения или изменения данных; скрытая кнопка не является защитой.
- На первом этапе не создавать пустые маршруты компаний, пользователей, ролей, автомобилей, документов и устройств.
- Не добавлять новые npm-зависимости.
- Каждая Prisma-схема сопровождается SQL-миграцией, `prisma format`, `prisma generate` и schema-тестом.
- Каждый новый route с серверными данными получает `loading.tsx`, `error.tsx` и безопасное forbidden-состояние.
- UI использует production-компоненты `/ui-kit`, семантические токены и touch target не меньше 44×44 px.
- Не логировать пароли, session tokens, секреты устройств, содержимое документов и значения `.env`.
- Существующие `debug.log`, `dev-server.err.log` и `dev-server.out.log` не добавлять в Git и не удалять.

---

### Task 1: Добавить RBAC- и audit-модели в Prisma

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260804090000_add_admin_center_foundation/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`
- Modify: `src/database/prisma/seed.ts`
- Modify: `src/database/prisma/seed.test.ts`
- Modify: `src/database/prisma/fleet-seed.test.ts`
- Generated: `src/database/generated/prisma/**`

**Interfaces:**

- Consumes: существующие `User`, `Company`, `CompanyMember` и идемпотентный seed администратора.
- Produces: Prisma enums `UserRole`, `CompanyRole`, `CompanyPermission`, `AuditAction`, `AuditEntityType`; модель `AuditLog`; `CompanyMember.additionalPermissions`.

- [ ] **Step 1: Зафиксировать новую схему падающим тестом**

В `src/database/prisma/schema.test.ts` добавить проверки:

```ts
expect(schema).toContain('SUPER_ADMIN');
expect(schema).toContain('MEMBER');
expect(schema).toContain('COMPANY_ADMIN');
expect(schema).toContain('additionalPermissions CompanyPermission[]');
expect(schema).toContain('model AuditLog {');
expect(schema).toContain('actorEmailSnapshot String');
expect(schema).toContain('@@index([companyId, createdAt])');
```

В `seed.test.ts` и `fleet-seed.test.ts` изменить ожидания старых `ADMIN` на:

```ts
expect(userUpsert.create.role).toBe('SUPER_ADMIN');
expect(memberUpsert.create.role).toBe('COMPANY_ADMIN');
```

- [ ] **Step 2: Запустить тесты и подтвердить RED**

Run:

```powershell
npx vitest run src/database/prisma/schema.test.ts src/database/prisma/seed.test.ts src/database/prisma/fleet-seed.test.ts
```

Expected: FAIL на отсутствующих enum/model и старом значении `ADMIN`.

- [ ] **Step 3: Обновить Prisma schema**

Использовать точные enum-контракты:

```prisma
enum UserRole {
  SUPER_ADMIN
  MEMBER
}

enum CompanyRole {
  COMPANY_ADMIN
  DISPATCHER
  DRIVER
  VIEWER
}

enum CompanyPermission {
  MANAGE_USERS
  MANAGE_ROLES
  MANAGE_VEHICLES
  MANAGE_DEVICES
  MANAGE_DOCUMENTS
  MANAGE_MAINTENANCE
  MANAGE_WASH
  VIEW_REPORTS
  VIEW_AUDIT
}

enum AuditAction {
  CREATE
  UPDATE
  ASSIGN
  BLOCK
  ARCHIVE
  DELETE
}

enum AuditEntityType {
  COMPANY
  USER
  ROLE
  VEHICLE
  DEVICE
  DOCUMENT
  SYSTEM
}
```

Изменить модели:

```prisma
model User {
  // существующие поля сохраняются
  role      UserRole  @default(MEMBER)
  auditLogs AuditLog[]
}

model Company {
  // существующие поля сохраняются
  auditLogs AuditLog[]
}

model CompanyMember {
  // существующие поля сохраняются
  role                  CompanyRole        @default(VIEWER)
  additionalPermissions CompanyPermission[] @default([])
}

model AuditLog {
  id                 String          @id @default(cuid())
  companyId          String?
  company            Company?        @relation(fields: [companyId], references: [id], onDelete: SetNull)
  actorUserId         String?
  actorUser           User?           @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  actorEmailSnapshot  String
  action              AuditAction
  entityType          AuditEntityType
  entityId            String?
  entityLabel         String?
  changes             Json?
  createdAt           DateTime         @default(now())

  @@index([companyId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([entityType, entityId, createdAt])
}
```

- [ ] **Step 4: Создать аддитивную миграцию с безопасным переносом `ADMIN`**

В SQL создать новые enum-типы, временно снять defaults, преобразовать существующие значения
`User.role: ADMIN → SUPER_ADMIN` и `CompanyMember.role: ADMIN → COMPANY_ADMIN`, затем заменить старые
enum-типы. Создать `CompanyPermission`, `AuditAction`, `AuditEntityType`, колонку
`additionalPermissions` с пустым массивом по умолчанию, таблицу `AuditLog`, foreign keys `SET NULL`
и три индекса из schema.

Миграция не удаляет пользователей, членства или доменные записи. Rollback выполняется возвратом к
предыдущей версии приложения без удаления новых таблиц и enum-значений.

- [ ] **Step 5: Обновить seed до системного суперадминистратора**

В `seed.ts` использовать:

```ts
create: { email, name, passwordHash, role: 'SUPER_ADMIN', isActive: true },
update: { name, passwordHash, role: 'SUPER_ADMIN', isActive: true },
```

Членство demo-компании создаётся как:

```ts
create: {
  companyId: company.id,
  userId: adminUserId,
  role: 'COMPANY_ADMIN',
  additionalPermissions: [],
},
update: { role: 'COMPANY_ADMIN' },
```

- [ ] **Step 6: Форматировать и сгенерировать Prisma client**

Run:

```powershell
npx prisma format
npx prisma generate
```

Expected: обе команды exit 0; generated client содержит новые enums и `AuditLog`.

- [ ] **Step 7: Запустить focused tests**

Run:

```powershell
npx vitest run src/database/prisma/schema.test.ts src/database/prisma/seed.test.ts src/database/prisma/fleet-seed.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/database/prisma/schema.prisma src/database/prisma/migrations/20260804090000_add_admin_center_foundation src/database/prisma/seed.ts src/database/prisma/schema.test.ts src/database/prisma/seed.test.ts src/database/prisma/fleet-seed.test.ts src/database/generated/prisma
git commit -m "feat: add admin access data model"
```

### Task 2: Реализовать permission policy и серверный access-layer

**Files:**

- Create: `src/modules/admin/access/permissions.ts`
- Create: `src/modules/admin/access/permissions.test.ts`
- Create: `src/modules/admin/access/server.ts`
- Create: `src/modules/admin/access/server.test.ts`
- Create: `src/modules/admin/access/index.ts`
- Modify: `src/modules/auth/types.ts`
- Modify: `src/services/auth/session.ts`
- Modify: `src/services/auth/session.test.ts`
- Modify: `src/modules/auth/dal.ts`
- Modify: `src/modules/auth/actions.ts`
- Modify: `src/modules/auth/actions.test.ts`
- Modify: tenant-role literals in `src/modules/events/**`, `src/modules/devices/**`, `src/modules/maintenance/**`, `src/modules/wash/**`, `src/database/prisma/**` and their tests.

**Interfaces:**

- Consumes: Prisma roles and permissions from Task 1.
- Produces: `resolveCompanyPermissions`, `hasCompanyPermission`, `requireAdminCenterAccess`; `SafeUser.canAccessAdmin`.

- [ ] **Step 1: Написать падающие pure policy tests**

Покрыть точную базовую матрицу:

```ts
expect(resolveCompanyPermissions('COMPANY_ADMIN', [])).toEqual(
  new Set([
    'MANAGE_USERS',
    'MANAGE_ROLES',
    'MANAGE_VEHICLES',
    'MANAGE_DEVICES',
    'MANAGE_DOCUMENTS',
    'MANAGE_MAINTENANCE',
    'MANAGE_WASH',
    'VIEW_REPORTS',
    'VIEW_AUDIT',
  ]),
);
expect(hasCompanyPermission('VIEWER', [], 'MANAGE_VEHICLES')).toBe(false);
expect(hasCompanyPermission('VIEWER', ['MANAGE_VEHICLES'], 'MANAGE_VEHICLES')).toBe(true);
```

Зафиксировать `DISPATCHER`, `DRIVER` и запрет выдачи `SUPER_ADMIN` через company permissions.

- [ ] **Step 2: Запустить policy test и подтвердить RED**

Run: `npx vitest run src/modules/admin/access/permissions.test.ts`

Expected: FAIL с отсутствующим модулем.

- [ ] **Step 3: Реализовать чистую permission policy**

Экспортировать:

```ts
export type CompanyPermissionValue =
  | 'MANAGE_USERS'
  | 'MANAGE_ROLES'
  | 'MANAGE_VEHICLES'
  | 'MANAGE_DEVICES'
  | 'MANAGE_DOCUMENTS'
  | 'MANAGE_MAINTENANCE'
  | 'MANAGE_WASH'
  | 'VIEW_REPORTS'
  | 'VIEW_AUDIT';

export function resolveCompanyPermissions(
  role: CompanyRole,
  additionalPermissions: readonly CompanyPermissionValue[],
): ReadonlySet<CompanyPermissionValue>;

export function hasCompanyPermission(
  role: CompanyRole,
  additionalPermissions: readonly CompanyPermissionValue[],
  permission: CompanyPermissionValue,
): boolean;
```

`COMPANY_ADMIN` получает полный набор. Остальные роли получают минимальный зафиксированный набор,
после чего добавляются только значения `additionalPermissions`.

- [ ] **Step 4: Расширить безопасного пользователя**

`SafeUser` становится:

```ts
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'MEMBER';
  canAccessAdmin: boolean;
}
```

В `getAuthenticatedSession()` загрузить только роли членств:

```ts
include: {
  user: {
    include: {
      memberships: { select: { role: true } },
    },
  },
},
```

`canAccessAdmin` равно `true` для `SUPER_ADMIN` или при наличии `COMPANY_ADMIN` membership. Пароли,
permissions и company ids на клиент не передаются.

- [ ] **Step 5: Написать падающие server access tests**

Проверить:

```ts
await expect(requireAdminCenterAccess()).resolves.toEqual({
  user: superAdmin,
  scope: 'SYSTEM',
  companyIds: [],
});
```

Для `COMPANY_ADMIN` ожидать `scope: 'COMPANY'` и только его company ids. Для `MEMBER` без
административного членства ожидать `null` от `getAdminCenterAccess()`; функция `require...` не должна
раскрывать данные.

- [ ] **Step 6: Реализовать server access API**

```ts
export interface AdminCenterAccess {
  user: SafeUser;
  scope: 'SYSTEM' | 'COMPANY';
  companyIds: readonly string[];
}

export async function getAdminCenterAccess(): Promise<AdminCenterAccess | null>;
export async function requireAdminCenterAccess(): Promise<AdminCenterAccess>;
```

`SUPER_ADMIN` возвращает системную область без списка tenant ids. Для company admin Prisma-запрос
выбирает только membership с `role: 'COMPANY_ADMIN'`. `requireAdminCenterAccess()` бросает закрытую
ошибку `AdminAccessDeniedError`, которую `/admin` переводит в `ForbiddenState`.

- [ ] **Step 7: Перевести legacy role literals**

Все Prisma-фильтры `CompanyMember.role: 'ADMIN'` заменить на `'COMPANY_ADMIN'`. Все тестовые
`SafeUser` дополнить `canAccessAdmin`, а `role: 'ADMIN'` заменить на `SUPER_ADMIN` либо `MEMBER` по
сценарию. `requireAdmin()` временно остаётся compatibility helper существующих защищённых маршрутов,
но принимает только активную сессию; создание новых пользователей появится в отдельном этапе и до
полного permission-аудита не включается.

- [ ] **Step 8: Запустить auth/access regression**

Run:

```powershell
npx vitest run src/modules/admin/access src/services/auth/session.test.ts src/modules/auth
npm run typecheck
```

Expected: PASS; клиентский `SafeUser` не содержит company ids или permission array.

- [ ] **Step 9: Commit**

```powershell
git add src/modules/admin/access src/modules/auth src/services/auth/session.ts src/services/auth/session.test.ts src/modules/events src/modules/devices src/modules/maintenance src/modules/wash src/database/prisma
git commit -m "feat: add server admin access policy"
```

### Task 3: Добавить безопасный audit writer и scoped reader

**Files:**

- Create: `src/modules/admin/audit/types.ts`
- Create: `src/modules/admin/audit/write-audit-log.ts`
- Create: `src/modules/admin/audit/write-audit-log.test.ts`
- Create: `src/modules/admin/audit/get-audit-log.ts`
- Create: `src/modules/admin/audit/get-audit-log.test.ts`
- Create: `src/modules/admin/audit/index.ts`

**Interfaces:**

- Consumes: `AdminCenterAccess` из Task 2 и Prisma `AuditLog` из Task 1.
- Produces: `writeAuditLog(input)`, `getRecentAuditLog(access, limit)` и serializable `AuditLogItem`.

- [ ] **Step 1: Написать тесты redaction и tenant scope**

Проверить, что writer принимает только безопасный payload:

```ts
await writeAuditLog({
  actor: { id: 'user-1', email: 'admin@example.com' },
  companyId: 'company-1',
  action: 'UPDATE',
  entityType: 'VEHICLE',
  entityId: 'vehicle-1',
  entityLabel: 'А 123 МР 77',
  changes: { status: { from: 'IDLE', to: 'MOVING' } },
});
```

`changes` с ключами `password`, `passwordHash`, `token`, `tokenHash`, `secret`, `content`, `env`
должны быть отклонены до Prisma write. Reader для company scope всегда добавляет
`where.companyId.in = access.companyIds`; system scope не добавляет tenant filter.

- [ ] **Step 2: Подтвердить RED**

Run: `npx vitest run src/modules/admin/audit`

Expected: FAIL с отсутствующими модулями.

- [ ] **Step 3: Реализовать типы и writer**

```ts
export interface WriteAuditLogInput {
  actor: { id: string; email: string };
  companyId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel?: string;
  changes?: Readonly<Record<string, unknown>>;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void>;
```

Writer помечается `server-only`, проверяет имена ключей рекурсивно, ограничивает сериализованный
`changes` 16 KiB и записывает `actorEmailSnapshot`. Ошибки не включают исходный payload.

- [ ] **Step 4: Реализовать scoped reader**

```ts
export interface AuditLogItem {
  id: string;
  actorLabel: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityLabel: string | null;
  companyLabel: string | null;
  createdAt: string;
}

export async function getRecentAuditLog(
  access: AdminCenterAccess,
  limit = 8,
): Promise<readonly AuditLogItem[]>;
```

Ограничить `limit` диапазоном 1–50, сортировать `createdAt: desc`, выбирать только поля DTO.

- [ ] **Step 5: Запустить audit tests**

Run:

```powershell
npx vitest run src/modules/admin/audit
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/admin/audit
git commit -m "feat: add tenant scoped audit log"
```

### Task 4: Создать рабочий обзор `/admin`

**Files:**

- Create: `src/modules/admin/overview/types.ts`
- Create: `src/modules/admin/overview/get-admin-overview.ts`
- Create: `src/modules/admin/overview/get-admin-overview.test.ts`
- Create: `src/modules/admin/overview/AdminOverviewPage.tsx`
- Create: `src/modules/admin/overview/AdminOverviewPage.test.tsx`
- Create: `src/modules/admin/overview/index.ts`
- Create: `src/app/(protected)/admin/page.tsx`
- Create: `src/app/(protected)/admin/page.test.tsx`
- Create: `src/app/(protected)/admin/loading.tsx`
- Create: `src/app/(protected)/admin/error.tsx`
- Create: `tests/admin.spec.ts`

**Interfaces:**

- Consumes: `requireAdminCenterAccess`, `getRecentAuditLog`, `PageHeader`, `Card`, `Badge`, `Skeleton`, `ForbiddenState`, `AppShell`.
- Produces: защищённый responsive route `/admin` с реальными агрегатами и существующими быстрыми действиями.

- [ ] **Step 1: Написать query tests для system и company scope**

Ожидаемый DTO:

```ts
export interface AdminOverview {
  scope: 'SYSTEM' | 'COMPANY';
  companies: number;
  users: number;
  vehicles: number;
  devices: number;
  recentAudit: readonly AuditLogItem[];
}
```

Для system scope использовать глобальные counts. Для company scope каждый count получает tenant
filter через `companyIds`; users считаются по distinct membership user ids.

- [ ] **Step 2: Запустить query test и подтвердить RED**

Run: `npx vitest run src/modules/admin/overview/get-admin-overview.test.ts`

Expected: FAIL с отсутствующим модулем.

- [ ] **Step 3: Реализовать `getAdminOverview`**

```ts
export async function getAdminOverview(access: AdminCenterAccess): Promise<AdminOverview>;
```

Запустить независимые counts и audit reader через `Promise.all`. Не загружать строки автомобилей,
пользователей или устройств для вычисления количества.

- [ ] **Step 4: Написать component и route tests**

Проверить русские heading/labels, четыре KPI, scope badge, аудит/empty state и три реальные ссылки:

```ts
expect(screen.getByRole('heading', { name: 'Центр управления' })).toBeVisible();
expect(screen.getByText('Компании')).toBeVisible();
expect(screen.getByRole('link', { name: 'Открыть автопарк' })).toHaveAttribute('href', '/vehicles');
expect(screen.getByRole('link', { name: 'Открыть устройства' })).toHaveAttribute(
  'href',
  '/devices',
);
expect(screen.getByRole('link', { name: 'Проверить систему' })).toHaveAttribute('href', '/system');
```

Route test подтверждает, что access проверяется до query. Denied access рендерит `ForbiddenState`
внутри `AppShell` и не вызывает `getAdminOverview`.

- [ ] **Step 5: Реализовать страницу**

`AdminOverviewPage` использует `PageHeader`, четыре KPI-card, блок «Быстрые действия» только с уже
существующими маршрутами и «Последние действия». Не показывать кнопки создания компаний,
пользователей или документов до соответствующих этапов.

`page.tsx`:

```tsx
export default async function AdminPage() {
  const access = await getAdminCenterAccess();

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Администрирование' }]}>
      {access ? (
        <AdminOverviewPage overview={await getAdminOverview(access)} />
      ) : (
        <ForbiddenState />
      )}
    </AppShell>
  );
}
```

- [ ] **Step 6: Добавить loading и error**

`loading.tsx` сохраняет `AppShell`, PageHeader-геометрию, четыре KPI, быстрые действия и аудит.
`error.tsx` использует существующий защищённый error pattern, безопасный reference code и retry.

- [ ] **Step 7: Добавить browser tests**

В `tests/admin.spec.ts` проверить desktop 1440×900 и mobile 390×844:

- heading и реальные counts;
- отсутствие горизонтального overflow;
- ссылки существующих быстрых действий;
- отсутствие неработающих «Добавить компанию/пользователя»;
- forbidden state для подготовленного MEMBER без company-admin membership;
- skeleton route geometry через контролируемую test seam без fixed sleep.

- [ ] **Step 8: Запустить focused tests**

Run:

```powershell
npx vitest run src/modules/admin/overview 'src/app/(protected)/admin/page.test.tsx'
npx playwright test tests/admin.spec.ts --workers=1
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add src/modules/admin/overview 'src/app/(protected)/admin' tests/admin.spec.ts
git commit -m "feat: add admin center overview"
```

### Task 5: Подключить условную навигацию desktop и mobile

**Files:**

- Modify: `src/shared/components/app-shell/navigation.ts`
- Modify: `src/shared/components/app-shell/Sidebar.tsx`
- Modify: `src/shared/components/app-shell/Sidebar.test.ts`
- Modify: `src/shared/components/app-shell/MobileNavigation.tsx`
- Modify: `src/shared/components/app-shell/Header.test.tsx`
- Modify: `src/app/(protected)/layout.test.ts`
- Modify: `tests/admin.spec.ts`

**Interfaces:**

- Consumes: `SafeUser.canAccessAdmin` из Task 2 и `/admin` из Task 4.
- Produces: один и тот же разрешённый пункт «Администрирование» в desktop sidebar и mobile drawer.

- [ ] **Step 1: Написать падающие navigation tests**

Проверить:

```ts
expect(renderSidebar({ canAccessAdmin: true })).toContain('href="/admin"');
expect(renderSidebar({ canAccessAdmin: false })).not.toContain('href="/admin"');
```

Добавить проверку `aria-current="page"` для `/admin` и открытие ссылки в mobile drawer.

- [ ] **Step 2: Подтвердить RED**

Run:

```powershell
npx vitest run src/shared/components/app-shell/Sidebar.test.ts src/shared/components/app-shell/Header.test.tsx 'src/app/(protected)/layout.test.ts'
```

Expected: FAIL на отсутствующей административной ссылке.

- [ ] **Step 3: Добавить метаданные доступа к navigation item**

```ts
export interface NavigationItem {
  label: string;
  href: string;
  icon: IconType;
  adminOnly?: boolean;
}
```

Добавить `{ label: 'Администрирование', href: '/admin', icon: FiSettings, adminOnly: true }` перед
«Состояние системы». В Sidebar вычислять:

```ts
const visibleNavigation = navigation.filter((item) => !item.adminOnly || user.canAccessAdmin);
```

MobileNavigation продолжает использовать тот же Sidebar и не содержит второй копии условий.

- [ ] **Step 4: Запустить shell и browser tests**

Run:

```powershell
npx vitest run src/shared/components/app-shell 'src/app/(protected)/layout.test.ts'
npx playwright test tests/admin.spec.ts --workers=1
npm run typecheck
```

Expected: PASS на desktop и mobile.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/components/app-shell 'src/app/(protected)/layout.test.ts' tests/admin.spec.ts
git commit -m "feat: expose permission aware admin navigation"
```

### Task 6: Зафиксировать контракт в UI-kit, документации и полной регрессии

**Files:**

- Modify: `src/app/(protected)/ui-kit/sections.tsx`
- Modify: `tests/ui-kit.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `docs/superpowers/specs/2026-08-04-admin-center-design.md`

**Interfaces:**

- Consumes: production admin overview primitives, role/permission presentation и navigation state.
- Produces: актуальный исполняемый контракт `/ui-kit` и handoff-документацию.

- [ ] **Step 1: Написать падающий UI-kit browser test**

Проверить наличие секции:

```ts
await expect(page.getByRole('heading', { name: 'Административный доступ' })).toBeVisible();
await expect(page.getByText('Суперадминистратор')).toBeVisible();
await expect(page.getByText('Администратор компании')).toBeVisible();
```

- [ ] **Step 2: Подтвердить RED**

Run: `npx playwright test tests/ui-kit.spec.ts --workers=1`

Expected: FAIL на новой секции.

- [ ] **Step 3: Обновить UI-kit production-контрактом**

Добавить компактную секцию, которая использует существующие `Card`, `Badge`, `Avatar`, `PageHeader`
и реальные русские названия ролей. Не копировать классы `/admin` и не создавать интерактивные формы
ролей до этапа пользователей.

- [ ] **Step 4: Обновить guide и статус spec**

В `PROJECT_GUIDE.md` добавить фактически реализованные:

- системный `SUPER_ADMIN`;
- company roles и дополнительные permissions;
- `/admin` и условную навигацию;
- tenant-scoped `AuditLog` foundation;
- честное ограничение: компании, пользователи и назначения прав ещё не редактируются в UI.

В spec изменить статус первого этапа на «реализован» только после всех проверок.

- [ ] **Step 5: Применить миграцию и seed в локальной инфраструктуре**

Перед записью создать резервную копию development DB или подтвердить, что база воспроизводима seed.

Run:

```powershell
npx prisma migrate deploy
npm run db:seed
```

Expected: миграция применена; пользователь из `PILOT_ADMIN_EMAIL` имеет `SUPER_ADMIN`, demo membership
имеет `COMPANY_ADMIN`; повторный seed не создаёт дубликаты.

- [ ] **Step 6: Выполнить статические проверки**

Run:

```powershell
npx prettier --check src/modules/admin 'src/app/(protected)/admin' src/modules/auth src/services/auth src/shared/components/app-shell src/database/prisma/schema.prisma tests/admin.spec.ts tests/ui-kit.spec.ts docs/PROJECT_GUIDE.md docs/superpowers/specs/2026-08-04-admin-center-design.md
npm run lint
npm run typecheck
git diff --check
```

Expected: exit 0; существующие несвязанные format-проблемы не маскиваются и перечисляются отдельно.

- [ ] **Step 7: Выполнить unit regression**

Run: `npm run test:unit`

Expected: все тесты PASS.

- [ ] **Step 8: Выполнить последовательный browser regression**

Run:

```powershell
npx playwright test tests/auth.spec.ts tests/admin.spec.ts tests/system-states.spec.ts tests/profile.spec.ts tests/system-health.spec.ts tests/dashboard.spec.ts tests/ui-kit.spec.ts tests/vehicles.spec.ts tests/maintenance.spec.ts tests/wash.spec.ts tests/devices.spec.ts --workers=1
```

Expected: PASS, включая credentialed auth и mobile admin navigation.

- [ ] **Step 9: Проверить production build**

Run: `npm run build`

Expected: Next.js production build exit 0. Известный Turbopack NFT warning фиксируется отдельно и не
считается новым дефектом, если import trace не изменился.

- [ ] **Step 10: Визуальная проверка**

Открыть `/admin`, `/`, `/profile` и `/ui-kit` на 1440×900 и 390×844. Подтвердить:

- отсутствие горизонтального overflow;
- единый `PageHeader`, карточки, шрифт и высоты действий;
- административную ссылку только при `canAccessAdmin`;
- рабочий mobile drawer;
- корректное empty state аудита;
- отсутствие неработающих кнопок будущих модулей.

- [ ] **Step 11: Commit**

```powershell
git add src/app/(protected)/ui-kit/sections.tsx tests/ui-kit.spec.ts docs/PROJECT_GUIDE.md docs/superpowers/specs/2026-08-04-admin-center-design.md
git commit -m "docs: establish admin center foundation"
```

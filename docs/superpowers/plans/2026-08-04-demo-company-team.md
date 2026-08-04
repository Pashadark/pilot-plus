# Pilot+ Demo Company and Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить реалистичные реквизиты demo-компании и четыре неактивных профиля корпоративных ролей, затем безопасно показать их в существующем `/admin`.

**Architecture:** Nullable-реквизиты расширяют существующую `Company` без потери данных. Идемпотентный seed создаёт неактивных `MEMBER` и членства, а server-only overview query возвращает только tenant-scoped DTO без password hash и permission arrays. UI использует существующие компоненты Pilot+ и не добавляет CRUD.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Prisma 6.16, PostgreSQL 17, Tailwind CSS 4, Vitest 3, Playwright.

## Global Constraints

- Перед изменением Next.js-кода прочитать `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` и `node_modules/next/dist/docs/01-app/02-guides/authentication.md`.
- Все пользовательские тексты и комментарии в коде — на русском языке.
- Павел Седов сохраняет `SUPER_ADMIN`; demo-профили получают `MEMBER` и `isActive: false`.
- Demo-профили не получают рабочие пароли и не могут войти.
- SYSTEM scope видит demo-компанию; COMPANY scope ограничивается `access.companyIds` до чтения данных.
- DTO не содержит `passwordHash`, additional permissions, session token или значения `.env`.
- Не добавлять формы, приглашения, документы, фотографии, удаление пользователей или новые npm-зависимости.
- Prisma schema сопровождается SQL-миграцией, `prisma format`, `prisma generate` и schema-тестом.
- Seed должен быть идемпотентным и не создавать дубликаты при повторном запуске.
- UI использует production-компоненты `/ui-kit`, семантические токены и touch target не меньше 44×44 px.
- Существующие `debug.log`, `dev-server.err.log` и `dev-server.out.log` не добавлять в Git и не удалять.

---

### Task 1: Расширить Company и добавить идемпотентный demo-team seed

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260804150000_add_demo_company_profile/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`
- Modify: `src/database/prisma/seed.ts`
- Modify: `src/database/prisma/fleet-seed.test.ts`
- Create: `src/database/prisma/demo-team-seed.test.ts`
- Generated: `src/database/generated/prisma/**`

**Interfaces:**

- Consumes: существующую компанию `pilot-demo`, `seedFleet()` и Prisma `User`/`CompanyMember`.
- Produces: реквизиты `Company`; `seedDemoTeam(database, companyId)`; четыре неактивных `MEMBER` с корпоративными ролями.

- [ ] **Step 1: Зафиксировать schema contract падающим тестом**

В `schema.test.ts` добавить точные проверки:

```ts
for (const field of [
  'inn           String?',
  'kpp           String?',
  'ogrn          String?',
  'directorName  String?',
  'legalAddress  String?',
  'actualAddress String?',
  'phone         String?',
  'email         String?',
  'isDemo        Boolean  @default(false)',
]) {
  expect(schema).toContain(field);
}
```

- [ ] **Step 2: Запустить schema test и подтвердить RED**

Run: `npx vitest run src/database/prisma/schema.test.ts`

Expected: FAIL на первом отсутствующем поле `Company`.

- [ ] **Step 3: Добавить поля и аддитивную миграцию**

В `Company` добавить:

```prisma
inn           String?
kpp           String?
ogrn          String?
directorName  String?
legalAddress  String?
actualAddress String?
phone         String?
email         String?
isDemo        Boolean @default(false)
```

Миграция создаёт nullable text columns и `isDemo BOOLEAN NOT NULL DEFAULT false`; существующие строки не удаляются и не получают фиктивные реквизиты.

- [ ] **Step 4: Написать падающие seed tests**

В `fleet-seed.test.ts` ожидать, что upsert `pilot-demo` записывает полные фиксированные реквизиты из spec. В новом `demo-team-seed.test.ts` использовать fake repositories и проверить:

```ts
expect(result).toEqual({ users: 4, memberships: 4 });
expect(userUpserts.map((call) => call.create)).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      email: 'anna.vorontsova@sever-trans.demo',
      name: 'Анна Воронцова',
      role: 'MEMBER',
      isActive: false,
    }),
    expect.objectContaining({ email: 'maksim.orlov@sever-trans.demo' }),
    expect.objectContaining({ email: 'dmitry.sokolov@sever-trans.demo' }),
    expect.objectContaining({ email: 'elena.mironova@sever-trans.demo' }),
  ]),
);
expect(membershipRoles).toEqual([
  'COMPANY_ADMIN',
  'DISPATCHER',
  'DRIVER',
  'VIEWER',
]);
```

Повторный вызов должен оставить четыре уникальных email и четыре уникальных membership key.

- [ ] **Step 5: Запустить seed tests и подтвердить RED**

Run:

```powershell
npx vitest run src/database/prisma/fleet-seed.test.ts src/database/prisma/demo-team-seed.test.ts
```

Expected: FAIL на отсутствующем `seedDemoTeam` и старом company payload.

- [ ] **Step 6: Реализовать фиксированные реквизиты demo-компании**

Вынести exported constant, чтобы тесты и seed использовали один контракт:

```ts
export const demoCompanyData = {
  name: 'ООО «Север Транс Мониторинг»',
  slug: 'pilot-demo',
  inn: '2465357184',
  kpp: '246501001',
  ogrn: '1242400017356',
  directorName: 'Александр Сергеевич Лебедев',
  legalAddress:
    '660049, Красноярский край, г. Красноярск, ул. Карла Маркса, д. 93, офис 412',
  actualAddress:
    '660020, Красноярский край, г. Красноярск, ул. Шахтёров, д. 33, стр. 2',
  phone: '+7 (391) 205-17-40',
  email: 'office@sever-trans.demo',
  isDemo: true,
} as const;
```

`seedFleet()` использует этот объект в `create` и все поля кроме `slug` в `update`.

- [ ] **Step 7: Реализовать demo-team seed**

Добавить точный контракт:

```ts
export async function seedDemoTeam(
  database: DemoTeamSeedDatabase,
  companyId: string,
): Promise<{ users: number; memberships: number }>;
```

Профили определяются readonly-массивом. Один технический hash вычисляется через `hashPassword()` от внутренней случайной строки, созданной `randomBytes(32).toString('hex')`; значение не логируется и не возвращается. Для каждого профиля:

```ts
await database.user.upsert({
  where: { email: profile.email },
  create: {
    email: profile.email,
    name: profile.name,
    passwordHash: technicalPasswordHash,
    role: 'MEMBER',
    isActive: false,
  },
  update: { name: profile.name, role: 'MEMBER', isActive: false },
});
```

Членство создаётся/обновляется с нужной ролью и `additionalPermissions: []`. В `main()` вызвать `seedDemoTeam(prisma, fleet.companyId)` после `seedFleet()` и вывести только количества.

- [ ] **Step 8: Форматировать Prisma и сгенерировать client**

Run:

```powershell
npx prisma format
npx prisma generate
```

Expected: обе команды exit 0; generated client содержит новые поля `Company`.

- [ ] **Step 9: Запустить focused tests и typecheck**

Run:

```powershell
npx vitest run src/database/prisma/schema.test.ts src/database/prisma/fleet-seed.test.ts src/database/prisma/demo-team-seed.test.ts src/database/prisma/seed.test.ts
npm run typecheck
```

Expected: PASS; seed test не проверяет и не выводит исходную техническую строку.

- [ ] **Step 10: Commit**

```powershell
git add src/database/prisma
git commit -m "feat: seed demo company and role profiles"
```

### Task 2: Добавить tenant-scoped company/team DTO в admin overview

**Files:**

- Modify: `src/modules/admin/overview/types.ts`
- Modify: `src/modules/admin/overview/get-admin-overview.ts`
- Modify: `src/modules/admin/overview/get-admin-overview.test.ts`

**Interfaces:**

- Consumes: `AdminCenterAccess` и новые Prisma-поля из Task 1.
- Produces: `AdminCompanyProfile`, `AdminTeamMember`, расширенный `AdminOverview.companyProfiles`.

- [ ] **Step 1: Написать падающие query tests**

Расширить Prisma mock методом `company.findMany` и зафиксировать DTO:

```ts
export interface AdminTeamMember {
  id: string;
  name: string;
  email: string;
  role: 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER' | 'VIEWER';
  isActive: boolean;
}

export interface AdminCompanyProfile {
  id: string;
  name: string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  directorName: string | null;
  legalAddress: string | null;
  actualAddress: string | null;
  phone: string | null;
  email: string | null;
  isDemo: boolean;
  team: readonly AdminTeamMember[];
}
```

SYSTEM query ожидает `where: { isDemo: true }`. COMPANY query ожидает `where: { id: { in: companyIds } }`. В обоих случаях select содержит только company DTO fields и `members` с `user: { select: { id, name, email, isActive } }`; passwordHash и permissions отсутствуют.

- [ ] **Step 2: Запустить query test и подтвердить RED**

Run: `npx vitest run src/modules/admin/overview/get-admin-overview.test.ts`

Expected: FAIL, потому что `companyProfiles` отсутствует.

- [ ] **Step 3: Реализовать DTO mapping и scoped query**

Добавить `getCompanyProfilesWhere(access)`:

```ts
function getCompanyProfilesWhere(access: AdminCenterAccess) {
  return access.scope === 'SYSTEM'
    ? { isDemo: true }
    : { id: { in: [...access.companyIds] } };
}
```

Добавить `prisma.company.findMany()` в существующий `Promise.all`; сортировать company `name: asc`, members `user.name: asc`. Преобразовать Prisma rows в serializable DTO. Не менять существующую count-логику.

- [ ] **Step 4: Запустить focused tests и typecheck**

Run:

```powershell
npx vitest run src/modules/admin/overview/get-admin-overview.test.ts src/modules/admin/access/server.test.ts
npm run typecheck
```

Expected: PASS; system/company DTOs не содержат tenant data вне разрешённого scope.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/admin/overview/types.ts src/modules/admin/overview/get-admin-overview.ts src/modules/admin/overview/get-admin-overview.test.ts
git commit -m "feat: expose scoped company team overview"
```

### Task 3: Показать компанию и команду в `/admin`

**Files:**

- Create: `src/modules/admin/overview/CompanyProfileCard.tsx`
- Create: `src/modules/admin/overview/CompanyProfileCard.test.tsx`
- Create: `src/modules/admin/overview/TeamList.tsx`
- Create: `src/modules/admin/overview/TeamList.test.tsx`
- Modify: `src/modules/admin/overview/AdminOverviewPage.tsx`
- Modify: `src/modules/admin/overview/AdminOverviewPage.test.tsx`
- Modify: `src/modules/admin/overview/index.ts`
- Modify: `src/app/(protected)/admin/loading.tsx`
- Modify: `tests/admin.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `docs/superpowers/specs/2026-08-04-demo-company-team-design.md`

**Interfaces:**

- Consumes: `AdminOverview.companyProfiles` из Task 2, shared `Avatar`, `Badge`, `Card`, `CardContent`, `CardHeader`, `Skeleton`.
- Produces: responsive company/team blocks на `/admin` без интерактивного CRUD.

- [ ] **Step 1: Написать падающие component tests**

Проверить `CompanyProfileCard`:

```ts
expect(screen.getByRole('heading', { name: 'ООО «Север Транс Мониторинг»' })).toBeTruthy();
expect(screen.getByText('Демо')).toBeTruthy();
expect(screen.getByText('2465357184')).toBeTruthy();
expect(screen.getByText('Александр Сергеевич Лебедев')).toBeTruthy();
```

Проверить `TeamList`:

```ts
expect(screen.getByText('Анна Воронцова')).toBeTruthy();
expect(screen.getByText('Администратор компании')).toBeTruthy();
expect(screen.getByText('Диспетчер')).toBeTruthy();
expect(screen.getByText('Водитель')).toBeTruthy();
expect(screen.getByText('Наблюдатель')).toBeTruthy();
expect(screen.getAllByText('Неактивен')).toHaveLength(4);
```

Отдельно проверить empty states «Реквизиты компании пока не заполнены» и «Пользователи пока не добавлены».

- [ ] **Step 2: Запустить component tests и подтвердить RED**

Run:

```powershell
npx vitest run src/modules/admin/overview/CompanyProfileCard.test.tsx src/modules/admin/overview/TeamList.test.tsx
```

Expected: FAIL на отсутствующих компонентах.

- [ ] **Step 3: Реализовать `CompanyProfileCard`**

Использовать семантический `dl`, `Card` и `Badge`. Значения `null` показывать как `Не указано`. Телефон и email выводить текстом, без новых действий. Адреса должны использовать `break-words`, чтобы не создавать mobile overflow.

- [ ] **Step 4: Реализовать `TeamList`**

Добавить локальную точную карту ролей:

```ts
const companyRoleLabel = {
  COMPANY_ADMIN: 'Администратор компании',
  DISPATCHER: 'Диспетчер',
  DRIVER: 'Водитель',
  VIEWER: 'Наблюдатель',
} as const;
```

Каждый list item использует production `Avatar`, name/email, role `Badge` и status `Badge` с текстом `Активен` либо `Неактивен`. Компонент не содержит кнопок.

- [ ] **Step 5: Встроить блоки в `AdminOverviewPage` и loading geometry**

После KPI добавить heading «Компании и команда» и отрисовать каждый `companyProfiles` как grid company/team. Если массив пуст, показать один `Card` с empty state. В `loading.tsx` добавить два skeleton-блока той же геометрии.

- [ ] **Step 6: Запустить page component regression**

Run:

```powershell
npx vitest run src/modules/admin/overview
npm run typecheck
```

Expected: PASS; существующие KPI/audit/quick actions сохранены.

- [ ] **Step 7: Расширить browser test**

В desktop сценарии проверить company heading, ИНН и четыре team items. В mobile 390×844 проверить те же блоки и:

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
```

- [ ] **Step 8: Обновить документацию**

В `PROJECT_GUIDE.md` добавить фактически реализованный demo-company/team seed и отображение `/admin`, явно сохранив ограничение «создание и редактирование ещё недоступны». В spec изменить статус на «реализован» только после успешных проверок.

- [ ] **Step 9: Применить миграцию и seed локально**

Сначала создать backup development DB. Затем:

```powershell
npx prisma migrate deploy
npm run db:seed
npm run db:seed
```

Expected: миграция применена; оба seed запуска выводят `4 профиля, 4 членства`; в базе одна `pilot-demo` company и четыре уникальных demo-email.

- [ ] **Step 10: Выполнить финальные проверки**

Run:

```powershell
npx prettier --check src/database/prisma src/modules/admin/overview 'src/app/(protected)/admin' tests/admin.spec.ts docs/PROJECT_GUIDE.md docs/superpowers/specs/2026-08-04-demo-company-team-design.md
npm run lint
npm run typecheck
npm run test:unit
npx playwright test tests/admin.spec.ts --workers=1
npm run build
git diff --check
```

Expected: все команды exit 0. Допустимы только уже документированные Prisma config и Turbopack NFT warnings, если import trace не изменился.

- [ ] **Step 11: Commit**

```powershell
git add src/modules/admin/overview 'src/app/(protected)/admin/loading.tsx' tests/admin.spec.ts docs/PROJECT_GUIDE.md docs/superpowers/specs/2026-08-04-demo-company-team-design.md
git commit -m "feat: show demo company team in admin center"
```

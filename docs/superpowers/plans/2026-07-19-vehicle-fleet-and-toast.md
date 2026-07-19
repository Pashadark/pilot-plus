# Vehicle Fleet and Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести 130 автомобилей в PostgreSQL, показать их в адаптивном разделе Pilot+ с подробными карточками и добавить глобальные уведомления четырёх типов.

**Architecture:** Защищённые Server Components получают только автомобили компании текущего пользователя через серверный DAL. Интерактивные фильтры и тосты остаются небольшими Client Components; Prisma никогда не попадает в клиентский bundle. Исходный каталог импортируется идемпотентно, а отсутствующая телеметрия отображается честными пустыми состояниями.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Tailwind CSS 4, Prisma 6.16, PostgreSQL/PostGIS, Vitest 3, Playwright 1.61.

## Global Constraints

- Работать только над сайтом; Telegram-бот не изменять до отдельной команды пользователя.
- Весь пользовательский текст, комментарии и новая документация — на русском языке.
- Не добавлять UI-зависимость для тостов: использовать существующие React, Tailwind, Framer Motion и React Icons.
- Все записи принадлежат `Company`; `companyId` с клиента не является основанием доступа.
- В источник истины попадают ровно 130 карточек; повторный seed не создаёт дубликаты.
- Не генерировать координаты, пробег, топливо, поездки или события, отсутствующие в источнике.
- На карте показывать только автомобили с настоящей последней позицией.
- Сохранять `debug.log` без изменений и не включать его в коммиты.
- Перед кодом App Router сверяться с `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`, `05-server-and-client-components.md`, `06-fetching-data.md` и `node_modules/next/dist/docs/01-app/02-guides/data-security.md`.
- Каждый этап проходит lint, typecheck и относящиеся тесты до коммита.

---

## File Map

- `src/database/prisma/schema.prisma` — tenant, транспорт и будущие телематические связи.
- `src/database/prisma/migrations/20260719_add_vehicle_fleet/migration.sql` — воспроизводимая SQL-миграция.
- `src/database/prisma/data/fleet-source.txt` — неизменённый текст 130 карточек.
- `src/database/prisma/fleet-import.ts` — чистый parser и нормализация источника.
- `src/database/prisma/fleet-import.test.ts` — контракт разбора ровно 130 карточек.
- `src/database/prisma/seed.ts` и `seed.test.ts` — компания, членство и идемпотентный fleet upsert.
- `src/shared/providers/ToastProvider.tsx` и `.test.tsx` — очередь и публичный `useToast()`.
- `src/shared/ui/Toast.tsx` — презентационный тост четырёх тонов.
- `src/modules/vehicles/types.ts` — клиентские DTO и типы фильтров.
- `src/modules/vehicles/server/queries.ts` и `.test.ts` — tenant-scoped Prisma-запросы.
- `src/modules/vehicles/components/*` — список, фильтры, карточка, сводка и вкладки.
- `src/app/(protected)/vehicles/*` — тонкие страницы, loading/error/not-found.
- `src/app/(protected)/ui-kit/sections.tsx` — интерактивная демонстрация тостов.
- `tests/vehicles.spec.ts` и `tests/ui-kit.spec.ts` — browser-проверки.
- `docs/PROJECT_GUIDE.md` — актуальное состояние после реализации.

---

### Task 1: Tenant и доменная схема транспорта

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260719_add_vehicle_fleet/migration.sql`
- Test: `src/database/prisma/schema.test.ts`

**Interfaces:**
- Consumes: существующие `User`, `Session`, `LoginThrottle`.
- Produces: Prisma enums `CompanyRole`, `VehicleStatus`, `FuelType`, `TelemetrySeverity`; models `Company`, `CompanyMember`, `Vehicle`, `VehiclePosition`, `Trip`, `VehicleEvent`, `FuelRecord`, `MaintenanceRecord`, `VehicleDocument`.

- [ ] **Step 1: Написать падающий контракт схемы**

В `schema.test.ts` прочитать schema как текст и проверить наличие tenant relations, уникального `sourceKey`, nullable `registrationNumber`/`vin`, индексов `[companyId, status]` и временных индексов телематики. Это тестирует обязательные инварианты миграции, не Prisma internals.

```ts
expect(schema).toContain('sourceKey         String        @unique');
expect(schema).toContain('companyId         String');
expect(schema).toContain('@@index([companyId, status])');
expect(schema).toContain('registrationNumber String?');
expect(schema).toContain('vin                String?');
```

- [ ] **Step 2: Убедиться, что контракт падает**

Run: `npx vitest run src/database/prisma/schema.test.ts`  
Expected: FAIL — модели транспорта отсутствуют.

- [ ] **Step 3: Расширить Prisma schema и создать SQL-миграцию**

Добавить обратные relations в `User`, обязательное членство в компании и cascade delete только для дочерних доменных данных. Денежное поле назвать `dailyPriceMinor Int`; объём двигателя — `engineLiters Decimal? @db.Decimal(3, 1)`; особенности — `features String[]`; даты телематики — `recordedAt`/`startedAt`/`endedAt`. `Vehicle.companyId` обязателен, а `sourceKey` уникален глобально для идемпотентного импорта.

Создать миграцию командой:

```powershell
npx prisma migrate dev --name add_vehicle_fleet --create-only
```

Проверить SQL: все foreign keys с ожидаемыми delete rules, enum names и индексы присутствуют.

- [ ] **Step 4: Валидировать схему и зелёный контракт**

Run: `npx prisma format && npx prisma validate && npx vitest run src/database/prisma/schema.test.ts`  
Expected: schema valid; 1 test file PASS.

- [ ] **Step 5: Сгенерировать клиент и сделать коммит**

Run: `npx prisma generate && npm run typecheck`  
Expected: Prisma Client generated; TypeScript PASS.

```powershell
git add src/database/prisma/schema.prisma src/database/prisma/migrations src/database/prisma/schema.test.ts src/database/generated/prisma
git commit -m "feat: add tenant vehicle data model"
```

---

### Task 2: Разбор каталога и идемпотентный seed 130 машин

**Files:**
- Create: `src/database/prisma/data/fleet-source.txt`
- Create: `src/database/prisma/fleet-import.ts`
- Create: `src/database/prisma/fleet-import.test.ts`
- Modify: `src/database/prisma/seed.ts`
- Modify: `src/database/prisma/seed.test.ts`

**Interfaces:**
- Produces: `parseFleetSource(source: string): FleetImportRow[]`, `seedFleet(database, adminId, rows): Promise<{companyId: string; vehicles: number}>`.
- `FleetImportRow` содержит `sourceKey`, `model`, `city`, `office`, `transmission`, `engineLiters`, `fuelType`, `seats`, `dailyPriceMinor`, `currency`, `originalPrice`, `features`.

- [ ] **Step 1: Сохранить исходник и написать падающие parser-тесты**

Перенести вложение без исправления текста в `data/fleet-source.txt`. В тесте проверить:

```ts
const rows = parseFleetSource(source);
expect(rows).toHaveLength(130);
expect(new Set(rows.map((row) => row.sourceKey)).size).toBe(130);
expect(rows[0]).toMatchObject({
  model: 'GWM WEY', city: 'Красноярск', transmission: 'АКПП',
  engineLiters: 1.5, fuelType: 'PETROL', seats: 7,
  dailyPriceMinor: 880000, currency: 'RUB',
});
expect(rows.some((row) => row.currency === 'THB')).toBe(true);
```

- [ ] **Step 2: Запустить тест и подтвердить падение**

Run: `npx vitest run src/database/prisma/fleet-import.test.ts`  
Expected: FAIL — module not found.

- [ ] **Step 3: Реализовать строгий parser**

Разделять записи конечной строкой `Забронировать`; первые две строки `Автопарк` и `130 авто` удалить только в заголовке. Искать технические значения регулярными выражениями (`/^(АКПП|МКПП)$/`, `/^\d+(?:[.,]\d+)? л$/`, `/^\d+ мест$/`, `/^[\d ]+ [₽฿]$/`). Строки между повтором модели и коробкой сохранять как офис/особенности. При неполной карточке выбрасывать ошибку с её порядковым номером.

- [ ] **Step 4: Дополнить seed тестами tenant и upsert**

Проверить, что `seedFleet` создаёт/обновляет компанию `Pilot+ Demo`, связывает администратора и вызывает vehicle upsert 130 раз по `sourceKey`. Повторный вызов должен вернуть `vehicles: 130`, не создавать вторую компанию и не писать позиции/поездки.

- [ ] **Step 5: Реализовать seed и запустить тесты**

Расширить `SeedDatabase` ровно репозиториями `company`, `companyMember`, `vehicle`; передавать `admin.id` из `seedAdmin`. В `main()` сначала seed администратора, затем каталог. Логировать только email, company id и количество, без секретов.

Run: `npx vitest run src/database/prisma/fleet-import.test.ts src/database/prisma/seed.test.ts`  
Expected: PASS; parser reports 130.

- [ ] **Step 6: Применить миграцию и проверить реальную БД**

Run: `npx prisma migrate deploy && npm run db:seed`  
Expected: миграция применена; сообщение «Импортировано автомобилей: 130».

Run: `docker exec pilot-postgres psql -U pilot -d pilot -tAc 'SELECT count(*) FROM "Vehicle"; SELECT count(*) FROM "VehiclePosition";'`  
Expected: `130`, затем `0`.

- [ ] **Step 7: Сделать коммит**

```powershell
git add src/database/prisma/data/fleet-source.txt src/database/prisma/fleet-import.ts src/database/prisma/fleet-import.test.ts src/database/prisma/seed.ts src/database/prisma/seed.test.ts
git commit -m "feat: seed 130 fleet vehicles"
```

---

### Task 3: Глобальная система тостов Pilot+

**Files:**
- Create: `src/shared/ui/Toast.tsx`
- Create: `src/shared/providers/ToastProvider.tsx`
- Create: `src/shared/providers/ToastProvider.test.tsx`
- Modify: `src/shared/ui/Feedback.tsx`
- Modify: `src/shared/ui/index.ts`
- Modify: `src/app/(protected)/layout.tsx`

**Interfaces:**
- Produces: `ToastTone = 'success' | 'warning' | 'danger' | 'info'`.
- Produces: `useToast(): { showToast(input: ToastInput): string; dismissToast(id: string): void }`.
- `ToastInput = { tone; title; description?; actionLabel?; onAction?; durationMs? }`.

- [ ] **Step 1: Написать падающие тесты очереди**

С React DOM test utilities проверить: четыре tone, максимум четыре видимых элемента, новый сверху, ручное закрытие, auto-dismiss через fake timers, задержку `danger`, паузу на pointer enter/focus и ошибку `useToast` вне provider.

- [ ] **Step 2: Запустить тесты**

Run: `npx vitest run src/shared/providers/ToastProvider.test.tsx`  
Expected: FAIL — provider отсутствует.

- [ ] **Step 3: Реализовать презентационный Toast**

Использовать семантические токены, иконки `FiCheckCircle`, `FiAlertTriangle`, `FiAlertCircle`, `FiInfo`, `FiX`; `role="alert"` только для danger, остальные `role="status"`. Кнопка закрытия получает русский `aria-label="Закрыть уведомление"`.

- [ ] **Step 4: Реализовать provider и viewport**

Хранить очередь через `useReducer`; генерировать id через `crypto.randomUUID()` с локальным fallback. Viewport: fixed top-right под header, `pointer-events-none`, элементы `pointer-events-auto`, ширина `min(24rem, calc(100vw - 2rem))`, `aria-live="polite"`. Анимация Framer Motion отключается через `useReducedMotion()`.

- [ ] **Step 5: Подключить provider и убрать старый статический экспорт**

Обернуть `children` защищённого layout в `ToastProvider`; заменить старую функцию `Toast` в `Feedback.tsx` экспортом нового компонента, чтобы не существовало двух API с одинаковым именем.

- [ ] **Step 6: Проверить и закоммитить**

Run: `npx vitest run src/shared/providers/ToastProvider.test.tsx && npm run typecheck && npm run lint`  
Expected: PASS.

```powershell
git add src/shared/ui src/shared/providers/ToastProvider.tsx src/shared/providers/ToastProvider.test.tsx 'src/app/(protected)/layout.tsx'
git commit -m "feat: add global Pilot toast notifications"
```

---

### Task 4: Tenant-scoped DAL и DTO автомобилей

**Files:**
- Create: `src/modules/vehicles/types.ts`
- Create: `src/modules/vehicles/server/queries.ts`
- Create: `src/modules/vehicles/server/queries.test.ts`
- Create: `src/modules/vehicles/utils.ts`
- Create: `src/modules/vehicles/utils.test.ts`
- Create: `src/modules/vehicles/index.ts`

**Interfaces:**
- Produces: `VehicleCardDto`, `VehicleDetailDto`, `VehicleTelemetrySummary`.
- Produces: `listVehiclesForUser(userId: string): Promise<VehicleCardDto[]>`.
- Produces: `getVehicleForUser(userId: string, vehicleId: string): Promise<VehicleDetailDto | null>`.
- Produces: `formatDailyPrice(minor: number, currency: string): string` and `formatOptionalMetric(value, suffix): string`.

- [ ] **Step 1: Написать падающие unit-тесты DAL**

Подменить минимальный Prisma gateway. Проверить, что list/detail всегда включают `company: { members: { some: { userId } } }`; detail чужой компании возвращает `null`. DTO не содержит `companyId`, Prisma Decimal или внутренних relation objects.

- [ ] **Step 2: Написать падающие format-тесты**

```ts
expect(formatDailyPrice(880000, 'RUB')).toBe('8 800 ₽/сутки');
expect(formatDailyPrice(110000, 'THB')).toBe('1 100 ฿/сутки');
expect(formatOptionalMetric(null, 'км')).toBe('Нет данных');
```

- [ ] **Step 3: Реализовать запросы и DTO mapping**

Выбирать только необходимые поля плюс последнюю позицию, последнюю поездку и последнюю fuel record через `take: 1`, `orderBy` по времени. Возвращать ISO-строки вместо `Date`, number вместо Decimal. Все дочерние выборки ограничивать текущим vehicle внутри tenant-scoped parent query.

- [ ] **Step 4: Реализовать форматирование и публичные экспорты**

Использовать `Intl.NumberFormat('ru-RU')`; неизвестную валюту показывать кодом, не выбрасывать runtime error. Экспортировать только DTO, formatter и серверные query из разделённых entry points, чтобы client component не импортировал Prisma transitively.

- [ ] **Step 5: Проверить и закоммитить**

Run: `npx vitest run src/modules/vehicles/server/queries.test.ts src/modules/vehicles/utils.test.ts && npm run typecheck`  
Expected: PASS.

```powershell
git add src/modules/vehicles
git commit -m "feat: add tenant scoped vehicle queries"
```

---

### Task 5: Адаптивный список и карточки автомобилей

**Files:**
- Create: `src/modules/vehicles/components/VehicleFilters.tsx`
- Create: `src/modules/vehicles/components/VehicleCard.tsx`
- Create: `src/modules/vehicles/components/VehicleGrid.tsx`
- Create: `src/modules/vehicles/components/VehicleListPage.tsx`
- Create: `src/modules/vehicles/components/VehicleGrid.test.tsx`
- Create: `src/app/(protected)/vehicles/page.tsx`
- Create: `src/app/(protected)/vehicles/loading.tsx`
- Create: `src/app/(protected)/vehicles/error.tsx`

**Interfaces:**
- Consumes: `VehicleCardDto[]`, `useToast()`.
- Produces: route `/vehicles` and client filters `{query, city, fuelType, status, seats}`.

- [ ] **Step 1: Написать падающие component-тесты**

Проверить поиск без учёта регистра по модели/городу/офису/номеру, комбинирование фильтров, счётчик результата, сброс и пустое состояние. Отдельно проверить, что отсутствующие telemetry fields рендерят «Нет данных», а «На карте» disabled и вызывает info toast.

- [ ] **Step 2: Запустить component-тесты**

Run: `npx vitest run src/modules/vehicles/components/VehicleGrid.test.tsx`  
Expected: FAIL — components отсутствуют.

- [ ] **Step 3: Собрать карточку**

Карточка содержит модель, `internalNumber`, status badge, город/офис, коробку, двигатель, топливо, места, цену, features и компактную telemetry grid. «Открыть», «История», «Маршруты» — `Link`; «На карте» — button, активная только при position. Touch targets не меньше 44px.

- [ ] **Step 4: Реализовать фильтры и сетку**

`useMemo` фильтрует уже разрешённый сервером массив. На desktop сетка 2–3 колонки, на mobile одна колонка без горизонтального scroll. Фильтры имеют labels/aria-labels и нативные select controls.

- [ ] **Step 5: Собрать Server Page и состояния route**

`page.tsx` вызывает `const user = await requireAdmin()` и `listVehiclesForUser(user.id)`. `loading.tsx` показывает карточки Skeleton; `error.tsx` — Client Component с ErrorState и кнопкой `reset()`.

- [ ] **Step 6: Проверить и закоммитить**

Run: `npx vitest run src/modules/vehicles/components/VehicleGrid.test.tsx && npm run lint && npm run typecheck`  
Expected: PASS.

```powershell
git add src/modules/vehicles/components 'src/app/(protected)/vehicles'
git commit -m "feat: add responsive vehicle fleet page"
```

---

### Task 6: Подробная карточка и семь вкладок

**Files:**
- Create: `src/modules/vehicles/components/VehicleDetailPage.tsx`
- Create: `src/modules/vehicles/components/VehicleOverview.tsx`
- Create: `src/modules/vehicles/components/VehicleTabs.tsx`
- Create: `src/modules/vehicles/components/VehicleEmptySection.tsx`
- Create: `src/modules/vehicles/components/VehicleDetailPage.test.tsx`
- Create: `src/app/(protected)/vehicles/[id]/page.tsx`
- Create: `src/app/(protected)/vehicles/[id]/loading.tsx`
- Create: `src/app/(protected)/vehicles/[id]/not-found.tsx`

**Interfaces:**
- Consumes: `VehicleDetailDto`, async Next.js `params: Promise<{id: string}>`, `searchParams: Promise<{tab?: string}>`.
- Produces: `/vehicles/[id]?tab=overview|trips|routes|events|fuel|maintenance|documents`.

- [ ] **Step 1: Написать падающие вкладочные тесты**

Проверить семь русских названий, обзор с исходными данными, выбранную вкладку из query, fallback неизвестного tab на overview и содержательные empty states: «Поездки ещё не поступали», «Маршрут появится после первой поездки», «Записей о топливе пока нет».

- [ ] **Step 2: Запустить тесты**

Run: `npx vitest run src/modules/vehicles/components/VehicleDetailPage.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Реализовать detail UI**

Верхняя панель повторяет model/status/location/internal number и цену. Overview группирует характеристики, предложение и последнюю телеметрию. Tabs — настоящие links с query string и `aria-current`; на mobile горизонтально прокручиваются, но страница не получает общий overflow.

- [ ] **Step 4: Реализовать динамический route по правилам Next.js 16**

Await `params` и `searchParams`; вызвать `getVehicleForUser(user.id, id)`, затем `notFound()` при null. Не принимать company id из URL. Установить title через `generateMetadata`, используя тот же tenant-scoped lookup или безопасный общий заголовок без раскрытия чужой машины.

- [ ] **Step 5: Проверить и закоммитить**

Run: `npx vitest run src/modules/vehicles/components/VehicleDetailPage.test.tsx && npm run typecheck && npm run lint`  
Expected: PASS.

```powershell
git add src/modules/vehicles/components 'src/app/(protected)/vehicles/[id]'
git commit -m "feat: add vehicle detail workspace"
```

---

### Task 7: Витрина тостов и browser-сценарии

**Files:**
- Modify: `src/app/(protected)/ui-kit/sections.tsx`
- Modify: `tests/ui-kit.spec.ts`
- Create: `tests/vehicles.spec.ts`

**Interfaces:**
- Consumes: `useToast`, `/vehicles`, seeded authenticated Playwright environment.
- Produces: стабильные `data-testid` только для критических browser assertions.

- [ ] **Step 1: Написать падающий UI-kit e2e тест**

Нажать четыре русские кнопки и проверить видимые заголовки «Операция выполнена», «Требуется внимание», «Произошла ошибка», «Новая информация». Закрыть danger тост клавиатурой и проверить исчезновение.

- [ ] **Step 2: Добавить интерактивную секцию тостов**

В `UiKitSections` вызвать `useToast()` и заменить статический пример четырьмя кнопками. Описания должны объяснять реальное назначение каждого tone, без английских подписей.

- [ ] **Step 3: Написать fleet e2e сценарии**

Проверить:

- 130 записей в заголовке;
- поиск `GWM WEY` и фильтр `Красноярск`;
- открытие первой карточки;
- переход на `?tab=trips`;
- видимое честное пустое состояние;
- disabled/map action и info toast;
- mobile viewport 390×844 без горизонтального overflow, с touch targets >= 44px.

- [ ] **Step 4: Запустить browser tests**

Run: `npx playwright test tests/ui-kit.spec.ts tests/vehicles.spec.ts --workers=1`  
Expected: PASS in Chromium.

- [ ] **Step 5: Сделать коммит**

```powershell
git add 'src/app/(protected)/ui-kit/sections.tsx' tests/ui-kit.spec.ts tests/vehicles.spec.ts
git commit -m "test: cover fleet and toast user flows"
```

---

### Task 8: Документация и полная приёмка сайта

**Files:**
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `README.md` if commands or visible feature list are outdated.

**Interfaces:**
- Consumes: verified results of Tasks 1–7.
- Produces: accurate handoff state for the next developer or AI agent.

- [ ] **Step 1: Обновить гид по факту, не по плану**

Перенести fleet, detail pages, tenant membership, 130 seeded records и toast system в «Что работает». Оставить MQTT/Redis/реальную телеметрию и Telegram-бот в planned/not implemented. Зафиксировать команды миграции, seed и теста автомобилей.

- [ ] **Step 2: Выполнить полный verification suite**

```powershell
npm run lint
npm run typecheck
npm run test:unit
npx prisma validate
npx prisma migrate deploy
npm run db:seed
npx playwright test tests/auth.spec.ts tests/dashboard.spec.ts tests/ui-kit.spec.ts tests/vehicles.spec.ts --workers=1
npm run build
git -c safe.directory=C:/Users/pasahdark/Projects/pilot-plus diff --check
```

Expected: all commands exit 0; seed reports 130; production build succeeds; no whitespace errors.

- [ ] **Step 3: Проверить scope и рабочее дерево**

Run: `git -c safe.directory=C:/Users/pasahdark/Projects/pilot-plus status --short`  
Expected: only intended documentation change plus user-owned untracked `debug.log`; no screenshots, test artifacts, `.env` or secrets staged.

- [ ] **Step 4: Финальный коммит**

```powershell
git add docs/PROJECT_GUIDE.md README.md
git commit -m "docs: record vehicle fleet implementation"
```

- [ ] **Step 5: Финальная ручная проверка**

Открыть `/vehicles` и одну detail page на desktop и 390px mobile. Проверить светлую/тёмную темы, четыре тоста, фильтры, keyboard focus, карту без фиктивных markers и отсутствие английских пользовательских подписей.

---

## Self-review result

- Spec coverage: все требования спецификации распределены по Tasks 1–8.
- Scope: бот, бронирование, редактирование и real-time pipeline явно исключены.
- Data integrity: parser требует 130 записей, seed идемпотентен, telemetry relations остаются пустыми.
- Type consistency: `VehicleCardDto`, `VehicleDetailDto`, `ToastTone`, `useToast`, list/detail query используются под одинаковыми именами.
- Placeholder scan: незаполненных решений и неопределённых задач нет.

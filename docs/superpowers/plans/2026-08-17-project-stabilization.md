# Pilot+ Project Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вернуть текущую основную ветку Pilot+ в проверяемое состояние, сохранив новый дизайн и исключив вымышленные бизнес-данные из автопарка.

**Architecture:** Исправления выполняются вертикально: сначала дизайн-система, затем карточка автомобиля, затем общие quality gates. Реальные DTO остаются единственным источником бизнес-данных; UI показывает «Нет данных», когда телеметрия или история отсутствуют.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript, Tailwind CSS 4, Vitest, ESLint, Prettier.

## Global Constraints

- Сохранить пользовательские незакоммиченные изменения и новый визуальный каркас.
- Не добавлять зависимости и не менять Prisma schema или общую БД.
- Не подменять отсутствующую телеметрию, поездки, события, ТО, мойки или документы fixtures.
- Все комментарии и пользовательский текст остаются на русском языке.
- Каждое исправление выполняется через RED → GREEN и заканчивается профильной проверкой.

---

### Task 1: Стабилизация UI-kit

**Files:**

- Modify: `src/app/(protected)/ui-kit/sections.tsx`
- Test: `src/app/(protected)/ui-kit/admin-access-showcase.test.ts`

**Interfaces:**

- Consumes: `EventCard` с обязательным `icon: React.ElementType`.
- Produces: типобезопасную витрину событий без отсутствующих props и ошибок форматирования.

- [ ] **Step 1: Зафиксировать текущий RED**

Run: `npm run typecheck`
Expected: FAIL на `EventCard` без `icon`.

- [ ] **Step 2: Передать семантическую иконку в единственный устаревший вызов**

Добавить `icon={FiAlertTriangle}` для событий карточки автомобиля и удалить хвостовой пробел.

- [ ] **Step 3: Проверить GREEN**

Run: `npm run typecheck` и `npx prettier --check "src/app/(protected)/ui-kit/sections.tsx"`
Expected: PASS.

### Task 2: Честная карточка автомобиля

**Files:**

- Modify: `src/modules/vehicles/components/VehicleDetailPage.tsx`
- Modify: `src/modules/vehicles/components/VehicleOverview.tsx`
- Modify: `src/modules/vehicles/components/VehicleDetailPage.test.ts`
- Test: `src/modules/vehicles/components/VehicleDetailPage.test.ts`

**Interfaces:**

- Consumes: `VehicleDetailDto` и его реальные `trips`, `events`, `fuelRecords`, `maintenanceRecords`, `washRecords`, `documents`, `telemetry`.
- Produces: новый визуальный интерфейс с реальными значениями и честными empty states.

- [ ] **Step 1: Расширить RED-тесты источника данных**

Добавить проверки, что при пустом DTO не появляются «Москва», синтетический VIN, вымышленные поездки, события, ТО и мойки; при заполненном DTO сохраняются реальные русские статусы и московские даты.

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npx vitest run src/modules/vehicles/components/VehicleDetailPage.test.ts`
Expected: FAIL на синтетических значениях и нарушенных empty states.

- [ ] **Step 3: Удалить fallback fixtures из production-компонентов**

Использовать только массивы и телеметрию `vehicle`; оставить новые карточки и адаптивную сетку, но показывать «Нет данных» или существующий `VehicleEmptySection`.

- [ ] **Step 4: Проверить GREEN**

Run: `npx vitest run src/modules/vehicles/components/VehicleDetailPage.test.ts src/modules/vehicles/components/VehicleDetailPage.test.ts`
Expected: PASS.

### Task 3: Полный технический шлюз и локальная проверка

**Files:**

- Modify only files proven necessary by failing checks.

**Interfaces:**

- Consumes: исправленные UI-kit и vehicle components.
- Produces: проверенный `main` без ошибок типизации и unit-регрессий.

- [ ] **Step 1: Запустить последовательные проверки**

Run: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run format:check`, `npm run build`.

- [ ] **Step 2: Исправлять только воспроизводимые ошибки через отдельный RED → GREEN цикл**

Не менять несвязанные модули и не применять миграции/seed.

- [ ] **Step 3: Проверить браузером**

Открыть `/ui-kit`, `/vehicles`, реальную `/vehicles/[id]` и договор `ME-2026-0001-BK` на desktop и 390 px; проверить отсутствие горизонтального переполнения и вымышленных показателей.

- [ ] **Step 4: Зафиксировать результат**

Отдельно перечислить устранённые причины, результаты проверок и оставшийся продуктовый долг.

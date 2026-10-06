# Rental List Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перестроить список договоров в читаемую таблицу с отдельными данными, кликабельными сущностями и цветом строки по состоянию аренды.

**Architecture:** Серверная страница передаёт компоненту отдельные идентификаторы и подписи клиента и автомобиля. Презентационный слой вычисляет жизненный цикл и семантический тон, а `RentalListPage` отвечает только за адаптивную разметку и ссылки.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Не добавлять зависимости.
- Сохранять существующие серверные фильтры, сортировку, документы и мобильное представление.
- Цвет не является единственным обозначением состояния: текстовый бейдж обязателен.
- Навигация выполняется через `next/link`.

---

### Task 1: Контракт данных и проверка таблицы

**Files:**

- Modify: `src/modules/rentals/components/RentalListPage.test.tsx`
- Modify: `src/modules/rentals/components/rental-list-presentation.ts`
- Modify: `src/app/(protected)/rentals/page.tsx`

**Interfaces:**

- Consumes: записи `listFilteredRentalsForCurrentUser` с `client.id`, `vehicle.id`, `vehicle.make`, `vehicle.modelName`, `vehicle.registrationNumber`.
- Produces: `RentalListSource` с `clientId`, `vehicleId`, `clientLabel`, `vehicleName`, `registrationNumber`.

- [ ] **Step 1: Write the failing test**

Расширить fixture полями идентификаторов, названием машины и номером. Проверить заголовки `Начало`, `Конец`, `Стоимость`, `Залог`, `Госномер` и ссылки `/clients/client-active`, `/vehicles/vehicle-active`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx`
Expected: FAIL — новых колонок и ссылок ещё нет.

- [ ] **Step 3: Write minimal data implementation**

Добавить в `RentalListSource`:

```ts
clientId: string;
vehicleId: string;
clientLabel: string;
vehicleName: string;
registrationNumber: string;
```

В серверном mapping передать идентификаторы и сформировать `vehicleName` только из марки и модели.

- [ ] **Step 4: Run type-focused test**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx`
Expected: тест всё ещё FAIL только из-за отсутствующей разметки.

### Task 2: Адаптивная таблица и цветовые состояния

**Files:**

- Modify: `src/modules/rentals/components/RentalListPage.tsx`
- Test: `src/modules/rentals/components/RentalListPage.test.tsx`

**Interfaces:**

- Consumes: расширенный `RentalListSource` из Task 1.
- Produces: ссылки клиента и машины, 11 отдельных колонок и `data-lifecycle` на строке.

- [ ] **Step 1: Implement the minimal markup**

Заменить объединённые колонки на `Договор`, `Клиент`, `Автомобиль`, `Госномер`, `Начало`, `Конец`, `Стоимость`, `Залог`, `Статус`, `Файлы`, `Действия`. Обернуть ФИО в `Link href=/clients/{clientId}`, название и номер машины — в `Link href=/vehicles/{vehicleId}`.

- [ ] **Step 2: Apply semantic row styles**

Использовать отдельную карту фонов строк: `ACTIVE` — emerald, `EXTENDED` — amber, `CONFIRMED` — blue, `COMPLETED/CANCELLED` — slate, `DRAFT` — neutral. Оставить существующую карту тонов для бейджей.

- [ ] **Step 3: Preserve mobile behavior**

Добавить те же ссылки и отдельные подписи `Начало`, `Конец`, `Стоимость`, `Залог` в карточное представление.

- [ ] **Step 4: Run component tests**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx src/modules/rentals/components/rental-list-presentation.test.ts`
Expected: PASS.

### Task 3: Регрессия и локальная проверка

**Files:**

- Verify only.

**Interfaces:**

- Consumes: готовая страница `/rentals`.
- Produces: подтверждение корректной сборки и визуального результата.

- [ ] **Step 1: Run static checks**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Inspect `/rentals` locally**

Проверить заголовки, цвета активной/продлённой/закрытой строки и переходы по клиенту, автомобилю и договору.

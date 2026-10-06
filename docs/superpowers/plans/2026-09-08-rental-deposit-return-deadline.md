# Rental Deposit Return Deadline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показывать сумму залога и дату его возврата через 21 рабочий день после закрытия договора.

**Architecture:** Расчёт выполняется чистой функцией презентационного слоя без изменения базы данных. Список аренд получает `completedAt`; для незакрытого договора используется `endsAt`, а фактические статусы возврата и удержания имеют приоритет над расчётной датой.

**Tech Stack:** TypeScript, React Server Components, Next.js 16, Vitest, Testing Library, Tailwind CSS.

## Global Constraints

- Не менять схему базы данных.
- Не менять бизнес-процессы выдачи, возврата и продления аренды.
- День закрытия не входит в 21 рабочий день; суббота и воскресенье пропускаются.
- Сохранить адаптивную таблицу и мобильные карточки.

---

### Task 1: Расчёт и представление срока возврата

**Files:**
- Modify: `src/modules/rentals/components/rental-list-presentation.ts`
- Modify: `src/modules/rentals/components/rental-list-presentation.test.ts`

**Interfaces:**
- Consumes: `RentalListSource.completedAt`, `RentalListSource.endsAt`, `depositStatus`, подтверждённые платежи.
- Produces: `depositLabel` с датой `Вернуть до ДД.ММ.ГГГГ` для внесённого нерешённого залога.

- [ ] **Step 1: Write the failing test**

Добавить сценарии, где 21 рабочий день после 24.08.2026 равен 22.09.2026 и где `completedAt` имеет приоритет над `endsAt`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/rentals/components/rental-list-presentation.test.ts`

Expected: FAIL, потому что сейчас возвращается `Внесён`.

- [ ] **Step 3: Write minimal implementation**

Добавить чистый расчёт рабочих дней по московской календарной дате, поле `completedAt` и заменить `Внесён` на `Вернуть до ...` только для нерешённого внесённого залога.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/rentals/components/rental-list-presentation.test.ts`

Expected: PASS.

### Task 2: Данные и интерфейс списка

**Files:**
- Modify: `src/modules/rentals/server/queries.ts`
- Modify: `src/app/(protected)/rentals/page.tsx`
- Modify: `src/modules/rentals/components/RentalListPage.tsx`
- Modify: `src/modules/rentals/components/RentalListPage.test.tsx`

**Interfaces:**
- Consumes: `Rental.completedAt` из Prisma.
- Produces: сумма залога первой строкой и срок возврата второй строкой в desktop и mobile UI.

- [ ] **Step 1: Write the failing component test**

Проверить заголовок `Срок возврата` и текст `Вернуть до 22.09.2026`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx`

Expected: FAIL на старом заголовке и старом статусе.

- [ ] **Step 3: Pass `completedAt` and update copy**

Добавить `completedAt` в Prisma select и DTO страницы, затем заменить заголовок таблицы.

- [ ] **Step 4: Run focused and module tests**

Run: `npx vitest run src/modules/rentals/components/rental-list-presentation.test.ts src/modules/rentals/components/RentalListPage.test.tsx`

Expected: PASS.

### Task 3: Проверка и production deployment

**Files:**
- No source files added.

**Interfaces:**
- Consumes: собранный production release.
- Produces: работающий `/rentals` на `https://supapro.ru`.

- [ ] **Step 1: Verify locally**

Run: `npm run typecheck`, `npm run lint`, `npm run build`.

Expected: exit code 0; допустимы только уже известные предупреждения.

- [ ] **Step 2: Back up and deploy release**

Создать резервную копию, собрать новый release на сервере, атомарно переключить `/opt/pilot-plus/current` и перезапустить `pilot-plus`.

- [ ] **Step 3: Run production smoke test**

Авторизоваться, открыть `/rentals`, проверить сумму залога, строку `Вернуть до` и отсутствие `Ожидается`.

Expected: HTTPS 200, сервис active, ошибок журнала нет.

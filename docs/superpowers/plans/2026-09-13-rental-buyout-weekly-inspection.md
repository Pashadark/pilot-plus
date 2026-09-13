# Аренда с правом выкупа и еженедельный контроль — план реализации

> **Для Codex:** выполнить план целиком через skill `executing-plans`, сохраняя существующие незакоммиченные изменения и проверяя каждый слой тестами.

**Цель:** добавить отдельный тип аренды с правом выкупа, заметную фиолетовую маркировку `#673AB7`, еженедельную фото/видео-проверку и пятничное напоминание в рабочую Telegram-группу.

**Архитектура:** тип аренды хранится в `Rental` и копируется в юридический snapshot. Еженедельная проверка использует существующие `RentalOperation` и `RentalOperationMedia`, расширяя тип операции значением `WEEKLY_INSPECTION`. Дайджест вычисляет отсутствие полной проверки в московской календарной неделе и создаёт один идемпотентный групповой job на аренду и неделю.

**Стек:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, Vitest, Tailwind CSS, существующий bot notification pipeline.

---

## Задача 1. Схема данных и доменные правила

**Файлы:**
- Изменить: `src/database/prisma/schema.prisma`
- Создать: `src/database/prisma/migrations/20260913193000_add_lease_to_own_weekly_inspection/migration.sql`
- Изменить: `src/database/prisma/rental-schema.test.ts`
- Изменить: `src/modules/rentals/operations/types.ts`
- Создать: `src/modules/rentals/lease-to-own/weekly-inspection.ts`
- Создать: `src/modules/rentals/lease-to-own/weekly-inspection.test.ts`

- [ ] Сначала написать падающие тесты на `RentalAgreementType`, поле `agreementType`, `WEEKLY_INSPECTION`, московскую неделю и полноту обязательных медиа.
- [ ] Добавить enum `RentalAgreementType { STANDARD LEASE_TO_OWN }`, `Rental.agreementType @default(STANDARD)` и `RentalOperationType.WEEKLY_INSPECTION`.
- [ ] Реализовать чистые функции диапазона недели, пятничного срока и проверки комплекта dashboard/body/video.
- [ ] Выполнить `npx prisma format`, `npx prisma generate`, targeted Vitest.

## Задача 2. Создание и редактирование аренды

**Файлы:**
- Изменить: `src/modules/rentals/components/RentalWizard.tsx`
- Изменить: `src/modules/rentals/components/RentalWizard.test.tsx`
- Изменить: `src/modules/rentals/server/actions.ts`
- Изменить: `src/modules/rentals/server/actions.test.ts`
- Изменить: `src/modules/rentals/server/confirm-rental.ts`
- Изменить: `src/modules/rentals/server/confirm-rental.test.ts`
- При необходимости изменить: `src/modules/rentals/edit/*`

- [ ] Написать падающие тесты: стандартный тип по умолчанию, выбор «С правом выкупа», сохранение в Rental и `snapshot.agreementType`.
- [ ] Добавить компактный выбор типа в мастер и контролируемое редактирование с новой версией документов.
- [ ] Не создавать отдельный шаблон договора до получения исходного договора от пользователя.
- [ ] Запустить targeted тесты действий/подтверждения/мастера.

## Задача 3. Список и карточка аренды

**Файлы:**
- Изменить: `src/app/(protected)/rentals/page.tsx`
- Изменить: `src/app/(protected)/rentals/[id]/page.tsx`
- Изменить: `src/modules/rentals/server/queries.ts`
- Изменить: `src/modules/rentals/components/rental-list-presentation.ts`
- Изменить: `src/modules/rentals/components/rental-list-presentation.test.ts`
- Изменить: `src/modules/rentals/components/RentalListPage.tsx`
- Изменить: `src/modules/rentals/components/RentalListPage.test.tsx`
- Изменить: `src/modules/rentals/components/RentalDetailPanel.tsx`
- Изменить: `src/modules/rentals/components/RentalDetailPanel.test.tsx`

- [ ] Написать падающие UI-тесты на полосу `#673AB7`, бейдж «С правом выкупа» и блок еженедельного контроля.
- [ ] Передать `agreementType` и последнюю проверку из tenant-scoped запросов.
- [ ] Отрисовать самостоятельную фиолетовую полосу шириной не менее 4 px, не заменяя существующее отображение срочности/статуса.
- [ ] В деталях показать последнюю проверку, статус текущей недели, следующую пятницу и действие добавления осмотра.

## Задача 4. Операция еженедельного осмотра

**Файлы:**
- Изменить: `src/modules/rentals/components/RentalActionRail.tsx`
- Изменить: `src/modules/rentals/components/RentalOperationDialog.tsx`
- Изменить: `src/modules/rentals/components/RentalOperationTimeline.tsx`
- Изменить: `src/modules/rentals/operations/server/prepare-operation.ts`
- Изменить: `src/modules/rentals/operations/server/execute-operation.ts`
- Изменить/создать соответствующие `*.test.ts(x)`.

- [ ] Написать падающие тесты на доступность действия только для активной `LEASE_TO_OWN` аренды.
- [ ] Разрешить сохранить неполный осмотр как DRAFT; COMMITTED допускается только с dashboard, четырьмя сторонами кузова и видео в CLEAN-состоянии.
- [ ] Повторно использовать существующую загрузку, проверку MIME/размера и ClamAV; не ослаблять tenant access.
- [ ] Показать toast об успехе/ошибке; ошибка загрузки не должна закрывать осмотр.
- [ ] Запустить targeted серверные и компонентные тесты.

## Задача 5. Пятничное групповое напоминание

**Файлы:**
- Изменить: `src/modules/bot-api/daily-operations.ts`
- Изменить: `src/modules/bot-api/daily-operations.test.ts`
- Изменить: `src/modules/bot-api/notifications.ts`
- Изменить: `src/modules/bot-api/notifications.test.ts`

- [ ] Написать падающие тесты: секция только по пятницам, только активные `LEASE_TO_OWN`, отсутствует после полной проверки недели, адресат только рабочая группа, стабильный event key `company+rental+week`.
- [ ] Добавить в дневные операции блок «Аренда с правом выкупа — еженедельный контроль» с клиентом, авто/номером, договором, перечнем файлов и ссылкой.
- [ ] Не создавать личные клиентские сообщения и не выводить пустую секцию.
- [ ] Запустить targeted bot tests.

## Задача 6. Проверка, выпуск и точечное обновление Седова

**Файлы:**
- Изменять только созданную миграцию/скрипт выпуска при необходимости.

- [ ] Запустить `npm run typecheck`, `npm run lint`, targeted tests и `npm run build`.
- [ ] Проверить `git diff --check` и отдельно просмотреть diff затронутых файлов, чтобы не захватить чужие изменения.
- [ ] Выпустить текущий подтверждённый набор изменений по действующей схеме деплоя и применить миграцию.
- [ ] В production сначала найти активную аренду клиента Седова по tenant-scoped SQL, затем точечно установить `LEASE_TO_OWN`; не выбирать запись по догадке.
- [ ] Проверить production: `/rentals`, карточку аренды, ежедневный API/очередь, service health и отсутствие дублей notification jobs.

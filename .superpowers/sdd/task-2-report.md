# Отчёт Task 2 — общий responsive-календарь операций

## Результат

- Добавлен общий client-компонент `OperationsCalendar`, который принимает сериализуемые события,
  месяц и callbacks навигации без зависимостей от Prisma, ТО или мойки.
- На `md` и шире компонент публикует семиколоночную месячную сетку с понедельника по
  воскресенье; на телефоне — повестку по датам без горизонтального контейнера.
- В одном дне изначально показываются первые три записи и кнопка «Ещё N». Раскрытие хранится
  отдельно для каждой ISO-даты.
- События — native-кнопки с областью не меньше 44 px, иконкой, временем, автомобилем, видимым
  русским статусом, tone-токенами и focus-visible стилем.
- Добавлен `CalendarEventDialog` на существующем `Modal`: дата и время в `Europe/Moscow`,
  автомобиль, статус, опциональный доменный action-slot и явная кнопка «Закрыть».
- Контролы месяца используют существующие `IconButton` и `Button`; переходы учитывают
  `prefers-reduced-motion` через `motion-reduce:transition-none`.
- Публичные компоненты и их props экспортируются из `operations-calendar/index.ts`.

## TDD evidence

| Этап | Команда | Результат |
| --- | --- | --- |
| RED | `npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts` | Ожидаемое падение: отсутствовали `CalendarEventDialog` и `OperationsCalendar`. |
| GREEN | `npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts src/shared/components/operations-calendar/calendar-model.test.ts` | PASS: 2 файла, 27 тестов. |
| RED review | `npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts` | Ожидаемое падение: статус события ещё не был визуально опубликован. |
| GREEN review | focused-команда для компонента и модели | PASS: 2 файла, 27 тестов; статус видим и не передаётся только цветом. |

## Проверки

- `npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts src/shared/components/operations-calendar/calendar-model.test.ts` — PASS, 27/27.
- `npm run typecheck` — PASS.
- `npx eslint` для четырёх файлов Task 2 — PASS.
- `npx prettier --check` для четырёх файлов Task 2 — PASS.
- `git diff --check` — PASS.

## Границы и self-review

- Не изменялись Prisma, Server Actions, формы, workspace ТО/мойки и query-параметры страниц.
- Не добавлялись зависимости и новые цветовые значения: использованы существующие Pilot+
  tokens, `Button`, `IconButton`, `Badge`, `Card` и `Modal`.
- Интерактивные browser-сценарии календаря будут проверяться после интеграции в маршруты в
  следующих задачах; текущая задача покрывает общий render-контракт focused unit-тестами.
- Проверены min-width/overflow ограничения, перенос текста в диалоге, native keyboard controls,
  русские accessible names и явный путь закрытия окна.

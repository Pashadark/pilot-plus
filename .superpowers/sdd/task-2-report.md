# Отчёт Task 2 — общий responsive-календарь операций

## Результат

- Добавлен общий client-компонент `OperationsCalendar`, который принимает сериализуемые события,
  месяц и callbacks навигации без зависимостей от Prisma, ТО или мойки.
- На `md` и шире компонент публикует семиколоночную месячную сетку с понедельника по
  воскресенье; на телефоне — повестку по датам без горизонтального контейнера.
- В одном дне изначально показываются первые три записи и кнопка «Ещё N». Раскрытие хранится
  отдельно для каждой ISO-даты; после раскрытия та же кнопка становится «Скрыть», сохраняет
  фокус и публикует состояние через `aria-expanded`, `aria-controls` и live-объявление.
- События — native-кнопки с областью не меньше 44 px, иконкой, временем, автомобилем, видимым
  русским статусом, полной датой в accessible name, tone-фоном/иконкой и контрастным текстом.
- Desktop-календарь использует семантику `grid` / `row` / `columnheader` / `gridcell`, а полные
  подписи дней связаны через `aria-labelledby` без дублирования weekday в одной ячейке.
- Добавлен `CalendarEventDialog` на существующем `Modal`: дата и время в `Europe/Moscow`,
  автомобиль, статус, опциональный доменный action-slot и явная кнопка «Закрыть».
- Выбранное событие хранится по `id` и выводится из актуального массива `events`: открытый
  dialog обновляется при смене props, закрывается при удалении записи и не открывается сам при
  повторном появлении того же `id`.
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
| RED accessibility review | DOM interaction suite с Testing Library и `user-event` | Ожидаемо упали 5 из 8 тестов: disclosure исчезал после раскрытия, дата отсутствовала в accessible name, selection хранила устаревший объект, отсутствовала grid-семантика и status text наследовал tone-цвет. |
| GREEN accessibility review | `npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts src/shared/components/operations-calendar/calendar-model.test.ts` | PASS: 2 файла, 31 тест. |
| RED contrast review | `npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts -t "status и vehicle text"` | Ожидаемое падение: фактический `--color-text-secondary` автомобиля дал минимум 4.4423:1 на tone-фоне. |
| GREEN contrast review | та же focused-команда после замены foreground | PASS: vehicle label использует `--color-text`; размер и weight продолжают задавать визуальную иерархию. |

## Проверки

- `npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts src/shared/components/operations-calendar/calendar-model.test.ts` — PASS, 31/31.
- `npm run test:unit` — PASS, 46 файлов и 223/223 теста.
- DOM-сценарии проверяют раскрытие/сворачивание, стабильный фокус, live-объявления,
  открытие/закрытие dialog с клавиатуры, возврат фокуса, навигационные callbacks, обновление и
  удаление события через props и полные русские accessible names дат.
- Автоматический contrast-тест извлекает фактические foreground-токены status и vehicle label
  из DOM и проверяет оба на всех пяти event-фонах в light/dark; все двадцать сочетаний
  соответствуют минимуму WCAG AA 4.5:1 для текста 12 px.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS для всего проекта.
- `npx prettier --check` для изменённых файлов Task 2 — PASS.
- Общий `npm run format:check` остаётся красным на 13 ранее неформатированных файлах вне
  Task 2; эти пользовательские файлы не изменялись.
- `git diff --check` — PASS.

## Границы и self-review

- Не изменялись Prisma, Server Actions, формы, workspace ТО/мойки и query-параметры страниц.
- В production dependencies и цветовые значения изменений нет: использованы существующие
  Pilot+ tokens, `Button`, `IconButton`, `Badge`, `Card` и `Modal`. Для реальных DOM-interaction
  тестов добавлены только devDependencies: Testing Library, `user-event` и `jsdom`.
- `npm install` сообщил о 6 уже учитываемых audit findings (1 moderate, 5 high); автоматический
  breaking `npm audit fix --force` не запускался, поскольку это вне границ Task 2.
- Проверены min-width/overflow ограничения, перенос текста в диалоге, native keyboard controls,
  русские accessible names, контраст в обеих темах и явный путь закрытия окна.

# Task 3 report — интеграция ТО, мойки и стабильного create-toast

## Результат

- Добавлены чистые доменные мапперы `maintenanceToCalendarEvent(record)` и
  `washToCalendarEvent(record)`. Они преобразуют DTO модулей в общий
  `OperationsCalendarEvent`, сохраняют русские статусы, семантические tone/icon и полную подпись
  автомобиля.
- На `/maintenance` и `/wash` добавлены доступные вкладки «Список» и «Календарь».
  Активный режим принадлежит query-параметру `view=list|calendar`, а выбранный месяц —
  `month=YYYY-MM`.
- Изменение режима и месяца использует Next.js 16 App Router hooks
  `useRouter`/`usePathname`/`useSearchParams`, копирует текущий `URLSearchParams` и сохраняет
  сторонние query-параметры. Некорректные значения безопасно нормализуются существующим
  `parseCalendarMonth`.
- Существующие фильтры, таблицы, мобильные карточки и guarded status actions сохранены в list-mode.
  Состояние фильтров остаётся в workspace при переключении представлений.
- Общий адаптивный `OperationsCalendar` подключён к обоим доменам. Details dialog получает
  существующие action-компоненты ТО/мойки через `onEventAction`; они продолжают вызывать прежние
  tenant-guarded Server Actions.
- Ownership успешного создания перенесён из формы в постоянно смонтированный workspace.
  Форма передаёт `onSuccess(message)`, workspace публикует один success-toast и закрывает modal.
  Ошибки остаются inline через `role="alert"` и не закрывают форму.
- Существующие transition-toast coordinators в обоих workspace не переносились и не ослаблялись.

## TDD

### RED

- `npx vitest run src/modules/maintenance/calendar.test.ts src/modules/wash/calendar.test.ts`
  завершился ожидаемым FAIL: отсутствовали `src/modules/maintenance/calendar.ts` и
  `src/modules/wash/calendar.ts`.
- В `tests/maintenance.spec.ts` и `tests/wash.spec.ts` до production-реализации добавлены
  acceptance-контракты вкладок, URL, reload persistence, календарной сетки и единственного
  create-toast после скрытия dialog.
- Browser RED не дошёл до product assertions: Next.js dev-server аварийно завершил Turbopack
  worker с `TurbopackInternalError: failed to receive message`, причиной в выводе был
  разрыв локального worker-соединения (`os error 10054`).

### GREEN

- Mapper tests: 2 файла, 3 теста — PASS.
- Focused Task 3 + shared calendar: 4 файла, 34 теста — PASS.
- Полный unit-набор: 48 файлов, 226 тестов — PASS.

## Playwright coverage

Targeted specs для обеих страниц теперь проверяют:

- переключение на календарь и `view=calendar`;
- видимость `operations-calendar-grid`;
- сохранение выбранной вкладки после reload;
- запись `month=YYYY-MM` при навигации;
- возврат в `view=list`;
- сохранение стороннего `source=e2e`;
- открытие details dialog для доменного события;
- наличие существующего status action в action slot;
- скрытие create dialog и ровно один matching success-toast.

Фактический targeted Playwright GREEN в этой сессии не получен. Первый запуск завершился
Turbopack panic до assertions. Повторный escalated-запуск был остановлен пользователем после
длительного ожидания и не вернул валидный test summary. После остановки подтверждено отсутствие
listener на порту 3000; generated `test-results` удалён после проверки, что абсолютный путь
находится внутри worktree. Повторный нестабильный E2E по указанию ведущего не запускался.

## Проверки

| Проверка | Результат |
| --- | --- |
| Focused Vitest | PASS — 4 файла, 34 теста |
| Full `npm run test:unit` | PASS — 48 файлов, 226 тестов |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| Scoped `prettier --check` | PASS |
| `git diff --check` | PASS |
| Targeted Playwright | BLOCKED — Turbopack panic / прерванный повтор |

## Ограничения и safeguards

- Prisma schema, migrations, generated client, Server Actions, tenant authorization и permissions
  не менялись.
- Новые зависимости не добавлялись.
- `progress.md` не изменялся.
- Maintenance records без `scheduledAt` намеренно не попадают в календарь и остаются доступны в
  list-mode.
- Компоненты используют существующие Pilot+ Tabs, Badge, Button, Modal и семантические
  design-токены; новый hard-coded цвет или отдельная UI-система не добавлялись.

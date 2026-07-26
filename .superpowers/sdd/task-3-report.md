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
  сторонние query-параметры. Общий `canonicalizeOperationsCalendarQuery` нормализует URL через
  `router.replace`: `view` всегда становится `list|calendar`, calendar-mode всегда получает
  валидный `month=YYYY-MM`, а list-mode удаляет неактуальный `month`. Проверка `changed`
  предотвращает replace-loop и лишние записи истории.
- Существующие фильтры, таблицы, мобильные карточки и guarded status actions сохранены в list-mode.
  Состояние фильтров остаётся в workspace при переключении представлений.
- Общий адаптивный `OperationsCalendar` подключён к обоим доменам. Details dialog получает
  существующие action-компоненты ТО/мойки через `onEventAction`; они продолжают вызывать прежние
  tenant-guarded Server Actions.
- Общий календарь поддерживает необязательный `renderEventStatus(event)`: если домен передаёт
  renderer, он полностью заменяет generic badge, а без renderer сохраняется прежний fallback.
  ТО и мойка используют существующие `MaintenanceStatusBadge` и `WashStatusBadge` для выбранной
  актуальной записи, не меняя action slots.
- Короткий заголовок wash-события остаётся строго названием вида мойки. Необязательный
  `renderEventDetails(event)` показывает доменные сведения только в открытом details dialog;
  мойка использует его для отображения уникального подрядчика без перегрузки календарной сетки.
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
- Для последнего review-fix focused RED подтвердил две причины: mapper возвращал заголовок с
  provider, а общий details dialog игнорировал доменные поля.

### GREEN

- Mapper tests стали table-driven и покрывают все пять статусов ТО и все четыре статуса мойки.
- Review-fix focused pure/shared/domain: 4 файла, 25 тестов — PASS.
- Последний review-fix focused GREEN: 2 файла, 16 тестов — PASS; mapper test отдельно требует
  точный заголовок `Комплексная`, shared interaction test проверяет details renderer.
- Итоговые числа focused и full unit-набора приведены ниже по результатам финальной проверки.

## Playwright coverage

Targeted specs для обеих страниц теперь проверяют:

- переключение на календарь и `view=calendar`;
- канонизацию некорректного `month` и удаление `month` в list-mode без потери `source=e2e`;
- видимость `operations-calendar-grid`;
- сохранение выбранной вкладки после reload;
- запись `month=YYYY-MM` при навигации;
- возврат в `view=list`;
- сохранение стороннего `source=e2e`;
- открытие details dialog для доменного события;
- отображение существующего доменного status badge с иконкой вместо generic badge;
- наличие существующего status action в action slot;
- скрытие create dialog и ровно один matching success-toast.

Wash calendar строит точное accessible name кандидата из плановой даты и времени, вида мойки,
автомобиля и статуса. Если таких записей несколько, тест последовательно открывает каждую,
проверяет уникальный provider в details dialog и безопасно закрывает несовпавшие; `.first()` не
используется как доказательство созданной записи.

Фактический targeted Playwright GREEN в этой сессии не получен. Первый запуск завершился
Turbopack panic до assertions. Повторный escalated-запуск был остановлен пользователем после
длительного ожидания и не вернул валидный test summary. После остановки подтверждено отсутствие
listener на порту 3000; generated `test-results` удалён после проверки, что абсолютный путь
находится внутри worktree. Повторный нестабильный E2E по указанию ведущего не запускался.

## Проверки

| Проверка | Результат |
| --- | --- |
| Focused Vitest | PASS — 5 файлов, 49 тестов |
| Full `npm run test:unit` | PASS — 49 файлов, 241 тест |
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

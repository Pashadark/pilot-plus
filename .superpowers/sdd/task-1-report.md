# Отчёт Task 1 — чистая модель календаря операций

## Изменения

- Добавлены сериализуемые контракты события календаря, дня и месяца.
- Добавлены чистые функции нормализации месяца, построения полной сетки с понедельника по воскресенье и группировки событий по дню `Europe/Moscow`.
- Добавлены unit-тесты для сетки июля 2026 года, московской границы суток, обработки некорректного месяца, отметки сегодняшнего дня и порядка событий.
- Добавлен публичный API общего календарного модуля.
- Устранена особая обработка JavaScript годов `0–99`: date-only арифметика использует `setUTCFullYear`, а ISO-даты всегда имеют вид `YYYY-MM-DD`.
- `startsAt` теперь принимается только в строгом RFC3339-формате с `Z` или `±HH:mm`; строки без смещения и несуществующие календарные даты исключаются из группировки.

## TDD и проверки

| Команда | Результат |
| --- | --- |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` до реализации | RED: модуль `./calendar-model` отсутствовал. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после реализации | PASS: 1 файл, 6 тестов. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после замечаний ревью | RED: 3 ожидаемых падения для годов `< 100`, timezone-less строки и `2026-02-30`. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после исправления | PASS: 1 файл, 13 тестов. |
| `npm run typecheck` | PASS. |
| `npm run lint -- src/shared/components/operations-calendar` | PASS. |
| `npx prettier --check` для четырёх файлов календаря | PASS. |
| `git diff --cached --check` | PASS: пробельных ошибок нет. |

## Известные ограничения

- Модель строит пустые массивы `events` в ячейках; компонент следующей задачи сопоставит их с результатом `groupCalendarEvents`.
- В общем контракте нет отдельного канала ошибок: невалидные `startsAt`, включая строки без timezone offset, молча исключаются из группировки.

# Отчёт Task 1 — чистая модель календаря операций

## Изменения

- Добавлены сериализуемые контракты события календаря, дня и месяца.
- Добавлены чистые функции нормализации месяца, построения полной сетки с понедельника по воскресенье и группировки событий по дню `Europe/Moscow`.
- Добавлены unit-тесты для сетки июля 2026 года, московской границы суток, обработки некорректного месяца, отметки сегодняшнего дня и порядка событий.
- Добавлен публичный API общего календарного модуля.
- Устранена особая обработка JavaScript годов `0–99`: date-only арифметика использует `setUTCFullYear`, а ISO-даты в основном диапазоне имеют вид `YYYY-MM-DD`.
- `startsAt` теперь принимается только в строгом RFC3339-формате с `Z` или `±HH:mm`; строки без смещения и несуществующие календарные даты исключаются из группировки.
- Все месяцы, разрешённые regex-контрактом `0000-01`…`9999-12`, принимаются. Spillover-дни граничных сеток используют ISO 8601 expanded years: `-000001-MM-DD` и `+010000-MM-DD`.
- Fallback невалидного месяца возвращает канонический московский `YYYY-MM` для годов `0000–9999`; для `now` за пределами диапазона или невалидного `Date` выбран безопасный fallback `1970-01`.
- Единый internal-нормализатор бизнес-даты использует era-aware московский год для месяца и `isToday`; fallback-дата всегда `1970-01-01` и не вызывает `RangeError`.
- Группировка событий использует то же era-aware преобразование, поэтому RFC3339-события года `0000` и московский spillover в expanded предыдущий год получают корректные ключи.

## TDD и проверки

| Команда | Результат |
| --- | --- |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` до реализации | RED: модуль `./calendar-model` отсутствовал. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после реализации | PASS: 1 файл, 6 тестов. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после замечаний ревью | RED: 3 ожидаемых падения для годов `< 100`, timezone-less строки и `2026-02-30`. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после исправления | PASS: 1 файл, 13 тестов. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после повторного ревью | RED: `0000-01` проходил regex, хотя сетка выходила в год `-0001`. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после граничного исправления | PASS: 1 файл, 17 тестов. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после финального изменения подхода | RED: 4 ожидаемых падения для expanded ISO и fallback годов `0000/0099/9999`. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после поддержки expanded ISO | PASS: 1 файл, 18 тестов. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после последних замечаний ревью | RED: `Invalid Date` выбрасывал `RangeError`, а 0000 не отмечал `isToday`. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после нормализации business date | PASS: 1 файл, 20 тестов. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после замечания о группировке событий | RED: события года `0000` получали era-сдвинутые ключи. |
| `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts` после era-aware группировки | PASS: 1 файл, 22 теста. |
| `npm run typecheck` | PASS. |
| `npm run lint -- src/shared/components/operations-calendar` | PASS. |
| `npx prettier --check` для четырёх файлов календаря | PASS. |
| `git diff --cached --check` | PASS: пробельных ошибок нет. |

## Известные ограничения

- Модель строит пустые массивы `events` в ячейках; компонент следующей задачи сопоставит их с результатом `groupCalendarEvents`.
- В общем контракте нет отдельного канала ошибок: невалидные `startsAt`, включая строки без timezone offset, молча исключаются из группировки.

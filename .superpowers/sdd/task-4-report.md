# Task 4 report — mobile acceptance, документация и финальная проверка календарей

## Статус

**BLOCKED.** Усиленный post-review browser gate не прошёл: mobile wash получил успешный ответ
Server Action, но форма создания не закрылась за штатный Playwright timeout 5 секунд. По правилу
review после первого flake второй browser-run не запускался. Merge в `main`, push и cleanup
worktree не выполнялись.

## Изменения

- `tests/maintenance.spec.ts` и `tests/wash.spec.ts` проверяют для обоих модулей:
  - безопасную нормализацию невалидного `month` в текущий месяц `Europe/Moscow`;
  - точный URL и порядок query-параметров для перехода
    `2026-12 → 2027-01 → 2026-12` с сохранением `source=e2e`;
  - возврат «Сегодня» и невалидного месяца в текущий месяц `Europe/Moscow`;
  - mobile viewport 390×844, видимую повестку и скрытую desktop-сетку;
  - отсутствие горизонтального переполнения документа и details dialog;
  - область календарных событий и трёх month-controls не меньше 44×44 px;
  - раскрытие четырёх событий одного дня через «Ещё 1»;
  - открытие details dialog клавишей Enter.
- Общий test-helper для create-сценариев требует видимую форму и активный save-control, ждёт
  конкретный POST с заголовком `next-action` на `/maintenance` или `/wash`, успешный HTTP-ответ,
  стабильный pathname, закрытие формы и ровно один success-toast.
- Перед следующим setup-созданием toast закрывается и обязательно удаляется из DOM через
  `toHaveCount(0)`.
- `README.md` и `docs/PROJECT_GUIDE.md` документируют list/calendar URL для ТО и мойки,
  сериализуемую границу `OperationsCalendarEvent`, московский бизнес-месяц, ownership create-toast
  постоянно смонтированным workspace и ограничения этапа.
- Product-код, Prisma, Server Actions, tenant authorization, зависимости и общий
  `playwright.config.ts` не изменялись.

## Диагностика Playwright

Репозиторный `webServer` запускает `next dev`, а предыдущий Task 3 был заблокирован аварией
Turbopack worker. Локальная документация установленного Next.js 16.2 рекомендует E2E на
production-коде и подтверждает команды `next build --webpack` и `next start`.

Для этой проверки выполнены:

1. `npx next build --webpack`;
2. production `next start` на изолированном `127.0.0.1:3104`;
3. targeted Playwright через временную конфигурацию с тем же base URL и одним desktop worker.

Pre-review browser-запуски помогли уточнить тестовую синхронизацию:

- maintenance Server Action revalidation заменяла client-subtree сразу после создания; после
  проверки toast/stat тест перезагружает календарный URL и открывает уже сохранённое событие;
- после раскрытия кнопка «Ещё 1» корректно меняет accessible name на «Скрыть», поэтому
  дальнейшая проверка использует новый locator;
- закрываемый transition-toast оставался в DOM на exit-анимации;
- production POST мойки содержит query string, который не покрывал старый route pattern.

Pre-review controlled rerun проходил 4/4, но не связывал submit с конкретным Server Action
response и не ждал удаления каждого toast. Поэтому этот результат больше не используется как
доказательство готовности.

Post-review первый production-run завершился **3/4 PASS**:

- maintenance desktop — PASS;
- maintenance mobile — PASS;
- wash desktop — PASS;
- wash mobile — FAIL.

В failing mobile wash запрос с `next-action` на `/wash` завершился успешным HTTP-ответом,
`page.url()` сохранил pathname `/wash`, но `getByRole('dialog')` оставался видимым после 5 секунд
ожидания. Ошибка зафиксирована в `tests/helpers/operations-calendar.ts:47`. Timeout не увеличивался:
серверный ответ уже был получен, а блокирующим этапом оказался клиентский lifecycle результата.
По review gate повторный browser-run и новые исправительные циклы не выполнялись.

Listener остановлен, временная конфигурация и `test-results` удалены, порт 3104 свободен.

## Финальные проверки

| Проверка | Результат |
| --- | --- |
| Focused Vitest: shared model/component/query + два mapper | PASS — 5 файлов, 49/49 тестов |
| `npm run test:unit` | PASS — 49 файлов, 241/241 тест |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| Scoped `prettier --check` для task-файлов и отчёта | PASS |
| Targeted production Playwright после review | BLOCKED — 3/4 PASS, mobile wash form remained open |
| `npm run build` | PASS; routes `/maintenance` и `/wash` присутствуют |
| `git diff --check` | PASS |

`npm run build` сохранил два известных неблокирующих предупреждения проекта: inferred workspace
root из-за двух lockfiles и широкий NFT trace через generated Prisma client. Новых предупреждений
или изменений product-кода для них не добавлялось.

## Известные границы

- Нет drag-and-drop переноса.
- Нет недельного/дневного режима.
- Нет повторяющихся правил.
- Нет синхронизации с внешними календарями.

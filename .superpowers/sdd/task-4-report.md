# Task 4 report — mobile acceptance, документация и финальная проверка календарей

## Статус

**PASS.** Обязательные статические, unit, production build и targeted browser-проверки прошли.
Блокирующих ошибок нет. Merge в `main`, push и cleanup worktree не выполнялись: эти действия
оставлены ведущему после final review.

## Изменения

- `tests/maintenance.spec.ts` и `tests/wash.spec.ts` проверяют для обоих модулей:
  - безопасную нормализацию невалидного `month` в текущий месяц `Europe/Moscow`;
  - точные URL-значения предыдущего, следующего и текущего месяца после «Сегодня»;
  - mobile viewport 390×844, видимую повестку и скрытую desktop-сетку;
  - отсутствие горизонтального переполнения документа и details dialog;
  - область календарных событий и трёх month-controls не меньше 44×44 px;
  - раскрытие четырёх событий одного дня через «Ещё 1»;
  - открытие details dialog клавишей Enter.
- Существующие create-сценарии продолжают доказывать закрытие формы и ровно один success-toast
  на один успешный ответ. Между несколькими setup-созданиями тест явно закрывает предыдущий toast
  и ждёт завершения exit-состояния.
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

Первые диагностические запуски нашли только тестовую синхронизацию:

- maintenance Server Action revalidation заменяла client-subtree сразу после создания; после
  проверки toast/stat тест перезагружает календарный URL и открывает уже сохранённое событие;
- после раскрытия кнопка «Ещё 1» корректно меняет accessible name на «Скрыть», поэтому
  дальнейшая проверка использует новый locator;
- закрываемый transition-toast оставался в DOM на exit-анимации;
- production POST мойки содержит query string, который не покрывал старый route pattern.

После уточнения acceptance полный controlled rerun прошёл: **4/4 PASS за 15.2 s**. Listener
остановлен, временная конфигурация и `test-results` удалены, порт 3104 свободен.

## Финальные проверки

| Проверка | Результат |
| --- | --- |
| Focused Vitest: shared model/component/query + два mapper | PASS — 5 файлов, 49/49 тестов |
| `npm run test:unit` | PASS — 49 файлов, 241/241 тест |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| Scoped `prettier --check` для task-файлов и отчёта | PASS |
| Targeted production Playwright | PASS — 4/4 теста |
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

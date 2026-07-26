# Task 4 report — mobile acceptance и финальная проверка календарей

## Канонический статус

**READY.** Финальный production gate прошёл 8/8 с `--repeat-each=2`. Merge в `main`, push и cleanup
worktree в рамках Task 4 не выполнялись.

Полная диагностика двух follow-up lifecycle-дефектов, TDD evidence и точные проверки находятся в
[`wash-success-lifecycle-report.md`](wash-success-lifecycle-report.md).

## Реализованный acceptance-контракт

`tests/maintenance.spec.ts` и `tests/wash.spec.ts` проверяют:

- безопасную нормализацию невалидного `month` в текущий месяц `Europe/Moscow`;
- точный URL и порядок query-параметров при навигации между месяцами;
- возврат «Сегодня» в текущий московский месяц;
- mobile viewport 390×844, видимую повестку и скрытую desktop-сетку;
- отсутствие горизонтального переполнения документа и details dialog;
- области календарных событий и month-controls не меньше 44×44 px;
- раскрытие четырёх событий одного дня;
- открытие details dialog клавишей Enter;
- конкретный `POST` с заголовком `next-action`;
- успешный HTTP-ответ и неизменный pathname;
- закрытие create dialog;
- ровно один matching success-toast;
- обновлённые records, статистику и созданное событие после success.

Общий helper перед следующим setup-созданием закрывает toast и ждёт его удаления из DOM.

## История диагностики

### 1. Потерянное завершение временной формы

Первый post-review gate завершился 3/4: mobile wash получил успешный action response, но dialog
остался видим. Причиной был `useEffect([state])` внутри временной формы: завершение запроса зависело
от passive effect и идентичности action state.

Исправление:

- каждая client action-функция ожидает существующий Server Action;
- каждый resolved success сразу вызывает workspace callback;
- workspace показывает toast и закрывает dialog;
- ошибки остаются inline и не завершают success lifecycle.

### 2. Устаревший RSC payload после завершённого success lifecycle

Следующий reviewer gate с `--repeat-each=2` завершился 7/8: maintenance desktop во втором повторе
получил успешный response, dialog закрылся и toast был один, но `maintenance-overdue-stat`
оставался `0` вместо `1` в течение штатных 5 секунд.

Это был отдельный этап: action result уже обработан, но workspace продолжал видеть старые server
props. `revalidatePath` и action return приходят одним Flight response; production evidence
показал, что одного seeded RSC merge недостаточно как стабильной acceptance-синхронизации.

Минимальное симметричное исправление для maintenance и wash:

```text
showToast → setFormOpen(false) → router.refresh()
```

`router.refresh()` делает отдельное чтение текущего маршрута после server-cache invalidation,
сливает свежий RSC payload и по контракту Next.js 16.2 сохраняет незатронутый client/browser state.
Query, выбранные `view`/`month`, локальные фильтры и scroll не переписываются. Error response не
вызывает refresh.

Timeout acceptance-тестов не увеличивался.

## TDD

Component regression для обоих workspace зафиксировал RED:

- matching toast: 1;
- dialog: закрыт;
- `router.refresh`: 0 вместо 1.

GREEN требует для двух последовательных success:

- два action completion;
- два toast;
- два закрытия dialog;
- ровно два `router.refresh`;
- ни одного `router.replace`;
- сохранённый локальный поисковый фильтр.

Form tests отдельно требуют, чтобы action error оставлял форму в error state и не вызывал
workspace `onSuccess`, следовательно не создавал toast/close/refresh lifecycle.

## Финальные проверки

| Проверка | Результат |
| --- | --- |
| Focused lifecycle Vitest | PASS — 4 файла, 6 тестов |
| Full `npm run test:unit` | PASS — 53 файла, 247 тестов |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; `/maintenance` и `/wash` присутствуют |
| Production targeted `--repeat-each=2` | PASS — 8/8 за 37.1 с |
| `git diff --check` | PASS |

Production gate:

```powershell
npx playwright test tests/maintenance.spec.ts tests/wash.spec.ts `
  --project=desktop --workers=1 --repeat-each=2
```

Сохранены известные предупреждения проекта о двух lockfiles и широком NFT trace generated Prisma
client. Production listener остановлен, `test-results` и `playwright-report` удалены.

## Границы этапа

- Нет drag-and-drop переноса.
- Нет недельного/дневного режима.
- Нет повторяющихся правил.
- Нет синхронизации с внешними календарями.

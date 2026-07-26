# Отчёт: жизненный цикл успешного создания мойки

Дата: 26 июля 2026 года

## Исходный симптом

Production acceptance-проверка Task 4 получила успешный HTTP-ответ на Server Action:

- `POST /wash` с заголовком `next-action`;
- `response.ok() === true`;
- pathname оставался `/wash`;
- спустя штатные 5 секунд mobile dialog создания мойки всё ещё был видим;
- success-toast не завершал ожидаемый workspace lifecycle.

Timeout не увеличивался: серверная мутация уже завершилась, поэтому проблема находилась между
получением action-result и клиентской обработкой успеха.

## Причина

Документация этапа объявляла владельцем success lifecycle постоянно смонтированный workspace, но
реализация перенесла туда только callback:

- `WashWorkspace` и `MaintenanceWorkspace` публиковали toast и закрывали dialog;
- `useActionState` и `useEffect`, решавший вызвать callback, оставались внутри краткоживущих
  `WashForm` и `MaintenanceForm`;
- эффект зависел от значения `state`, а не от факта завершения конкретной отправки.

Это создавало два связанных условия гонки:

1. `revalidatePath` и возвращаемое значение Server Action приходят в одном Flight response. React
   одновременно применяет обновлённое серверное дерево и action-result, поэтому passive effect
   временной формы не является надёжной границей завершения запроса.
2. `useActionState` использует reducer `(_, newState) => newState`; React не считает
   `Object.is`-равное состояние новым render-событием. Повторный success с тем же state object и
   сообщением не запускает эффект повторно.

Второе условие воспроизведено без таймингов: action был вызван два раза, но прежний эффект передал
успех workspace только один раз. Оно также объясняет, почему повторная попытка не гарантировала
восстановление уже зависшего диалога.

## Проверенные альтернативы

- Server Action действительно сохранял запись и вызывал `revalidatePath('/wash')`; HTTP-ошибки и
  tenant authorization не были причиной.
- `Modal` при `open=false` возвращает `null`, но одного remount/key недостаточно: результат всё
  равно сначала должен пройти через эффект формы.
- `pending` корректно блокировал повторный submit только на время action; увеличение ожидания не
  исправляло потерянное completion-событие.
- ToastProvider генерирует отдельный id для каждого вызова и не подавляет одинаковые заголовки.

## TDD

Добавлены component regression-тесты для мойки и ТО:

- одна и та же смонтированная форма отправляется два раза;
- mock action оба раза возвращает один и тот же success object;
- проверяется два вызова Server Action и два вызова `onSuccess`.

RED:

- `WashForm.test.ts`: action 2 раза, `onSuccess` 1 раз;
- `MaintenanceForm.test.ts`: action 2 раза, `onSuccess` 1 раз.

GREEN:

- оба теста проходят;
- action 2 раза, `onSuccess` 2 раза для каждого домена.

## Исправление

В обеих формах passive `useEffect([state])` заменён стабильной client action-функцией для
`useActionState`:

1. функция ожидает существующий tenant-guarded Server Action;
2. каждый конкретный resolved success сразу сбрасывает форму и вызывает workspace
   `onSuccess(message)`;
3. результат возвращается в `useActionState`, поэтому inline validation/error state и `pending`
   продолжают работать;
4. workspace по-прежнему единолично публикует success-toast и закрывает dialog.

Таким образом completion принадлежит факту завершения каждой action invocation, а не последующему
render/effect и не сравнению payload по идентичности. Server Actions, revalidation, Prisma и
acceptance timeout не менялись.

## Проверки

| Проверка | Результат |
| --- | --- |
| RED WashForm | FAIL как ожидалось: `onSuccess` 1 вместо 2 |
| RED MaintenanceForm | FAIL как ожидалось: `onSuccess` 1 вместо 2 |
| Focused GREEN | PASS — 2 файла, 2 теста |
| Full `npm run test:unit` | PASS — 51 файл, 243 теста |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; `/maintenance` и `/wash` присутствуют |
| Production targeted run 1 | PASS — 4/4 |
| Production targeted run 2 | PASS — 4/4 |

Production gate использовал `next start`, один desktop worker и существующие четыре
maintenance/wash acceptance-сценария, включая mobile viewport внутри тестов. Оба последовательных
запуска проверяли конкретный `next-action` response, скрытие dialog и один matching success-toast.

Сохранены два известных предупреждения проекта: выбор workspace root из-за двух lockfiles и
широкий NFT trace generated Prisma client. После проверки production listener остановлен,
`test-results` и `playwright-report` удалены.

## Follow-up: синхронизация RSC-данных workspace

Повторная production-проверка Task 4 с `--repeat-each=2` обнаружила отдельный этап того же
пользовательского lifecycle:

- maintenance desktop во втором повторе получил успешный `next-action` response;
- dialog закрылся;
- matching success-toast был один;
- `maintenance-overdue-stat` оставался `0` вместо `1` в течение штатных 5 секунд.

Это исключило форму, action result и toast lifecycle: устаревшими остались серверные `records`,
переданные workspace. Хотя `revalidatePath` должен включать обновлённый RSC payload в тот же Flight
response, production evidence показал, что seeded navigation не является достаточно стабильным
единственным сигналом для acceptance read-your-own-write.

Локальная документация Next.js 16.2 подтверждает, что client `router.refresh()`:

- делает новый запрос текущего маршрута;
- повторно получает и сливает RSC payload;
- не сбрасывает незатронутый React `useState`, scroll и browser state;
- не меняет pathname или query-параметры.

Поэтому workspace success coordinator теперь выполняет строго:

1. один `showToast`;
2. `setFormOpen(false)`;
3. один `router.refresh()`.

Refresh не вызывается из формы и не запускается для error state. Server Action по-прежнему
выполняет `revalidatePath`: он инвалидирует server cache, а последующий client refresh гарантирует
новое чтение уже инвалидированных данных.

### Follow-up TDD

Новые component-тесты `MaintenanceWorkspace.test.ts` и `WashWorkspace.test.ts` сначала получили
корректный RED:

- toast — 1;
- dialog закрыт;
- `router.refresh` — 0 вместо 1.

После исправления два последовательных success в каждом workspace дают ровно два toast и два
refresh. Тесты также требуют отсутствие `router.replace`, сохранение локального поискового фильтра
и отсутствие `onSuccess` у форм при action error.

### Итоговая follow-up-проверка

| Проверка | Результат |
| --- | --- |
| Focused lifecycle Vitest | PASS — 4 файла, 6 тестов |
| Full `npm run test:unit` | PASS — 53 файла, 247 тестов |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Production targeted `--repeat-each=2` | PASS — 8/8 |

Production listener остановлен, browser-артефакты удалены. Канонический итог Task 4 зафиксирован в
[`task-4-report.md`](task-4-report.md).

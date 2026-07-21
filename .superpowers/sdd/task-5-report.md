# Task 5 — полноценная страница мойки

## Статус

Реализован защищённый маршрут `/wash` в общей оболочке Pilot+ с хлебными крошками и русским доменным интерфейсом. Серверная страница параллельно получает tenant-scoped записи мойки из Task 4 и 130 доступных автомобилей с локальными WebP из Task 3.

`WashWorkspace` показывает показатели «Сегодня», «В работе», «Завершено за месяц» и «Требуют мойки», поиск, фильтры вида и статуса, desktop-таблицу и отдельные mobile-карточки. Статусы имеют semantic tone, иконку и русскую подпись. Запланированную мойку можно начать или отменить, активную — завершить или отменить.

Форма планирования использует реальные vehicle options, показывает локальное главное изображение выбранного автомобиля и отправляет существующий `createWashAction`. Один workspace-level `useActionState` координирует переходы статуса и тосты, поэтому результат действия остаётся видимым после серверного rerender и даже когда запись исчезает из текущего фильтра.

Добавлены route-level loading и безопасный error state, а также точное пустое состояние «Записи не найдены / Измените поиск или фильтры.». В браузер не выводятся исходные исключения.

## TDD

1. До production-кода добавлен `tests/wash.spec.ts` с tenant-scoped `afterAll` cleanup.
2. RED подтверждён focused Playwright: оба сценария ожидаемо упали на отсутствующем `data-testid="wash-page"` маршрута `/wash`.
3. После минимальной реализации первый GREEN-прогон выявил ошибку тестового локатора: он выбирал фоновый фильтр «Вид мойки», оставляя обязательный «Тип мойки» в диалоге пустым. Локатор сужен до `dialog`, production-валидация не ослаблялась.
4. Финальный GREEN: создание, фильтрация, старт, завершение, устойчивый transition toast, пустое состояние, mobile 44 px и отсутствие горизонтального overflow прошли.

## Self-review

- Route contract использует `requireAdmin`, `Promise.all`, `listWashRecordsForUser` и `listVehicleOptionsForUser`.
- Доступ к данным и переходы статуса остаются в существующих tenant-scoped Task 4 actions/queries; Prisma schema, maintenance и роли не менялись.
- Workspace-level transition coordinator повторяет исправленный maintenance-паттерн и проверяется после исчезновения записи из активного фильтра.
- E2E cleanup удаляет только записи с process-specific provider prefix и только через компанию тестового администратора.
- Таблица существует только на `md+` и ограничивает широкое содержимое собственным horizontal scroll; mobile-карточки и формы используют `min-w-0`, перенос текста и общие 44 px controls.
- Все статусы различимы не одним цветом: badge содержит иконку и русскую подпись.
- Error state не рендерит `error.message`, а empty state использует согласованный копирайт brief.

## Проверки

- `npx playwright test tests/wash.spec.ts --project=desktop --workers=1` с переменными из корневого `.env` — 2/2 PASS.
- `npx vitest run src/modules/wash/validation.test.ts src/modules/wash/status.test.ts src/modules/wash/server/queries.test.ts src/modules/wash/actions.test.ts` — 17/17 PASS.
- `npm run typecheck` — PASS.
- `npx eslint` для девяти изменённых TypeScript/TSX-файлов — PASS.
- `npx prettier --check` для девяти изменённых TypeScript/TSX-файлов — PASS.
- `git diff --cached --check` — PASS.

Первый sandbox-запуск focused Vitest не смог загрузить `vitest.config.ts` из-за известного `esbuild Access is denied`; немедленный повтор того же набора вне sandbox прошёл полностью. Playwright выводит существующее предупреждение Next.js о нескольких lockfile и inferred workspace root; на результат тестов оно не влияет, конфигурация проекта в этой задаче не менялась.

## Коммит функциональности

- `f2dcb59 feat: add wash workspace`

## Review fixes

- Введена доменная константа `CLEAN_WASH_WINDOW_DAYS = 7` и чистая функция `calculateFleetCleanliness(vehicleOptions, records, referenceTime)`. Для каждого уникального vehicle option она выбирает последнюю завершённую мойку: не старше семи дней — `CLEAN`, отсутствующая или более старая — `NEEDS_WASH`.
- KPI «Требуют мойки» теперь равен числу уникальных tenant vehicle options со статусом `NEEDS_WASH`, а не числу записей мойки. На чистой E2E-базе проверяется реальное значение 130 и уменьшение до 129 после завершения мойки одного автомобиля.
- KPI «Сегодня» считает только сегодняшние `PLANNED` и `IN_PROGRESS`; `COMPLETED` и `CANCELLED` исключены. E2E проверяет увеличение на единицу после планирования, сохранение значения в работе и возврат после завершения.
- В desktop-таблицу и mobile-карточку добавлен cleanliness badge с иконкой, русской подписью «Чистый»/«Требует мойки» и semantic tone.
- Отмена больше не отправляет действие напрямую. Кнопка открывает `ConfirmationDialog`, а скрытая cancel-submit вызывается через `requestSubmit` только после «Подтвердить». E2E проверяет отсутствие перехода и transition-тоста до подтверждения, затем статус `CANCELLED` и устойчивый success toast.
- Pending-состояние связано с парой `recordId + targetStatus`: loading показывается только на выбранном действии выбранной записи; остальные действия временно отключаются без ложных spinner/копирайта «Обновляем…» во всех строках.
- Мобильный тест дополнительно проверяет отсутствие horizontal overflow при открытом planning dialog и после выбора автомобиля/появления локального WebP; все видимые controls по-прежнему не меньше 44 px.

### Review TDD

1. RED unit: `src/modules/wash/cleanliness.test.ts` ожидаемо завершился `Cannot find module './cleanliness'` до создания production-модуля.
2. GREEN unit: четыре cleanliness-сценария прошли — нет завершённой мойки, свежая, устаревшая, несколько записей одного автомобиля с уникальным fleet count.
3. RED E2E после cleanliness GREEN дошёл до отмены и ожидаемо упал на отсутствующем диалоге «Отменить мойку?», подтвердив, что старый cancel отправлялся сразу.
4. GREEN E2E после confirmation/pending исправления прошёл весь desktop и mobile workflow.

### Проверки после review

- `npx vitest run src/modules/wash/cleanliness.test.ts src/modules/wash/validation.test.ts src/modules/wash/status.test.ts src/modules/wash/server/queries.test.ts src/modules/wash/actions.test.ts` — 5 файлов, 21/21 PASS.
- `npx playwright test tests/wash.spec.ts --project=desktop --workers=1` с переменными из корневого `.env` — 2/2 PASS.
- `npm run typecheck` — PASS.
- `npx eslint src/modules/wash/cleanliness.ts src/modules/wash/cleanliness.test.ts src/modules/wash/components/WashWorkspace.tsx src/modules/wash/components/WashRecordCard.tsx tests/wash.spec.ts` — PASS.
- `npx prettier --check src/modules/wash/cleanliness.ts src/modules/wash/cleanliness.test.ts src/modules/wash/components/WashWorkspace.tsx src/modules/wash/components/WashRecordCard.tsx tests/wash.spec.ts` — PASS после механического форматирования обновлённого E2E-файла.
- `git diff --cached --check` — PASS.

## Коммит review fixes

- `e0e6e50 fix: address wash workspace review`

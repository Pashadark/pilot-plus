# Task 6 — финальная интеграция ТО и мойки

## Статус

Task 6 завершён. Единая desktop/mobile-навигация содержит пункты «Техническое обслуживание»
и «Мойка» в согласованном порядке с `FiTool` и `FiDroplet`, без дублирования массивов меню.

Подробности автомобиля получают tenant-scoped типизированные summaries последних записей ТО и
моек. Вкладка «Обслуживание» показывает две read-only секции на общих `Card` и `Badge`, русские
виды и статусы, даты, пробег, стоимость и исполнителя. Если один вид истории отсутствует, его
секция остаётся видимой с честным пустым состоянием; если отсутствуют обе истории, сохраняется
общий empty state вкладки.

Canonical `docs/PROJECT_GUIDE.md` обновлён текущими маршрутами, моделями `MaintenanceRecord` и
`WashRecord`, правилами tenant authorization Server Actions, фактическим состоянием модулей и
отложенной admin-controlled RBAC. Новые роли не добавлялись.

## Безопасность и данные

- Detail lookup по-прежнему ограничен `vehicle.id` и членством пользователя в компании.
- DTO не передаёт `companyId`, внутренние поля сессии или данные чужого tenant.
- `MaintenanceStatus`, `MaintenanceKind`, `WashStatus` и `WashKind` больше не представлены
  произвольными строками в vehicle detail DTO.
- List query отделён от detail query: карточки автопарка выбирают только необходимые поля,
  последнюю позицию/поездку и главное изображение; до 50 записей ТО/мойки на каждый автомобиль
  загружаются только для detail page.
- E2E history fixture создаёт пару ТО/мойка одной Prisma-транзакцией и удаляет только записи по
  возвращённым идентификаторам в `finally`.

## TDD

### Основной RED → GREEN

1. `Sidebar.test.ts` ожидаемо упал: `/wash` отсутствовал, а подпись ТО была сокращённой.
2. `queries.test.ts` ожидаемо упал: целевой пробег оставался Prisma Decimal-like значением,
   wash history отсутствовала в select/DTO.
3. `VehicleDetailPage.test.ts` ожидаемо упал: UI показывал сырой `COMPLETED`, не имел русских
   history headings и не рендерил мойки.
4. После минимальной реализации focused Vitest прошёл: 3 файла, 9/9 тестов.

### Review RED → GREEN

Независимый read-only review не нашёл Critical issues, но обнаружил три Important issues:
избыточную загрузку detail histories в fleet list, неатомарное создание E2E fixture и слишком
общие assertions со старой датой мойки.

1. Новый query assertion ожидаемо упал, потому что list select содержал `maintenanceRecords` и
   `washRecords`.
2. Новый UI assertion ожидаемо упал, потому что отсутствующая wash subsection полностью
   скрывалась.
3. После split card/detail select, subsection empty state и усиления E2E fixture focused Vitest
   прошёл: 3 файла, 10/10 тестов.
4. Финальный `tests/vehicles.spec.ts` после review-fixes прошёл: 6/6.

Первый sandbox-повтор focused Vitest после review-fixes не смог загрузить `vitest.config.ts` из-за
известной ошибки esbuild `Access is denied`; немедленный разрешённый повтор вне sandbox прошёл
10/10. Это ограничение среды, не падение тестов продукта.

## Найденные и исправленные регрессии targeted suite

- Dashboard-тест ожидал, что `/` не будет перехвачен при видимом global search, что
  противоречило действующему unit-контракту shortcut. Ожидание синхронизировано: событие
  предотвращается, поиск получает фокус.
- Vehicles-тест мог увидеть одновременно loading и final `AppShell`. `beforeEach` теперь ждёт
  `vehicle-list-page` до assertions.
- Первый history E2E использовал Link prefetch, выполненный до создания fixture, и мог получить
  устаревший detail payload. После insert используется полный переход по detail URL.
- Уникальные title/provider marker assertions исключают ложный pass на старых данных; актуальная
  `scheduledAt` гарантирует попадание мойки в последние 50 записей.

## Проверки

- `npm run lint` — PASS после всех review-fixes.
- `npm run typecheck` — PASS после всех review-fixes.
- `npm run test:unit` — PASS: 40 файлов, 172/172 теста после всех review-fixes.
- `npx playwright test tests/dashboard.spec.ts tests/vehicles.spec.ts tests/maintenance.spec.ts tests/wash.spec.ts --project=desktop --workers=1` с переменными из корневого `.env` — PASS:
  32/32.
- `npx playwright test tests/vehicles.spec.ts --project=desktop --workers=1` с переменными из
  корневого `.env` после review-fixes — PASS: 6/6.
- `npm run build` с переменными из корневого `.env` после review-fixes — PASS; маршруты
  `/maintenance`, `/wash` и `/vehicles/[id]` присутствуют в build output.
- `npx prettier --check` для изменённых файлов — PASS.
- `git diff --check` и staged diff checks — PASS.

## Self-review

- Exact navigation test фиксирует полный порядок и не допускает дубликатов.
- Desktop и mobile drawer проверяют точные русские подписи обоих маршрутов.
- Detail select выбирает typed maintenance fields и последние 50 wash records по
  `scheduledAt desc`; list select histories не читает.
- Maintenance и wash histories используют общие semantic badges и текстовые русские статусы,
  поэтому смысл не зависит только от цвета.
- Существующие action authorization и transition rules не изменялись и не ослаблялись.
- Prisma schema, migration, роли и unrelated modules не менялись.

## Коммиты

- `dab1ea1 feat: integrate maintenance and wash navigation`
- `7643d0e fix: address maintenance wash integration review`

## Известные предупреждения

Playwright/dev и build по-прежнему выводят существующее предупреждение Next.js о нескольких
lockfile и inferred workspace root. Build также выводит уже документированное предупреждение NFT
trace через generated Prisma client. В browser-прогоне встречается существующее LCP-предупреждение
для первого изображения автомобиля. Эти предупреждения не вызваны Task 6 и не расширялись в
рамках интеграционной задачи.

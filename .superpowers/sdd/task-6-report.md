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

## Root review follow-up — полная подпись ТО

Root task review обнаружил, что доступное имя ссылки было полным, но видимый expanded label
«Техническое обслуживание» мог обрезаться внутри фиксированного `w-40` с
`overflow-hidden whitespace-nowrap`.

Исправление:

- expanded label занимает остаток строки через `min-w-0 flex-1`, переносится через
  `whitespace-normal` и использует компактный `leading-snug`;
- нулевая ширина, `overflow-hidden` и `whitespace-nowrap` остались только в collapsed-ветке;
- ширина sidebar, icon-only collapsed state и `min-h-11` ссылки не изменялись;
- desktop и mobile E2E проверяют точный текст видимого label container, условие
  `scrollWidth <= clientWidth` и высоту ссылки не меньше 44 px;
- mobile E2E дополнительно подтверждает отсутствие document-level horizontal overflow;
- `VehicleDetailPage.test.ts` симметрично покрывает wash-only, maintenance-only и обе пустые
  истории: при одной истории рендерятся обе subsection с локальным empty state, при двух пустых —
  только общий empty state вкладки.

TDD и проверки follow-up:

- RED: focused Vitest — 1 ожидаемое падение из 8 тестов на отсутствии нового navigation label
  DOM-контракта; существующие и новые vehicle empty-state тесты прошли.
- GREEN: `npx vitest run src/shared/components/app-shell/Sidebar.test.ts src/modules/vehicles/components/VehicleDetailPage.test.ts`
  — 2 файла, 8/8 PASS.
- `npx playwright test tests/dashboard.spec.ts --project=desktop --workers=1 -g "настольная оболочка показывает постоянную навигацию|мобильный drawer закрывается после выбора ссылки|мобильная оболочка не создаёт горизонтальное переполнение"`
  с root `.env` — 3/3 PASS.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npx prettier --check` для четырёх изменённых файлов — PASS.
- `git diff --check` и staged diff check — PASS.

Один финальный sandbox-запуск focused Vitest снова встретил известный `esbuild Access is denied`;
разрешённый повтор вне sandbox прошёл 8/8.

## Коммиты

- `dab1ea1 feat: integrate maintenance and wash navigation`
- `7643d0e fix: address maintenance wash integration review`
- `3d6e982 fix: preserve full maintenance navigation label`

## Известные предупреждения

Playwright/dev и build по-прежнему выводят существующее предупреждение Next.js о нескольких
lockfile и inferred workspace root. Build также выводит уже документированное предупреждение NFT
trace через generated Prisma client. В browser-прогоне встречается существующее LCP-предупреждение
для первого изображения автомобиля. Эти предупреждения не вызваны Task 6 и не расширялись в
рамках интеграционной задачи.

## Финальный root review — корректность времени, legacy-данных и operational UI

- Бизнес-часовой пояс явно зафиксирован как `Europe/Moscow`; обе формы преобразуют
  `datetime-local` в один и тот же UTC instant независимо от TZ процесса.
- Запланированная прошедшая работа выдаётся как эффективная `OVERDUE`; фильтр, badge, доступные
  действия и четыре KPI используют этот статус. Переход из просрочки атомарно принимает только
  лежащую в БД `PLANNED` запись с прошедшей датой; follow-up нормализует исторический stored
  `OVERDUE` обратно в `PLANNED` для единой модели.
- При создании ТО сервер сам читает последнюю tenant-scoped позицию автомобиля и сохраняет
  стартовый `odometerKm`; клиент не передаёт текущий пробег. DTO отдельно отдаёт старт, последнюю
  позицию и цель, UI показывает остаток и shared `Progress` при достаточных данных.
- Отмена ТО требует `ConfirmationDialog`; скрытая submit-кнопка вызывается только после
  подтверждения, а toast остаётся на уровне workspace.
- Журналы ТО и мойки ограничены последними 200 записями. Чистота автопарка считается отдельным
  tenant-scoped запросом последней завершённой мойки каждого автомобиля и не зависит от среза
  журнала.
- Applied migration `20260721230000_add_maintenance_and_wash` не изменялась. Follow-up переносит
  `description` в `notes` через `COALESCE`; preflight перечисляет неизвестные legacy-статусы и
  останавливается до enum-конверсии. Ограничение исходного fallback задокументировано: неизвестное
  значение, уже преобразованное в `PLANNED`, восстанавливается только из backup.

Проверки финального review:

- focused Vitest — 13 файлов, 52/52 PASS;
- `npm run test:unit` — 43 файла, 186/186 PASS;
- `npm run lint`, `npm run typecheck`, targeted Prettier и `git diff --check` — PASS;
- `npx prisma format`, `generate`, `validate`, `migrate deploy`, `migrate status` — PASS; follow-up
  применён, схема локальной БД актуальна;
- targeted Playwright `maintenance + wash + vehicles` — 9/10 PASS с одним test-only strict
  locator на двух сохранённых toast; после точечного исправления `maintenance.spec.ts` — 2/2 PASS,
  после фиксации Moscow-format helper `wash.spec.ts` — 2/2 PASS; исходно прошедшие vehicle-тесты
  не перезапускались без необходимости;
- `npm run build` — PASS, все три маршрута присутствуют. Остались известные предупреждения о
  нескольких lockfile/workspace root и широком Prisma NFT trace.

## Повторный root review — vehicle detail и обязательный legacy preflight

- `VehicleDetailPage` использует общий `PILOT_BUSINESS_TIME_ZONE`; unit-тест меняет TZ процесса на
  `America/New_York` и фиксирует московский вывод известных UTC-дат ТО и мойки.
- Vehicle detail query применяет `getEffectiveMaintenanceStatus` ко всем maintenance summaries с
  одним `referenceTime` на весь `mapDetail`; прошедший stored `PLANNED` согласованно выдаётся как
  `OVERDUE`.
- `npm run db:preflight:maintenance` выполняет только `SELECT`: на чистой БД разрешает отсутствие
  legacy-таблицы, а на существующей запрещает неизвестные статусы и `OVERDUE`, для которых
  `scheduledAt` отсутствует либо ещё не наступил. В документации команда стоит непосредственно
  перед `prisma migrate deploy`.
- Обе применённые migration.sql оставлены байт-в-байт неизменными. Mutable preflight SQL полностью
  переведён на русский. Перевод комментариев уже применённого follow-up вынесен в checksum-safe
  русский SQL-sidecar; изменение самого файла создало бы запрещённый checksum drift.
- Уже потерянные старой миграцией неизвестные значения статусов не объявляются восстановимыми:
  восстановление возможно только из внешней резервной копии.

Проверки повторного review:

- focused Vitest — 4 файла, 20/20 PASS после зафиксированного RED по всем трём контрактам;
- `npm run db:preflight:maintenance` на текущей PostgreSQL — PASS;
- `npx prisma migrate status` — PASS, 5 миграций, схема актуальна;
- `npm run typecheck`, `npm run lint`, Prettier для поддерживаемых форматов и `git diff --check` —
  PASS; SQL проверен тестами и вручную, потому что настроенного Prettier SQL parser в проекте нет;
- `tests/vehicles.spec.ts --project=desktop --workers=1` — 6/6 PASS;
- `npm run build` — PASS с прежними предупреждениями workspace root и Prisma NFT trace;
- `git diff 7bd3df0` для обеих применённых `migration.sql` пуст: checksum-файлы не изменены.

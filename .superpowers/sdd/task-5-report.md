# Task 5 — Server Actions и очередь команд Pilot Connect

## Результат

- Добавлены tenant-safe Server Actions для создания устройства, привязки и отвязки автомобиля, постановки команды в очередь и отмены команды.
- Каждое действие получает серверную сессию, требует `ADMIN`-membership компании и не доверяет идентификаторам из формы без tenant-scoped чтения.
- Привязка выполняется транзакционно: проверяются устройство и автомобиль одной компании, а занятой другим устройством автомобиль получает безопасную русскую ошибку.
- Команды только создаются в `PENDING`: у записи фиксируются `companyId`, `deviceId`, `createdByUserId`, тип, безопасный payload и целевая версия прошивки. MQTT не вызывается.
- Перед созданием команды проверяется отсутствие `PENDING`/`SENT` команды, а обновление прошивки разрешено только на существующий числовой SemVer новее текущей версии.
- Отмена использует атомарный `updateMany` с условием `status: PENDING`; отправленные, завершённые и чужие команды не изменяются.
- Дубликаты serial number и IMEI преобразуются в field errors без текста или деталей Prisma. После каждой успешной мутации инвалидируются `/devices` и конкретная карточка устройства.

## TDD

1. До production-кода создан `actions.test.ts`.
2. RED подтверждён: focused Vitest завершился `Cannot find module './actions'` до создания Server Actions.
3. GREEN: 12 сценариев покрывают отсутствие сессии, tenant-границы устройства и автомобиля, занятый автомобиль, уникальные serial/IMEI, конфликт активной команды, проверку прошивки, автора и payload команды, а также отмену только `PENDING`.

## Проверки

- `npx vitest run src/modules/devices/actions.test.ts` — 13/13 PASS.
- `npm run typecheck` — PASS.
- `npm run lint -- src/modules/devices/actions.ts src/modules/devices/actions.test.ts` — PASS.
- `npx prettier --check src/modules/devices/actions.ts src/modules/devices/actions.test.ts` — PASS.
- `git diff --check` — PASS.

Первый повторный focused Vitest внутри sandbox не запустился из-за известного ограничения esbuild на чтение worktree. Идентичный прогон вне sandbox прошёл; это не изменяло проектные файлы.

## Review fix

- Проверка `PENDING`/`SENT` и создание новой команды теперь выполняются в Prisma-транзакции с `Serializable` isolation level. Конфликт сериализации PostgreSQL/Prisma `P2034` преобразуется в безопасный ответ о уже выполняющейся команде, поэтому параллельные запросы не могут поставить две активные команды.
- RED/GREEN: тест сначала ожидал `Serializable` и ответ для `P2034`, затем после реализации прошёл вместе со всем focused-набором.

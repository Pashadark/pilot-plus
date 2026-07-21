# Task 4 — защищённые запросы и переходы статусов мойки

## Статус

Реализованы серверные запросы и действия модуля мойки. `createWashAction` самостоятельно проверяет сессию и принадлежность автомобиля компании пользователя перед созданием записи. `transitionWashAction` самостоятельно проверяет сессию и выполняет единственный защищённый `updateMany` с идентификатором записи, ожидаемым исходным статусом и tenant-фильтром через `vehicle.company.members.some.userId`.

Автомат переходов разрешает только `PLANNED → IN_PROGRESS|CANCELLED` и `IN_PROGRESS → COMPLETED|CANCELLED`. При начале сохраняется `startedAt`, при завершении — `completedAt`. Кэш `/wash` инвалидируется только после успешной записи.

## TDD

1. Добавлены тесты для ещё отсутствующих `status`, `server/queries` и `actions`.
2. RED подтверждён командой focused Vitest: все три набора завершились ожидаемой ошибкой `Cannot find module` для отсутствующих production-модулей.
3. Реализованы минимальные production-модули; GREEN: 14 тестов в трёх наборах прошли.

## Self-review

- Проверено, что каждая Server Action выполняет собственную проверку сессии.
- Проверено, что создание сначала ограничивает автомобиль tenant-фильтром, а переход включает tenant-фильтр в единственную атомарную `updateMany`.
- Проверено, что ни ошибки валидации, доступа, гонки статуса, ни сбой репозитория не вызывают `revalidatePath('/wash')`.
- Проверено, что наружу возвращаются только русские безопасные сообщения без деталей ошибки базы данных.

## Проверки

- `npx vitest run src/modules/wash/status.test.ts src/modules/wash/server/queries.test.ts src/modules/wash/actions.test.ts` — 14/14 PASS.
- `npm run typecheck` — PASS.
- `npx eslint` для шести изменённых TypeScript-файлов — PASS.
- `npx prettier --check` для шести изменённых TypeScript-файлов — PASS.
- `git diff --check` — PASS.

Один объединённый shell-вызов ESLint, Prettier и Vitest дал ошибку доступа esbuild к `vitest.config.ts`; изолированный немедленный повтор того же Vitest-набора прошёл. Изменения кода для этого инфраструктурного сбоя не потребовались.

## Commit

- `8d2f0f0 feat: add protected wash workflows`

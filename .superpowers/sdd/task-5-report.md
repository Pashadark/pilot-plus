# Task 5 — Ручные записи и отметки прочтения истории событий

## Результат

- Добавлены tenant-safe Server Actions в `src/modules/events/actions.ts`:
  `createManualEventAction`, `markEventReadAction`, `markEventsReadAction` и
  `markAllEventsReadAction`.
- Ручная запись получает `companyId` и `authorId` только из проверенной серверной сессии и
  membership; значения из `FormData` для компании и автора не используются.
- Перед созданием повторно проверяется принадлежность автомобиля текущей компании. Текст,
  координаты и время проходят существующую строгую нормализацию `createManualEventSchema`.
- Отметка прочтения принимает только известные составные ключи. `verifyAccessibleEventKeys`
  группирует ключи по источнику и выполняет ограниченные `findMany` с tenant-scoped условиями;
  неполный результат отклоняется.
- Поддерживаются источники `vehicle-position`, `trip`, `vehicle-event`, `fuel-record`,
  `maintenance-record`, `wash-record`, `device-command` и `manual-vehicle-event`.
  Команды устройств дополнительно требуют устройство компании с привязанным автомобилем.
- Пачка ограничена 100 ключами, дедуплицируется и сохраняется в транзакции через idempotent
  `EventReadReceipt.upsert`. Массовая отметка использует только ключи tenant-safe результата
  `getEventTimeline`; лимит страницы согласован с Task 4 и равен 50.
- После успешной записи инвалидируются `/events` и затронутые маршруты автомобилей.
- Пользователь получает только безопасные русские сообщения; детали Prisma не возвращаются.

## TDD

1. До реализации создан `src/modules/events/actions.test.ts`.
2. RED подтверждён: focused Vitest завершился ошибкой `Cannot find module './actions'` до
   создания Server Actions.
3. GREEN: 7 сценариев покрывают отсутствие сессии, автомобиль другой компании, server-trusted
   компанию и автора, недоступный ключ события, ограничение 101 ключа, idempotent receipt и
   массовую отметку только ключей tenant-safe ленты.

## Проверки

- `npx vitest run src/modules/events/actions.test.ts` — 7/7 PASS.
- `npm run typecheck` — PASS.
- `npx eslint src/modules/events/actions.ts src/modules/events/actions.test.ts` — PASS.
- `npx prettier --check src/modules/events/actions.ts src/modules/events/actions.test.ts` — PASS.
- `git diff --check` — PASS.

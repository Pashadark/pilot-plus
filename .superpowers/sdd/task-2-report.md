# Task 2 — Идемпотентный seed Pilot Connect

## Выполнено

- Добавлен `seedPilotConnectDevices` с 24 детерминированными устройствами Pilot Connect.
- Первые 23 устройства привязываются к первым автомобилям по `internalNumber`; `PC-2026-0024` остаётся свободным.
- Добавлены три стабильных релиза прошивки и шесть завершённых исторических команд с устойчивыми идентификаторами.
- Основной seed запускает Pilot Connect после импорта автопарка и выводит русское сообщение о результате.

## TDD

- RED: `npx vitest run src/database/prisma/device-seed.test.ts` завершился ожидаемой ошибкой `Cannot find module './device-seed'` до реализации.
- GREEN: тесты idempotency и существующие тесты seed проходят.

## Проверки

- PASS — `npx vitest run --config vitest.config.ts src/database/prisma/device-seed.test.ts src/database/prisma/seed.test.ts` (9 тестов).
- PASS — `npm run typecheck`.
- PASS — `npx eslint src/database/prisma/device-seed.ts src/database/prisma/device-seed.test.ts src/database/prisma/seed.ts`.
- PASS — `npx prettier --check src/database/prisma/device-seed.ts src/database/prisma/device-seed.test.ts src/database/prisma/seed.ts`.
- PASS — `git diff --check`.
- SKIP — `npm run db:seed` дважды: в изолированном worktree нет `.env` и безопасно доступного `DATABASE_URL`.
- NOTE — `npx prisma validate` без переменной окружения ожидаемо останавливается на отсутствии `DATABASE_URL`; это не проверка изменений Task 2.

# Task 2 — Идемпотентный seed истории событий

## Выполнено

- Добавлен `seedVehicleEventTimeline` с 18 поездками, 24 телематическими событиями,
  12 операциями с топливом и 8 ручными записями.
- Все записи используют явные стабильные идентификаторы, фиксированные ISO-времена июля 2026
  и обновляются через `upsert` по `id`.
- Демонстрационные данные содержат три события `DANGER`, слив топлива, назначения и инциденты
  с реалистичными русскими названиями и локациями Красноярска.
- Основной seed запускает историю после импорта автопарка и seed Pilot Connect, затем выводит
  русские счётчики результата.

## TDD

- RED: `npx vitest run src/database/prisma/event-timeline-seed.test.ts` ожидаемо завершился
  ошибкой `Cannot find module './event-timeline-seed'` до создания модуля.
- GREEN: тест дважды вызывает seed на одной fake-базе и подтверждает стабильные счётчики,
  отсутствие дубликатов, `DANGER`, `DRAIN`, `ASSIGNMENT` и `INCIDENT`.

## Проверки

- PASS — `npx vitest run --config vitest.config.ts src/database/prisma/event-timeline-seed.test.ts src/database/prisma/seed.test.ts` (8 тестов).
- PASS — `npm run typecheck`.
- PASS — `npx eslint src/database/prisma/event-timeline-seed.ts src/database/prisma/event-timeline-seed.test.ts src/database/prisma/seed.ts`.
- PASS — `npx prettier --check src/database/prisma/event-timeline-seed.ts src/database/prisma/event-timeline-seed.test.ts src/database/prisma/seed.ts`.
- PASS — `git diff --check`.
- SKIP — `npm run db:seed` дважды: в изолированном worktree нет `.env` и доступного
  `DATABASE_URL`; значения окружения не запрашивались и не выводились.

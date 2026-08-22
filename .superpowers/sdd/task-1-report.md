# Task 1 report: единый вычислитель GPS-состояния

## Выполнено

- Добавлен чистый `deriveVehicleGpsStatus` в `src/modules/vehicles/gps-status.ts`.
- Свежесть сигнала рассчитывается относительно переданного `now`: ровно 15 минут остаются свежими, а 15 минут и 1 мс получают `STALE`.
- Разделены состояния `IN_PARK`, `MOVING`, `IDLE`, `STALE` и `NO_DATA` с русской подписью, semantic tone и `isConnected`.
- Нормализация адреса вынесена в `park-status.ts` и переиспользуется вычислителем; варианты «Зелёный»/«Зеленый проспект, 22» распознаются без дублирования правил.
- Изменений Prisma, схемы и данных нет.

## Проверки

- `npx vitest run src/modules/vehicles/gps-status.test.ts src/modules/vehicles/park-status.test.ts` — PASS, 8 тестов.
- `npx prettier --check src/modules/vehicles/gps-status.ts src/modules/vehicles/gps-status.test.ts src/modules/vehicles/park-status.ts src/modules/vehicles/park-status.test.ts` — PASS.
- `git diff --check` — PASS.
- `npm run typecheck` — BLOCKED базовым состоянием worktree: отсутствуют `src/database/generated/prisma` и пакет `server-only`, из-за чего TypeScript выдаёт существующие ошибки Prisma/типов; новые GPS-файлы отдельной ошибки не добавляют.
- `npx vitest run src/modules/vehicles/server/queries.test.ts` — BLOCKED тем же отсутствующим generated Prisma client до запуска тестов.

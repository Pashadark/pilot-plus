# Task 2: Автопарк — фильтр и цветные GPS-статусы

## Изменения

- `VehicleCardDto` теперь передаёт единый `gpsStatus` из `deriveVehicleGpsStatus`.
- Серверный запрос получает скорость последней `VehiclePosition` и вычисляет статус от одного reference time; detail DTO использует тот же путь.
- В фильтры добавлен отдельный доступный select «Где машина» с состояниями `IN_PARK`, `MOVING`, `IDLE`, `STALE` и `NO_DATA`; существующий бизнес-фильтр «Статус» сохранён.
- Карточка показывает отдельные GPS- и бизнес-метки через общий `Badge`, использующие семантические token tones: park — success, moving — primary, idle — warning, stale/no-data — danger.
- Подпись «Последний сигнал» показывает время последней позиции или честное «Нет данных».
- Широкая сетка фильтров включается на `xl`, чтобы дополнительное поле не сжимало intermediate layouts.

## RED → GREEN

1. RED: `npx vitest run src/modules/vehicles/filter.test.ts src/modules/vehicles/server/queries.test.ts src/modules/vehicles/components/VehicleFilters.test.tsx src/modules/vehicles/components/VehicleCard.test.tsx` завершился с code 1: GPS-фильтр игнорировался, select и GPS-бейдж отсутствовали, query не выбирал скорость и не маппил статус.
2. GREEN: после минимального wiring все focused-наборы прошли. Vitest окружение не содержит jest-dom matchers, поэтому component assertions используют стандартные DOM properties без изменения production-кода.

## Проверки

- `npx vitest run src/modules/vehicles/gps-status.test.ts src/modules/vehicles/filter.test.ts src/modules/vehicles/server/queries.test.ts src/modules/vehicles/components/VehicleFilters.test.tsx src/modules/vehicles/components/VehicleCard.test.tsx` — 5 файлов, 24/24 теста успешно.
- `npm run typecheck` — успешно.
- Scoped `npx eslint` для изменённых vehicle source/test files — успешно.
- Scoped `npx prettier --check` для изменённых vehicle source/test files — успешно.
- `git diff --check` — успешно.

## Environment

Worktree не содержал `src/database/generated/prisma`, из-за чего server query suite сначала не загружался. Выполнен безопасный локальный `npx prisma generate --schema src/database/prisma/schema.prisma` без изменения schema, миграций или данных; generated output игнорируется Git. Полный suite, schema/data операции и database checks не запускались по scope Task 2.

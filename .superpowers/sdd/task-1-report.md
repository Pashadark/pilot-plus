# Task 1 — Prisma-модели Pilot Connect

## RED

До изменения схемы создан `src/database/prisma/device-schema.test.ts` и выполнена команда:

```powershell
npx vitest run src/database/prisma/device-schema.test.ts
```

Результат: 4 из 5 проверок упали ожидаемо — отсутствовали модели `Device`,
`FirmwareRelease`, `DeviceCommand` и индекс очереди устройства. Проверка существующего
`vehicleId`/`@unique` прошла, так как эти подстроки уже были в модели `Vehicle`.

## GREEN

Добавлены точные enum-модели и связи из brief, а также один additive migration-каталог
`20260727120000_add_pilot_connect_devices`. SQL создаёт enum-типы, таблицы, индексы и
внешние ключи, а затем добавляет DB-level ограничения диапазонов сигнала, заряда,
спутников и координат.

Повторная schema-проверка:

```powershell
npx prisma format
npx vitest run src/database/prisma/device-schema.test.ts src/database/prisma/schema.test.ts
```

Результат: 2 test files, 11 tests passed.

## Изменённые файлы

- `src/database/prisma/schema.prisma`
- `src/database/prisma/migrations/20260727120000_add_pilot_connect_devices/migration.sql`
- `src/database/prisma/device-schema.test.ts`

## Выполненные проверки

```powershell
npx prisma format
$env:DATABASE_URL='<parseable PostgreSQL URL>'; npx prisma validate
npx prisma generate
npx vitest run src/database/prisma/device-schema.test.ts src/database/prisma/schema.test.ts
npm run typecheck
npx eslint src/database/prisma/device-schema.test.ts
npx prettier --check src/database/prisma/device-schema.test.ts
git diff --check
```

`prisma validate` получил URL только в процессе команды: это необходимо для разбора
datasource и не подключает либо не изменяет базу. Миграция не запускалась.

## Ограничения

- Prisma не представляет PostgreSQL `CHECK`-ограничения, поэтому пять диапазонов живут в
  additive SQL-миграции.
- Проверка принадлежности выбранного автомобиля той же компании и запрет конфликтующей
  активной команды относятся к tenant-scoped Server Actions следующей задачи; текущая
  схема и миграция точно соответствуют утверждённому Task 1 brief.
- Prettier не содержит parser для `.prisma` или `.sql`; схема форматируется `prisma format`,
  а scoped Prettier-проверка применена к новому TypeScript-тесту.

# Task 1 — Prisma-модели единой истории событий

## Scope

Реализован фундамент единой истории событий Pilot+ только на уровне Prisma-схемы и
additive SQL-миграции. Изменения создают ручные события автомобиля и идемпотентные
отметки прочтения. Миграция к базе данных не применялась.

## RED

Сначала создан `src/database/prisma/event-timeline-schema.test.ts` строго по brief и
выполнена команда:

```powershell
npx vitest run src/database/prisma/event-timeline-schema.test.ts
```

Результат: suite завершился с ожидаемой ошибкой `ENOENT`: ещё не существовал файл
`src/database/prisma/migrations/20260727180000_add_event_timeline/migration.sql`.
Это подтверждает, что проверка была добавлена до новой схемы и миграции.

## GREEN

- Добавлен enum `ManualVehicleEventKind` со значениями `NOTE`, `INCIDENT` и
  `ASSIGNMENT`.
- Добавлена `ManualVehicleEvent`: tenant, автомобиль, автор с `RESTRICT`, тип,
  серьёзность, текст, необязательные координаты и хронологические индексы.
- Добавлена `EventReadReceipt`: tenant, пользователь, `eventKey VARCHAR(191)`,
  idempotent-ограничение `@@unique([userId, eventKey])` и индекс выдачи прочтений.
- В `Company`, `User` и `Vehicle` добавлены только новые relation arrays, без
  переименования существующих связей.
- Создана миграция `20260727180000_add_event_timeline`: enum, две таблицы, все
  индексы и foreign keys, а также PostgreSQL `CHECK`-ограничения широты, долготы и
  длины ключа события от 3 до 191 символа.

## Изменённые файлы

- `src/database/prisma/schema.prisma`
- `src/database/prisma/migrations/20260727180000_add_event_timeline/migration.sql`
- `src/database/prisma/event-timeline-schema.test.ts`
- `.superpowers/sdd/task-1-report.md`

## Проверки

```powershell
npx prisma format
$env:DATABASE_URL='postgresql://pilot:pilot@127.0.0.1:5432/pilot'; npx prisma validate
npx prisma generate
npx vitest run src/database/prisma/event-timeline-schema.test.ts src/database/prisma/schema.test.ts
npm run typecheck
npx eslint src/database/prisma/event-timeline-schema.test.ts
```

Результаты: schema valid, Prisma Client generated, 2 test files / 11 tests passed,
typecheck passed, scoped ESLint passed. `DATABASE_URL` задавался только для разбора
datasource Prisma; соединение с БД и применение миграции не выполнялись.

## Ограничения и concerns

- Prisma не моделирует PostgreSQL `CHECK`-ограничения, поэтому они намеренно
  находятся в новой SQL-миграции.
- `npx prisma` выводит уже известное предупреждение о deprecated
  `package.json#prisma`; задача не меняет конфигурацию Prisma вне scope.

# Task 4 — tenant-safe запросы устройств

## Результат

- Добавлены запросы списка и детальной карточки устройств.
- Все запросы ограничены `companyId` авторизованного пользователя.
- Доступные автомобили ограничены текущей компанией и свободной/текущей привязкой.
- Prisma `Decimal`, `Date` и модели преобразуются в сериализуемые DTO.

## Проверки

- `npx vitest run src/modules/devices/server/queries.test.ts` — 4/4 PASS.
- `npm run typecheck` — PASS.
- `git diff --check` — PASS.


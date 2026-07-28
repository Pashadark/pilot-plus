# Task 3 — контракты и нормализация единой истории

## Результат

- `zod@4.4.3` объявлен прямой production-зависимостью; `npm ls zod --depth=0`
  подтверждает его наличие.
- Добавлены сериализуемые `TimelineCategory`, `TimelineSeverity` и
  `TimelineEventDto` без Prisma-типов.
- Добавлены безопасные стабильные ключи источника `source:id` и их парсинг.
- Реализованы pure normalizers для позиции, поездки, телематического события,
  топлива, ТО, мойки, команды устройства и ручной записи. Все принимают raw
  интерфейсы рядом с normalizers и преобразуют Decimal-like значения в числа.
- Добавлена строгая Zod-схема создания ручного события: нормализация текста,
  допустимые координаты, обязательная пара широты/долготы и ISO timestamp с offset.
- Добавлены схемы одного ключа прочтения и пакета от 1 до 100 ключей.

## TDD

До реализации three focused test suites завершились с ожидаемыми ошибками импорта
отсутствующих `event-key`, `normalizers` и `validation`. После минимальной реализации
focused-набор проходит: 3 файла, 19 тестов.

## Проверки

| Проверка | Результат |
| --- | --- |
| `npm ls zod --depth=0` | PASS — `zod@4.4.3` direct dependency |
| Focused Vitest | PASS — 3 файла, 19 тестов |
| `npm run typecheck` | PASS |
| `npx eslint src/modules/events` | PASS |
| Scoped Prettier | PASS |
| `git diff --check` | PASS |

## Границы

- Не менялись Prisma schema/migrations, seed, queries, Server Actions и UI.
- Normalizers намеренно не импортируют Prisma Client; доступ к данным остаётся
  задачей server-query слоя.

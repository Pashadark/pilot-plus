# Task 4 — tenant-safe объединённая история событий

## Результат

- Добавлен серверный агрегатор восьми источников истории с tenant-scoped запросами,
  сериализуемым `TimelineEventDto` и списком доступных автомобилей.
- Все source reads и запросы квитанций ограничены размером 50; события стабильно
  объединяются по `(recordedAt desc, key asc)` и продолжают чтение после read-фильтра.
- Период по умолчанию составляет 30 дней, диапазон ограничен 90 днями; курсор хранит
  время и стабильный ключ.
- Позиции учитываются только при `speedKph > 0`; ручные записи используют канонический
  ключ `manual-vehicle-event:*`.

## Проверки

- PASS — `npx vitest run src/modules/events/server/queries.test.ts` (6 тестов).
- PASS — `npm run typecheck`.
- PASS — `npx eslint src/modules/events/server`.
- PASS — `git diff --check`.

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

## Исправление по review (29 июля 2026)

- `MAX_PAGE_SIZE` снижен с 100 до 50, поэтому `read: 'all'` не может передать в
  запрос квитанций более 50 ключей.
- Удалены неиспользуемые поля `fixedCategory` и `fixedSeverity` у внутренних
  source-specifications без изменения нормализации.
- PASS — `npx vitest run src/modules/events/server/queries.test.ts` (6/6); новый
  регрессионный сценарий отклоняет `limit: 51` и проверяет `eventReadReceipt.take <= 50`.
- PASS — `npm run typecheck`.
- PASS — `npx eslint src/modules/events/server`.
- PASS — `git diff --check`.

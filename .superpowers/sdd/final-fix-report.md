# Final fix wave — dynamic vehicle tracks

**Дата:** 30 июля 2026
**Ветка:** `codex/dynamic-vehicle-tracks`

## Результат

- «7 дней» теперь строит коллекционную модель из трёх отдельных поездок. В GeoJSON у каждого
  сегмента и события есть `tripId`/`tripIndex`; поездки разделены белой границей, небольшим
  `line-offset` и собственными точками «Старт»/«Финиш».
- Сводка периода агрегирует пробег, длительность, максимальную скорость и только реальные
  `stop`-события. Playback семидневного периода явно управляет самой новой поездкой.
- В панели выбранного автомобиля добавлен видимый список всех событий. Hover, focus и click/tap
  используют единый callback; совпавшие события остаются отдельными доступными элементами списка,
  а маркер карты показывает их общий счётчик.
- Ошибка трекового слоя показывает «Повторить». Отдельный `trackAttempt` перемонтирует только
  источники/слои маршрута и не пересоздаёт базовую MapLibre-карту или автомобильные маркеры.
- `fitBounds` использует размеры map container. `ResizeObserver` повторно вписывает маршрут только
  при смене container breakpoint или ориентации.
- Мобильная OSM-атрибуция поднята над панелью `48dvh`; Playwright проверяет отсутствие пересечения.
- Все 15 fixtures содержат распределённые события потери связи и входа/выхода из геозоны; есть
  стабильный grouped same-point случай.
- Loading skeleton синхронизирован с `48dvh`, правой desktop-панелью и геометрией playback.

## RED

Команда:

```text
npx vitest run src/modules/online-map/track-model.test.ts src/modules/online-map/components/OnlineMapWorkspace.test.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
```

Результат: `exit 1`, `3 failed` test files, `16 failed | 22 passed` tests.

Ожидаемые причины падений:

- отсутствовали `buildTrackPeriodViewModel`, `getVehicleTracks`, `stopsCount` и trip discriminator;
- «7 дней» оставался однодневным;
- не было видимого списка событий и period aggregate;
- отсутствовали `getTrackFitOptions` и retry-кнопка трекового слоя.

## GREEN

Целевые unit/component:

```text
3 passed test files
41 passed tests
```

Полный unit:

```text
Test Files 79 passed (79)
Tests      393 passed (393)
```

Статические проверки:

```text
npm run typecheck — exit 0
npm run lint      — exit 0
```

Полный браузерный прогон до последней косметической детализации списка:

```text
npx playwright test tests/online-map.spec.ts --workers=1
26 passed, 4 skipped
```

Финальный целевой браузерный прогон после всех изменений:

```text
npx playwright test tests/online-map.spec.ts --workers=1 \
  --grep "показывает цветной|несколько разделённых|видимый список|на телефоне ждёт"
7 passed, 1 skipped
```

Production build:

```text
npm run build — exit 0
Next.js 16.2.10, compiled successfully, 15/15 static pages generated
```

Formatting и diff:

```text
Prettier touched-files check — exit 0
git diff --check            — exit 0
```

## Известные предупреждения

- Next.js сообщает о нескольких lockfiles и автоматически выбранном workspace root.
- Turbopack сохраняет существующее предупреждение NFT trace из `next.config.ts`/Prisma/system-health.
- Эти предупреждения существовали до final fix wave и не влияют на успешный build или тесты.

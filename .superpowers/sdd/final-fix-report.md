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

---

## Final fix wave 2 — preview, keyboard surface и event glyphs

### Результат

- Preview и activation разделены во всём вертикальном срезе. Hover/focus показывают popup и
  подсветку, но не меняют выбранное событие, playback position или autoplay; click/Enter/tap
  активируют событие.
- MapLibre event hover закрывается по `mouseleave`. После click активированное событие остаётся
  показанным, а `focusAfterOpen: false` не позволяет popup красть фокус у видимой кнопки.
- Полностью clipped accessibility surface больше не содержит кнопок или `tabindex`. В нём остались
  только неинтерактивные data probes для браузерной проверки отрисовки.
- В панели открыт видимый collapsible-раздел «Участки маршрута». Он содержит все участки всех
  поездок, дату в accessible name, время, скорость, адрес и видимые точки старта/финиша.
- Клавиатурный E2E проходит реальным последовательным `Tab`, без программного `focus()` на
  clipped-элементы.
- Для шести типов событий регистрируются шесть разных raster glyphs через MapLibre `addImage`.
  Symbol layer использует `icon-image: ["get", "icon"]` и не зависит от map font glyphs.
- Runtime probe читает реальные MapLibre paint properties для casing width и trip line offset;
  browser-тест проверяет точные сериализованные значения.

### RED

```text
npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx \
  src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts

2 failed test files
6 failed | 25 passed
```

Ожидаемые причины: clipped surface ещё содержал 12 кнопок; hover активировал событие и перемещал
playback; не было видимого списка участков, raster glyphs, отдельного preview callback и runtime
paint probe.

### GREEN и полная проверка

```text
npm run lint       — exit 0
npm run typecheck  — exit 0
npm run test:unit  — 79 files, 397 tests passed
npm run build      — exit 0, 15/15 static pages

npx playwright test tests/online-map.spec.ts --workers=1
26 passed, 4 skipped

Focused component/unit
31 passed
```

`npm run format:check` по всему репозиторию по-прежнему сообщает 14 исторически
неформатированных файлов вне этого изменения. Проверка Prettier для touched files и
`git diff --check` проходит. Файлы `.superpowers/sdd/task-1-report.md` и
`.superpowers/sdd/task-2-report.md` являются посторонними незакоммиченными изменениями и намеренно
не включаются в commit.

---

## Final review follow-up — playback endpoints

- Старт и финиш каждой поездки стали видимыми focusable-кнопками с датой, временем и адресом в
  accessible name.
- Workspace хранит отдельный `playbackTripId`. Семидневный период по умолчанию воспроизводит
  новейшую поездку, но endpoint старой поездки переводит marker, slider и последующий autoplay на
  выбранную поездку.
- Выбор endpoint устанавливает точный прогресс `0`/`100`; смена периода, даты, автомобиля или
  закрытие панели сбрасывает transient playback-trip selection.
- Accessible name каждого события теперь всегда содержит дату поездки, поэтому одинаковые события
  разных дней однозначны.

### RED

```text
npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx

1 failed file
5 failed | 13 passed
```

Падения подтверждали отсутствие endpoint-кнопок, dated event names, playback-trip state и новой
индикации активной поездки.

### GREEN

```text
Focused component/unit: 33 passed
Full unit:              79 files, 399 passed
Targeted Playwright:    4 passed
Full online-map E2E:    28 passed, 4 skipped
npm run typecheck:      exit 0
npm run lint:           exit 0
```

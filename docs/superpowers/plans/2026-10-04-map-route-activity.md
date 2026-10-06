# Map Route Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Объединить сырые точки маршрута в понятные состояния, сделать их интерактивными и освободить карту на мобильном экране.

**Architecture:** Чистая функция в `track-model.ts` преобразует существующие `VehicleTrackSegment` в агрегированные участки без изменения API телеметрии. Рабочая область хранит выбранный агрегированный участок и передаёт карте исходный сегмент для позиционирования. Мобильная панель получает отдельное компактное состояние, а desktop-разметка остаётся прежней.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, MapLibre.

## Global Constraints

- Использовать семантические токены и геометрию `/ui-kit`.
- Не использовать символ `·` в новых элементах маршрута.
- Не менять серверный контракт `/api/map/tracks`.
- Порог превышения остаётся `140 км/ч`, пока источник не предоставляет дорожное ограничение.
- Мобильная рабочая область проверяется при `390×844`.

---

### Task 1: Агрегированная модель участков

**Files:**
- Modify: `src/modules/online-map/track-types.ts`
- Modify: `src/modules/online-map/track-model.ts`
- Test: `src/modules/online-map/track-model.test.ts`

**Interfaces:**
- Produces: `VehicleTrackActivitySection` and `buildTrackActivitySections(segments)`.

- [ ] Добавить падающие тесты для объединения стоянки, движения, превышения и разрыва телеметрии.
- [ ] Запустить `npx vitest run src/modules/online-map/track-model.test.ts` и подтвердить ожидаемое падение.
- [ ] Реализовать минимальную чистую функцию группировки и расчёт длительности, расстояния и скоростей.
- [ ] Повторно запустить тест и получить PASS.

### Task 2: Компактные даты и интерактивный список

**Files:**
- Modify: `src/modules/online-map/components/TrackDateControls.tsx`
- Modify: `src/modules/online-map/components/TrackDateControls.test.tsx`
- Modify: `src/modules/online-map/components/TrackSegmentList.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

**Interfaces:**
- Consumes: `buildTrackActivitySections`.
- Produces: выбранный `VehicleTrackActivitySection`, который позиционирует карту и playback.

- [ ] Добавить падающие тесты стрелок дат, компактных подписей и агрегированных строк.
- [ ] Добавить падающий тест выбора участка и повторного снятия выбора.
- [ ] Реализовать компоненты в токенах СУПА ПРО без символа `·`.
- [ ] Запустить целевые компонентные тесты и получить PASS.

### Task 3: Мобильная рабочая область карты

**Files:**
- Modify: `src/modules/online-map/components/SelectedVehiclePanel.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: `src/modules/online-map/components/SelectedVehiclePanel.test.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

**Interfaces:**
- Produces: управляемое состояние `mobilePanelExpanded` и кнопка свернуть/развернуть.

- [ ] Добавить падающий тест доступной кнопки сворачивания.
- [ ] Добавить падающий тест классов `38dvh` и отсутствия мобильного playback overlay.
- [ ] Реализовать компактную нижнюю панель, сохранив desktop-поведение.
- [ ] Запустить целевые тесты и получить PASS.

### Task 4: Полная проверка и выпуск

**Files:**
- Verify only.

- [ ] Запустить целевые Vitest-тесты.
- [ ] Запустить `npm run typecheck`, Prettier и `npm run build`.
- [ ] Проверить `/map` визуально на desktop и `390×844`.
- [ ] Собрать релиз на сервере, атомарно переключить symlink и проверить сервис и HTTP.

# Map Popup Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать боковые компактные карточки событий и отдельную горизонтальную карточку автомобиля.

**Architecture:** События продолжают использовать существующий `TrackEventPopup`, но Popup создаётся с боковым anchor, выбранным по экранной координате. Информация автомобиля переносится из вращающегося DOM-маркера в отдельный MapLibre Popup с собственным React root.

**Tech Stack:** React 19, TypeScript, MapLibre GL 5, Tailwind CSS, Vitest.

## Global Constraints

- Использовать название Supa Pro / СУПА ПРО.
- Не менять трек, поинты, курс автомобиля и существующую архитектуру карты.
- Сохранять поддержку светлой и тёмной темы.

---

### Task 1: Боковые карточки событий

**Files:**
- Modify: `src/modules/online-map/components/TrackEventPopup.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.module.css`
- Test: `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

**Interfaces:**
- Consumes: `VehicleTrackEventView`, `maplibregl.Popup`
- Produces: `getMapPopupAnchor(map, coordinates): 'left' | 'right'`

- [ ] Написать тест, что карточка получает боковой anchor по положению точки и использует графитовую поверхность.
- [ ] Запустить `npx vitest run src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts` и увидеть ожидаемое падение.
- [ ] Добавить выбор `left/right`, компактную структуру текста и боковые цвета стрелки.
- [ ] Повторно запустить focused test и получить PASS.

### Task 2: Горизонтальная карточка автомобиля

**Files:**
- Modify: `src/modules/online-map/components/VehicleMapMarker.tsx`
- Create: `src/modules/online-map/components/VehicleMapPopup.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.tsx`
- Test: `src/modules/online-map/components/VehicleMapMarker.test.tsx`
- Test: `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

**Interfaces:**
- Consumes: `OnlineMapVehicle`
- Produces: `VehicleMapPopup({ vehicle })`

- [ ] Написать тест, что вращающийся marker больше не содержит текстовую карточку, а карта создаёт отдельный Popup для выбранного автомобиля.
- [ ] Запустить focused tests и увидеть ожидаемое падение.
- [ ] Вынести содержимое в `VehicleMapPopup`, добавить отдельный React root и синхронизацию координат выбранной машины.
- [ ] Запустить focused tests, TypeScript, ESLint и production build.
- [ ] Проверить наведение и выбор автомобиля на боевой карте после развёртывания.


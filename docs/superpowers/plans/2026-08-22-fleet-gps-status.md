# Fleet GPS Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать единые честные GPS-состояния и фильтры в автопарке и на онлайн-карте.

**Architecture:** Один чистый модуль вычисляет состояние из последней GLONASSSOFT-позиции, времени, скорости и адреса. Серверные DTO автопарка и карты передают одинаковое состояние; UI только отображает его и фильтрует без повторения бизнес-правил.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript 5, Prisma 6.16, Vitest 3, Tailwind CSS 4.

## Global Constraints

- Свежий GPS: последняя позиция не старше 15 минут включительно.
- Старше 15 минут или отсутствующая позиция: красное состояние отсутствия связи.
- «В парке»: свежий GPS, автомобиль стоит, адрес — «Зелёный проспект, 22» после нормализации.
- `/map` использует только реальные данные `listOnlineMapVehicles`, без fixture fallback на маршруте.
- Машина без координат остаётся в списке, но не получает фиктивный маркер.
- Не добавлять зависимости и не изменять данные БД.

---

### Task 1: Единый вычислитель GPS-состояния

**Files:**

- Create: `src/modules/vehicles/gps-status.ts`
- Create: `src/modules/vehicles/gps-status.test.ts`
- Modify: `src/modules/vehicles/park-status.ts`

**Interfaces:**

- Produces: `deriveVehicleGpsStatus({ recordedAt, speedKph, address, hasCoordinates }, now): VehicleGpsStatusView`.
- `VehicleGpsStatusView.key`: `IN_PARK | MOVING | IDLE | STALE | NO_DATA`.
- `VehicleGpsStatusView` also contains Russian `label`, semantic `tone`, and `isConnected`.

- [ ] **Step 1: Write failing boundary tests**

Test exact 15-minute freshness, 15 minutes + 1 ms stale, missing coordinates, moving speed, and both spellings of «Зелёный проспект, 22».

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/modules/vehicles/gps-status.test.ts`
Expected: FAIL because `deriveVehicleGpsStatus` does not exist.

- [ ] **Step 3: Implement minimal pure function**

Use `OFFLINE_AFTER_MS = 15 * 60 * 1000`, the existing address normalizer, and return fixed semantic views without reading system time internally.

- [ ] **Step 4: Verify GREEN and commit**

Run the focused test, `npm run typecheck`, scoped Prettier, and `git diff --check`.
Commit: `feat(vehicles): derive honest gps status`.

### Task 2: Автопарк — фильтр и цветные статусы

**Files:**

- Modify: `src/modules/vehicles/types.ts`
- Modify: `src/modules/vehicles/server/queries.ts`
- Modify: `src/modules/vehicles/filter.ts`
- Modify: `src/modules/vehicles/filter.test.ts`
- Modify: `src/modules/vehicles/components/VehicleFilters.tsx`
- Modify: `src/modules/vehicles/components/VehicleCard.tsx`
- Modify: focused component tests beside these files.

**Interfaces:**

- Consumes: `deriveVehicleGpsStatus` from Task 1.
- Produces: `VehicleCardDto.gpsStatus` and `VehicleFilters.gpsStatus`.

- [ ] **Step 1: Write failing filtering and rendering tests**

Assert separate filtering for `IN_PARK`, `MOVING`, `IDLE`, `STALE`, `NO_DATA`; assert green park, blue moving, yellow idle, and red stale/no-data badges plus the last-signal text.

- [ ] **Step 2: Verify RED**

Run only vehicle filter/card/query tests; expected failures are missing `gpsStatus`, option labels, and semantic classes.

- [ ] **Step 3: Implement DTO, filter and UI wiring**

Add a dedicated «Где машина» select while preserving the existing business-status filter. Render badges through shared semantic tones rather than inline duplicated labels.

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests, typecheck, scoped ESLint/Prettier, and diff check.
Commit: `feat(vehicles): filter fleet by gps state`.

### Task 3: Онлайн-карта — реальные GPS-индикаторы

**Files:**

- Modify: `src/modules/online-map/types.ts`
- Modify: `src/modules/online-map/server/queries.ts`
- Modify: `src/modules/online-map/server/queries.test.ts`
- Modify: `src/modules/online-map/filter-vehicles.ts`
- Modify: `src/modules/online-map/components/VehicleMapMarker.tsx`
- Modify: `src/modules/online-map/components/SelectedVehiclePanel.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: focused map component/filter tests.

**Interfaces:**

- Consumes: `deriveVehicleGpsStatus` from Task 1.
- Produces: map DTO with `gpsStatus`, real last-signal timestamp label, coordinates only when supplied by GLONASSSOFT.

- [ ] **Step 1: Write failing server and UI tests**

Assert the query selects GLONASSSOFT positions, fresh/park/stale/no-data derivation, red stale marker/panel, and filter parity with `/vehicles`. Assert a no-coordinate vehicle remains in the top list but is absent from marker data.

- [ ] **Step 2: Verify RED**

Run focused online-map query/filter/marker/panel tests; expected failures are missing shared GPS view and incorrect stale colors/copy.

- [ ] **Step 3: Wire the shared state through the map**

Remove duplicated freshness/status mapping from the query and components. Keep `OnlineMapWorkspace` fixture default only for isolated component stories/tests; the protected page must continue passing real server vehicles explicitly.

- [ ] **Step 4: Verify and inspect locally**

Run focused tests, typecheck, scoped lint/Prettier, and diff check. Restart port 3001, then inspect `/vehicles` and `/map` in the signed-in local browser.
Commit: `feat(map): show live gps health`.

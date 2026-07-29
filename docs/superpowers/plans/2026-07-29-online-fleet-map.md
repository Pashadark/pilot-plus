# Online Fleet Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать защищённую адаптивную страницу `/map` с пятью тестовыми автомобилями, фирменными интерактивными маркерами и плавающими панелями Pilot+.

**Architecture:** Новый доменный модуль `online-map` владеет fixtures, фильтрацией, состоянием рабочего пространства и MapLibre-слоем. Серверный маршрут только собирает страницу, а интерактивность остаётся в небольших клиентских компонентах; существующий дашборд не меняется.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Tailwind CSS 4, Framer Motion 12, MapLibre GL 5, Vitest, Testing Library, Playwright.

## Global Constraints

- Все пользовательские тексты и комментарии в исходниках — на русском языке.
- Использовать только семантические дизайн-токены Pilot+, без новых raw hex в компонентах.
- Пять автомобилей остаются демонстрационными fixtures и не записываются в PostgreSQL.
- Touch targets — минимум 44×44 px; hover всегда имеет keyboard/touch-эквивалент.
- Анимации 150–250 мс и учитывают `prefers-reduced-motion`.
- Маршрут обязан иметь геометрический skeleton и фирменное error state.

---

### Task 1: Типы, fixtures и фильтрация

**Files:**
- Create: `src/modules/online-map/types.ts`
- Create: `src/modules/online-map/fixtures.ts`
- Create: `src/modules/online-map/filter-vehicles.ts`
- Test: `src/modules/online-map/filter-vehicles.test.ts`

**Interfaces:**
- Produces: `OnlineMapVehicle`, `OnlineMapFilter`, `onlineMapVehicles`, `filterOnlineMapVehicles(vehicles, query, filter)`.

- [ ] **Step 1: Write the failing filtering test**

```ts
import { describe, expect, it } from 'vitest';
import { onlineMapVehicles } from './fixtures';
import { filterOnlineMapVehicles } from './filter-vehicles';

describe('filterOnlineMapVehicles', () => {
  it('находит автомобиль по госномеру без учёта пробелов и регистра', () => {
    expect(filterOnlineMapVehicles(onlineMapVehicles, 'а123мр77', 'all')).toHaveLength(1);
  });

  it('оставляет только автомобили в движении', () => {
    expect(filterOnlineMapVehicles(onlineMapVehicles, '', 'moving').every(
      (vehicle) => vehicle.status === 'moving',
    )).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npx vitest run src/modules/online-map/filter-vehicles.test.ts`  
Expected: FAIL because the module files do not exist.

- [ ] **Step 3: Implement types, five fixtures, and pure filtering**

```ts
export type OnlineMapStatus = 'moving' | 'idle' | 'offline';
export type OnlineMapFilter = 'all' | OnlineMapStatus;

export interface OnlineMapVehicle {
  id: string;
  name: string;
  plate: string;
  status: OnlineMapStatus;
  longitude: number;
  latitude: number;
  speedKph: number;
  fuelPercent: number;
  lastSeenLabel: string;
  address: string;
}
```

Fixtures must contain exactly: `А 123 МР 77`, `В 456 КХ 178`, `Е 789 НО 77`,
`К 111 МР 199`, `М 333 АХ 750`, with stable coordinates around Krasnoyarsk.
Filtering normalizes query and plate using `toLocaleLowerCase('ru-RU').replace(/\s/g, '')`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npx vitest run src/modules/online-map/filter-vehicles.test.ts`  
Expected: 2 tests passed.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/online-map
git commit -m "feat: add online map vehicle fixtures"
```

### Task 2: Accessible animated vehicle marker

**Files:**
- Create: `src/modules/online-map/components/VehicleMapMarker.tsx`
- Test: `src/modules/online-map/components/VehicleMapMarker.test.tsx`

**Interfaces:**
- Consumes: `OnlineMapVehicle`.
- Produces: `VehicleMapMarker({ vehicle, selected, onSelect })`.

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { onlineMapVehicles } from '../fixtures';
import { VehicleMapMarker } from './VehicleMapMarker';

it('показывает госномер и позволяет выбрать автомобиль с клавиатуры', async () => {
  const onSelect = vi.fn();
  render(<VehicleMapMarker vehicle={onlineMapVehicles[0]} selected={false} onSelect={onSelect} />);
  const marker = screen.getByRole('button', { name: /А 123 МР 77/ });
  await userEvent.setup().tab();
  expect(marker).toHaveFocus();
  await userEvent.setup().keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledWith(onlineMapVehicles[0]);
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npx vitest run src/modules/online-map/components/VehicleMapMarker.test.tsx`  
Expected: FAIL because `VehicleMapMarker` does not exist.

- [ ] **Step 3: Implement marker**

Use a native 44×44 button with a vehicle icon, status dot and plate label. Wrap its visual surface
in `motion.div` with `whileHover={{ scale: 1.05, y: -4 }}` and
`whileFocus={{ scale: 1.05, y: -4 }}`; use a 200 ms transition and CSS
`motion-reduce:transform-none`. Render the detail preview on `group-hover`,
`group-focus-within`, or when `selected` is true.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npx vitest run src/modules/online-map/components/VehicleMapMarker.test.tsx`  
Expected: 1 test passed.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/online-map/components
git commit -m "feat: add animated fleet map marker"
```

### Task 3: MapLibre canvas and responsive workspace

**Files:**
- Create: `src/modules/online-map/components/OnlineFleetMap.tsx`
- Create: `src/modules/online-map/components/OnlineFleetMapClient.tsx`
- Create: `src/modules/online-map/components/SelectedVehiclePanel.tsx`
- Create: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Test: `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

**Interfaces:**
- Consumes: `onlineMapVehicles`, `filterOnlineMapVehicles`, `VehicleMapMarker`.
- Produces: `OnlineMapWorkspace()` with search, status filters, selection, empty state and map.

- [ ] **Step 1: Write the failing workspace test**

```tsx
it('фильтрует пять тестовых машин и сбрасывает скрытый выбор', async () => {
  render(<OnlineMapWorkspace mapComponent={FakeMap} />);
  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(5);
  await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Поиск транспорта' }), 'А 123');
  expect(screen.getAllByRole('button', { name: /Выбрать автомобиль/ })).toHaveLength(1);
});
```

The test seam is:

```ts
export interface OnlineMapWorkspaceProps {
  mapComponent?: ComponentType<OnlineFleetMapProps>;
}
```

- [ ] **Step 2: Run test to verify RED**

Run: `npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx`  
Expected: FAIL because the workspace does not exist.

- [ ] **Step 3: Implement MapLibre integration**

Create the map once per vehicle-set, render each marker through `createRoot`, and always unmount
React roots plus `map.remove()` in effect cleanup. Center Krasnoyarsk at approximately
`[92.87, 56.01]`; use OpenStreetMap raster tiles and the existing attribution pattern. Marker
click calls `onVehicleSelect` and `flyTo`.

- [ ] **Step 4: Implement responsive workspace**

Desktop: absolute search/filter surfaces at top-left and selected panel at right. Mobile: compact
horizontal filters and a bottom panel with safe-area padding. When filtering hides the selected
vehicle, select the first visible vehicle or clear selection if none remain.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npx vitest run src/modules/online-map`  
Expected: all online-map tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/online-map
git commit -m "feat: build online map workspace"
```

### Task 4: Route, loading/error states and browser verification

**Files:**
- Create: `src/app/(protected)/map/page.tsx`
- Create: `src/app/(protected)/map/loading.tsx`
- Create: `src/app/(protected)/map/error.tsx`
- Create: `tests/online-map.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`

**Interfaces:**
- Consumes: `OnlineMapWorkspace`.
- Produces: protected `/map` route.

- [ ] **Step 1: Write the failing Playwright test**

```ts
test('онлайн-карта показывает пять тестовых автомобилей', async ({ page }) => {
  await openAuthenticatedPage(page, '/map');
  await expect(page.getByRole('heading', { name: 'Онлайн-карта' })).toBeVisible();
  await expect(page.getByText('Демонстрационные данные')).toBeVisible();
  await expect(page.getByRole('button', { name: /А 123 МР 77/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /М 333 АХ 750/ })).toBeVisible();
});
```

Also add desktop hover/focus, mobile 390×844 bottom-panel, search, empty-state, and no-horizontal-
overflow checks.

- [ ] **Step 2: Run browser test to verify RED**

Run: `npx playwright test tests/online-map.spec.ts --workers=1`  
Expected: FAIL because `/map` is not implemented.

- [ ] **Step 3: Implement route states**

`page.tsx` renders a visually hidden/overlay-compatible `h1` and `OnlineMapWorkspace`.
`loading.tsx` reproduces the full map, top controls and bottom/mobile panel using shared
`Skeleton`. `error.tsx` is a client boundary using shared `ErrorState` and `unstable_retry`.

- [ ] **Step 4: Update canonical project guide**

Document `/map` as a demonstration backed by five fixtures, with hover/focus markers and mobile
bottom panel. Explicitly state that MQTT/Redis live telemetry is not connected.

- [ ] **Step 5: Run full verification**

```powershell
npm run lint
npm run typecheck
npx vitest run src/modules/online-map
npx playwright test tests/online-map.spec.ts --workers=1
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add src/app src/modules/online-map tests/online-map.spec.ts docs/PROJECT_GUIDE.md
git commit -m "feat: add responsive online fleet map"
```

# Fleet Route Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixture-driven map experience with a Pilot+-styled dispatcher workspace that selects any accessible vehicle, loads stored route history, colors segments by speed, and places credible fine events on the route.

**Architecture:** Keep the page as a Server Component for the initial fleet snapshot, expose tenant-scoped historical data through an uncached authenticated Route Handler, and keep interaction in focused Client Components. Convert database rows to a serializable route DTO on the server; keep geometry, playback, filtering, and rendering pure on the client.

**Tech Stack:** Next.js App Router Route Handlers, React, TypeScript, Prisma, MapLibre GL, Tailwind CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve the current Pilot+ light theme, blue primary color, typography, component tokens, header, and button language.
- Desktop uses a fixed left fleet panel; mobile uses a bottom sheet.
- The map remains the dominant surface.
- Red means high recorded speed, not a legal speeding violation unless a confirmed fine exists.
- Never invent GPS points, speed, location, fuel, trip distance, or fine coordinates.
- Stored history remains readable while live GPS collection is disabled.
- Date boundaries use `Europe/Moscow`; request range is limited to seven days.
- Production UI must not import `vehicleTrackFixtures`.
- Route responses are tenant-scoped, private, and `no-store`.

---

### Task 1: Production Route DTO and Geometry Rules

**Files:**
- Modify: `src/modules/online-map/track-types.ts`
- Modify: `src/modules/online-map/track-model.ts`
- Modify: `src/modules/online-map/track-model.test.ts`

**Interfaces:**
- Produces: four-color `TrackSpeedColor` including `orange`.
- Produces: `buildVehicleTracks(rows: VehicleTrackSource): readonly VehicleTrack[]` in the server query task.
- Preserves: `buildTrackViewModel`, `buildTrackPeriodViewModel`, and playback contracts.

- [ ] **Step 1: Add failing model tests**

Cover the exact speed scale and disconnected telemetry:

```ts
expect(getSpeedColor(0)).toBe('green');
expect(getSpeedColor(39)).toBe('green');
expect(getSpeedColor(40)).toBe('yellow');
expect(getSpeedColor(70)).toBe('orange');
expect(getSpeedColor(100)).toBe('red');
```

Create two points more than 20 minutes apart and assert `buildTrackViewModel(track).segments` does not connect them and `distanceKm` does not include the gap.

- [ ] **Step 2: Run the model tests and verify failures**

Run: `npx vitest run src/modules/online-map/track-model.test.ts`

Expected: FAIL because `orange` and the telemetry-gap rule are absent.

- [ ] **Step 3: Extend types and centralize thresholds**

```ts
export type TrackSpeedColor = 'green' | 'yellow' | 'orange' | 'red';

export const TRACK_SPEED_THRESHOLDS = {
  yellowFromKph: 40,
  orangeFromKph: 70,
  redFromKph: 100,
} as const;

export const MAX_TRACK_POINT_GAP_MS = 20 * 60 * 1_000;
```

Update `getSpeedColor` to use those constants. Filter segment pairs whose timestamp gap exceeds `MAX_TRACK_POINT_GAP_MS`, and calculate distance from the same accepted pairs.

- [ ] **Step 4: Run the model tests**

Run: `npx vitest run src/modules/online-map/track-model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit route geometry rules**

```bash
git add src/modules/online-map/track-types.ts src/modules/online-map/track-model.ts src/modules/online-map/track-model.test.ts
git commit -m "feat: harden vehicle route geometry"
```

### Task 2: Tenant-Scoped Route History Query

**Files:**
- Create: `src/modules/online-map/server/track-history.ts`
- Create: `src/modules/online-map/server/track-history.test.ts`

**Interfaces:**
- Produces: `getOnlineMapTrackHistory(user, input, repository?, now?): Promise<OnlineMapTrackHistoryDto>`.
- Input: `{ vehicleId: string; from: string; to: string }`, where dates use `YYYY-MM-DD`.
- Output: `{ vehicleId; from; to; availableDates; tracks; fines }` with JSON-safe numbers and strings.

- [ ] **Step 1: Write failing server-query tests**

Test these cases with a repository mock:

```ts
await expect(
  getOnlineMapTrackHistory(user, {
    vehicleId: 'vehicle-1',
    from: '2026-09-15',
    to: '2026-09-15',
  }, repository),
).resolves.toEqual(
  expect.objectContaining({
    vehicleId: 'vehicle-1',
    availableDates: ['2026-09-15'],
  }),
);
```

Also assert: a vehicle outside the user company is rejected; an eight-day request is rejected; points are ordered; decimals become numbers; a day with fewer than two points is returned as unavailable; no query uses a provider token.

- [ ] **Step 2: Run the server-query test and verify the missing-module failure**

Run: `npx vitest run src/modules/online-map/server/track-history.test.ts`

Expected: FAIL because `track-history.ts` does not exist.

- [ ] **Step 3: Implement validation and tenant scope**

Use `parsePilotDateTimeLocal(`${date}T00:00`)` for the inclusive start and the day after `to` for the exclusive end. Reject invalid order or more than seven Moscow dates.

The vehicle authorization selector must be:

```ts
const vehicleWhere =
  user.role === 'SUPER_ADMIN'
    ? { id: input.vehicleId, archivedAt: null, isDemoImport: false }
    : {
        id: input.vehicleId,
        archivedAt: null,
        isDemoImport: false,
        company: { members: { some: { userId: user.id } } },
      };
```

Select positions between the date boundaries and select fines for the same vehicle and period. Fine DTO fields are `id`, `offenseAt`, `latitude`, `longitude`, `currentAmountMinor`, `status`, `description`, `address`, `rental`, and `client`.

- [ ] **Step 4: Convert rows into stable DTOs**

Group points by Moscow `YYYY-MM-DD`. Create stable point IDs from persisted position IDs. Convert Prisma decimals and bigint values before returning. Do not create a track for fewer than two valid coordinate points.

For each fine:

- use its coordinates when both are valid;
- otherwise find the nearest route point by absolute timestamp difference within 30 minutes;
- set `locationSource: 'exact' | 'time-inferred' | 'unmapped'`;
- omit coordinates for `unmapped`.

- [ ] **Step 5: Run the history-query tests**

Run: `npx vitest run src/modules/online-map/server/track-history.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the history query**

```bash
git add src/modules/online-map/server/track-history.ts src/modules/online-map/server/track-history.test.ts
git commit -m "feat: query stored vehicle route history"
```

### Task 3: Authenticated Route Handler and Client Loader

**Files:**
- Create: `src/app/api/map/tracks/route.ts`
- Create: `src/app/api/map/tracks/route.test.ts`
- Create: `src/modules/online-map/useVehicleTrackHistory.ts`
- Create: `src/modules/online-map/useVehicleTrackHistory.test.tsx`

**Interfaces:**
- Consumes: `getOnlineMapTrackHistory` from Task 2.
- Produces: `GET /api/map/tracks?vehicleId=...&from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Produces: `useVehicleTrackHistory({ vehicleId, from, to })` returning `{ data, loading, error, retry }`.

- [ ] **Step 1: Write failing handler tests**

Assert `401` without a session, `400` for invalid input, `403` for inaccessible vehicle, `200` with a JSON DTO, and this header on every response:

```ts
{ 'Cache-Control': 'private, no-store' }
```

- [ ] **Step 2: Run the handler tests and verify failure**

Run: `npx vitest run src/app/api/map/tracks/route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the uncached GET handler**

Follow the installed Next.js Route Handler contract:

```ts
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: HEADERS });

  const url = new URL(request.url);
  try {
    const data = await getOnlineMapTrackHistory(user, {
      vehicleId: url.searchParams.get('vehicleId') ?? '',
      from: url.searchParams.get('from') ?? '',
      to: url.searchParams.get('to') ?? '',
    });
    return Response.json(data, { headers: HEADERS });
  } catch (error) {
    return mapTrackHistoryErrorToResponse(error, HEADERS);
  }
}
```

Import `getCurrentUser` from `@/modules/auth/dal` and use the same session and response-header pattern as `src/app/api/map/live/route.ts`.

- [ ] **Step 4: Write the failing client-loader tests**

Test that changing `vehicleId` aborts the previous request, the stale response is ignored, `retry()` repeats the current request, and an empty vehicle clears data without fetching.

- [ ] **Step 5: Implement the loader with `AbortController`**

The hook must URL-encode all query parameters, set `loading` before each request, keep the last successful data visible during a retry, and normalize failures to the Russian message `Не удалось загрузить маршрут.`.

- [ ] **Step 6: Run handler and loader tests**

Run: `npx vitest run src/app/api/map/tracks/route.test.ts src/modules/online-map/useVehicleTrackHistory.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the transport boundary**

```bash
git add src/app/api/map/tracks/route.ts src/app/api/map/tracks/route.test.ts src/modules/online-map/useVehicleTrackHistory.ts src/modules/online-map/useVehicleTrackHistory.test.tsx
git commit -m "feat: load private vehicle route history"
```

### Task 4: Fleet Vehicle Rail and Mobile Sheet

**Files:**
- Create: `src/modules/online-map/components/FleetVehicleRail.tsx`
- Create: `src/modules/online-map/components/FleetVehicleRail.test.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

**Interfaces:**
- Produces: `FleetVehicleRail({ vehicles, selectedVehicleId, query, filter, collapsed, onSelect, onQueryChange, onFilterChange, onCollapsedChange })`.
- Consumes: existing `OnlineMapVehicle` values and shared status tokens.
- Consumes: history loader from Task 3.

- [ ] **Step 1: Write failing rail tests**

Assert:

```ts
expect(screen.getByRole('searchbox', { name: 'Поиск автомобиля' })).toBeTruthy();
expect(screen.getByRole('button', { name: /Выбрать Kia K5 В342НР797/ })).toBeTruthy();
expect(selectedCard.getAttribute('aria-current')).toBe('true');
expect(screen.getByText('Нет активного водителя')).toBeTruthy();
```

Also test search by plate and driver, filters `Все`, `В движении`, `Стоит`, `Нет связи`, collapse/expand, and that a vehicle without coordinates remains selectable.

- [ ] **Step 2: Run rail tests and verify the missing-component failure**

Run: `npx vitest run src/modules/online-map/components/FleetVehicleRail.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the desktop rail using Pilot+ tokens**

Use a semantic `aside` and list. Keep the desktop width at `22.5rem`, card targets at least `44px`, selected styling with `var(--color-primary)` and `var(--color-primary-soft)`, and text fallbacks for driver, fuel, and last signal.

- [ ] **Step 4: Integrate the rail and remove the horizontal plate-chip selector**

In `OnlineMapWorkspace`, keep search/filter/selection state but move its presentation to the rail. Replace fixture selectors:

```ts
getVehicleTrackDates(selectedVehicle.id)
getVehicleTrack(selectedVehicle.id, trackDate)
getVehicleTracks(selectedVehicle.id, trackDates)
```

with the data returned by `useVehicleTrackHistory`. Keep the live snapshot update logic and selected-vehicle query parameter behavior.

For mobile, render the same rail content inside the existing overlay primitives as a bottom sheet; keep the selected-car summary visible when collapsed.

- [ ] **Step 5: Run rail and workspace tests**

Run: `npx vitest run src/modules/online-map/components/FleetVehicleRail.test.tsx src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the workspace layout**

```bash
git add src/modules/online-map/components/FleetVehicleRail.tsx src/modules/online-map/components/FleetVehicleRail.test.tsx src/modules/online-map/components/OnlineMapWorkspace.tsx src/modules/online-map/components/OnlineMapWorkspace.test.tsx
git commit -m "feat: add fleet rail to online map"
```

### Task 5: Speed Legend, Fine Events, and Honest Empty States

**Files:**
- Modify: `src/modules/online-map/components/VehicleTrackLayers.tsx`
- Modify: `src/modules/online-map/components/TrackEventPopup.tsx`
- Modify: `src/modules/online-map/components/TrackEventList.tsx`
- Create: `src/modules/online-map/components/TrackSpeedLegend.tsx`
- Create: `src/modules/online-map/components/TrackSpeedLegend.test.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

**Interfaces:**
- Consumes: four-color segment model from Task 1.
- Consumes: fine DTO with `locationSource` from Task 2.
- Produces: readable map markers and event details without changing fine records.

- [ ] **Step 1: Add failing presentation tests**

Test the legend labels `0`, `40`, `70`, `100+ км/ч`; exact fine marker; inferred marker with `Место определено по времени`; unmapped fine present in the list but absent from map markers; and an empty day message `Маршрут за выбранный день не записан`.

- [ ] **Step 2: Run component tests and verify failures**

Run: `npx vitest run src/modules/online-map/components/TrackSpeedLegend.test.tsx src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

Expected: FAIL at the new legend, fine marker, and empty-state assertions.

- [ ] **Step 3: Implement the speed legend and map colors**

Map the speed colors to existing accessible semantic tokens or a single centralized route palette. The legend is compact, always visible when a route is visible, and includes numeric labels so color is not the only signal.

- [ ] **Step 4: Render fine events without false certainty**

Use a dedicated fine icon. The popup must show date/time, address, speed when present, amount, payment status, client, contract, and a link to `/fines?query={decreeNumber}`. Add the inferred-location label only for `time-inferred`; do not render an unmapped marker.

- [ ] **Step 5: Implement loading, retry, and GPS-off states**

Keep the last saved map visible while retrying. When no stored track exists, show the empty message and date controls. Do not render `0 км/ч` as a substitute for missing history.

- [ ] **Step 6: Run map component tests**

Run: `npx vitest run src/modules/online-map/components`

Expected: PASS.

- [ ] **Step 7: Commit route presentation**

```bash
git add src/modules/online-map/components/VehicleTrackLayers.tsx src/modules/online-map/components/TrackEventPopup.tsx src/modules/online-map/components/TrackEventList.tsx src/modules/online-map/components/TrackSpeedLegend.tsx src/modules/online-map/components/TrackSpeedLegend.test.tsx src/modules/online-map/components/OnlineMapWorkspace.tsx src/modules/online-map/components/OnlineMapWorkspace.test.tsx
git commit -m "feat: show speed and fines on stored routes"
```

### Task 6: Responsive and Production Verification

**Files:**
- Modify: `tests/online-map.spec.ts`
- Modify only if required by route integration: `src/app/(protected)/map/page.tsx`

**Interfaces:**
- Consumes all map behavior from Tasks 1–5.
- Produces no new runtime contract.

- [ ] **Step 1: Add desktop browser acceptance**

Assert that the left rail is visible, choosing a vehicle updates the selected state, the map remains visible, the date picker loads history, and the speed legend appears only with a route.

- [ ] **Step 2: Add mobile browser acceptance**

Set a phone viewport and assert that the desktop rail is replaced by a bottom sheet, its collapsed summary remains visible, it can be expanded, and every vehicle option has a tap target of at least 44 pixels.

- [ ] **Step 3: Add empty-history and inaccessible-vehicle acceptance**

Assert that an accessible vehicle with no stored points remains selectable and shows the honest empty state. Assert that an inaccessible `vehicleId` query parameter does not select or fetch that vehicle.

- [ ] **Step 4: Run focused and static verification**

Run: `npx vitest run src/modules/online-map src/app/api/map/tracks/route.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Run browser verification**

Run: `npx playwright test tests/online-map.spec.ts`

Expected: PASS in desktop and mobile projects configured by `playwright.config.ts`.

- [ ] **Step 6: Commit acceptance coverage**

```bash
git add tests/online-map.spec.ts src/app/(protected)/map/page.tsx
git commit -m "test: verify fleet route workspace"
```

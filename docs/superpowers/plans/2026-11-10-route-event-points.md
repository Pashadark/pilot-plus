# Route Event Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the existing route event and endpoint point artwork with the approved Supa Pro markers, add a soft two-second pulse, and keep the popup screen-aligned without changing the route or vehicle course marker.

**Architecture:** Keep the existing GeoJSON sources, MapLibre symbol layers, hitboxes, event callbacks, and DOM popup. Generate theme-aware raster icons in `VehicleTrackLayers.tsx`, add one animated circle layer beneath the event icons, and reuse `TrackEventPopup` for the compact overlay.

**Tech Stack:** React 19, TypeScript, MapLibre GL 5, Tailwind CSS 4, Vitest, Testing Library.

## Global Constraints

- Change only route event points, start/finish points, and the event popup presentation.
- Do not change route geometry, speed-gradient layers, playback, vehicle course marker, event calculation, or GPS coordinates.
- Event marker diameter is 28 px with a 2 px theme-aware outline and a 16 px semantic icon.
- Dark marker center is `#17171c`; the light theme uses the existing light surface token equivalent.
- Pulse duration is approximately two seconds and is disabled for `prefers-reduced-motion: reduce`.
- Desktop uses hover preview; touch/click activates the same existing popup.
- Product copy and naming remain Supa Pro / СУПА ПРО.

---

### Task 1: Lock the marker contract with tests

**Files:**
- Modify: `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

**Interfaces:**
- Consumes: `createTrackEventIconImage(type, theme)`, `createTrackEndpointIconImage(kind, theme)`, and `mountVehicleTrackLayers(map, options)`.
- Produces: regression assertions for the 28 px visual size, theme center colors, semantic glyph differences, pulse layer ordering, animation cleanup, and unchanged route paint.

- [ ] **Step 1: Add failing raster-icon assertions**

```ts
it('рисует 28px поинт с графитовым центром и тонкой тематической обводкой', async () => {
  const { createTrackEventIconImage } = await import('./VehicleTrackLayers');
  const dark = createTrackEventIconImage('speeding', 'dark');
  const light = createTrackEventIconImage('speeding', 'light');

  expect(dark).toMatchObject({ width: 56, height: 56 });
  expect(pixelAt(dark, 28, 28)).toEqual([23, 23, 28, 255]);
  expect(pixelAt(light, 28, 28)).toEqual([248, 250, 252, 255]);
  expect(pixelAt(dark, 28, 1)).toEqual([239, 68, 68, 255]);
});

function pixelAt(
  image: { width: number; data: Uint8Array },
  x: number,
  y: number,
): number[] {
  const offset = (y * image.width + x) * 4;
  return Array.from(image.data.slice(offset, offset + 4));
}
```

Add the helper beside the marker tests and assert that the four semantic glyphs are not identical:

```ts
const semanticImages = [
  createTrackEventIconImage('speeding'),
  createTrackEventIconImage('harsh-acceleration'),
  createTrackEventIconImage('harsh-braking'),
  createTrackEventIconImage('connection-loss'),
];
expect(new Set(semanticImages.map((image) => Array.from(image.data).join(','))).size).toBe(4);
```

- [ ] **Step 2: Add failing pulse-layer and cleanup assertions**

```ts
expect(mapMocks.mapAddLayer).toHaveBeenCalledWith(
  expect.objectContaining({
    id: 'vehicle-track-event-pulse',
    type: 'circle',
    source: 'vehicle-track-events',
  }),
  'vehicle-track-event-icons',
);
expect(mapMocks.mapSetPaintProperty).toHaveBeenCalledWith(
  'vehicle-track-event-pulse',
  'circle-radius',
  expect.any(Number),
);
unmountLayers();
expect(cancelAnimationFrame).toHaveBeenCalled();
```

Extend the map mock with `setPaintProperty`, and stub `requestAnimationFrame`, `cancelAnimationFrame`, and `matchMedia`. Keep the existing assertions for `vehicle-track-casing`, `vehicle-track-gradient-0`, `vehicle-track-lines`, and `vehicle-track-playback` unchanged.

- [ ] **Step 3: Run the focused test and confirm RED**

Run:

```powershell
npx vitest run src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
```

Expected: FAIL because the images are still 48 px filled circles and `vehicle-track-event-pulse` does not exist.

- [ ] **Step 4: Commit the failing contract**

```powershell
git add src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
git commit -m "test: define route event point contract"
```

---

### Task 2: Implement theme-aware event and endpoint artwork

**Files:**
- Modify: `src/modules/online-map/components/VehicleTrackLayers.tsx`
- Test: `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

**Interfaces:**
- Consumes: existing `VehicleTrackEventView['type']`, `eventColor`, `icon`, and endpoint GeoJSON properties.
- Produces: `createTrackEventIconImage(type, theme)` and `createTrackEndpointIconImage(kind, theme)` raster images registered through the existing MapLibre `addImage` calls.

- [ ] **Step 1: Replace pixel patterns with drawing primitives**

Introduce small private raster helpers with exact signatures:

```ts
type Rgba = readonly [number, number, number, number];

function drawLine(
  data: Uint8Array,
  width: number,
  from: readonly [number, number],
  to: readonly [number, number],
  thickness: number,
  color: Rgba,
): void;

function drawCircle(
  data: Uint8Array,
  width: number,
  centerX: number,
  centerY: number,
  radius: number,
  color: Rgba,
): void;
```

Use these helpers to draw a 56×56 retina image (`pixelRatio: 2`) whose rendered diameter is 28 px: transparent outside, a four-device-pixel (2 rendered px) colored rim, a `#17171c` dark center or `#f8fafc` light center, and a semantic glyph in the event color.

- [ ] **Step 2: Draw each approved semantic glyph**

Implement explicit branches:

```ts
switch (type) {
  case 'speeding':
    drawSpeedometerGlyph(data, width, color);
    break;
  case 'harsh-acceleration':
    drawDoubleChevronGlyph(data, width, 'up', color);
    break;
  case 'harsh-braking':
    drawDoubleChevronGlyph(data, width, 'down', color);
    break;
  case 'connection-loss':
    drawConnectionLossGlyph(data, width, color);
    break;
  default:
    drawPatternGlyph(data, width, TRACK_EVENT_ICON_PATTERNS[type], color);
}
```

`drawPatternGlyph` has the exact signature below and scales the retained 5×5 patterns into the 16 rendered px icon box:

```ts
function drawPatternGlyph(
  data: Uint8Array,
  width: number,
  pattern: readonly string[],
  color: Rgba,
): void;
```

Keep the established colors: speeding `#ef4444`, harsh acceleration `#f59e0b`, harsh braking `#0067ff`, and connection loss `#64748b`. Preserve semantic colors for stop, refuel, fine, and geofence events.

- [ ] **Step 3: Restyle start and finish without moving them**

Keep the endpoint source and symbol layer unchanged. Render start as a green target and finish as a theme-aware checkered flag on the same 56×56/28 px circular system. Do not add `icon-offset`, rotation, or coordinate changes to the endpoint layer.

- [ ] **Step 4: Run the focused raster tests and confirm GREEN**

Run:

```powershell
npx vitest run src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts -t "поинт|маркеры старта|raster-иконок"
```

Expected: PASS for marker raster tests.

- [ ] **Step 5: Commit the artwork implementation**

```powershell
git add src/modules/online-map/components/VehicleTrackLayers.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
git commit -m "feat: refine route event markers"
```

---

### Task 3: Add the MapLibre pulse and preserve popup behavior

**Files:**
- Modify: `src/modules/online-map/components/VehicleTrackLayers.tsx`
- Modify: `src/modules/online-map/components/TrackEventPopup.tsx`
- Test: `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

**Interfaces:**
- Consumes: existing `eventColor`, event hover/click callbacks, MapLibre `setPaintProperty`, and `TrackEventPopup` data.
- Produces: one `vehicle-track-event-pulse` layer, a cleanup-safe animation loop, and a compact upright DOM popup.

- [ ] **Step 1: Add the pulse layer below event icons**

Add `vehicle-track-event-pulse` to `TRACK_LAYER_IDS`, then register:

```ts
map.addLayer(
  {
    id: 'vehicle-track-event-pulse',
    type: 'circle',
    source: TRACK_EVENTS_SOURCE_ID,
    paint: {
      'circle-color': ['get', 'eventColor'],
      'circle-radius': 14,
      'circle-opacity': 0.2,
      'circle-stroke-width': 0,
    },
  },
  'vehicle-track-event-icons',
);
```

Keep the icon layer at the exact event coordinate. Remove the old leader/vertical offset presentation for speeding, acceleration, and braking so the marker itself no longer floats above and hides a different track position. Retain the 28 px hitbox and labels only at the existing zoom thresholds.

- [ ] **Step 2: Add one cleanup-safe two-second animation loop**

```ts
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
let pulseFrameId: number | null = null;

const animatePulse = (timestamp: number) => {
  const progress = (timestamp % 2_000) / 2_000;
  map.setPaintProperty('vehicle-track-event-pulse', 'circle-radius', 14 + progress * 8);
  map.setPaintProperty('vehicle-track-event-pulse', 'circle-opacity', 0.24 * (1 - progress));
  pulseFrameId = requestAnimationFrame(animatePulse);
};

if (!reducedMotion && document.visibilityState !== 'hidden') {
  pulseFrameId = requestAnimationFrame(animatePulse);
}
```

Add a `visibilitychange` listener that stops the frame while hidden and restarts once when visible. In `cleanup`, remove the listener and cancel the outstanding frame before removing layers.

- [ ] **Step 3: Keep the popup screen-aligned and compact**

Do not add `pitchAlignment`, marker rotation, or map transforms in `OnlineFleetMap.tsx`. Update the regular-event article and its metadata rows in `TrackEventPopup.tsx` with the following concrete class structure while preserving its text values:

```tsx
<article
  aria-label={`Событие: ${event.title}`}
  className="min-w-56 max-w-72 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm shadow-[var(--shadow-card)]"
>
  <div className="flex items-center justify-between gap-3">
    <strong className="text-[var(--color-text)]">{event.title}</strong>
    {count > 1 ? <Badge>{count} события</Badge> : null}
  </div>
  <p className="font-semibold tabular-nums text-[var(--color-text)]">
    {event.timestamp} · {event.speedKph} км/ч
  </p>
  <p className="text-[var(--color-text-secondary)]">{event.address}</p>
  <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
    {event.description}
  </p>
</article>
```

Keep the current `Popup({ closeButton: true, focusAfterOpen: false, offset: 16 })` construction and hover/click flow.

- [ ] **Step 4: Run interaction and cleanup tests**

Run:

```powershell
npx vitest run src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
```

Expected: PASS; hover previews, leave clears, click activates, pulse paint updates, and cleanup cancels animation.

- [ ] **Step 5: Commit pulse and popup changes**

```powershell
git add src/modules/online-map/components/VehicleTrackLayers.tsx src/modules/online-map/components/TrackEventPopup.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
git commit -m "feat: animate route event points"
```

---

### Task 4: Regression verification

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: completed marker implementation.
- Produces: evidence that the focused tests, type checker, lint, and production build pass.

- [ ] **Step 1: Run the focused tests**

```powershell
npx vitest run src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts src/modules/online-map/components/VehicleMapMarker.test.tsx
```

Expected: PASS, including the unchanged vehicle marker tests.

- [ ] **Step 2: Run static checks**

```powershell
npm run typecheck
npm run lint -- src/modules/online-map/components/VehicleTrackLayers.tsx src/modules/online-map/components/TrackEventPopup.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
```

Expected: both commands exit 0.

- [ ] **Step 3: Run the production build**

```powershell
npm run build
```

Expected: Next.js production build exits 0.

- [ ] **Step 4: Inspect the final diff**

```powershell
git diff HEAD~3 -- src/modules/online-map/components/VehicleTrackLayers.tsx src/modules/online-map/components/TrackEventPopup.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
git diff --check
```

Expected: only marker/popup/test changes; no route, playback, speed-gradient, or vehicle course-marker logic changes; `git diff --check` exits 0.

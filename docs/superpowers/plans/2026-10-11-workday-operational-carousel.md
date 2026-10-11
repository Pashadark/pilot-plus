# Workday Operational Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an accessible operational carousel that combines daily rental events, deposit returns, and urgent vehicle warnings, and upgrade the dashboard weather badge with local condition-aware artwork.

**Architecture:** Keep database normalization in the dashboard server/domain layer and render a small client-side carousel over a single discriminated item model. The carousel owns only scrolling and navigation state; event content remains in focused card renderers. Weather artwork is selected by a pure mapper and served from the existing local Meteocons set.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, CSS, Vitest, Testing Library.

## Global Constraints

- Preserve the existing Pilot+ graphite design system and `#101014` page background.
- Do not copy or hotlink Yandex Weather CSS, fonts, or icon assets.
- Use the existing local Meteocons assets.
- Desktop arrows appear only for actual overflow and hover/focus; mobile uses native swipe.
- Respect `prefers-reduced-motion`.
- Do not overwrite unrelated dirty-worktree changes.

---

### Task 1: Include operational items in selected-day data

**Files:**
- Modify: `src/modules/dashboard/server/queries.ts`
- Modify: `src/modules/dashboard/WorkdayDashboard.tsx`
- Test: `src/modules/dashboard/server/queries.test.ts`
- Test: `src/modules/dashboard/normalizers.test.ts`

**Interfaces:**
- Consumes: `DashboardWorkItemDto` from `src/modules/dashboard/overview-types.ts`.
- Produces: `getDayEvents(day)` returning rental operations, visible deposit returns, and low-fuel work items relevant to the selected day.

- [ ] **Step 1: Write failing selected-day tests**

Add fixtures for a completed rental whose 21-business-day deposit deadline falls on the selected day and assert that `getDayEvents` returns `DEPOSIT_RETURN`. Add a low-fuel vehicle fixture and assert `LOW_FUEL` is returned without duplicating a rental event.

- [ ] **Step 2: Run the focused tests**

Run: `npx vitest run src/modules/dashboard/server/queries.test.ts src/modules/dashboard/normalizers.test.ts`

Expected: FAIL because the day query currently loads only `CONFIRMED` and `ACTIVE` rentals and filters to four rental kinds.

- [ ] **Step 3: Extend the day query with bounded operational data**

Load completed rentals only for the deposit reminder window, include the payment and committed operation fields already used by `buildDashboardOverview`, and include fresh fuel readings for real non-archived vehicles. Return only these supported kinds:

```ts
const carouselKinds = new Set([
  'HANDOVER',
  'DELIVERY',
  'RETURN',
  'RENTAL_END',
  'DEPOSIT_RETURN',
  'LOW_FUEL',
]);
return overview.workItems.filter((item) => carouselKinds.has(item.kind));
```

Update the initial dashboard filter to use the same kind set so initial render and date navigation agree.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run src/modules/dashboard/server/queries.test.ts src/modules/dashboard/normalizers.test.ts`

Expected: PASS.

### Task 2: Define and prioritize carousel items

**Files:**
- Create: `src/modules/dashboard/workday-carousel.ts`
- Create: `src/modules/dashboard/workday-carousel.test.ts`
- Modify: `src/modules/dashboard/WorkdayEventsSection.tsx`
- Modify: `src/modules/dashboard/WorkdayDashboard.tsx`
- Modify: `src/modules/dashboard/overview-types.ts`

**Interfaces:**
- Consumes: `DashboardWorkItemDto[]`, `DashboardAttentionItemDto[]`, selected day, current day.
- Produces: `buildWorkdayCarouselItems(input): WorkdayCarouselItem[]` and `WorkdayCarouselItem` discriminated by `type: 'operation' | 'attention'`.

- [ ] **Step 1: Write failing priority and deduplication tests**

Cover this order: overdue/danger, timed day events, deposit reminders, untimed warnings. Assert duplicate warning IDs linked to the same work item are removed and informational items are rejected. Assert that live GPS and fuel warnings appear only when the selected date is today.

- [ ] **Step 2: Run the mapper test**

Run: `npx vitest run src/modules/dashboard/workday-carousel.test.ts`

Expected: FAIL because the mapper does not exist.

- [ ] **Step 3: Implement the pure mapper**

Use stable keys and explicit priority values:

```ts
const priority = {
  overdue: 0,
  danger: 1,
  timedOperation: 2,
  depositReturn: 3,
  warning: 4,
} as const;
```

Do not infer missing money, times, clients, or vehicles. Preserve the existing DTO values and links. Pass `overview.attentionItems` from `WorkdayDashboard` into `WorkdayEventsSection`; merge those warnings only for the current day.

- [ ] **Step 4: Run the mapper test**

Run: `npx vitest run src/modules/dashboard/workday-carousel.test.ts`

Expected: PASS.

### Task 3: Build the native scroll carousel

**Files:**
- Modify: `src/modules/dashboard/WorkdayVehicleEvents.tsx`
- Create: `src/modules/dashboard/WorkdayVehicleEvents.test.tsx`
- Modify: `src/app/workday.css`

**Interfaces:**
- Consumes: `WorkdayCarouselItem[]`, `DashboardFleetVehicle[]`.
- Produces: accessible horizontal carousel with one-card scrolling, edge-aware arrows, keyboard navigation, native touch swipe, and existing details modal.

- [ ] **Step 1: Write failing interaction tests**

Mock `scrollTo`, `scrollLeft`, `clientWidth`, and `scrollWidth`. Assert:

- arrows are absent without overflow;
- right arrow scrolls by one card plus gap;
- left arrow is disabled/hidden at the start;
- `ArrowRight` and `ArrowLeft` navigate while focus is inside the carousel;
- deposit and warning cards use the correct labels and actions.

- [ ] **Step 2: Run the component test**

Run: `npx vitest run src/modules/dashboard/WorkdayVehicleEvents.test.tsx`

Expected: FAIL against the current plain grid.

- [ ] **Step 3: Implement navigation state**

Use one viewport ref, a `ResizeObserver`, and passive `scroll` handling. Calculate edges with a two-pixel tolerance and calculate the step from the first rendered card:

```ts
const step = firstCard?.getBoundingClientRect().width ?? viewport.clientWidth;
viewport.scrollBy({
  left: direction * (step + gap),
  behavior: reduceMotion ? 'auto' : 'smooth',
});
```

Arrow buttons use `FiChevronLeft` and `FiChevronRight`, live outside the scrollable element, and have Russian `aria-label` values.

- [ ] **Step 4: Add graphite carousel styling**

Use grid-auto-columns for three/two/one-card breakpoints, `scroll-snap-align: start`, hidden visual scrollbar, elevated graphite cards, focus-visible outlines, hover/focus arrow reveal, and `@media (pointer: coarse)` to hide overlay arrows. Keep the next mobile card partially visible.

- [ ] **Step 5: Run the component and dashboard tests**

Run: `npx vitest run src/modules/dashboard/WorkdayVehicleEvents.test.tsx src/modules/dashboard/WorkdayEventsSection.test.tsx tests/dashboard.spec.ts`

Expected: PASS.

### Task 4: Upgrade the weather badge with local artwork

**Files:**
- Create: `src/modules/weather/weather-artwork.ts`
- Create: `src/modules/weather/weather-artwork.test.ts`
- Modify: `src/modules/dashboard/WorkdayDashboard.tsx`
- Modify: `src/app/workday.css`

**Interfaces:**
- Consumes: `MoscowWeather` condition fields.
- Produces: `getWeatherArtwork(weather): { src: string; label: string }` pointing only to `/weather/meteocons/*.svg`.

- [ ] **Step 1: Write failing condition mapping tests**

Cover clear day/night, clouds, rain, snow, thunder, fog, and unknown fallback. Assert every path starts with `/weather/meteocons/`.

- [ ] **Step 2: Run the mapper test**

Run: `npx vitest run src/modules/weather/weather-artwork.test.ts`

Expected: FAIL because the mapper does not exist.

- [ ] **Step 3: Implement the mapper and badge**

Reuse the established condition vocabulary from `MoscowWeatherCard`. Replace the generic cloud icon with `next/image`, retain visible Moscow temperature and wind text, and add the human-readable condition when available.

- [ ] **Step 4: Style and verify the badge**

Keep the same compact header footprint, use the elevated theme surface, and size artwork between 28 and 36 pixels without changing title alignment.

Run: `npx vitest run src/modules/weather/weather-artwork.test.ts src/modules/weather/MoscowWeatherCard.test.tsx`

Expected: PASS.

### Task 5: Full verification and production rollout

**Files:**
- Modify if required by findings: only files listed above.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: verified production dashboard with rollback-safe deployment.

- [ ] **Step 1: Run static and focused verification**

Run:

```powershell
npm run typecheck
npm run lint
npx vitest run src/modules/dashboard src/modules/weather
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 2: Review desktop and mobile rendering**

Verify `/` at desktop and mobile widths in dark and light themes. Confirm no body horizontal scroll, no layout shift when arrows appear, swipe works, deposit cards are visible, and weather artwork matches the current condition.

- [ ] **Step 3: Deploy through the existing release process**

Create a new release directory, preserve `/opt/pilot-plus/current` as rollback target, build, switch the symlink, restart `pilot-plus`, and verify the service and `/api/health` before reporting completion.

- [ ] **Step 4: Run production canary checks**

Verify the home page returns successfully, inspect browser console errors, and confirm the previous release remains available for rollback.

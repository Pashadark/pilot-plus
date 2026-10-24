# GPS Monitoring, Events, and Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and execute tasks in order. Do not deploy until the complete verification gate passes.

**Goal:** Make Supa Pro GPS ingestion detect harsh acceleration safely, persist auditable events, prepare staff/client notifications in record-only mode, and make route playback follow real GPS time without changing the approved map visual language.

**Architecture:** Extend the existing telematics ingestion, `VehicleEvent`, bot notification queue, Events module, Profile settings, and online-map workspace. Detection is a pure tested domain function called from ingestion; playback is a pure timestamp-based model consumed by the existing MapLibre layers. Schema changes are additive, notification delivery defaults to `RECORD_ONLY`, and all visual redesign work remains behind the owner approval gate.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Prisma 6/PostgreSQL, Vitest, MapLibre GL, Python Telegram worker.

## Global Constraints

- Product copy uses only **Supa Pro / СУПА ПРО** and the approved descriptor.
- Do not modify or replace the approved logo.
- Preserve the existing dirty worktree and touch only scoped files.
- Use additive Prisma migrations; never reset or destructively rewrite production data.
- Do not enable outbound harsh-acceleration notifications in production in this implementation. Default is `RECORD_ONLY`.
- Do not change marker, track, control, panel, or unloaded-tile visuals before presenting variants and receiving explicit approval.
- Do not deploy until targeted tests, full typecheck, lint for changed files, unit tests, and production build pass.

---

### Task 1: Add the pure harsh-acceleration detector

**Files:**
- Create: `src/modules/telematics/domain/harsh-acceleration.ts`
- Create: `src/modules/telematics/domain/harsh-acceleration.test.ts`

**Step 1: Write failing tests**

Cover normal acceleration, harsh threshold, critical threshold, timestamp disorder, duplicate points, unrealistic GPS jump, long sampling gap, three-second confirmation, and three-second event merging.

Use this public contract:

```ts
export type AccelerationSample = {
  id: string;
  recordedAt: Date;
  latitude: number;
  longitude: number;
  speedKph: number;
};

export type AccelerationDetectorSettings = {
  harshThresholdMps2: number;
  criticalThresholdMps2: number;
  confirmationWindowMs: number;
  mergeWindowMs: number;
  maximumGapMs: number;
};

export type DetectedAccelerationEvent = {
  severity: 'WARNING' | 'CRITICAL';
  startedAt: Date;
  endedAt: Date;
  startPointId: string;
  endPointId: string;
  startSpeedKph: number;
  endSpeedKph: number;
  maxAccelerationMps2: number;
  durationMs: number;
  pointIds: string[];
};

export function detectHarshAcceleration(
  samples: AccelerationSample[],
  settings: AccelerationDetectorSettings,
): DetectedAccelerationEvent[];
```

**Step 2: Prove RED**

Run: `npx vitest run src/modules/telematics/domain/harsh-acceleration.test.ts`

**Step 3: Implement the minimum robust detector**

- Sort and deduplicate by timestamp/id.
- Reject non-positive deltas, gaps beyond `maximumGapMs`, impossible implied distance/speed, and invalid coordinates.
- Smooth speed with a bounded three-sample median.
- Compute acceleration in m/s².
- Require the threshold to be confirmed within the confirmation window.
- Merge adjacent confirmed intervals within the merge window.
- Preserve point IDs for auditability.

**Step 4: Prove GREEN**

Run the same Vitest command and then `npm run typecheck`.

---

### Task 2: Add additive GPS settings and event fields

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/<timestamp>_gps_event_settings/migration.sql`
- Create: `src/modules/telematics/domain/gps-settings.ts`
- Create: `src/modules/telematics/domain/gps-settings.test.ts`

**Step 1: Write failing settings-resolution tests**

Test company defaults, partial vehicle override, explicit disabled detector, and `RECORD_ONLY` default.

```ts
export type GpsNotificationMode = 'RECORD_ONLY' | 'STAFF_ONLY' | 'STAFF_AND_CLIENT';

export function resolveGpsSettings(
  company: CompanyGpsSettingsShape | null,
  vehicle: VehicleGpsSettingsOverrideShape | null,
): ResolvedGpsSettings;
```

**Step 2: Add schema fields and models**

- Extend `VehicleEvent` with nullable company/rental/client links, start/end timestamps and coordinates, speed range, max acceleration, duration, point IDs JSON, details JSON.
- Add one-to-one `CompanyGpsSettings` and `VehicleGpsSettingsOverride` models.
- Add `GpsClientWarning` with unique dedupe identity and acknowledgement fields.
- Defaults: detector enabled, 3.0/4.0 m/s², 3000ms confirmation/merge, mode `RECORD_ONLY`.

**Step 3: Create additive migration SQL**

Use `ALTER TABLE ... ADD COLUMN`, new tables, foreign keys, and indexes only. No drops, rewrites, or data deletion.

**Step 4: Validate**

Run:
- `npx prisma format`
- `npx prisma validate`
- `npx prisma generate`
- `npx vitest run src/modules/telematics/domain/gps-settings.test.ts`
- `npm run db:migrate:fresh:verify`

---

### Task 3: Persist acceleration events during ingestion

**Files:**
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.ts`
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.test.ts`
- Create: `src/modules/telematics/glonasssoft/harsh-acceleration-events.server.ts`
- Create: `src/modules/telematics/glonasssoft/harsh-acceleration-events.server.test.ts`

**Step 1: Write failing repository/service tests**

Assert that ingestion loads a short ordered position window, resolves active rental/client at the event timestamp, persists exactly one `HARSH_ACCELERATION` event, and is idempotent for duplicate provider data.

**Step 2: Implement service boundary**

```ts
export async function detectAndPersistHarshAcceleration(input: {
  companyId: string;
  vehicleId: string;
  latestPositionId: string;
  prisma: PrismaLike;
}): Promise<{ createdEventIds: string[] }>;
```

Generate a deterministic external ID from vehicle/start/end/point IDs. Use a transaction for event creation and queue preparation. Never send network requests inline.

**Step 3: Connect after successful point persistence**

Call the service only after `savePoint` succeeds. Detector failures must be logged and isolated so GPS ingestion continues.

**Step 4: Verify**

Run both focused test files, then `npm run typecheck`.

---

### Task 4: Queue staff and client bot notifications safely

**Files:**
- Create: `src/modules/bot-api/gps-event-notifications.ts`
- Create: `src/modules/bot-api/gps-event-notifications.test.ts`
- Modify: `src/app/api/bot/v1/notifications/claim/route.ts`
- Modify: `src/app/api/bot/v1/notifications/claim/route.test.ts`
- Modify: `bot/services/notifications.py`
- Modify: `bot/keyboards/notifications.py`
- Modify: corresponding `bot/tests/*`

**Step 1: Write failing TypeScript queue tests**

Assert exact dedupe key, staff template payload, Supa Pro map deep link, rental link, record-only behavior, same-rental three-events-in-30-min aggregation, 30-min client cooldown, and acknowledgement payload.

**Step 2: Implement queue builders**

```ts
export function buildGpsEventMapHref(event: GpsEventLinkInput): string;
export async function queueGpsEventNotifications(input: QueueGpsEventInput): Promise<QueueResult>;
```

`RECORD_ONLY` persists the event and returns without creating a sendable job.

**Step 3: Extend bot template handling and inline acknowledgement**

Reuse the existing allow-listed callback system. Do not introduce a second worker or direct Telegram call.

**Step 4: Verify**

Run focused Vitest and Python bot tests. Confirm no real bot token/network is used.

---

### Task 5: Add “GPS и уведомления” settings without redesigning Profile

**Files:**
- Modify: existing Profile workspace/form/query/action files discovered by `rg -n "ProfileWorkspace|ProfileForms" src/modules/profile src/app`
- Create: `src/modules/profile/gps-settings-actions.ts`
- Create: `src/modules/profile/gps-settings-actions.test.ts`

**Step 1: Write failing validation/action tests**

Cover role authorization, numeric bounds, partial overrides, reset-to-company-default, audit log, and record-only default.

**Step 2: Implement server action and existing-design form**

Use Zod validation, company scope, existing controls, and `revalidatePath('/profile')`. No new visual language.

**Step 3: Verify**

Run focused tests, typecheck, and Profile component tests.

---

### Task 6: Expose events and support deep links

**Files:**
- Modify: `src/modules/online-map/server/track-history.ts`
- Modify: `src/modules/online-map/server/track-history.test.ts`
- Modify: `src/modules/online-map/track-types.ts`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: map page server component that owns `searchParams`

**Step 1: Write failing history/deep-link tests**

Assert acceleration event DTO, event coordinates/timestamps, and selection from `/map?vehicleId=...&date=...&eventId=...`.

**Step 2: Extend DTO and query**

Add `harsh-acceleration` event type and details without changing existing types or colors.

**Step 3: Implement server search-param parsing**

Read `searchParams` in the page Server Component and pass initial selection as props, avoiding an unnecessary client-only bailout.

**Step 4: Verify**

Run focused tests and production build.

---

### Task 7: Replace percentage playback with real timestamp playback

**Files:**
- Modify: `src/modules/online-map/track-model.ts`
- Modify: `src/modules/online-map/track-model.test.ts`
- Modify: `src/modules/online-map/track-types.ts`

**Step 1: Write failing interpolation tests**

Cover irregular timestamps, equal timestamps, large gaps, exact endpoints, interpolation of coordinates/speed/heading, and trail filtering.

```ts
export function getTrackBounds(track: VehicleTrack): { startMs: number; endMs: number };
export function getPlaybackFrame(track: VehicleTrack, cursorMs: number): PlaybackFrame;
export function getPlaybackTrail(track: VehicleTrack, cursorMs: number): VehicleTrackPoint[];
```

**Step 2: Implement timestamp model**

Never fabricate a line across a gap larger than `MAX_TRACK_POINT_GAP_MS`. Clamp the cursor and provide the nearest valid frame when interpolation is unsafe.

**Step 3: Verify**

Run `npx vitest run src/modules/online-map/track-model.test.ts` and typecheck.

---

### Task 8: Connect real-time playback to the existing map controls

**Files:**
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: `src/modules/online-map/components/TrackPlayback.tsx`
- Modify: `src/modules/online-map/components/VehicleTrackLayers.tsx`
- Modify/create focused component tests

**Step 1: Write failing behavior tests**

Assert x1/x5/x10/x30, requestAnimationFrame elapsed-time advancement, pause/resume, seek, current clock label, gradual past trail, hidden future route while playing/seeking, and full route restored before playback/reset.

**Step 2: Implement controller**

Store `cursorMs`, not percentage, as source of truth. Use monotonic animation timestamps; derive range percentage for the existing slider.

**Step 3: Update MapLibre sources safely**

While playback is active, set the base visible track to the past trail and keep future coordinates out of rendered sources. Preserve existing gradient and approved styles.

**Step 4: Verify**

Run focused component/model tests and typecheck.

---

### Task 9: Fix event-card data and right-panel overflow functionally

**Files:**
- Modify: current online-map event card and right-panel components discovered by targeted `rg`
- Modify/create focused tests

**Step 1: Reproduce with tests**

Add fixtures for missing rental/client/location data and narrow desktop/mobile widths.

**Step 2: Fix data fallbacks and overflow**

Render meaningful existing fields, safe fallbacks, `min-width: 0`, truncation/wrapping, and vertical scrolling. Do not redesign cards or panel.

**Step 3: Verify**

Run focused tests and a Playwright smoke test at mobile and desktop widths.

---

### Task 10: Add acceleration events to the existing Events page

**Files:**
- Modify: `src/modules/events/server/queries.ts`
- Modify/create Events page component/tests

**Step 1: Write failing query/UI tests**

Assert company isolation, vehicle/rental/client attribution, severity, timestamp, and map deep link.

**Step 2: Extend existing query and row/card**

Use existing Supa Pro styles. No new page redesign.

**Step 3: Verify**

Run focused tests and typecheck.

---

### Task 11: Prepare visual variants and stop at the approval gate

**Files:**
- Create visual artifacts outside production code for: acceleration color, event marker, start/finish/long-stop markers, unloaded-tile background, and any significant panel change.

Produce 2–3 variants grounded in the live Supa Pro screen. Do not implement the selected visual changes until the owner explicitly approves a variant.

---

### Task 12: Full verification and safe rollout gate

**Step 1: Run full local verification**

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

**Step 2: Review migration and diff**

Confirm additive-only SQL, no logo/brand regressions, no unrelated files, notification mode remains `RECORD_ONLY`, and no secrets are committed.

**Step 3: Production rollout only after explicit approval**

- Back up database.
- Apply additive migration.
- Deploy one versioned release.
- Run health, authenticated map, mobile theme, track history, playback, and event deep-link canaries.
- Keep Telegram delivery disabled until separately approved.
- Roll back application release on any regression; additive schema remains backward-compatible.


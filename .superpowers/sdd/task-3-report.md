# Task 3 — Онлайн-карта: реальные GPS-индикаторы

## Result

- `listOnlineMapVehicles` now selects the latest `GLONASSSOFT` address and delegates all
  GPS-state derivation to `deriveVehicleGpsStatus` from Task 1.
- The map DTO carries `gpsStatus`; old local moving/idle/offline status rendering was removed.
- Existing map filter semantics map explicitly to shared keys: `offline → STALE` and
  `no-data → NO_DATA`; the new `in-park` filter maps to `IN_PARK`.
- Markers and the selected panel use shared label/tone. Stale and no-data are red;
  the selected panel explicitly says `Последний сигнал`.
- Vehicles without coordinates remain in the workspace list/filter but `OnlineFleetMap`
  creates no marker for them. The protected `/map` route still passes the server result
  directly and has no fixture fallback.

## TDD evidence

RED was observed in focused map tests before implementation:

- shared-key filtering returned `[]` for a stale vehicle;
- stale marker and selected-panel tests received the old `Нет связи`/secondary styling;
- no-coordinate workspace filtering used the old disconnected filter model.

The first query-test attempt was blocked because this worktree contained only Vitest cache
under `node_modules`, so the existing config's local Next `server-only` alias did not resolve.
A local ignored junction to the repository's installed Next package enabled the existing
query test configuration; no tracked dependency or configuration changed.

## Verification

```text
npx vitest run src/modules/online-map/server/queries.test.ts \
  src/modules/online-map/filter-vehicles.test.ts \
  src/modules/online-map/components/VehicleMapMarker.test.tsx \
  src/modules/online-map/components/SelectedVehiclePanel.test.tsx \
  src/modules/online-map/components/OnlineMapWorkspace.test.tsx \
  src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
6 passed, 46 tests passed

npx vitest run src/modules/online-map/filter-vehicles.test.ts \
  src/modules/online-map/components/VehicleMapMarker.test.tsx \
  src/modules/online-map/components/SelectedVehiclePanel.test.tsx \
  src/modules/online-map/components/OnlineMapWorkspace.test.tsx \
  src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts \
  src/app/(protected)/map/route-states.test.tsx
6 passed, 47 tests passed

npx vitest run src/app/(protected)/map/route-states.test.tsx
1 passed, 3 tests passed

npm run typecheck
exit 0

npx eslint <Task 3 online-map files>
exit 0

npx prettier --check <Task 3 online-map files>
All matched files use Prettier code style!

git diff --check
exit 0
```

No DB/schema/data changes or full suite were run.

## Concern

The requested local signed-in browser inspection was not performed in this subtask: the
focused unit/component/route tests are the available verification evidence.

## Reviewer follow-up — partial GLONASSSOFT coordinates

Reviewer P1 found that `Number(null)` could serialize a partial provider position as the
fictional coordinate `0`. A new server-query regression first failed with `latitude: 0`.
The mapper now validates finite latitude/longitude ranges and returns **both** values as
`null` unless both are present and valid. The shared GPS view therefore remains `NO_DATA`;
the existing map regression verifies that no-coordinate vehicles create no marker while
remaining available to the workspace list/filter.

```text
npx vitest run src/modules/online-map/server/queries.test.ts \
  src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
2 passed, 19 tests passed

npm run typecheck
exit 0

git diff --check
exit 0
```

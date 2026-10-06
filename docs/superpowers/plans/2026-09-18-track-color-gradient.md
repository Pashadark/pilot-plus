# Track color gradient implementation plan

> Execute inline with executing-plans and test-driven-development.

**Goal:** Replace discrete track colors with native continuous gradients.
**Architecture:** Keep the existing segment source for interaction. Build continuous
render runs, each with a lineMetrics source and line-gradient layer. Preserve geometry.
**Tech Stack:** TypeScript, MapLibre, Vitest.

## Constraints

Only track color changes. No GPS, panels, marker, database or worker changes.

## Steps

- [ ] Add `track-gradient.test.ts` for continuity, split trips, zero length and color scale;
  run `npx vitest run src/modules/online-map/track-gradient.test.ts` and observe failure.
- [ ] Add `track-gradient.ts`: `buildTrackGradientRuns(segments, geometry)` returns
  coordinates, tripIndex and an interpolation expression using Mercator lengths.
  Split runs at discontinuities; remove duplicate distance stops; omit zero-length runs.
- [ ] Modify `VehicleTrackLayers.tsx`: add native gradient sources with
  `lineMetrics: true`, preserve interaction source, remove dynamic layers before sources.
- [ ] Run gradient and map cleanup tests, TypeScript and targeted ESLint.
- [ ] Build an isolated production release based on current server release, copying
  only the two changed implementation files. Switch only after successful build.
- [ ] Verify visible route and no gradient errors in browser, and check server health.

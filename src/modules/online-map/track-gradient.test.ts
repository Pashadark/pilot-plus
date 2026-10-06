import { expect, it } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { buildTrackGradientRuns, trackSpeedColor } from './track-gradient';
import type { VehicleTrackSegment } from './track-types';

function segment(
  id: string,
  x: number,
  fromSpeed: number,
  toSpeed: number,
  tripId = 'a',
): VehicleTrackSegment {
  return {
    id,
    tripId,
    tripIndex: 0,
    opacity: 0.72,
    color: 'green',
    speedKph: toSpeed,
    from: { id: `${x}`, coordinates: [x, 55], timestamp: `${x}`, speedKph: fromSpeed, address: '' },
    to: {
      id: `${x + 1}`,
      coordinates: [x + 1, 55],
      timestamp: `${x + 1}`,
      speedKph: toSpeed,
      address: '',
    },
  };
}
it('joins adjacent geometry and uses continuous native gradient stops', () => {
  const segments = [segment('a', 37, 0, 70), segment('b', 38, 70, 140)];
  const runs = buildTrackGradientRuns(
    segments,
    segments.map((s) => [[...s.from.coordinates], [...s.to.coordinates]]),
  );
  expect(runs).toHaveLength(1);
  expect(runs[0].coordinates).toEqual([
    [37, 55],
    [38, 55],
    [39, 55],
  ]);
  expect(runs[0].gradient.slice(0, 3)).toEqual(['interpolate', ['linear'], ['line-progress']]);
  expect(runs[0].stops[0]).toEqual([0, trackSpeedColor(0)]);
  expect(runs[0].stops.at(-1)).toEqual([1, trackSpeedColor(140)]);
  expect(runs[0].stops.some(([t]) => Math.abs(t - 0.5) < 1e-8)).toBe(true);
  expect(runs[0].stops.some(([, color]) => color === trackSpeedColor(100))).toBe(true);
});
it('never connects different trips or disconnected points', () => {
  const segments = [
    segment('a', 37, 0, 40),
    segment('b', 38, 40, 70, 'b'),
    segment('c', 40, 70, 80, 'b'),
  ];
  expect(
    buildTrackGradientRuns(
      segments,
      segments.map((s) => [[...s.from.coordinates], [...s.to.coordinates]]),
    ),
  ).toHaveLength(3);
});
it('omits empty and stationary geometry without invalid gradient stops', () => {
  expect(buildTrackGradientRuns([], [])).toEqual([]);
  const s = segment('a', 37, 0, 0);
  expect(
    buildTrackGradientRuns(
      [s],
      [
        [
          [37, 55],
          [37, 55],
        ],
      ],
    ),
  ).toEqual([]);
});
it('handles duplicate vertices and uses strictly increasing stops', () => {
  const s = segment('a', 37, 140, 0);
  const [run] = buildTrackGradientRuns(
    [s],
    [
      [
        [37, 55],
        [37, 55],
        [38, 55],
      ],
    ],
  );
  expect(
    run.stops.every(([t], i) => Number.isFinite(t) && (i === 0 || t > run.stops[i - 1][0])),
  ).toBe(true);
});
it('goes through burgundy at 120 and dark at 160', () => {
  expect(trackSpeedColor(120)).toBe('#7f1d1d');
  expect(trackSpeedColor(160)).toBe('#111827');
  expect(trackSpeedColor(140)).not.toBe(trackSpeedColor(120));
});

it('produces a valid MapLibre line-gradient style', () => {
  const s = segment('a', 37, 0, 160);
  const [run] = buildTrackGradientRuns([s], [[[37, 55], [38, 55]]]);
  expect(validateStyleMin({ version: 8, sources: { track: {
    type: 'geojson', lineMetrics: true, data: { type: 'Feature', properties: {},
      geometry: {type: 'LineString', coordinates: run.coordinates} }
  } }, layers: [{id: 'track', type: 'line', source: 'track',
    paint: {'line-gradient': run.gradient} }] })).toEqual([]);
});

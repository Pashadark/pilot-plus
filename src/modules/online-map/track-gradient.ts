import type { ExpressionSpecification } from 'maplibre-gl';
import type { VehicleTrackSegment } from './track-types';

const PALETTE: readonly (readonly [number, string])[] = [
  [0, '#22c55e'],
  [39, '#22c55e'],
  [69, '#f59e0b'],
  [99, '#f97316'],
  [100, '#ef4444'],
  [120, '#7f1d1d'],
  [160, '#111827'],
];

export function trackSpeedColor(speed: number): string {
  const value = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  for (let i = 1; i < PALETTE.length; i++) {
    const [end, to] = PALETTE[i];
    const [start, from] = PALETTE[i - 1];
    if (value > end) continue;
    const ratio = (value - start) / (end - start);
    return (
      '#' +
      [1, 3, 5]
        .map((offset) => {
          const a = parseInt(from.slice(offset, offset + 2), 16);
          const b = parseInt(to.slice(offset, offset + 2), 16);
          return Math.round(a + (b - a) * ratio)
            .toString(16)
            .padStart(2, '0');
        })
        .join('')
    );
  }
  return PALETTE[PALETTE.length - 1][1];
}

export interface TrackGradientRun {
  coordinates: number[][];
  tripIndex: number;
  stops: [number, string][];
  gradient: ExpressionSpecification;
}

// MapLibre line-progress measures projected (Web Mercator), not geodesic length.
function projectedDistance(a: number[], b: number[]): number {
  const y = (lat: number) =>
    Math.log(
      Math.tan(Math.PI / 4 + (Math.max(-85.051129, Math.min(85.051129, lat)) * Math.PI) / 360),
    );
  return Math.hypot(((b[0] - a[0]) * Math.PI) / 180, y(b[1]) - y(a[1]));
}

export function buildTrackGradientRuns(
  segments: readonly VehicleTrackSegment[],
  geometry: readonly number[][][],
): TrackGradientRun[] {
  const runs: TrackGradientRun[] = [];
  let coordinates: number[][] = [];
  let stops: [number, string][] = [];
  let length = 0;
  let previous: VehicleTrackSegment | undefined;

  const finish = () => {
    if (length > 0 && coordinates.length > 1 && previous) {
      const normalized = stops.map(([distance, color]): [number, string] => [
        distance / length,
        color,
      ]);
      runs.push({
        coordinates,
        tripIndex: previous.tripIndex,
        stops: normalized,
        gradient: [
          'interpolate',
          ['linear'],
          ['line-progress'],
          ...normalized.flat(),
        ] as ExpressionSpecification,
      });
    }
    coordinates = [];
    stops = [];
    length = 0;
  };
  const addStop = (distance: number, speed: number) => {
    const stop: [number, string] = [distance, trackSpeedColor(speed)];
    if (stops.length && distance === stops[stops.length - 1][0]) stops[stops.length - 1] = stop;
    else stops.push(stop);
  };

  segments.forEach((segment, index) => {
    const points = geometry[index];
    if (!points || points.length < 2) {
      finish();
      previous = undefined;
      return;
    }
    const tail = coordinates.at(-1);
    if (
      previous &&
      (previous.tripId !== segment.tripId ||
        previous.to.timestamp !== segment.from.timestamp ||
        tail?.[0] !== points[0][0] ||
        tail?.[1] !== points[0][1])
    )
      finish();
    if (!coordinates.length) coordinates.push([...points[0]]);
    let intervalLength = 0;
    for (let i = 1; i < points.length; i++) {
      const distance = projectedDistance(points[i - 1], points[i]);
      if (distance > 0) {
        intervalLength += distance;
        coordinates.push([...points[i]]);
      }
    }
    const from = segment.from.speedKph;
    const to = segment.to.speedKph;
    addStop(length, from);
    if (intervalLength > 0) {
      const crossings = PALETTE.map(([speed]) => ({ speed, t: (speed - from) / (to - from) }))
        .filter(({ t }) => t > 0 && t < 1)
        .sort((a, b) => a.t - b.t);
      for (const { speed, t } of crossings) addStop(length + t * intervalLength, speed);
      length += intervalLength;
      addStop(length, to);
    }
    previous = segment;
  });
  finish();
  return runs;
}

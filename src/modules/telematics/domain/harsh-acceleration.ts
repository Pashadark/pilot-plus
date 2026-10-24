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

export const DEFAULT_ACCELERATION_DETECTOR_SETTINGS: AccelerationDetectorSettings = {
  harshThresholdMps2: 3,
  criticalThresholdMps2: 4,
  confirmationWindowMs: 3_000,
  mergeWindowMs: 3_000,
  maximumGapMs: 10_000,
};

const MAX_REPORTED_SPEED_KPH = 350;
const MAX_IMPLIED_SPEED_KPH = 400;
const EARTH_RADIUS_METERS = 6_371_000;

type NormalizedSample = AccelerationSample & {
  timeMs: number;
  smoothedSpeedKph: number;
};

function isValidSample(sample: AccelerationSample): boolean {
  return (
    sample.id.length > 0 &&
    Number.isFinite(sample.recordedAt.getTime()) &&
    Number.isFinite(sample.latitude) &&
    sample.latitude >= -90 &&
    sample.latitude <= 90 &&
    Number.isFinite(sample.longitude) &&
    sample.longitude >= -180 &&
    sample.longitude <= 180 &&
    Number.isFinite(sample.speedKph) &&
    sample.speedKph >= 0 &&
    sample.speedKph <= MAX_REPORTED_SPEED_KPH
  );
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(left: AccelerationSample, right: AccelerationSample): number {
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function smoothSpeed(samples: AccelerationSample[], index: number): number {
  const current = samples[index];
  if (!current) {
    return 0;
  }

  const previous = samples[index - 1];
  const next = samples[index + 1];
  if (!previous || !next) {
    return current.speedKph;
  }

  const neighbourDifference = Math.abs(previous.speedKph - next.speedKph);
  const currentDeviation = Math.min(
    Math.abs(current.speedKph - previous.speedKph),
    Math.abs(current.speedKph - next.speedKph),
  );

  return neighbourDifference <= 20 && currentDeviation >= 80
    ? median([previous.speedKph, current.speedKph, next.speedKph])
    : current.speedKph;
}

function normalizeSamples(samples: AccelerationSample[]): Array<NormalizedSample | null> {
  const ordered = [...samples].sort((left, right) => {
    const timeDifference = left.recordedAt.getTime() - right.recordedAt.getTime();
    return timeDifference !== 0 ? timeDifference : left.id.localeCompare(right.id);
  });
  const deduplicated: AccelerationSample[] = [];
  const seenTimestamps = new Set<number>();

  for (const sample of ordered) {
    const timestamp = sample.recordedAt.getTime();
    if (seenTimestamps.has(timestamp)) {
      continue;
    }
    seenTimestamps.add(timestamp);
    deduplicated.push(sample);
  }

  return deduplicated.map((sample, index) =>
    isValidSample(sample)
      ? {
          ...sample,
          timeMs: sample.recordedAt.getTime(),
          smoothedSpeedKph: smoothSpeed(deduplicated, index),
        }
      : null,
  );
}

function isConnected(
  previous: NormalizedSample,
  current: NormalizedSample,
  settings: AccelerationDetectorSettings,
): boolean {
  const deltaMs = current.timeMs - previous.timeMs;
  if (deltaMs <= 0 || deltaMs > settings.maximumGapMs) {
    return false;
  }

  const impliedSpeedKph = (distanceMeters(previous, current) / deltaMs) * 3_600;
  return impliedSpeedKph <= MAX_IMPLIED_SPEED_KPH;
}

function buildConfirmedEvents(
  normalized: Array<NormalizedSample | null>,
  settings: AccelerationDetectorSettings,
): DetectedAccelerationEvent[] {
  const events: DetectedAccelerationEvent[] = [];
  let run: {
    start: NormalizedSample;
    end: NormalizedSample;
    maxAccelerationMps2: number;
    points: NormalizedSample[];
  } | null = null;

  const finishRun = () => {
    if (!run || run.end.timeMs - run.start.timeMs < settings.confirmationWindowMs) {
      run = null;
      return;
    }

    events.push({
      severity: run.maxAccelerationMps2 >= settings.criticalThresholdMps2 ? 'CRITICAL' : 'WARNING',
      startedAt: new Date(run.start.timeMs),
      endedAt: new Date(run.end.timeMs),
      startPointId: run.start.id,
      endPointId: run.end.id,
      startSpeedKph: run.start.speedKph,
      endSpeedKph: run.end.speedKph,
      maxAccelerationMps2: Math.round(run.maxAccelerationMps2 * 1_000) / 1_000,
      durationMs: run.end.timeMs - run.start.timeMs,
      pointIds: run.points.map((point) => point.id),
    });
    run = null;
  };

  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];

    if (!previous || !current || !isConnected(previous, current, settings)) {
      finishRun();
      continue;
    }

    const deltaSeconds = (current.timeMs - previous.timeMs) / 1_000;
    const accelerationMps2 =
      ((current.smoothedSpeedKph - previous.smoothedSpeedKph) / 3.6) / deltaSeconds;

    if (accelerationMps2 < settings.harshThresholdMps2) {
      finishRun();
      continue;
    }

    if (!run) {
      run = {
        start: previous,
        end: current,
        maxAccelerationMps2: accelerationMps2,
        points: [previous, current],
      };
      continue;
    }

    run.end = current;
    run.maxAccelerationMps2 = Math.max(run.maxAccelerationMps2, accelerationMps2);
    run.points.push(current);
  }

  finishRun();
  return events;
}

function mergeEvents(
  events: DetectedAccelerationEvent[],
  settings: AccelerationDetectorSettings,
): DetectedAccelerationEvent[] {
  const merged: DetectedAccelerationEvent[] = [];

  for (const event of events) {
    const previous = merged.at(-1);
    if (!previous || event.startedAt.getTime() - previous.endedAt.getTime() > settings.mergeWindowMs) {
      merged.push(event);
      continue;
    }

    previous.endedAt = event.endedAt;
    previous.endPointId = event.endPointId;
    previous.endSpeedKph = event.endSpeedKph;
    previous.maxAccelerationMps2 = Math.max(previous.maxAccelerationMps2, event.maxAccelerationMps2);
    previous.durationMs = previous.endedAt.getTime() - previous.startedAt.getTime();
    previous.pointIds = [...new Set([...previous.pointIds, ...event.pointIds])];
    previous.severity =
      previous.maxAccelerationMps2 >= settings.criticalThresholdMps2 ? 'CRITICAL' : 'WARNING';
  }

  return merged;
}

export function detectHarshAcceleration(
  samples: AccelerationSample[],
  settings: AccelerationDetectorSettings,
): DetectedAccelerationEvent[] {
  if (
    samples.length < 2 ||
    settings.harshThresholdMps2 <= 0 ||
    settings.criticalThresholdMps2 < settings.harshThresholdMps2 ||
    settings.confirmationWindowMs < 0 ||
    settings.mergeWindowMs < 0 ||
    settings.maximumGapMs <= 0
  ) {
    return [];
  }

  return mergeEvents(buildConfirmedEvents(normalizeSamples(samples), settings), settings);
}

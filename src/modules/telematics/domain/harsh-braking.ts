import {
  detectHarshAcceleration,
  type AccelerationDetectorSettings,
  type AccelerationSample,
} from './harsh-acceleration';

export type BrakingDetectorSettings = {
  harshThresholdMps2: number;
  criticalThresholdMps2: number;
  confirmationWindowMs: number;
  mergeWindowMs: number;
  maximumGapMs: number;
};

export type DetectedBrakingEvent = {
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

export const DEFAULT_BRAKING_DETECTOR_SETTINGS: BrakingDetectorSettings = {
  harshThresholdMps2: 3,
  criticalThresholdMps2: 4,
  confirmationWindowMs: 3_000,
  mergeWindowMs: 3_000,
  maximumGapMs: 10_000,
};

export function detectHarshBraking(
  samples: AccelerationSample[],
  settings: BrakingDetectorSettings,
): DetectedBrakingEvent[] {
  const sampleById = new Map(samples.map((sample) => [sample.id, sample]));
  const mirrored = samples.map((sample) => ({
    ...sample,
    speedKph: 350 - sample.speedKph,
  }));
  const detectorSettings: AccelerationDetectorSettings = settings;

  return detectHarshAcceleration(mirrored, detectorSettings).flatMap((event) => {
    const start = sampleById.get(event.startPointId);
    const end = sampleById.get(event.endPointId);
    if (!start || !end) return [];

    return [
      {
        severity: event.severity,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        startPointId: event.startPointId,
        endPointId: event.endPointId,
        startSpeedKph: start.speedKph,
        endSpeedKph: end.speedKph,
        maxAccelerationMps2: -event.maxAccelerationMps2,
        durationMs: event.durationMs,
        pointIds: event.pointIds,
      },
    ];
  });
}

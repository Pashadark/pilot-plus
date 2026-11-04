import { describe, expect, it } from 'vitest';

import { DEFAULT_GPS_SETTINGS, resolveGpsSettings } from './gps-settings';

describe('resolveGpsSettings', () => {
  it('использует безопасные значения по умолчанию без настроек компании', () => {
    expect(resolveGpsSettings(null, null)).toEqual(DEFAULT_GPS_SETTINGS);
    expect(resolveGpsSettings(null, null).notificationMode).toBe('RECORD_ONLY');
    expect(resolveGpsSettings(null, null)).toMatchObject({
      brakingDetectionEnabled: true,
      harshBrakingThresholdMps2: 3,
      criticalBrakingThresholdMps2: 4,
    });
  });

  it('применяет настройки компании', () => {
    expect(
      resolveGpsSettings(
        {
          accelerationDetectionEnabled: true,
          harshAccelerationThresholdMps2: 3.2,
          criticalAccelerationThresholdMps2: 4.4,
          brakingDetectionEnabled: true,
          harshBrakingThresholdMps2: 3.1,
          criticalBrakingThresholdMps2: 4.1,
          confirmationWindowMs: 3_500,
          mergeWindowMs: 2_500,
          maximumGapMs: 12_000,
          clientWarningEventCount: 4,
          clientWarningWindowMinutes: 45,
          clientWarningCooldownMinutes: 60,
          notificationMode: 'STAFF_ONLY',
        },
        null,
      ),
    ).toEqual({
      accelerationDetectionEnabled: true,
      harshAccelerationThresholdMps2: 3.2,
      criticalAccelerationThresholdMps2: 4.4,
      brakingDetectionEnabled: true,
      harshBrakingThresholdMps2: 3.1,
      criticalBrakingThresholdMps2: 4.1,
      confirmationWindowMs: 3_500,
      mergeWindowMs: 2_500,
      maximumGapMs: 12_000,
      clientWarningEventCount: 4,
      clientWarningWindowMinutes: 45,
      clientWarningCooldownMinutes: 60,
      notificationMode: 'STAFF_ONLY',
    });
  });

  it('накладывает только заполненные настройки автомобиля', () => {
    const resolved = resolveGpsSettings(
      {
        ...DEFAULT_GPS_SETTINGS,
        notificationMode: 'STAFF_ONLY',
      },
      {
        accelerationDetectionEnabled: null,
        harshAccelerationThresholdMps2: 3.6,
        criticalAccelerationThresholdMps2: null,
        brakingDetectionEnabled: null,
        harshBrakingThresholdMps2: null,
        criticalBrakingThresholdMps2: null,
        confirmationWindowMs: null,
        mergeWindowMs: null,
        maximumGapMs: null,
        clientWarningEventCount: null,
        clientWarningWindowMinutes: null,
        clientWarningCooldownMinutes: null,
        notificationMode: 'RECORD_ONLY',
      },
    );

    expect(resolved.harshAccelerationThresholdMps2).toBe(3.6);
    expect(resolved.criticalAccelerationThresholdMps2).toBe(4);
    expect(resolved.notificationMode).toBe('RECORD_ONLY');
    expect(resolved.accelerationDetectionEnabled).toBe(true);
  });

  it('разрешает отключить детектор только явным override автомобиля', () => {
    expect(
      resolveGpsSettings(DEFAULT_GPS_SETTINGS, {
        accelerationDetectionEnabled: false,
        harshAccelerationThresholdMps2: null,
        criticalAccelerationThresholdMps2: null,
        brakingDetectionEnabled: null,
        harshBrakingThresholdMps2: null,
        criticalBrakingThresholdMps2: null,
        confirmationWindowMs: null,
        mergeWindowMs: null,
        maximumGapMs: null,
        clientWarningEventCount: null,
        clientWarningWindowMinutes: null,
        clientWarningCooldownMinutes: null,
        notificationMode: null,
      }).accelerationDetectionEnabled,
    ).toBe(false);
  });

  it('разрешает отдельно настроить торможение для автомобиля', () => {
    const resolved = resolveGpsSettings(
      {
        ...DEFAULT_GPS_SETTINGS,
        harshBrakingThresholdMps2: 3.2,
      },
      {
        ...Object.fromEntries(Object.keys(DEFAULT_GPS_SETTINGS).map((key) => [key, null])),
        brakingDetectionEnabled: false,
        harshBrakingThresholdMps2: 3.8,
      } as Parameters<typeof resolveGpsSettings>[1],
    );

    expect(resolved.brakingDetectionEnabled).toBe(false);
    expect(resolved.harshBrakingThresholdMps2).toBe(3.8);
    expect(resolved.criticalBrakingThresholdMps2).toBe(4);
  });
});

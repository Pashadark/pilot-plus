export type GpsNotificationMode = 'RECORD_ONLY' | 'STAFF_ONLY' | 'STAFF_AND_CLIENT';

export type ResolvedGpsSettings = {
  accelerationDetectionEnabled: boolean;
  harshAccelerationThresholdMps2: number;
  criticalAccelerationThresholdMps2: number;
  brakingDetectionEnabled: boolean;
  harshBrakingThresholdMps2: number;
  criticalBrakingThresholdMps2: number;
  confirmationWindowMs: number;
  mergeWindowMs: number;
  maximumGapMs: number;
  clientWarningEventCount: number;
  clientWarningWindowMinutes: number;
  clientWarningCooldownMinutes: number;
  notificationMode: GpsNotificationMode;
};

export type CompanyGpsSettingsShape = ResolvedGpsSettings;

export type VehicleGpsSettingsOverrideShape = {
  [Key in keyof ResolvedGpsSettings]: ResolvedGpsSettings[Key] | null;
};

export const DEFAULT_GPS_SETTINGS: Readonly<ResolvedGpsSettings> = {
  accelerationDetectionEnabled: true,
  harshAccelerationThresholdMps2: 3,
  criticalAccelerationThresholdMps2: 4,
  brakingDetectionEnabled: true,
  harshBrakingThresholdMps2: 3,
  criticalBrakingThresholdMps2: 4,
  confirmationWindowMs: 3_000,
  mergeWindowMs: 3_000,
  maximumGapMs: 10_000,
  clientWarningEventCount: 3,
  clientWarningWindowMinutes: 30,
  clientWarningCooldownMinutes: 30,
  notificationMode: 'RECORD_ONLY',
};

export function resolveGpsSettings(
  company: CompanyGpsSettingsShape | null,
  vehicle: VehicleGpsSettingsOverrideShape | null,
): ResolvedGpsSettings {
  const companySettings: ResolvedGpsSettings = {
    ...DEFAULT_GPS_SETTINGS,
    ...(company ?? {}),
  };

  if (!vehicle) {
    return companySettings;
  }

  return Object.fromEntries(
    Object.entries(companySettings).map(([key, companyValue]) => {
      const overrideValue = vehicle[key as keyof VehicleGpsSettingsOverrideShape];
      return [key, overrideValue ?? companyValue];
    }),
  ) as ResolvedGpsSettings;
}

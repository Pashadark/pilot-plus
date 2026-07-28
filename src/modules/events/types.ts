export type TimelineCategory =
  | 'MOVEMENT'
  | 'TRIP'
  | 'STOP'
  | 'ALERT'
  | 'FUEL'
  | 'MAINTENANCE'
  | 'WASH'
  | 'DEVICE'
  | 'FIRMWARE'
  | 'MANUAL';

export type TimelineSeverity = 'INFO' | 'WARNING' | 'DANGER';

export interface TimelineEventDto {
  key: string;
  category: TimelineCategory;
  severity: TimelineSeverity;
  title: string;
  description: string | null;
  recordedAt: string;
  isRead: boolean;
  isManual: boolean;
  vehicle: {
    id: string;
    internalNumber: string;
    model: string;
    imagePath: string | null;
  };
  location: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  telemetry: {
    speedKph: number | null;
    heading: number | null;
    odometerKm: number | null;
    fuelLevelPercent: number | null;
    fuelVolumeLiters: number | null;
  };
  source: { type: string; id: string; href: string | null };
}

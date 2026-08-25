import { describe, expect, it } from 'vitest';
import { buildEventNotifications } from './build-notifications';

describe('buildEventNotifications', () => {
  it('maps real timeline events and deduplicates their stable keys', () => {
    const event = {
      key: 'vehicle-event:1', category: 'ALERT' as const, severity: 'DANGER' as const,
      title: 'Превышение скорости', description: 'Kia Rio · Р604АО997',
      recordedAt: '2026-08-26T01:30:00.000Z', isRead: false, isManual: false,
      vehicle: { id: 'v1', internalNumber: '10', model: 'Kia Rio', imagePath: null },
      location: null, coordinates: null,
      telemetry: { speedKph: 90, heading: null, odometerKm: null, fuelLevelPercent: null, fuelVolumeLiters: null },
      source: { type: 'vehicle-event', id: '1', href: '/vehicles/v1' },
    };
    const result = buildEventNotifications([event, event]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'vehicle-event:1', tone: 'danger', href: '/vehicles/v1', isRead: false });
  });
});

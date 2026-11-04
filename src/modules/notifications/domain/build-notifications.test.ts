import { describe, expect, it } from 'vitest';
import { buildEventNotifications } from './build-notifications';
import type { TimelineEventDto } from '@/modules/events/types';

describe('buildEventNotifications', () => {
  it('omits routine motion, stops and trips but preserves safety warnings', () => {
    const base: TimelineEventDto = {
      key: 'position:1',
      category: 'MOVEMENT',
      severity: 'INFO',
      title: 'Автомобиль в движении',
      description: null,
      recordedAt: '2026-10-08T04:57:00Z',
      isRead: false,
      isManual: false,
      vehicle: { id: 'v1', internalNumber: '1', model: 'Kia Rio', imagePath: null },
      location: null,
      coordinates: null,
      telemetry: {
        speedKph: 30,
        heading: null,
        odometerKm: null,
        fuelLevelPercent: null,
        fuelVolumeLiters: null,
      },
      source: { type: 'vehicle-position', id: '1', href: '/vehicles/v1' },
    };
    const events = [
      base,
      { ...base, key: 'stop:1', category: 'STOP' as const },
      { ...base, key: 'trip:1', category: 'TRIP' as const },
      { ...base, key: 'alert:1', category: 'ALERT' as const, severity: 'DANGER' as const },
      { ...base, key: 'movement-warning:1', severity: 'WARNING' as const },
    ];
    expect(buildEventNotifications(events).map((n) => n.id)).toEqual([
      'alert:1',
      'movement-warning:1',
    ]);
    expect(events).toHaveLength(5);
  });
  it('maps real timeline events and deduplicates their stable keys', () => {
    const event = {
      key: 'vehicle-event:1',
      category: 'ALERT' as const,
      severity: 'DANGER' as const,
      title: 'Превышение скорости',
      description: 'Kia Rio · Р604АО997',
      recordedAt: '2026-08-26T01:30:00.000Z',
      isRead: false,
      isManual: false,
      vehicle: { id: 'v1', internalNumber: '10', model: 'Kia Rio', imagePath: null },
      location: null,
      coordinates: null,
      telemetry: {
        speedKph: 90,
        heading: null,
        odometerKm: null,
        fuelLevelPercent: null,
        fuelVolumeLiters: null,
      },
      source: { type: 'vehicle-event', id: '1', href: '/vehicles/v1' },
    };
    const result = buildEventNotifications([event, event]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'vehicle-event:1',
      category: 'SYSTEM',
      tone: 'danger',
      href: '/vehicles/v1',
      isRead: false,
      occurredAt: '2026-08-26T01:30:00.000Z',
    });
  });
});

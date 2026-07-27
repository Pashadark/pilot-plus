import { describe, expect, it } from 'vitest';

import { DEVICE_STATUS_META, getDeviceStatusMeta, getEffectiveDeviceStatus } from './status';

describe('getEffectiveDeviceStatus', () => {
  it('считает онлайн-устройство офлайн после 15 минут без связи', () => {
    expect(
      getEffectiveDeviceStatus(
        { status: 'ONLINE', vehicleId: 'v1', lastSeenAt: new Date('2026-07-27T09:00:00Z') },
        new Date('2026-07-27T09:16:00Z'),
      ),
    ).toBe('OFFLINE');
  });

  it('оставляет онлайн-устройство онлайн ровно через 15 минут', () => {
    expect(
      getEffectiveDeviceStatus(
        { status: 'ONLINE', vehicleId: 'v1', lastSeenAt: new Date('2026-07-27T09:00:00Z') },
        new Date('2026-07-27T09:15:00Z'),
      ),
    ).toBe('ONLINE');
  });

  it('считает онлайн-устройство без времени связи офлайн', () => {
    expect(getEffectiveDeviceStatus({ status: 'ONLINE', vehicleId: 'v1', lastSeenAt: null })).toBe(
      'OFFLINE',
    );
  });

  it('оставляет свободное устройство непривязанным независимо от lastSeenAt', () => {
    expect(
      getEffectiveDeviceStatus(
        { status: 'ONLINE', vehicleId: null, lastSeenAt: new Date('2026-07-27T09:00:00Z') },
        new Date('2026-07-27T09:01:00Z'),
      ),
    ).toBe('UNASSIGNED');
  });
});

describe('статус устройства', () => {
  it('сопоставляет каждый статус с утверждённой русской подписью', () => {
    expect(
      Object.fromEntries(
        Object.entries(DEVICE_STATUS_META).map(([key, meta]) => [key, meta.label]),
      ),
    ).toEqual({
      ONLINE: 'Онлайн',
      OFFLINE: 'Офлайн',
      WARNING: 'Требует внимания',
      UNASSIGNED: 'Не привязано',
      DISABLED: 'Отключено',
    });
  });

  it('возвращает метаданные для статуса', () => {
    expect(getDeviceStatusMeta('WARNING')).toMatchObject({
      label: 'Требует внимания',
      tone: 'warning',
    });
  });
});

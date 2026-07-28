import { describe, expect, it } from 'vitest';

import {
  normalizeDeviceCommand,
  normalizeFuelRecord,
  normalizeMaintenanceRecord,
  normalizeManualVehicleEvent,
  normalizeTrip,
  normalizeVehicleEvent,
  normalizeVehiclePosition,
  normalizeWashRecord,
} from './normalizers';
import type { TimelineEventDto } from './types';

const vehicle = {
  id: 'vehicle-1',
  internalNumber: 'A-101',
  model: 'Hyundai Solaris',
  imagePath: '/vehicles/solar.webp',
};

const recordedAt = '2026-07-27T12:00:00.000Z';

function expectEvent(
  event: TimelineEventDto,
  expected: Pick<TimelineEventDto, 'key' | 'category' | 'severity' | 'title' | 'recordedAt'> & {
    href: string | null;
  },
) {
  const { href, ...eventFields } = expected;

  expect(event).toMatchObject({
    ...eventFields,
    source: { href },
  });
}

describe('нормализация источников истории', () => {
  it('нормализует последнюю движущуюся позицию', () => {
    const event = normalizeVehiclePosition({
      id: 'position-1',
      vehicle,
      recordedAt,
      isMoving: true,
      latitude: '55.755826',
      longitude: '37.6173',
      speedKph: '48',
      heading: '180',
      odometerKm: '12450.5',
      fuelLevelPercent: '64.25',
    });

    expectEvent(event, {
      key: 'vehicle-position:position-1',
      category: 'MOVEMENT',
      severity: 'INFO',
      title: 'Автомобиль в движении',
      recordedAt,
      href: '/vehicles/vehicle-1',
    });
    expect(event.coordinates).toEqual({ latitude: 55.755826, longitude: 37.6173 });
    expect(event.telemetry).toMatchObject({
      speedKph: 48,
      heading: 180,
      odometerKm: 12450.5,
      fuelLevelPercent: 64.25,
    });
  });

  it('нормализует завершённую поездку', () => {
    const event = normalizeTrip({
      id: 'trip-1',
      vehicle,
      startedAt: '2026-07-27T10:00:00.000Z',
      endedAt: recordedAt,
      distanceKm: '12.5',
      averageSpeedKph: 32,
    });

    expectEvent(event, {
      key: 'trip:trip-1',
      category: 'TRIP',
      severity: 'INFO',
      title: 'Поездка завершена',
      recordedAt,
      href: '/vehicles/vehicle-1?tab=trips',
    });
    expect(event.telemetry).toMatchObject({ odometerKm: 12.5, speedKph: 32 });
  });

  it('нормализует активную поездку как движение', () => {
    const event = normalizeTrip({
      id: 'trip-2',
      vehicle,
      startedAt: recordedAt,
      endedAt: null,
      distanceKm: '3.2',
      averageSpeedKph: null,
    });

    expectEvent(event, {
      key: 'trip:trip-2',
      category: 'MOVEMENT',
      severity: 'INFO',
      title: 'Автомобиль в движении',
      recordedAt,
      href: '/vehicles/vehicle-1?tab=trips',
    });
    expect(event.telemetry.odometerKm).toBe(3.2);
  });

  it('сохраняет опасность телематического события', () => {
    const event = normalizeVehicleEvent({
      id: 'event-1',
      vehicle,
      title: 'Аварийный сигнал',
      description: 'Сработал датчик удара',
      location: 'Москва',
      severity: 'DANGER',
      recordedAt,
    });

    expectEvent(event, {
      key: 'vehicle-event:event-1',
      category: 'ALERT',
      severity: 'DANGER',
      title: 'Аварийный сигнал',
      recordedAt,
      href: '/vehicles/vehicle-1?tab=events',
    });
    expect(event.description).toBe('Сработал датчик удара');
  });

  it('нормализует заправку', () => {
    const event = normalizeFuelRecord({
      id: 'fuel-1',
      vehicle,
      type: 'REFILL',
      volumeLiters: '42.5',
      levelPercent: '84',
      recordedAt,
    });

    expectEvent(event, {
      key: 'fuel-record:fuel-1',
      category: 'FUEL',
      severity: 'INFO',
      title: 'Заправка автомобиля',
      recordedAt,
      href: '/vehicles/vehicle-1?tab=fuel',
    });
    expect(event.telemetry).toMatchObject({ fuelVolumeLiters: 42.5, fuelLevelPercent: 84 });
  });

  it('нормализует слив топлива как опасное событие', () => {
    const event = normalizeFuelRecord({
      id: 'fuel-2',
      vehicle,
      type: 'DRAIN',
      volumeLiters: '8.75',
      levelPercent: null,
      recordedAt,
    });

    expectEvent(event, {
      key: 'fuel-record:fuel-2',
      category: 'FUEL',
      severity: 'DANGER',
      title: 'Слив топлива',
      recordedAt,
      href: '/vehicles/vehicle-1?tab=fuel',
    });
    expect(event.telemetry.fuelVolumeLiters).toBe(8.75);
  });

  it('нормализует просроченное ТО', () => {
    const event = normalizeMaintenanceRecord({
      id: 'maintenance-1',
      vehicle,
      title: 'Замена масла',
      status: 'OVERDUE',
      scheduledAt: recordedAt,
      completedAt: null,
      odometerKm: '12500.1',
    });

    expectEvent(event, {
      key: 'maintenance-record:maintenance-1',
      category: 'MAINTENANCE',
      severity: 'WARNING',
      title: 'Просроченное техническое обслуживание',
      recordedAt,
      href: '/maintenance',
    });
    expect(event.telemetry.odometerKm).toBe(12500.1);
  });

  it('нормализует завершённую мойку', () => {
    const event = normalizeWashRecord({
      id: 'wash-1',
      vehicle,
      status: 'COMPLETED',
      scheduledAt: '2026-07-27T09:00:00.000Z',
      completedAt: recordedAt,
    });

    expectEvent(event, {
      key: 'wash-record:wash-1',
      category: 'WASH',
      severity: 'INFO',
      title: 'Мойка завершена',
      recordedAt,
      href: '/wash',
    });
    expect(event.telemetry.fuelVolumeLiters).toBeNull();
  });

  it('нормализует неудачную команду устройства', () => {
    const event = normalizeDeviceCommand({
      id: 'command-1',
      vehicle,
      deviceId: 'device-1',
      type: 'REBOOT',
      status: 'FAILED',
      createdAt: recordedAt,
      sentAt: null,
      completedAt: null,
    });

    expectEvent(event, {
      key: 'device-command:command-1',
      category: 'DEVICE',
      severity: 'WARNING',
      title: 'Команда устройства не выполнена',
      recordedAt,
      href: '/devices/device-1',
    });
    expect(event.telemetry.speedKph).toBeNull();
  });

  it('нормализует завершённое обновление прошивки', () => {
    const event = normalizeDeviceCommand({
      id: 'command-2',
      vehicle,
      deviceId: 'device-1',
      type: 'UPDATE_FIRMWARE',
      status: 'COMPLETED',
      createdAt: '2026-07-27T10:00:00.000Z',
      sentAt: '2026-07-27T11:00:00.000Z',
      completedAt: recordedAt,
    });

    expectEvent(event, {
      key: 'device-command:command-2',
      category: 'FIRMWARE',
      severity: 'INFO',
      title: 'Обновление прошивки завершено',
      recordedAt,
      href: '/devices/device-1',
    });
    expect(event.telemetry.heading).toBeNull();
  });

  it('нормализует ручное происшествие', () => {
    const event = normalizeManualVehicleEvent({
      id: 'manual-1',
      vehicle,
      kind: 'INCIDENT',
      severity: 'DANGER',
      title: 'ДТП на парковке',
      description: 'Повреждён бампер',
      location: 'Москва, Тверская улица',
      latitude: '55.76',
      longitude: '37.61',
      recordedAt,
    });

    expectEvent(event, {
      key: 'manual-vehicle-event:manual-1',
      category: 'MANUAL',
      severity: 'DANGER',
      title: 'ДТП на парковке',
      recordedAt,
      href: '/vehicles/vehicle-1?tab=history',
    });
    expect(event.coordinates).toEqual({ latitude: 55.76, longitude: 37.61 });
  });
});

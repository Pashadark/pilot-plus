import { expect, it, vi } from 'vitest';

import { listOnlineMapVehicles } from './queries';

it('возвращает только активные реальные машины доступных компаний с последней позицией', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'vehicle-1',
      model: 'Kia K5',
      registrationNumber: 'В342НР797',
      positions: [
        {
          latitude: '55.751244',
          longitude: '37.618423',
          speedKph: 42,
          fuelLevelPercent: '68.5',
          recordedAt: new Date('2026-08-20T12:00:00.000Z'),
        },
      ],
    },
  ]);

  const result = await listOnlineMapVehicles(
    { id: 'user-1', role: 'ADMIN' } as never,
    { vehicle: { findMany } } as never,
    new Date('2026-08-20T12:02:00.000Z'),
  );

  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        archivedAt: null,
        isDemoImport: false,
        company: { memberships: { some: { userId: 'user-1' } } },
      },
    }),
  );
  expect(findMany.mock.calls[0]?.[0].select.positions).toEqual(
    expect.objectContaining({
      where: { provider: 'GLONASSSOFT' },
      select: expect.objectContaining({ address: true }),
    }),
  );
  expect(result).toEqual([
    expect.objectContaining({
      id: 'vehicle-1',
      name: 'Kia K5',
      plate: 'В342НР797',
      gpsStatus: {
        key: 'MOVING',
        label: 'В движении',
        tone: 'primary',
        isConnected: true,
      },
      latitude: 55.751244,
      longitude: 37.618423,
      speedKph: 42,
      fuelPercent: 68.5,
      lastSeenLabel: '2 минуты назад',
    }),
  ]);
});

it('super-admin видит все компании, а устаревшая позиция получает общий красный GPS-статус', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'vehicle-2',
      model: 'Toyota Camry',
      registrationNumber: 'Н726АХ550',
      positions: [
        {
          latitude: 55.7,
          longitude: 37.6,
          speedKph: 0,
          fuelLevelPercent: null,
          recordedAt: new Date('2026-08-20T10:00:00.000Z'),
        },
      ],
    },
  ]);

  const result = await listOnlineMapVehicles(
    { id: 'root', role: 'SUPER_ADMIN' } as never,
    { vehicle: { findMany } } as never,
    new Date('2026-08-20T12:00:00.000Z'),
  );

  expect(findMany.mock.calls[0]?.[0].where.company).toBeUndefined();
  expect(result[0]).toEqual(
    expect.objectContaining({
      gpsStatus: {
        key: 'STALE',
        label: 'Давно не обновлялся',
        tone: 'danger',
        isConnected: false,
      },
      fuelPercent: null,
      lastSeenLabel: '2 часа назад',
    }),
  );
});

it('оставляет реальную машину без координат в списке с общим красным GPS-статусом', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'vehicle-3',
      model: 'Volkswagen Polo',
      registrationNumber: 'А156АХ997',
      positions: [],
      rentals: [
        {
          id: 'rental-1',
          contractNumber: 'ME-2026-0003-BK',
          client: {
            lastName: 'Горбунов',
            firstName: 'Глеб',
            middleName: 'Геннадьевич',
          },
        },
      ],
    },
  ]);

  const result = await listOnlineMapVehicles(
    { id: 'root', role: 'SUPER_ADMIN' } as never,
    { vehicle: { findMany } } as never,
    new Date('2026-08-20T12:00:00.000Z'),
  );

  expect(result[0]).toEqual(
    expect.objectContaining({
      gpsStatus: {
        key: 'NO_DATA',
        label: 'Нет связи',
        tone: 'danger',
        isConnected: false,
      },
      latitude: null,
      longitude: null,
      currentRental: {
        id: 'rental-1',
        contractNumber: 'ME-2026-0003-BK',
        clientName: 'Горбунов Глеб Геннадьевич',
      },
    }),
  );
  expect(findMany.mock.calls[0]?.[0].select.rentals.select.client.select).toEqual({
    lastName: true,
    firstName: true,
    middleName: true,
  });
});

it('не превращает частичную позицию GLONASSSOFT в фиктивные координаты нуля', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'vehicle-4',
      model: 'Skoda Octavia',
      registrationNumber: 'О321ОО77',
      positions: [
        {
          latitude: null,
          longitude: '37.618423',
          speedKph: 0,
          fuelLevelPercent: '40',
          address: 'Москва, Зелёный проспект, 22',
          recordedAt: new Date('2026-08-20T11:59:00.000Z'),
        },
      ],
    },
  ]);

  const result = await listOnlineMapVehicles(
    { id: 'root', role: 'SUPER_ADMIN' } as never,
    { vehicle: { findMany } } as never,
    new Date('2026-08-20T12:00:00.000Z'),
  );

  expect(result).toEqual([
    expect.objectContaining({
      latitude: null,
      longitude: null,
      gpsStatus: {
        key: 'NO_DATA',
        label: 'Нет связи',
        tone: 'danger',
        isConnected: false,
      },
      lastSeenLabel: '1 минуту назад',
    }),
  ]);
});

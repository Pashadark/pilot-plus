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
  expect(result).toEqual([
    expect.objectContaining({
      id: 'vehicle-1',
      name: 'Kia K5',
      plate: 'В342НР797',
      status: 'moving',
      latitude: 55.751244,
      longitude: 37.618423,
      speedKph: 42,
      fuelPercent: 68.5,
      lastSeenLabel: '2 минуты назад',
    }),
  ]);
});

it('super-admin видит все компании, а устаревшая позиция помечается без связи', async () => {
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
      status: 'offline',
      fuelPercent: null,
      lastSeenLabel: '2 часа назад',
    }),
  );
});

it('оставляет реальную машину без координат в списке и показывает текущий договор', async () => {
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
          client: { fullName: 'Горбунов Глеб Геннадьевич' },
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
      status: 'no-data',
      latitude: null,
      longitude: null,
      currentRental: {
        id: 'rental-1',
        contractNumber: 'ME-2026-0003-BK',
        clientName: 'Горбунов Глеб Геннадьевич',
      },
    }),
  );
});

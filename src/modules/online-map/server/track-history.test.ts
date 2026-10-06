import { describe, expect, it, vi } from 'vitest';

import { getOnlineMapTrackHistory } from './track-history';

const admin = { id: 'admin-1', role: 'ADMIN' } as never;

function repositoryWith(row: unknown) {
  return {
    vehicle: { findFirst: vi.fn().mockResolvedValue(row) },
  };
}

describe('getOnlineMapTrackHistory', () => {
  it('возвращает сохранённый маршрут и штраф с точными координатами', async () => {
    const repository = repositoryWith({
      id: 'vehicle-1',
      positions: [
        {
          id: 'position-2',
          latitude: '55.760000',
          longitude: '37.630000',
          speedKph: 74,
          address: 'Москва, Тверская улица',
          recordedAt: new Date('2026-09-15T07:10:00.000Z'),
        },
        {
          id: 'position-1',
          latitude: '55.750000',
          longitude: '37.620000',
          speedKph: 10,
          address: null,
          recordedAt: new Date('2026-09-15T07:00:00.000Z'),
        },
      ],
      fines: [
        {
          id: 'fine-1',
          decreeNumber: '18810177260000000001',
          offenseAt: new Date('2026-09-15T07:05:00.000Z'),
          latitude: '55.755000',
          longitude: '37.625000',
          currentAmountMinor: BigInt(500_000),
          status: 'NEW',
          description: 'Превышение скорости',
          address: 'Москва',
          rental: { id: 'rental-1', contractNumber: 'ME-2026-0044-AA' },
          client: { id: 'client-1', lastName: 'Иванов', firstName: 'Иван', middleName: null },
        },
      ],
    });

    const result = await getOnlineMapTrackHistory(
      admin,
      { vehicleId: 'vehicle-1', from: '2026-09-15', to: '2026-09-15' },
      repository as never,
    );

    expect(repository.vehicle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'vehicle-1',
          company: { members: { some: { userId: 'admin-1' } } },
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        vehicleId: 'vehicle-1',
        availableDates: ['2026-09-15'],
        tracks: [
          expect.objectContaining({
            date: '2026-09-15',
            points: [
              expect.objectContaining({ id: 'position-1', coordinates: [37.62, 55.75] }),
              expect.objectContaining({ id: 'position-2', coordinates: [37.63, 55.76] }),
            ],
          }),
        ],
        fines: [
          expect.objectContaining({
            id: 'fine-1',
            coordinates: [37.625, 55.755],
            locationSource: 'exact',
            amountMinor: 500_000,
            clientName: 'Иванов Иван',
          }),
        ],
      }),
    );
  });

  it('привязывает штраф без координат к ближайшей точке не дальше 30 минут', async () => {
    const repository = repositoryWith({
      id: 'vehicle-1',
      positions: [
        {
          id: 'position-1',
          latitude: 55.75,
          longitude: 37.62,
          speedKph: 20,
          address: 'Москва',
          recordedAt: new Date('2026-09-15T07:00:00.000Z'),
        },
        {
          id: 'position-2',
          latitude: 55.76,
          longitude: 37.63,
          speedKph: 40,
          address: 'Москва',
          recordedAt: new Date('2026-09-15T07:10:00.000Z'),
        },
      ],
      fines: [
        {
          id: 'fine-near',
          decreeNumber: 'near',
          offenseAt: new Date('2026-09-15T07:08:00.000Z'),
          latitude: null,
          longitude: null,
          currentAmountMinor: BigInt(100_000),
          status: 'NEW',
          description: null,
          address: null,
          rental: null,
          client: null,
        },
        {
          id: 'fine-far',
          decreeNumber: 'far',
          offenseAt: new Date('2026-09-15T10:00:00.000Z'),
          latitude: null,
          longitude: null,
          currentAmountMinor: BigInt(100_000),
          status: 'NEW',
          description: null,
          address: null,
          rental: null,
          client: null,
        },
      ],
    });

    const result = await getOnlineMapTrackHistory(
      admin,
      { vehicleId: 'vehicle-1', from: '2026-09-15', to: '2026-09-15' },
      repository as never,
    );

    expect(result.fines[0]).toEqual(
      expect.objectContaining({
        id: 'fine-near',
        coordinates: [37.63, 55.76],
        pointId: 'position-2',
        locationSource: 'time-inferred',
      }),
    );
    expect(result.fines[1]).toEqual(
      expect.objectContaining({ id: 'fine-far', coordinates: null, locationSource: 'unmapped' }),
    );
  });

  it('не объявляет день доступным, если валидная точка только одна', async () => {
    const repository = repositoryWith({
      id: 'vehicle-1',
      positions: [
        {
          id: 'position-1',
          latitude: 55.75,
          longitude: 37.62,
          speedKph: null,
          address: null,
          recordedAt: new Date('2026-09-15T07:00:00.000Z'),
        },
        {
          id: 'invalid-position',
          latitude: 200,
          longitude: 37.62,
          speedKph: 0,
          address: null,
          recordedAt: new Date('2026-09-15T07:05:00.000Z'),
        },
      ],
      fines: [],
    });

    const result = await getOnlineMapTrackHistory(
      admin,
      { vehicleId: 'vehicle-1', from: '2026-09-15', to: '2026-09-15' },
      repository as never,
    );

    expect(result.availableDates).toEqual([]);
    expect(result.tracks).toEqual([]);
  });

  it('отклоняет недоступную машину и период длиннее семи дней', async () => {
    const repository = repositoryWith(null);

    await expect(
      getOnlineMapTrackHistory(
        admin,
        { vehicleId: 'vehicle-foreign', from: '2026-09-15', to: '2026-09-15' },
        repository as never,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      getOnlineMapTrackHistory(
        admin,
        { vehicleId: 'vehicle-1', from: '2026-09-08', to: '2026-09-15' },
        repository as never,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RANGE' });
  });
});

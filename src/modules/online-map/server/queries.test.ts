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
          heading: 127,
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
        company: { members: { some: { userId: 'user-1' } } },
      },
    }),
  );
  expect(findMany.mock.calls[0]?.[0].select.positions).toEqual(
    expect.objectContaining({
      where: { provider: 'GLONASSSOFT' },
      select: expect.objectContaining({ address: true, heading: true }),
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
        tone: 'success',
        isConnected: true,
      },
      latitude: 55.751244,
      longitude: 37.618423,
      speedKph: 42,
      heading: 127,
      fuelPercent: 68.5,
      recordedAt: '2026-08-20T12:00:00.000Z',
      lastSeenLabel: '2 минуты назад',
    }),
  ]);
});

it('возвращает фото, пробег, план ТО и подтверждённые условия активной аренды для боковых панелей', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'vehicle-rich',
      model: 'BMW 520d xDrive',
      registrationNumber: 'У891АВ797',
      odometerKm: { toString: () => '1250.5' },
      includedMileageKm: 400,
      images: [
        {
          localPath: '/vehicles/vehicle-rich/images/image-main',
          alt: 'BMW 520d xDrive, вид спереди',
        },
      ],
      positions: [
        {
          latitude: '55.751244',
          longitude: '37.618423',
          speedKph: 0,
          heading: 127,
          odometerKm: { toString: () => '1262.5' },
          fuelLevelPercent: '15',
          address: 'Северо-восточная хорда, Москва',
          recordedAt: new Date('2026-08-20T12:00:00.000Z'),
        },
      ],
      trips: [
        { distanceKm: { toString: () => '32.5' } },
        { distanceKm: { toString: () => '17.8' } },
      ],
      maintenanceRecords: [
        {
          odometerKm: { toString: () => '1000' },
          targetOdometerKm: { toString: () => '2000' },
          status: 'PLANNED',
        },
      ],
      rentals: [
        {
          id: 'rental-rich',
          contractNumber: 'ME-2026-1102-KU',
          endsAt: new Date('2026-08-25T15:00:00.000Z'),
          dailyRateMinor: BigInt(360_000),
          currency: 'RUB',
          depositMinor: BigInt(1_500_000),
          includedMileageKm: 400,
          client: {
            id: 'client-rich',
            lastName: 'Кульпинёв',
            firstName: 'Александр',
            middleName: 'Витальевич',
          },
          payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: BigInt(1_500_000) }],
          operations: [],
        },
      ],
    },
  ]);

  const result = await listOnlineMapVehicles(
    { id: 'root', role: 'SUPER_ADMIN' } as never,
    { vehicle: { findMany } } as never,
    new Date('2026-08-20T12:02:00.000Z'),
  );

  expect(result[0]).toEqual(
    expect.objectContaining({
      image: {
        src: '/vehicles/vehicle-rich/images/image-main',
        alt: 'BMW 520d xDrive, вид спереди',
      },
      odometerKm: 1262.5,
      dailyDistanceKm: 50.3,
      maintenance: {
        startOdometerKm: 1000,
        targetOdometerKm: 2000,
        remainingKm: 737.5,
        status: 'PLANNED',
      },
      currentRental: expect.objectContaining({
        id: 'rental-rich',
        clientId: 'client-rich',
        endsAt: '2026-08-25T15:00:00.000Z',
        dailyRateMinor: 360_000,
        currency: 'RUB',
        includedMileageKm: 400,
        canAccessDetails: true,
        depositState: 'COLLECTED',
      }),
    }),
  );
  expect(findMany.mock.calls[0]?.[0].select.images).toEqual(
    expect.objectContaining({
      orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
      take: 1,
    }),
  );
  expect(findMany.mock.calls[0]?.[0].select.trips.where.startedAt.gte).toEqual(
    new Date('2026-08-19T21:00:00.000Z'),
  );
});

it('не отдаёт финансовые поля аренды участнику без доступа к договорам', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'vehicle-viewer',
      model: 'Kia K5',
      registrationNumber: 'М022АН997',
      company: { members: [{ role: 'VIEWER' }] },
      positions: [],
      rentals: [
        {
          id: 'rental-secret',
          contractNumber: 'ME-SECRET',
          endsAt: new Date('2026-08-25T15:00:00.000Z'),
          dailyRateMinor: BigInt(500_000),
          currency: 'RUB',
          depositMinor: BigInt(2_000_000),
          includedMileageKm: 300,
          client: {
            id: 'client-secret',
            lastName: 'Иванов',
            firstName: 'Иван',
            middleName: null,
          },
          payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: BigInt(2_000_000) }],
          operations: [],
        },
      ],
    },
  ]);

  const [vehicle] = await listOnlineMapVehicles(
    { id: 'viewer', role: 'ADMIN' } as never,
    { vehicle: { findMany } } as never,
    new Date('2026-08-20T12:02:00.000Z'),
  );

  expect(vehicle.currentRental).toEqual({
    id: 'rental-secret',
    contractNumber: 'ME-SECRET',
    clientName: 'Иванов Иван',
    canAccessDetails: false,
  });
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

it('оставляет реальную машину без координат в списке с нейтральным GPS-статусом', async () => {
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
        tone: 'muted',
        isConnected: false,
      },
      latitude: null,
      longitude: null,
      currentRental: expect.objectContaining({
        id: 'rental-1',
        contractNumber: 'ME-2026-0003-BK',
        clientName: 'Горбунов Глеб Геннадьевич',
      }),
    }),
  );
  expect(findMany.mock.calls[0]?.[0].select.rentals.select.client.select).toEqual({
    id: true,
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
        tone: 'muted',
        isConnected: false,
      },
      lastSeenLabel: '1 минуту назад',
    }),
  ]);
});

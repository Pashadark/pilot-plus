import { describe, expect, it } from 'vitest';

import { createVehicleQueries } from './queries';

const rawVehicle = {
  id: 'vehicle-1',
  internalNumber: 'PLT-001',
  model: 'GWM WEY',
  city: 'Красноярск',
  office: null,
  registrationNumber: null,
  vin: null,
  transmission: 'АКПП',
  engineLiters: { toString: () => '1.5' },
  fuelType: 'PETROL',
  seats: 7,
  dailyPriceMinor: 880000,
  currency: 'RUB',
  originalPrice: '8 800 ₽',
  features: ['Все виды страхования'],
  status: 'UNKNOWN',
  createdAt: new Date('2026-07-19T12:00:00.000Z'),
  positions: [],
  trips: [],
  fuelRecords: [],
  events: [],
  maintenanceRecords: [
    {
      id: 'maintenance-1',
      title: 'Замена масла',
      kind: 'OIL',
      status: 'COMPLETED',
      scheduledAt: new Date('2026-07-20T10:00:00.000Z'),
      completedAt: new Date('2026-07-20T12:00:00.000Z'),
      targetOdometerKm: { toString: () => '15000.5' },
      provider: 'Сервис Pilot',
      costMinor: 420000,
    },
  ],
  washRecords: [
    {
      id: 'wash-1',
      kind: 'COMPLEX',
      status: 'IN_PROGRESS',
      scheduledAt: new Date('2026-07-21T10:00:00.000Z'),
      startedAt: new Date('2026-07-21T10:05:00.000Z'),
      completedAt: null,
      provider: 'Мойка Pilot',
      costMinor: 190000,
    },
  ],
  documents: [],
  images: [
    {
      localPath: '/vehicles/krasnoyarsk/fleet-001/primary.webp',
      alt: 'GWM WEY — Красноярск',
    },
  ],
};

function createRepository() {
  const calls: { list?: unknown; detail?: unknown } = {};
  return {
    calls,
    repository: {
      async findMany(args: unknown) {
        calls.list = args;
        return [rawVehicle];
      },
      async findFirst(args: unknown) {
        calls.detail = args;
        return rawVehicle;
      },
    },
  };
}

describe('запросы автопарка', () => {
  it('ограничивает список членством текущего пользователя', async () => {
    const fake = createRepository();
    const queries = createVehicleQueries(fake.repository);

    const vehicles = await queries.listVehiclesForUser('user-1');

    expect(fake.calls.list).toMatchObject({
      where: { company: { members: { some: { userId: 'user-1' } } } },
    });
    expect(vehicles[0]).toMatchObject({
      id: 'vehicle-1',
      model: 'GWM WEY',
      engineLiters: 1.5,
      telemetry: {
        odometerKm: null,
        fuelLevelPercent: null,
        lastSeenAt: null,
        lastTripAt: null,
        hasPosition: false,
      },
      primaryImage: {
        localPath: '/vehicles/krasnoyarsk/fleet-001/primary.webp',
        alt: 'GWM WEY — Красноярск',
      },
    });
    expect(fake.calls.list).toMatchObject({
      select: {
        images: {
          where: { isPrimary: true },
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
    });
    expect(fake.calls.list).not.toMatchObject({
      select: {
        maintenanceRecords: expect.anything(),
        washRecords: expect.anything(),
      },
    });
    expect(vehicles[0]).not.toHaveProperty('companyId');
    expect(vehicles[0]?.primaryImage).not.toHaveProperty('sourceUrl');
  });

  it('ищет подробности только внутри компании пользователя', async () => {
    const fake = createRepository();
    const queries = createVehicleQueries(fake.repository);

    const vehicle = await queries.getVehicleForUser('user-1', 'vehicle-1');

    expect(fake.calls.detail).toMatchObject({
      where: {
        id: 'vehicle-1',
        company: { members: { some: { userId: 'user-1' } } },
      },
    });
    expect(vehicle?.createdAt).toBe('2026-07-19T12:00:00.000Z');
    expect(vehicle?.maintenanceRecords).toEqual([
      {
        id: 'maintenance-1',
        title: 'Замена масла',
        kind: 'OIL',
        status: 'COMPLETED',
        scheduledAt: '2026-07-20T10:00:00.000Z',
        completedAt: '2026-07-20T12:00:00.000Z',
        targetOdometerKm: 15000.5,
        provider: 'Сервис Pilot',
        costMinor: 420000,
      },
    ]);
    expect(vehicle?.washRecords).toEqual([
      {
        id: 'wash-1',
        kind: 'COMPLEX',
        status: 'IN_PROGRESS',
        scheduledAt: '2026-07-21T10:00:00.000Z',
        startedAt: '2026-07-21T10:05:00.000Z',
        completedAt: null,
        provider: 'Мойка Pilot',
        costMinor: 190000,
      },
    ]);
    expect(fake.calls.detail).toMatchObject({
      select: {
        maintenanceRecords: {
          select: {
            kind: true,
            targetOdometerKm: true,
            provider: true,
            costMinor: true,
          },
          take: 50,
        },
        washRecords: {
          select: {
            id: true,
            kind: true,
            status: true,
            scheduledAt: true,
            startedAt: true,
            completedAt: true,
            provider: true,
            costMinor: true,
          },
          orderBy: { scheduledAt: 'desc' },
          take: 50,
        },
      },
    });
  });

  it('возвращает null для недоступного автомобиля', async () => {
    const repository = {
      async findMany() {
        return [];
      },
      async findFirst() {
        return null;
      },
    };
    const queries = createVehicleQueries(repository);

    await expect(queries.getVehicleForUser('user-1', 'foreign')).resolves.toBeNull();
  });

  it('возвращает null вместо главного фото, если запись отсутствует', async () => {
    const repository = {
      async findMany() {
        return [{ ...rawVehicle, images: [] }];
      },
      async findFirst() {
        return null;
      },
    };
    const queries = createVehicleQueries(repository);

    const vehicles = await queries.listVehiclesForUser('user-1');

    expect(vehicles[0]?.primaryImage).toBeNull();
  });

  it('возвращает компактные tenant-scoped опции автомобилей для форм', async () => {
    const fake = createRepository();
    const queries = createVehicleQueries(fake.repository);

    const options = await queries.listVehicleOptionsForUser('user-1');

    expect(fake.calls.list).toMatchObject({
      where: { company: { members: { some: { userId: 'user-1' } } } },
      select: {
        id: true,
        internalNumber: true,
        model: true,
        registrationNumber: true,
        images: {
          where: { isPrimary: true },
          select: { localPath: true, alt: true },
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
    });
    expect(options).toEqual([
      {
        id: 'vehicle-1',
        label: 'PLT-001 · GWM WEY',
        image: {
          localPath: '/vehicles/krasnoyarsk/fleet-001/primary.webp',
          alt: 'GWM WEY — Красноярск',
        },
      },
    ]);
  });
});

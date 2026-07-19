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
  maintenanceRecords: [],
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
});

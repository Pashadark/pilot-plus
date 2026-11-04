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
  manufacturedYear: 2020,
  engineLiters: { toString: () => '1.5' },
  fuelType: 'PETROL',
  seats: 7,
  dailyPriceMinor: 880000,
  currency: 'RUB',
  odometerKm: null,
  originalPrice: '8 800 ₽',
  features: ['Все виды страхования'],
  status: 'IDLE',
  createdAt: new Date('2026-07-19T12:00:00.000Z'),
  rentalOperations: [],
  positions: [
    {
      odometerKm: { toString: () => '12000' },
      fuelLevelPercent: { toString: () => '60' },
      speedKph: 0,
      recordedAt: new Date('2026-08-20T20:00:00.000Z'),
      address: 'г. Москва, Зелёный проспект, д. 22',
    },
  ],
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
  it('передаёт глобальное место популярности в подробную карточку автомобиля', async () => {
    const repository = {
      async findMany() {
        return [
          { id: 'vehicle-2', _count: { rentals: 4 }, rentals: [] },
          { id: 'vehicle-1', _count: { rentals: 3 }, rentals: [] },
        ];
      },
      async findFirst() {
        return { ...rawVehicle, id: 'vehicle-1' };
      },
    };

    const result = await createVehicleQueries(repository).getVehicleForUser('user-1', 'vehicle-1');

    expect(result?.popularityRank).toBe(2);
  });

  it('присваивает три места по подтверждённым заказам с устойчивым разрешением ничьей', async () => {
    const rankedFixtures = [
      {
        ...rawVehicle,
        id: 'vehicle-bronze',
        _count: { rentals: 2 },
        rentals: [{ createdAt: new Date('2026-08-28T10:00:00.000Z') }],
      },
      {
        ...rawVehicle,
        id: 'vehicle-without-orders',
        _count: { rentals: 0 },
        rentals: [],
      },
      {
        ...rawVehicle,
        id: 'vehicle-silver',
        _count: { rentals: 3 },
        rentals: [{ createdAt: new Date('2026-08-29T09:00:00.000Z') }],
      },
      {
        ...rawVehicle,
        id: 'vehicle-gold',
        _count: { rentals: 3 },
        rentals: [{ createdAt: new Date('2026-08-29T12:00:00.000Z') }],
      },
      {
        ...rawVehicle,
        id: 'vehicle-fourth',
        _count: { rentals: 1 },
        rentals: [{ createdAt: new Date('2026-08-30T12:00:00.000Z') }],
      },
    ];
    let listArgs: unknown;
    const queries = createVehicleQueries({
      async findMany(args: unknown) {
        listArgs = args;
        return rankedFixtures;
      },
      async findFirst() {
        return null;
      },
    });

    const vehicles = await queries.listVehiclesForUser('user-1');

    expect(listArgs).toMatchObject({
      where: { archivedAt: null, company: { members: { some: { userId: 'user-1' } } } },
      select: {
        _count: {
          select: {
            rentals: { where: { status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] } } },
          },
        },
        rentals: {
          where: { status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] } },
          select: {
            id: true,
            status: true,
            createdAt: true,
            startsAt: true,
            endsAt: true,
            contractNumber: true,
            client: { select: { firstName: true, middleName: true, lastName: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 100,
        },
      },
    });
    expect(
      Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle.popularityRank])),
    ).toEqual({
      'vehicle-bronze': 3,
      'vehicle-without-orders': null,
      'vehicle-silver': 2,
      'vehicle-gold': 1,
      'vehicle-fourth': null,
    });
  });

  it('ограничивает список членством текущего пользователя', async () => {
    const fake = createRepository();
    const queries = createVehicleQueries(fake.repository);

    const vehicles = await queries.listVehiclesForUser(
      'user-1',
      new Date('2026-08-20T20:05:00.000Z'),
    );

    expect(fake.calls.list).toMatchObject({
      where: { archivedAt: null, company: { members: { some: { userId: 'user-1' } } } },
    });
    expect(vehicles[0]).toMatchObject({
      id: 'vehicle-1',
      model: 'GWM WEY',
      engineLiters: 1.5,
      telemetry: {
        odometerKm: 12000,
        fuelLevelPercent: 60,
        speedKph: 0,
        lastSeenAt: '2026-08-20T20:00:00.000Z',
        lastTripAt: null,
        hasPosition: true,
        address: 'г. Москва, Зелёный проспект, д. 22',
      },
      primaryImage: {
        localPath: '/vehicles/krasnoyarsk/fleet-001/primary.webp',
        alt: 'GWM WEY — Красноярск',
      },
      gpsStatus: {
        key: 'IN_PARK',
        label: 'В парке',
        tone: 'success',
        isConnected: true,
      },
    });
    expect(fake.calls.list).toMatchObject({
      select: {
        positions: {
          where: { provider: 'GLONASSSOFT' },
          select: { speedKph: true },
        },
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

  it('готовит для карточки год, привод и последний расход топлива', async () => {
    const repository = {
      async findMany() {
        return [
          {
            ...rawVehicle,
            features: ['Привод: Передний', 'Расход: 8,4 л/100 км', 'Apple CarPlay'],
            fuelRecords: [
              {
                id: 'fuel-consumption',
                levelPercent: null,
                consumption: { toString: () => '7.2' },
                recordedAt: new Date('2026-09-30T10:00:00.000Z'),
              },
            ],
          },
        ];
      },
      async findFirst() {
        return null;
      },
    };

    const [vehicle] = await createVehicleQueries(repository).listVehiclesForUser('user-1');

    expect(vehicle).toMatchObject({
      manufacturedYear: 2020,
      driveType: 'Передний',
      fuelConsumptionLitersPer100Km: 8.4,
    });
  });

  it('показывает сохранённый при операции пробег, когда GPS не передаёт одометр', async () => {
    const repository = {
      async findMany() {
        return [
          {
            ...rawVehicle,
            odometerKm: { toString: () => '83273' },
            positions: [{ ...rawVehicle.positions[0], odometerKm: null }],
          },
        ];
      },
      async findFirst() {
        return null;
      },
    };

    const [vehicle] = await createVehicleQueries(repository).listVehiclesForUser('user-1');

    expect(vehicle?.telemetry.odometerKm).toBe(83273);
  });

  it('считает ручную правку пробега основной даже при большем старом значении операции', async () => {
    const repository = {
      async findMany() {
        return [
          {
            ...rawVehicle,
            odometerKm: { toString: () => '88652' },
            positions: [{ ...rawVehicle.positions[0], odometerKm: null }],
            rentalOperations: [
              {
                mileageKm: { toString: () => '100250' },
                fuelLevelPercent: null,
                occurredAt: new Date('2026-10-03T09:00:00.000Z'),
              },
            ],
          },
        ];
      },
      async findFirst() {
        return null;
      },
    };

    const [vehicle] = await createVehicleQueries(repository).listVehiclesForUser('user-1');

    expect(vehicle?.telemetry.odometerKm).toBe(88652);
  });

  it('подхватывает пробег и топливо из последнего возврата для старых машин', async () => {
    const repository = {
      async findMany() {
        return [
          {
            ...rawVehicle,
            odometerKm: null,
            positions: [{ ...rawVehicle.positions[0], odometerKm: null, fuelLevelPercent: null }],
            rentalOperations: [
              {
                mileageKm: { toString: () => '85699' },
                fuelLevelPercent: { toString: () => '20' },
                occurredAt: new Date('2026-09-06T09:21:00.000Z'),
              },
            ],
          },
        ];
      },
      async findFirst() {
        return null;
      },
    };

    const [vehicle] = await createVehicleQueries(repository).listVehiclesForUser('user-1');

    expect(vehicle?.telemetry.odometerKm).toBe(85699);
    expect(vehicle?.telemetry.fuelLevelPercent).toBe(20);
  });

  it('показывает ручной процент топлива, если он свежее GPS и возврата', async () => {
    const repository = {
      async findMany() {
        return [
          {
            ...rawVehicle,
            fuelRecords: [
              {
                id: 'fuel-manual',
                levelPercent: { toString: () => '73' },
                volumeLiters: null,
                recordedAt: new Date('2026-09-14T10:00:00.000Z'),
              },
            ],
            rentalOperations: [
              {
                mileageKm: null,
                fuelLevelPercent: { toString: () => '20' },
                occurredAt: new Date('2026-09-13T10:00:00.000Z'),
              },
            ],
          },
        ];
      },
      async findFirst() {
        return null;
      },
    };

    const [vehicle] = await createVehicleQueries(repository).listVehiclesForUser('user-1');

    expect(vehicle?.telemetry.fuelLevelPercent).toBe(73);
  });

  it('не позволяет старой ручной записи перекрыть более свежий GPS', async () => {
    const repository = {
      async findMany() {
        return [
          {
            ...rawVehicle,
            fuelRecords: [
              {
                id: 'fuel-manual',
                levelPercent: { toString: () => '15' },
                volumeLiters: null,
                recordedAt: new Date('2026-08-19T10:00:00.000Z'),
              },
            ],
          },
        ];
      },
      async findFirst() {
        return null;
      },
    };

    const [vehicle] = await createVehicleQueries(repository).listVehiclesForUser('user-1');

    expect(vehicle?.telemetry.fuelLevelPercent).toBe(60);
  });

  it('возвращает текущую активную аренду для карточки автомобиля, включая просроченную', async () => {
    const repository = {
      async findMany() {
        return [
          {
            ...rawVehicle,
            _count: { rentals: 1 },
            rentals: [
              {
                id: 'rental-active',
                status: 'ACTIVE',
                createdAt: new Date('2026-08-20T10:00:00.000Z'),
                startsAt: new Date('2026-08-20T10:00:00.000Z'),
                endsAt: new Date('2026-09-01T10:00:00.000Z'),
                contractNumber: 'ME-2026-0042-AA',
                client: { firstName: 'Иван', middleName: null, lastName: 'Иванов' },
              },
            ],
          },
        ];
      },
      async findFirst() {
        return null;
      },
    };

    const [vehicle] = await createVehicleQueries(repository).listVehiclesForUser(
      'user-1',
      new Date('2026-09-09T10:00:00.000Z'),
    );

    expect(vehicle?.activeRental).toEqual({
      id: 'rental-active',
      contractNumber: 'ME-2026-0042-AA',
      clientName: 'Иванов Иван',
      endsAt: '2026-09-01T10:00:00.000Z',
    });
  });

  it('ищет подробности только внутри компании пользователя', async () => {
    const fake = createRepository();
    const queries = createVehicleQueries(fake.repository);

    const vehicle = await queries.getVehicleForUser('user-1', 'vehicle-1');

    expect(fake.calls.detail).toMatchObject({
      where: {
        id: 'vehicle-1',
        archivedAt: null,
        company: { members: { some: { userId: 'user-1' } } },
      },
    });
    expect(fake.calls.detail).toMatchObject({
      select: {
        positions: {
          where: { provider: 'GLONASSSOFT' },
        },
      },
    });
    expect(vehicle?.createdAt).toBe('2026-07-19T12:00:00.000Z');
    expect(vehicle?.maintenanceRecords).toEqual([
      {
        id: 'maintenance-1',
        title: 'Замена масла',
        recordType: 'MAINTENANCE',
        description: null,
        kind: 'OIL',
        status: 'COMPLETED',
        scheduledAt: '2026-07-20T10:00:00.000Z',
        damageReportedAt: null,
        startedAt: null,
        completedAt: '2026-07-20T12:00:00.000Z',
        targetOdometerKm: 15000.5,
        provider: 'Сервис Pilot',
        costMinor: 420000,
        rental: null,
        client: null,
        workItems: [],
        attachments: [],
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

  it('выдаёт прошедшее PLANNED обслуживание как эффективное OVERDUE одним reference time', async () => {
    const referenceTime = new Date('2026-07-22T12:00:00.000Z');
    const repository = {
      async findMany() {
        return [];
      },
      async findFirst() {
        return {
          ...rawVehicle,
          maintenanceRecords: [
            {
              ...rawVehicle.maintenanceRecords[0],
              id: 'maintenance-overdue',
              status: 'PLANNED',
              scheduledAt: new Date('2026-07-22T11:59:59.000Z'),
            },
            {
              ...rawVehicle.maintenanceRecords[0],
              id: 'maintenance-future',
              status: 'PLANNED',
              scheduledAt: new Date('2026-07-22T12:00:00.000Z'),
            },
          ],
        };
      },
    };
    const queries = createVehicleQueries(repository);

    const vehicle = await queries.getVehicleForUser('user-1', 'vehicle-1', referenceTime);

    expect(vehicle?.maintenanceRecords.map((record) => record.status)).toEqual([
      'OVERDUE',
      'PLANNED',
    ]);
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

  it('показывает выдачу и возврат в истории конкретного автомобиля', async () => {
    const repository = {
      async findMany() {
        return [];
      },
      async findFirst() {
        return {
          ...rawVehicle,
          rentals: [
            {
              id: 'rental-1',
              contractNumber: 'ME-2026-0001-BK',
              status: 'COMPLETED',
              startsAt: new Date('2026-08-01T09:00:00.000Z'),
              endsAt: new Date('2026-08-03T09:00:00.000Z'),
              client: { id: 'client-1', firstName: 'Иван', middleName: null, lastName: 'Иванов' },
              documentVersions: [],
              operations: [
                {
                  id: 'operation-1',
                  type: 'RETURN',
                  occurredAt: new Date('2026-08-03T09:00:00.000Z'),
                  mileageKm: 10950,
                  fuelLevelPercent: 55,
                  evidenceStatus: 'COMPLETE',
                },
              ],
            },
          ],
        };
      },
    };
    const vehicle = await createVehicleQueries(repository).getVehicleForUser('user-1', 'vehicle-1');

    expect(vehicle?.rentals?.[0]?.operations).toEqual([
      expect.objectContaining({ id: 'operation-1', type: 'RETURN', mileageKm: 10950 }),
    ]);
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
      where: { archivedAt: null, company: { members: { some: { userId: 'user-1' } } } },
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

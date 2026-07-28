import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEventTimelineQueries, type EventTimelineRepository } from './queries';

const context = {
  userId: 'user-1',
  companyId: 'company-1',
  companyRole: 'ADMIN' as const,
};

const vehicle = {
  id: 'vehicle-1',
  internalNumber: 'A-101',
  model: 'Hyundai Solaris',
  registrationNumber: 'А101АА',
  images: [{ localPath: '/vehicles/solar.webp' }],
};

const otherVehicle = {
  ...vehicle,
  id: 'vehicle-2',
  internalNumber: 'B-202',
  model: 'Kia Rio',
  registrationNumber: 'В202ВВ',
  images: [],
};

type SourceRows = {
  vehiclePosition: unknown[];
  trip: unknown[];
  vehicleEvent: unknown[];
  fuelRecord: unknown[];
  maintenanceRecord: unknown[];
  washRecord: unknown[];
  deviceCommand: unknown[];
  manualVehicleEvent: unknown[];
};

const emptyRows = (): SourceRows => ({
  vehiclePosition: [],
  trip: [],
  vehicleEvent: [],
  fuelRecord: [],
  maintenanceRecord: [],
  washRecord: [],
  deviceCommand: [],
  manualVehicleEvent: [],
});

function findProperty(value: unknown, property: string): unknown[] {
  if (!value || typeof value !== 'object') return [];

  const object = value as Record<string, unknown>;
  const own = property in object ? [object[property]] : [];
  return [
    ...own,
    ...Object.values(object).flatMap((nested) =>
      Array.isArray(nested)
        ? nested.flatMap((item) => findProperty(item, property))
        : findProperty(nested, property),
    ),
  ];
}

function applyVariantFilter(model: keyof SourceRows, rows: unknown[], args: unknown): unknown[] {
  const constraints = findProperty(args, 'completedAt');
  const endedAtConstraints = findProperty(args, 'endedAt');
  const sentAtConstraints = findProperty(args, 'sentAt');

  return rows.filter((row) => {
    const record = row as Record<string, unknown>;

    if (model === 'trip') {
      if (endedAtConstraints.some((value) => value === null) && record.endedAt !== null) return false;
      if (
        endedAtConstraints.some(
          (value) =>
            value && typeof value === 'object' && (value as Record<string, unknown>).not === null,
        ) &&
        record.endedAt === null
      ) {
        return false;
      }
    }

    if (model === 'maintenanceRecord' || model === 'washRecord') {
      if (constraints.some((value) => value === null) && record.completedAt !== null) return false;
      if (
        constraints.some(
          (value) =>
            value && typeof value === 'object' && (value as Record<string, unknown>).not === null,
        ) &&
        record.completedAt === null
      ) {
        return false;
      }
    }

    if (model === 'deviceCommand') {
      if (constraints.some((value) => value === null) && record.completedAt !== null) return false;
      if (sentAtConstraints.some((value) => value === null) && record.sentAt !== null) return false;
      if (
        sentAtConstraints.some(
          (value) =>
            value && typeof value === 'object' && (value as Record<string, unknown>).not === null,
        ) &&
        record.sentAt === null
      ) {
        return false;
      }
    }

    return true;
  });
}

function createFakeRepository(
  sourceRows: Partial<SourceRows> = {},
  readKeys: string[] = [],
  vehicles = [vehicle, otherVehicle],
) {
  const rows = { ...emptyRows(), ...sourceRows };
  const calls = Object.fromEntries(
    [...Object.keys(rows), 'eventReadReceipt', 'vehicle'].map((name) => [name, [] as unknown[]]),
  ) as Record<keyof SourceRows | 'eventReadReceipt' | 'vehicle', unknown[]>;

  function source(model: keyof SourceRows) {
    return {
      async findMany(args: unknown) {
        calls[model].push(args);
        const filtered = applyVariantFilter(model, rows[model], args);
        const cursor = (args as { cursor?: { id?: string } }).cursor?.id;
        const start = cursor
          ? Math.max(
              0,
              filtered.findIndex((item) => (item as { id: string }).id === cursor) + 1,
            )
          : 0;
        return filtered.slice(start, start + 50);
      },
      async count(args: unknown) {
        calls[model].push(args);
        return applyVariantFilter(model, rows[model], args).length;
      },
    };
  }

  const repository = {
    vehiclePosition: source('vehiclePosition'),
    trip: source('trip'),
    vehicleEvent: source('vehicleEvent'),
    fuelRecord: source('fuelRecord'),
    maintenanceRecord: source('maintenanceRecord'),
    washRecord: source('washRecord'),
    deviceCommand: source('deviceCommand'),
    manualVehicleEvent: source('manualVehicleEvent'),
    eventReadReceipt: {
      async findMany(args: unknown) {
        calls.eventReadReceipt.push(args);
        const requested =
          (
            findProperty(args, 'eventKey').find(
              (value) => value && typeof value === 'object' && 'in' in value,
            ) as { in?: string[] } | undefined
          )?.in ?? [];
        return readKeys
          .filter((key) => requested.includes(key))
          .map((eventKey) => ({ eventKey }));
      },
    },
    vehicle: {
      async findMany(args: unknown) {
        calls.vehicle.push(args);
        const cursor = (args as { cursor?: { id?: string } }).cursor?.id;
        const start = cursor ? vehicles.findIndex((item) => item.id === cursor) + 1 : 0;
        return vehicles.slice(start, start + 50);
      },
    },
  } satisfies EventTimelineRepository;

  return { repository, calls };
}

function expectBoundedSourceCalls(calls: unknown[]) {
  for (const call of calls.filter((item) => 'take' in (item as object))) {
    expect(call).toMatchObject({ take: 50 });
  }
}

describe('tenant-safe event timeline queries', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('adds an exact company boundary to every source and keeps vehicleId inside it', async () => {
    const fake = createFakeRepository();
    const queries = createEventTimelineQueries(fake.repository, async () => context, () => new Date('2026-07-28T12:00:00.000Z'));

    await queries.getEventTimeline({ vehicleId: 'vehicle-1' });

    for (const model of [
      'vehiclePosition',
      'trip',
      'vehicleEvent',
      'fuelRecord',
      'maintenanceRecord',
      'washRecord',
    ] as const) {
      expect(fake.calls[model]).not.toHaveLength(0);
      for (const call of fake.calls[model]) {
        expect(call).toMatchObject({
          where: expect.objectContaining({
            vehicleId: 'vehicle-1',
            vehicle: { companyId: 'company-1' },
          }),
        });
      }
    }

    for (const call of fake.calls.manualVehicleEvent) {
      expect(call).toMatchObject({
        where: expect.objectContaining({
          companyId: 'company-1',
          vehicleId: 'vehicle-1',
        }),
      });
    }

    for (const call of fake.calls.deviceCommand) {
      expect(call).toMatchObject({
        where: expect.objectContaining({
          device: expect.objectContaining({
            companyId: 'company-1',
            vehicleId: 'vehicle-1',
          }),
        }),
      });
    }

    for (const calls of Object.values(fake.calls)) {
      expectBoundedSourceCalls(calls);
    }
  });

  it('stably merges interleaved sources and exposes the last returned tuple as cursor', async () => {
    const fake = createFakeRepository({
      vehiclePosition: [
        {
          id: 'position-old',
          vehicle,
          latitude: 55.7,
          longitude: 37.6,
          speedKph: 21,
          heading: 90,
          odometerKm: 1200,
          fuelLevelPercent: 80,
          recordedAt: new Date('2026-07-20T09:00:00.000Z'),
        },
      ],
      trip: [
        {
          id: 'trip-same-time',
          vehicle,
          startedAt: new Date('2026-07-20T08:00:00.000Z'),
          endedAt: new Date('2026-07-20T11:00:00.000Z'),
          distanceKm: 30,
          averageSpeedKph: 45,
        },
      ],
      vehicleEvent: [
        {
          id: 'event-new',
          vehicle,
          severity: 'DANGER',
          title: 'Аварийный сигнал',
          description: 'Сработал датчик удара',
          location: 'Москва',
          recordedAt: new Date('2026-07-20T12:00:00.000Z'),
        },
      ],
      fuelRecord: [
        {
          id: 'fuel-old',
          vehicle,
          type: 'REFILL',
          volumeLiters: 30,
          levelPercent: 70,
          recordedAt: new Date('2026-07-20T08:00:00.000Z'),
        },
      ],
      maintenanceRecord: [
        {
          id: 'maintenance-old',
          vehicle,
          title: 'Замена масла',
          description: null,
          status: 'COMPLETED',
          scheduledAt: new Date('2026-07-19T08:00:00.000Z'),
          completedAt: new Date('2026-07-20T07:00:00.000Z'),
          odometerKm: 1200,
        },
      ],
      washRecord: [
        {
          id: 'wash-old',
          vehicle,
          status: 'COMPLETED',
          scheduledAt: new Date('2026-07-19T08:00:00.000Z'),
          completedAt: new Date('2026-07-20T06:00:00.000Z'),
        },
      ],
      deviceCommand: [
        {
          id: 'command-old',
          deviceId: 'device-1',
          device: { vehicle, companyId: 'company-1', vehicleId: 'vehicle-1' },
          type: 'REBOOT',
          status: 'COMPLETED',
          createdAt: new Date('2026-07-20T04:00:00.000Z'),
          sentAt: new Date('2026-07-20T04:30:00.000Z'),
          completedAt: new Date('2026-07-20T05:00:00.000Z'),
        },
      ],
      manualVehicleEvent: [
        {
          id: 'manual-old',
          vehicle,
          companyId: 'company-1',
          kind: 'NOTE',
          severity: 'INFO',
          title: 'Комментарий диспетчера',
          description: null,
          location: null,
          latitude: null,
          longitude: null,
          recordedAt: new Date('2026-07-20T10:00:00.000Z'),
        },
      ],
    });
    const queries = createEventTimelineQueries(fake.repository, async () => context, () => new Date('2026-07-28T12:00:00.000Z'));

    const result = await queries.getEventTimeline({
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-28T12:00:00.000Z',
      limit: 3,
    });

    expect(result.events.map((event) => event.key)).toEqual([
      'vehicle-event:event-new',
      'trip:trip-same-time',
      'manual-vehicle-event:manual-old',
    ]);
    expect(result.nextCursor).toEqual({
      before: '2026-07-20T10:00:00.000Z',
      beforeKey: 'manual-vehicle-event:manual-old',
    });
    expect(fake.calls.eventReadReceipt[0]).toMatchObject({
      where: {
        companyId: 'company-1',
        userId: 'user-1',
        eventKey: {
          in: [
            'vehicle-event:event-new',
            'trip:trip-same-time',
            'manual-vehicle-event:manual-old',
          ],
        },
      },
      select: { eventKey: true },
      take: 3,
    });
  });

  it('continues bounded source batches when read filtering removes the first batch', async () => {
    const events = Array.from({ length: 52 }, (_, index) => ({
      id: `event-${String(index).padStart(2, '0')}`,
      vehicle,
      severity: 'INFO' as const,
      title: `Событие ${index}`,
      description: null,
      location: null,
      recordedAt: new Date(Date.UTC(2026, 6, 27, 12, 0, -index)),
    }));
    const readKeys = events
      .slice(0, 50)
      .map((event) => `vehicle-event:${event.id}`);
    const fake = createFakeRepository({ vehicleEvent: events }, readKeys);
    const queries = createEventTimelineQueries(fake.repository, async () => context, () => new Date('2026-07-28T12:00:00.000Z'));

    const result = await queries.getEventTimeline({
      read: 'unread',
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-28T12:00:00.000Z',
      limit: 2,
    });

    expect(result.events.map((event) => event.key)).toEqual([
      'vehicle-event:event-50',
      'vehicle-event:event-51',
    ]);
    expect(fake.calls.vehicleEvent.filter((call) => 'take' in (call as object)).length).toBeGreaterThan(1);
    expect(fake.calls.eventReadReceipt.length).toBeGreaterThanOrEqual(2);
    for (const call of fake.calls.eventReadReceipt) {
      const keys = (
        findProperty(call, 'eventKey').find(
          (value) => value && typeof value === 'object' && 'in' in value,
        ) as { in: string[] }
      ).in;
      expect(keys.length).toBeLessThanOrEqual(50);
    }
  });

  it('applies read, category, severity, search, vehicle, period and stable cursor filters', async () => {
    const fake = createFakeRepository(
      {
        vehicleEvent: [
          {
            id: 'event-matching',
            vehicle,
            severity: 'DANGER',
            title: 'Удар на парковке',
            description: 'Нужен осмотр',
            location: 'Москва',
            recordedAt: new Date('2026-07-20T12:00:00.000Z'),
          },
          {
            id: 'event-after-cursor',
            vehicle,
            severity: 'DANGER',
            title: 'Удар на парковке',
            description: null,
            location: null,
            recordedAt: new Date('2026-07-21T12:00:00.000Z'),
          },
          {
            id: 'event-other-vehicle',
            vehicle: otherVehicle,
            severity: 'DANGER',
            title: 'Удар на парковке',
            description: null,
            location: null,
            recordedAt: new Date('2026-07-20T11:00:00.000Z'),
          },
        ],
        manualVehicleEvent: [
          {
            id: 'manual-matching-text',
            vehicle,
            companyId: 'company-1',
            kind: 'INCIDENT',
            severity: 'DANGER',
            title: 'Удар на парковке',
            description: null,
            location: null,
            latitude: null,
            longitude: null,
            recordedAt: new Date('2026-07-20T10:00:00.000Z'),
          },
        ],
      },
      ['vehicle-event:event-matching'],
    );
    const queries = createEventTimelineQueries(fake.repository, async () => context, () => new Date('2026-07-28T12:00:00.000Z'));

    const result = await queries.getEventTimeline({
      search: 'осмотр',
      vehicleId: 'vehicle-1',
      categories: ['ALERT'],
      severities: ['DANGER'],
      read: 'read',
      from: '2026-07-20T00:00:00.000Z',
      to: '2026-07-22T00:00:00.000Z',
      before: '2026-07-21T12:00:00.000Z',
      beforeKey: 'vehicle-event:event-after-cursor',
      limit: 10,
    });

    expect(result.events.map((event) => event.key)).toEqual(['vehicle-event:event-matching']);
    expect(result.nextCursor).toBeNull();
  });

  it('normalizes the default period, rejects more than 90 days and ignores read for stats', async () => {
    const fake = createFakeRepository(
      {
        vehicleEvent: [
          {
            id: 'danger-read',
            vehicle,
            severity: 'DANGER',
            title: 'Критическое событие',
            description: null,
            location: null,
            recordedAt: new Date('2026-07-20T12:00:00.000Z'),
          },
          {
            id: 'info-unread',
            vehicle: otherVehicle,
            severity: 'INFO',
            title: 'Обычное событие',
            description: null,
            location: null,
            recordedAt: new Date('2026-07-19T12:00:00.000Z'),
          },
        ],
      },
      ['vehicle-event:danger-read'],
    );
    const queries = createEventTimelineQueries(fake.repository, async () => context, () => new Date('2026-07-28T12:00:00.000Z'));

    const result = await queries.getEventTimeline({ read: 'read' });

    expect(result.events.map((event) => event.key)).toEqual(['vehicle-event:danger-read']);
    expect(result.stats).toEqual({ total: 2, danger: 1, unread: 1, vehicles: 2 });
    const eventCall = fake.calls.vehicleEvent.find((call) => 'take' in (call as object));
    expect(eventCall).toMatchObject({
      where: expect.objectContaining({
        recordedAt: {
          gte: new Date('2026-06-28T12:00:00.000Z'),
          lte: new Date('2026-07-28T12:00:00.000Z'),
        },
      }),
      take: 50,
    });

    await expect(
      queries.getEventTimeline({
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-07-28T12:00:00.000Z',
      }),
    ).rejects.toThrow('90');

    await expect(queries.getEventTimeline({ limit: 51 })).rejects.toThrow('50');

    for (const receiptCall of fake.calls.eventReadReceipt) {
      expect(receiptCall).toMatchObject({ take: expect.any(Number) });
      expect((receiptCall as { take: number }).take).toBeLessThanOrEqual(50);
    }
  });

  it('returns serialized vehicle options and no tenant data without an authenticated membership', async () => {
    const fake = createFakeRepository();
    const unauthenticated = createEventTimelineQueries(fake.repository, async () => null);

    await expect(unauthenticated.getEventTimeline({})).resolves.toEqual({
      events: [],
      nextCursor: null,
      stats: { total: 0, danger: 0, unread: 0, vehicles: 0 },
      vehicles: [],
    });
    expect(Object.values(fake.calls).flat()).toEqual([]);

    const queries = createEventTimelineQueries(fake.repository, async () => context);
    const result = await queries.getEventTimeline({});
    expect(result.vehicles).toEqual([
      { id: 'vehicle-1', label: 'A-101 · Hyundai Solaris · А101АА' },
      { id: 'vehicle-2', label: 'B-202 · Kia Rio · В202ВВ' },
    ]);
    for (const call of fake.calls.vehicle) {
      expect(call).toMatchObject({
        where: { companyId: 'company-1' },
        orderBy: [{ internalNumber: 'asc' }, { id: 'asc' }],
        take: 50,
      });
    }
  });
});

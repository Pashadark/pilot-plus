import { describe, expect, it } from 'vitest';

import { buildDashboardOverview } from './normalizers';

const DEFAULT_NOW = new Date('2026-08-24T12:00:00.000Z');

it('enriches work items with real rental details and a separately expanded queue window', () => {
  const period = { key: 'today' as const, ...moscowDay('2026-08-24') };
  const result = buildDashboardOverview({
    period,
    workPeriod: { ...period, toExclusive: new Date('2026-08-27T21:00:00Z') },
    now: DEFAULT_NOW,
    vehicles: [vehicle()],
    clientCount: 1,
    maintenanceRecords: [],
    washRecords: [],
    rentals: [
      rental({
        clientId: 'client-1',
        startsAt: new Date('2026-08-25T10:00:00Z'),
        endsAt: new Date('2026-08-26T10:00:00Z'),
        depositMinor: BigInt(20000),
        payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: BigInt(20000) }],
      }),
    ],
  });
  expect(result.workItems).toContainEqual(
    expect.objectContaining({
      kind: 'HANDOVER',
      details: expect.objectContaining({
        vehicleHref: '/vehicles/vehicle-1',
        clientHref: '/clients/client-1',
        collectedMinor: '20000',
        startsAt: '2026-08-25T10:00:00.000Z',
      }),
    }),
  );
  expect(result.period.toExclusive).toBe(period.toExclusive.toISOString());
  expect(result.generatedAt).toBe(DEFAULT_NOW.toISOString());
});

function moscowDay(day: string) {
  const from = new Date(`${day}T00:00:00.000+03:00`);
  return { from, toExclusive: new Date(from.getTime() + 86_400_000), label: day };
}

function vehicle(overrides = {}) {
  return {
    id: 'vehicle-1',
    label: 'Kia Rio · А001АА777',
    position: { recordedAt: new Date('2026-08-24T11:50:00.000Z') },
    fuelLevelPercent: null,
    ...overrides,
  };
}

function operation(
  depositStatus: 'COLLECTED' | 'RETURNED' | 'PARTIALLY_WITHHELD' | 'WITHHELD',
  occurredAt: string,
) {
  return {
    id: `operation-${depositStatus}-${occurredAt}`,
    type: 'RETURN' as const,
    status: 'COMMITTED' as const,
    occurredAt: new Date(`${occurredAt}T10:00:00.000Z`),
    depositStatus,
    fulfillmentMethod: null,
    fulfillmentAddress: null,
  };
}

function rental(overrides = {}) {
  return {
    id: 'rental-1',
    vehicleId: 'vehicle-1',
    status: 'CONFIRMED' as const,
    startsAt: new Date('2026-08-24T07:00:00.000Z'),
    endsAt: new Date('2026-08-24T17:00:00.000Z'),
    totalPriceMinor: BigInt(40_000),
    depositMinor: null,
    contractNumber: 'R-1',
    client: { lastName: 'Иванов', firstName: 'Иван', middleName: null, phone: '+79990000000' },
    vehicleLabel: 'Kia Rio · А001АА777',
    payments: [],
    operations: [],
    ...overrides,
  };
}

function maintenance(overrides = {}) {
  return {
    id: 'maintenance-1',
    vehicleId: 'vehicle-1',
    title: 'Замена масла',
    recordType: 'MAINTENANCE' as const,
    status: 'PLANNED' as const,
    damageReportedAt: null,
    scheduledAt: new Date('2026-08-24T13:00:00.000Z'),
    scheduledEndsAt: null,
    vehicleLabel: 'Kia Rio · А001АА777',
    ...overrides,
  };
}

function wash(overrides = {}) {
  return {
    id: 'wash-1',
    vehicleId: 'vehicle-1',
    status: 'PLANNED' as const,
    scheduledAt: new Date('2026-08-24T14:00:00.000Z'),
    vehicleLabel: 'Kia Rio · А001АА777',
    ...overrides,
  };
}

function lead(overrides = {}) {
  return {
    id: 'lead-1',
    name: 'Иван',
    lastName: 'Иванов',
    source: 'Авито',
    status: 'NEW' as const,
    nextContactAt: new Date('2026-08-24T15:00:00.000Z'),
    createdAt: new Date('2026-08-24T08:00:00.000Z'),
    phone: '+79990000000',
    assignedToName: null,
    ...overrides,
  };
}

function fine(overrides = {}) {
  return {
    id: 'fine-1',
    decreeNumber: '18810577260909000001',
    createdAt: new Date('2026-08-24T10:30:00.000Z'),
    offenseAt: new Date('2026-08-24T09:45:00.000Z'),
    currentAmountMinor: BigInt(250_000),
    description: 'Превышение скорости',
    address: 'Москва, Ленинградское шоссе',
    vehicleLabel: 'Mercedes-Benz E 220 d 4MATIC · М283АМ997',
    clientLabel: 'Иванов Иван',
    contractNumber: 'ME-2026-0019-SA',
    ...overrides,
  };
}

function source(overrides = {}) {
  return {
    period: { key: 'today' as const, ...moscowDay('2026-08-24') },
    now: DEFAULT_NOW,
    vehicles: [vehicle()],
    rentals: [],
    financeRentals: [],
    clientCount: 0,
    maintenanceRecords: [],
    washRecords: [],
    leads: [],
    fines: [],
    ...overrides,
  };
}

describe('buildDashboardOverview', () => {
  it('counts actual outstanding deposits across all dates, excluding settled and uncollected amounts', () => {
    const paid = [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: BigInt(2000000) }];
    const result = buildDashboardOverview(
      source({
        financeRentals: [
          rental({ id: 'held', depositMinor: BigInt(2000000), payments: paid }),
          rental({
            id: 'partial-payment',
            depositMinor: BigInt(2000000),
            payments: [{ ...paid[0], amountMinor: BigInt(500000) }],
          }),
          rental({ id: 'unpaid', depositMinor: BigInt(2000000) }),
          ...(['RETURNED', 'PARTIALLY_WITHHELD', 'WITHHELD'] as const).map((status) =>
            rental({
              id: status,
              status: 'COMPLETED',
              depositMinor: BigInt(2000000),
              payments: paid,
              operations: [operation(status, '2026-08-23')],
            }),
          ),
          rental({
            id: 'legacy-held',
            depositMinor: BigInt(1000000),
            operations: [operation('COLLECTED', '2026-08-23')],
          }),
        ],
      }),
    );
    expect(result.kpis.heldDepositsMinor).toBe('3500000');
  });
  it('counts maintenance, repairs, washes, contracts and clients independently', () => {
    const result = buildDashboardOverview(
      source({
        vehicles: [
          vehicle({ id: 'vehicle-maintenance' }),
          vehicle({ id: 'vehicle-repair' }),
          vehicle({ id: 'vehicle-wash' }),
          vehicle({ id: 'vehicle-free' }),
        ],
        maintenanceRecords: [
          maintenance({ id: 'maintenance-1', vehicleId: 'vehicle-maintenance' }),
          maintenance({ id: 'maintenance-2', vehicleId: 'vehicle-maintenance' }),
          maintenance({
            id: 'repair-1',
            vehicleId: 'vehicle-repair',
            recordType: 'REPAIR',
            status: 'DAMAGE_REPORTED',
            scheduledAt: null,
            damageReportedAt: new Date('2026-08-24T09:00:00.000Z'),
          }),
        ],
        washRecords: [wash({ vehicleId: 'vehicle-wash' })],
        financeRentals: [
          rental({ id: 'confirmed', status: 'CONFIRMED' }),
          rental({ id: 'active', status: 'ACTIVE' }),
          rental({ id: 'completed', status: 'COMPLETED' }),
          rental({ id: 'draft', status: 'DRAFT' }),
          rental({ id: 'cancelled', status: 'CANCELLED' }),
        ],
        clientCount: 37,
      }),
    );

    expect(result.kpis).toMatchObject({
      maintenanceVehicles: 1,
      repairVehicles: 1,
      washVehicles: 1,
      serviceVehicles: 3,
      contracts: 3,
      clients: 37,
    });
  });

  it('calculates lifetime earnings and deposits independently from the selected work period', () => {
    const historical = rental({
      status: 'COMPLETED',
      startsAt: new Date('2026-07-01T07:00:00.000Z'),
      endsAt: new Date('2026-07-03T07:00:00.000Z'),
      totalPriceMinor: BigInt(40_000),
      depositMinor: BigInt(15_000),
      operations: [
        {
          ...operation('RETURNED', '2026-07-03'),
          id: 'extension-1',
          type: 'EXTENSION',
          extensionChargeMinor: BigInt(5_000),
        },
      ],
    });

    const result = buildDashboardOverview(source({ financeRentals: [historical] }));

    expect(result.kpis).toMatchObject({
      lifetimeEarnedMinor: '45000',
      lifetimeDepositsMinor: '15000',
      heldDepositsMinor: '0',
    });
  });

  it('excludes deposits from earned rental money', () => {
    const result = buildDashboardOverview(
      source({
        rentals: [
          rental({
            startsAt: new Date('2026-08-24T07:00:00.000Z'),
            endsAt: new Date('2026-08-24T17:00:00.000Z'),
            totalPriceMinor: BigInt(40_000),
            depositMinor: BigInt(15_000),
          }),
        ],
      }),
    );

    expect(result.kpis.earnedMinor).toBe('40000');
    expect(result.kpis.heldDepositsMinor).toBe('0');
  });

  it('allocates a multi-day contract across Moscow billable days', () => {
    const result = buildDashboardOverview(
      source({
        period: { key: 'today' as const, ...moscowDay('2026-08-25') },
        rentals: [
          rental({
            startsAt: new Date('2026-08-24T07:00:00.000Z'),
            endsAt: new Date('2026-08-26T07:00:00.000Z'),
            totalPriceMinor: BigInt(40_001),
          }),
        ],
      }),
    );

    expect(result.kpis.earnedMinor).toBe('13334');
  });

  it('allocates a 23:30–00:30 Moscow rental across both intersecting calendar days', () => {
    const result = buildDashboardOverview(
      source({
        period: { key: 'today' as const, ...moscowDay('2026-08-25') },
        rentals: [
          rental({
            startsAt: new Date('2026-08-24T20:30:00.000Z'),
            endsAt: new Date('2026-08-24T21:30:00.000Z'),
            totalPriceMinor: BigInt(10_001),
          }),
        ],
      }),
    );

    expect(result.kpis.earnedMinor).toBe('5000');
  });

  it('counts only the latest committed collected deposit as held', () => {
    const result = buildDashboardOverview(
      source({
        rentals: [
          rental({
            depositMinor: BigInt(15_000),
            operations: [operation('COLLECTED', '2026-08-20'), operation('RETURNED', '2026-08-24')],
          }),
        ],
      }),
    );

    expect(result.kpis.heldDepositsMinor).toBe('0');
  });

  it('puts overdue returns before later work items', () => {
    const result = buildDashboardOverview(
      source({
        rentals: [
          rental({
            endsAt: new Date('2026-08-24T10:00:00.000Z'),
            status: 'ACTIVE',
          }),
        ],
        washRecords: [wash()],
      }),
    );

    expect(result.workItems[0]).toMatchObject({ kind: 'RETURN', overdue: true, tone: 'danger' });
  });

  it('keeps an uncompleted overdue return visible on the current workday', () => {
    const result = buildDashboardOverview(
      source({
        rentals: [
          rental({
            status: 'ACTIVE',
            startsAt: new Date('2026-08-20T10:00:00.000Z'),
            endsAt: new Date('2026-08-23T10:00:00.000Z'),
          }),
        ],
      }),
    );

    expect(result.workItems).toContainEqual(
      expect.objectContaining({
        id: 'rental-return:rental-1',
        kind: 'RETURN',
        overdue: true,
        scheduledAt: '2026-08-23T10:00:00.000Z',
      }),
    );
    expect(result.kpis).toMatchObject({ occupiedVehicles: 1, freeVehicles: 0 });
  });

  it('treats an overlapping active rental as occupied', () => {
    const result = buildDashboardOverview(source({ rentals: [rental({ status: 'ACTIVE' })] }));

    expect(result.kpis).toMatchObject({ occupiedVehicles: 1, freeVehicles: 0, serviceVehicles: 0 });
  });

  it('excludes archived and demo vehicles required to be absent from the query contract', () => {
    const result = buildDashboardOverview(
      source({
        vehicles: [
          vehicle(),
          vehicle({ id: 'archived', archivedAt: new Date('2026-08-01T00:00:00.000Z') }),
          vehicle({ id: 'demo', isDemoImport: true }),
        ],
      }),
    );

    expect(result.kpis).toMatchObject({ freeVehicles: 1, occupiedVehicles: 0, serviceVehicles: 0 });
  });

  it('does not leak demo or archived vehicle records into dashboard finance, work, or service', () => {
    const result = buildDashboardOverview(
      source({
        vehicles: [
          vehicle(),
          vehicle({ id: 'demo', isDemoImport: true }),
          vehicle({ id: 'archived', archivedAt: new Date('2026-08-01T00:00:00.000Z') }),
        ],
        rentals: [
          rental({
            vehicleId: 'demo',
            totalPriceMinor: BigInt(99_999),
            depositMinor: BigInt(15_000),
            operations: [operation('COLLECTED', '2026-08-24')],
          }),
        ],
        maintenanceRecords: [maintenance({ vehicleId: 'archived' })],
        washRecords: [wash({ vehicleId: 'demo' })],
      }),
    );

    expect(result.kpis).toMatchObject({
      earnedMinor: '0',
      heldDepositsMinor: '0',
      freeVehicles: 1,
      occupiedVehicles: 0,
      serviceVehicles: 0,
    });
    expect(result.workItems).toEqual([]);
  });

  it('gives maintenance and wash precedence over rental availability', () => {
    const result = buildDashboardOverview(
      source({
        rentals: [rental({ status: 'ACTIVE' })],
        maintenanceRecords: [maintenance()],
        washRecords: [wash({ id: 'wash-2' })],
      }),
    );

    expect(result.kpis).toMatchObject({ occupiedVehicles: 0, freeVehicles: 0, serviceVehicles: 1 });
  });

  it('counts a position older than the GPS stale threshold as offline', () => {
    const result = buildDashboardOverview(
      source({
        vehicles: [vehicle({ position: { recordedAt: new Date('2026-08-24T11:44:59.999Z') } })],
      }),
    );

    expect(result.kpis.offlineVehicles).toBe(1);
  });

  it('does not add completed or cancelled service records to the workday', () => {
    const result = buildDashboardOverview(
      source({
        maintenanceRecords: [maintenance({ status: 'COMPLETED' })],
        washRecords: [wash({ status: 'CANCELLED' })],
      }),
    );

    expect(result.workItems).toEqual([]);
  });

  it('shows a pending deposit return three days before its 21-working-day deadline', () => {
    const result = buildDashboardOverview(
      source({
        period: { key: 'today' as const, ...moscowDay('2026-09-19') },
        now: new Date('2026-09-19T12:00:00.000Z'),
        rentals: [
          rental({
            status: 'COMPLETED',
            depositMinor: BigInt(15_000),
            endsAt: new Date('2026-08-24T17:00:00.000Z'),
            completedAt: new Date('2026-08-24T17:00:00.000Z'),
            operations: [{ ...operation('COLLECTED', '2026-08-20'), type: 'HANDOVER' }],
          }),
        ],
      }),
    );

    expect(result.workItems).toContainEqual(
      expect.objectContaining({
        id: 'deposit-return:rental-1',
        kind: 'DEPOSIT_RETURN',
        scheduledAt: '2026-09-22T17:00:00.000Z',
        overdue: false,
      }),
    );
  });

  it('shows a completed payment-backed deposit even without a collected operation', () => {
    const result = buildDashboardOverview(
      source({
        period: { key: 'today' as const, ...moscowDay('2026-09-19') },
        now: new Date('2026-09-19T12:00:00.000Z'),
        rentals: [
          rental({
            status: 'COMPLETED',
            depositMinor: BigInt(15_000),
            completedAt: new Date('2026-08-24T17:00:00.000Z'),
            payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: BigInt(15_000) }],
            operations: [],
          }),
        ],
      }),
    );

    expect(result.workItems).toContainEqual(
      expect.objectContaining({
        id: 'deposit-return:rental-1',
        kind: 'DEPOSIT_RETURN',
        scheduledAt: '2026-09-22T17:00:00.000Z',
        overdue: false,
      }),
    );
  });

  it('keeps a midnight deposit deadline as due today for the whole Moscow day', () => {
    const result = buildDashboardOverview(
      source({
        period: { key: 'today' as const, ...moscowDay('2026-09-23') },
        now: new Date('2026-09-23T12:00:00.000Z'),
        rentals: [
          rental({
            status: 'COMPLETED',
            depositMinor: BigInt(15_000),
            completedAt: new Date('2026-08-24T21:00:00.000Z'),
            operations: [{ ...operation('COLLECTED', '2026-08-20'), type: 'HANDOVER' }],
          }),
        ],
      }),
    );

    expect(result.workItems).toContainEqual(
      expect.objectContaining({
        id: 'deposit-return:rental-1',
        title: 'Вернуть депозит сегодня',
        scheduledAt: '2026-09-22T21:00:00.000Z',
        tone: 'warning',
        overdue: false,
      }),
    );
  });

  it('does not show a payment-backed deposit after a terminal return operation', () => {
    const result = buildDashboardOverview(
      source({
        period: { key: 'today' as const, ...moscowDay('2026-09-23') },
        now: new Date('2026-09-23T12:00:00.000Z'),
        rentals: [
          rental({
            status: 'COMPLETED',
            depositMinor: BigInt(15_000),
            completedAt: new Date('2026-08-24T17:00:00.000Z'),
            payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: BigInt(15_000) }],
            operations: [operation('RETURNED', '2026-09-22')],
          }),
        ],
      }),
    );

    expect(result.workItems).not.toContainEqual(
      expect.objectContaining({ id: 'deposit-return:rental-1' }),
    );
  });

  it('does not show a deposit return before the three-day reminder window', () => {
    const result = buildDashboardOverview(
      source({
        period: { key: 'today' as const, ...moscowDay('2026-09-18') },
        now: new Date('2026-09-18T12:00:00.000Z'),
        rentals: [
          rental({
            status: 'COMPLETED',
            depositMinor: BigInt(15_000),
            completedAt: new Date('2026-08-24T17:00:00.000Z'),
            operations: [{ ...operation('COLLECTED', '2026-08-20'), type: 'HANDOVER' }],
          }),
        ],
      }),
    );

    expect(result.workItems).not.toContainEqual(
      expect.objectContaining({ id: 'deposit-return:rental-1' }),
    );
  });

  it('keeps an overdue unreturned deposit at the top of the workday', () => {
    const result = buildDashboardOverview(
      source({
        period: { key: 'today' as const, ...moscowDay('2026-09-23') },
        now: new Date('2026-09-23T12:00:00.000Z'),
        rentals: [
          rental({
            status: 'COMPLETED',
            depositMinor: BigInt(15_000),
            completedAt: new Date('2026-08-24T17:00:00.000Z'),
            operations: [{ ...operation('COLLECTED', '2026-08-20'), type: 'HANDOVER' }],
          }),
        ],
      }),
    );

    expect(result.workItems[0]).toEqual(
      expect.objectContaining({
        id: 'deposit-return:rental-1',
        scheduledAt: '2026-09-22T17:00:00.000Z',
        tone: 'danger',
        overdue: true,
      }),
    );
  });

  it('uses the ID tie-breaker for committed handovers at the same timestamp', () => {
    const result = buildDashboardOverview(
      source({
        rentals: [
          rental({
            operations: [
              {
                ...operation('COLLECTED', '2026-08-24'),
                id: 'handover-a',
                type: 'HANDOVER',
                fulfillmentMethod: 'OFFICE',
              },
              {
                ...operation('COLLECTED', '2026-08-24'),
                id: 'handover-z',
                type: 'HANDOVER',
                fulfillmentMethod: 'DELIVERY',
                fulfillmentAddress: 'Москва, Тверская 1',
              },
            ],
          }),
        ],
      }),
    );

    expect(result.workItems).toContainEqual(
      expect.objectContaining({ kind: 'DELIVERY', address: 'Москва, Тверская 1' }),
    );
  });

  it('adds an assigned manual task to the same prioritized workday queue', () => {
    const result = buildDashboardOverview(
      source({
        manualTasks: [
          {
            id: 'task-1',
            title: 'Позвонить клиенту',
            description: 'Уточнить продление',
            dueAt: new Date('2026-08-24T10:00:00.000Z'),
            priority: 'HIGH',
            href: null,
            assignedToName: 'Павел Седов',
          },
        ],
      }),
    );

    expect(result.workItems).toContainEqual(
      expect.objectContaining({
        id: 'manual-task:task-1',
        kind: 'MANUAL_TASK',
        title: 'Позвонить клиенту',
        completable: true,
        overdue: true,
      }),
    );
  });

  it('adds active leads after scheduled work and keeps unscheduled leads last', () => {
    const result = buildDashboardOverview(
      source({
        leads: [
          lead({
            id: 'overdue',
            nextContactAt: new Date('2026-08-24T10:00:00.000Z'),
          }),
          lead({ id: 'scheduled', nextContactAt: new Date('2026-08-24T15:00:00.000Z') }),
          lead({ id: 'unscheduled', nextContactAt: null }),
        ],
        manualTasks: [
          {
            id: 'task-1',
            title: 'Плановая задача',
            description: null,
            dueAt: new Date('2026-08-24T13:00:00.000Z'),
            priority: 'NORMAL',
            href: null,
            assignedToName: null,
          },
        ],
      }),
    );

    expect(result.workItems.map((item) => item.id)).toEqual([
      'lead:overdue',
      'manual-task:task-1',
      'lead:scheduled',
      'lead:unscheduled',
    ]);
    expect(result.workItems.at(-1)).toMatchObject({
      kind: 'LEAD',
      vehicleLabel: 'Иванов Иван',
      clientLabel: 'Источник: Авито',
      unscheduled: true,
    });
  });

  it('adds new fines to the workday with vehicle, client, contract and amount', () => {
    const result = buildDashboardOverview(source({ fines: [fine()] }));

    expect(result.workItems).toContainEqual(
      expect.objectContaining({
        id: 'fine:fine-1',
        kind: 'FINE',
        scheduledAt: '2026-08-24T10:30:00.000Z',
        title: 'Новый штраф',
        tone: 'warning',
        href: '/fines?query=18810577260909000001',
        vehicleLabel: 'Mercedes-Benz E 220 d 4MATIC · М283АМ997',
        clientLabel: 'Иванов Иван',
        contractNumber: 'ME-2026-0019-SA',
        address: 'Москва, Ленинградское шоссе',
        amountMinor: '250000',
        overdue: false,
      }),
    );
  });

  it('uses discount deadline rather than ingestion date and keeps unknown payment deadlines unscheduled', () => {
    const result = buildDashboardOverview(
      source({
        fines: [
          fine({
            id: 'discount',
            status: 'UNPAID',
            createdAt: new Date('2026-08-01T10:00:00Z'),
            discountExpiresAt: new Date('2026-08-24T20:59:59Z'),
          }),
          fine({ id: 'unknown', status: 'UNPAID' }),
          fine({ id: 'paid', status: 'PAID' }),
        ],
      }),
    );
    expect(result.workItems.find((item) => item.id === 'fine:discount')).toMatchObject({
      scheduledAt: '2026-08-24T20:59:59.000Z',
      deadlineLabel: 'Скидка заканчивается сегодня',
      unscheduled: false,
      dateOnly: true,
    });
    expect(result.workItems.find((item) => item.id === 'fine:unknown')).toMatchObject({
      unscheduled: true,
      overdue: false,
    });
    expect(result.workItems.some((item) => item.id === 'fine:paid')).toBe(false);
  });

  it('adds a refuel action and attention card below25 percent', () => {
    const result = buildDashboardOverview(
      source({ vehicles: [vehicle({ fuelLevelPercent: 20 })] }),
    );
    expect(result.attentionItems).toContainEqual(
      expect.objectContaining({ id: 'low-fuel:vehicle-1', title: 'Нужна заправка' }),
    );

    expect(result.workItems).toContainEqual(
      expect.objectContaining({
        id: 'low-fuel:vehicle-1',
        kind: 'LOW_FUEL',
        title: 'Мало топлива',
        tone: 'danger',
        href: '/vehicles/vehicle-1',
        vehicleLabel: 'Kia Rio · А001АА777',
        clientLabel: 'Остаток топлива: 20%',
        overdue: false,
      }),
    );
  });

  it('does not put current low fuel into a future-only workday', () => {
    const result = buildDashboardOverview(
      source({
        period: { key: 'tomorrow' as const, ...moscowDay('2026-08-25') },
        vehicles: [vehicle({ fuelLevelPercent: 10 })],
      }),
    );

    expect(result.workItems).not.toContainEqual(expect.objectContaining({ kind: 'LOW_FUEL' }));
  });
});

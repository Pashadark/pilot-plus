import { describe, expect, it } from 'vitest';

import { buildDashboardOverview } from './normalizers';

const DEFAULT_NOW = new Date('2026-08-24T12:00:00.000Z');

function moscowDay(day: string) {
  const from = new Date(`${day}T00:00:00.000+03:00`);
  return { from, toExclusive: new Date(from.getTime() + 86_400_000), label: day };
}

function vehicle(overrides = {}) {
  return {
    id: 'vehicle-1',
    label: 'Kia Rio · А001АА777',
    position: { recordedAt: new Date('2026-08-24T11:50:00.000Z') },
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
    operations: [],
    ...overrides,
  };
}

function maintenance(overrides = {}) {
  return {
    id: 'maintenance-1',
    vehicleId: 'vehicle-1',
    title: 'Замена масла',
    status: 'PLANNED' as const,
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

function source(overrides = {}) {
  return {
    period: { key: 'today' as const, ...moscowDay('2026-08-24') },
    now: DEFAULT_NOW,
    vehicles: [vehicle()],
    rentals: [],
    maintenanceRecords: [],
    washRecords: [],
    ...overrides,
  };
}

describe('buildDashboardOverview', () => {
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

  it('schedules a pending deposit return on the completed rental obligation, not collection time', () => {
    const result = buildDashboardOverview(
      source({
        rentals: [
          rental({
            status: 'COMPLETED',
            depositMinor: BigInt(15_000),
            endsAt: new Date('2026-08-24T17:00:00.000Z'),
            operations: [{ ...operation('COLLECTED', '2026-08-20'), type: 'HANDOVER' }],
          }),
        ],
      }),
    );

    expect(result.workItems).toContainEqual(
      expect.objectContaining({
        id: 'deposit-return:rental-1',
        kind: 'DEPOSIT_RETURN',
        scheduledAt: '2026-08-24T17:00:00.000Z',
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
});

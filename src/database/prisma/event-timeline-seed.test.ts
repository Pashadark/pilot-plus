import { describe, expect, it } from 'vitest';

import { seedVehicleEventTimeline, type EventTimelineSeedDatabase } from './event-timeline-seed';

type UpsertArguments = {
  where: { id: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

function createEventTimelineSeedDatabase() {
  const trips = new Map<string, Record<string, unknown>>();
  const events = new Map<string, Record<string, unknown>>();
  const fuelRecords = new Map<string, Record<string, unknown>>();
  const manualEvents = new Map<string, Record<string, unknown>>();

  function upsertInto(records: Map<string, Record<string, unknown>>, arguments_: UpsertArguments) {
    const record = { id: arguments_.where.id, ...arguments_.create, ...arguments_.update };
    records.set(arguments_.where.id, record);
    return record;
  }

  return {
    trips,
    events,
    fuelRecords,
    manualEvents,
    database: {
      trip: { upsert: (arguments_: UpsertArguments) => upsertInto(trips, arguments_) },
      vehicleEvent: { upsert: (arguments_: UpsertArguments) => upsertInto(events, arguments_) },
      fuelRecord: { upsert: (arguments_: UpsertArguments) => upsertInto(fuelRecords, arguments_) },
      manualVehicleEvent: {
        upsert: (arguments_: UpsertArguments) => upsertInto(manualEvents, arguments_),
      },
    } as unknown as EventTimelineSeedDatabase,
  };
}

const vehicles = Array.from({ length: 23 }, (_, index) => ({
  id: `vehicle-${String(index + 1).padStart(2, '0')}`,
  internalNumber: `PLT-${String(index + 1).padStart(3, '0')}`,
}));

describe('seedVehicleEventTimeline', () => {
  it('идемпотентно создаёт содержательную историю событий автопарка', async () => {
    const fake = createEventTimelineSeedDatabase();

    const first = await seedVehicleEventTimeline(
      fake.database,
      'pilot-demo-company',
      'admin-user',
      vehicles,
    );
    const second = await seedVehicleEventTimeline(
      fake.database,
      'pilot-demo-company',
      'admin-user',
      vehicles,
    );

    expect(first).toEqual({ trips: 18, events: 24, fuelRecords: 12, manualEvents: 8 });
    expect(second).toEqual(first);
    expect(fake.trips.size).toBe(18);
    expect(fake.events.size).toBe(24);
    expect(fake.fuelRecords.size).toBe(12);
    expect(fake.manualEvents.size).toBe(8);
    expect([...fake.events.values()].filter((event) => event.severity === 'DANGER')).toHaveLength(
      3,
    );
    expect([...fake.fuelRecords.values()]).toContainEqual(
      expect.objectContaining({ type: 'DRAIN' }),
    );
    expect([...fake.manualEvents.values()]).toContainEqual(
      expect.objectContaining({ kind: 'ASSIGNMENT' }),
    );
    expect([...fake.manualEvents.values()]).toContainEqual(
      expect.objectContaining({ kind: 'INCIDENT' }),
    );
  });
});

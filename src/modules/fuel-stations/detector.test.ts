import { describe, expect, it } from 'vitest';

import { evaluateFuelStationPosition, type FuelStation } from './detector';

const station: FuelStation = {
  id: 'station-1',
  name: 'АЗС Тест',
  address: 'Москва',
  latitude: 55.75,
  longitude: 37.61,
};

describe('fuel station detector', () => {
  it('waits seven minutes before emitting a possible refuelling event', () => {
    const enteredAt = new Date('2026-09-18T08:00:00Z');
    const first = evaluateFuelStationPosition(
      { vehicleId: 'vehicle-1', latitude: 55.75, longitude: 37.61, recordedAt: enteredAt },
      null,
      [station],
      enteredAt,
    );
    expect(first.kind).toBe('entered');

    const pending = evaluateFuelStationPosition(
      { vehicleId: 'vehicle-1', latitude: 55.7502, longitude: 37.6102, recordedAt: new Date('2026-09-18T08:06:59Z') },
      first.state,
      [station],
      new Date('2026-09-18T08:06:59Z'),
    );
    expect(pending.kind).toBe('dwellPending');

    const ready = evaluateFuelStationPosition(
      { vehicleId: 'vehicle-1', latitude: 55.7501, longitude: 37.6101, recordedAt: new Date('2026-09-18T08:07:00Z') },
      pending.state,
      [station],
      new Date('2026-09-18T08:07:00Z'),
    );
    expect(ready.kind).toBe('possibleRefuelling');
    expect(ready.state?.notifiedAt).toEqual(new Date('2026-09-18T08:07:00Z'));
  });

  it('requires leaving the geofence before notifying again', () => {
    const start = new Date('2026-09-18T08:00:00Z');
    const entered = evaluateFuelStationPosition(
      { vehicleId: 'vehicle-1', latitude: 55.75, longitude: 37.61, recordedAt: start },
      null,
      [station],
      start,
    );
    const notified = evaluateFuelStationPosition(
      { vehicleId: 'vehicle-1', latitude: 55.75, longitude: 37.61, recordedAt: new Date('2026-09-18T08:07:00Z') },
      entered.state,
      [station],
      new Date('2026-09-18T08:07:00Z'),
    );
    const stillInside = evaluateFuelStationPosition(
      { vehicleId: 'vehicle-1', latitude: 55.75, longitude: 37.61, recordedAt: new Date('2026-09-18T08:08:00Z') },
      notified.state,
      [station],
      new Date('2026-09-18T08:08:00Z'),
    );
    expect(stillInside.kind).not.toBe('possibleRefuelling');
    const exited = evaluateFuelStationPosition(
      { vehicleId: 'vehicle-1', latitude: 55.8, longitude: 37.7, recordedAt: new Date('2026-09-18T08:09:00Z') },
      stillInside.state,
      [station],
      new Date('2026-09-18T08:09:00Z'),
    );
    expect(exited.kind).toBe('exited');
  });
});

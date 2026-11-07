import { describe, expect, it } from 'vitest';

import { deriveVehicleOperationalStatus } from './operational-status';

describe('deriveVehicleOperationalStatus', () => {
  it('uses the required priority: service, rental, park, available', () => {
    expect(
      deriveVehicleOperationalStatus({
        hasConfirmedServiceVisit: true,
        hasOpenMaintenance: false,
        hasActiveRental: true,
        gpsStatus: 'IN_PARK',
      }),
    ).toBe('IN_SERVICE');
    expect(
      deriveVehicleOperationalStatus({
        hasConfirmedServiceVisit: false,
        hasOpenMaintenance: false,
        hasActiveRental: true,
        gpsStatus: 'IN_PARK',
      }),
    ).toBe('RENTED');
    expect(
      deriveVehicleOperationalStatus({
        hasConfirmedServiceVisit: false,
        hasOpenMaintenance: false,
        hasActiveRental: false,
        gpsStatus: 'IN_PARK',
      }),
    ).toBe('IN_PARK');
    expect(
      deriveVehicleOperationalStatus({
        hasConfirmedServiceVisit: false,
        hasOpenMaintenance: false,
        hasActiveRental: false,
        gpsStatus: 'IDLE',
      }),
    ).toBe('AVAILABLE');
  });

  it('treats a manually opened maintenance state as service', () => {
    expect(
      deriveVehicleOperationalStatus({
        hasConfirmedServiceVisit: false,
        hasOpenMaintenance: true,
        hasActiveRental: true,
        gpsStatus: 'MOVING',
      }),
    ).toBe('IN_SERVICE');
  });
});

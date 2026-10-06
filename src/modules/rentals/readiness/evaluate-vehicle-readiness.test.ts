import { describe, expect, it } from 'vitest';

import { evaluateVehicleReadiness } from './evaluate-vehicle-readiness';

const period = {
  startsAt: new Date('2026-09-03T00:00:00.000Z'),
  endsAt: new Date('2026-09-05T00:00:00.000Z'),
};

describe('evaluateVehicleReadiness', () => {
  it('reports missing VIN as a blocker and missing KASKO as a warning', () => {
    const result = evaluateVehicleReadiness(
      {
        id: 'vehicle-1',
        archivedAt: null,
        isRentalReady: true,
        registrationNumber: 'А001АА997',
        vin: '',
        registrationCertificateNumber: 'СТС-1',
        vehiclePassportNumber: 'ПТС-1',
        osagoInsurer: 'Страховая',
        osagoPolicyNumber: 'ОСАГО-1',
        osagoStartsAt: new Date('2026-01-01T00:00:00.000Z'),
        osagoEndsAt: new Date('2027-01-01T00:00:00.000Z'),
        dailyPriceMinor: BigInt(500_000),
        depositMinor: BigInt(2_000_000),
        cascoPolicyNumber: null,
      },
      period,
    );

    expect(result).toMatchObject({
      ready: false,
      blockers: [expect.objectContaining({ code: 'VEHICLE_VIN_MISSING' })],
      warnings: [expect.objectContaining({ code: 'VEHICLE_CASCO_MISSING' })],
    });
  });

  it('rejects an OSAGO policy that does not cover the rental period', () => {
    const result = evaluateVehicleReadiness(
      {
        id: 'vehicle-1',
        archivedAt: null,
        isRentalReady: true,
        registrationNumber: 'А001АА997',
        vin: 'XWE12345678901234',
        registrationCertificateNumber: 'СТС-1',
        vehiclePassportNumber: 'ПТС-1',
        osagoInsurer: 'Страховая',
        osagoPolicyNumber: 'ОСАГО-1',
        osagoStartsAt: new Date('2026-01-01T00:00:00.000Z'),
        osagoEndsAt: new Date('2026-09-04T00:00:00.000Z'),
        dailyPriceMinor: BigInt(500_000),
        depositMinor: BigInt(2_000_000),
        cascoPolicyNumber: 'КАСКО-1',
      },
      period,
    );

    expect(result.blockers).toContainEqual(
      expect.objectContaining({ code: 'VEHICLE_OSAGO_PERIOD_INVALID' }),
    );
  });
});

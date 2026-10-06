import { beforeEach, describe, expect, it, vi } from 'vitest';

const vehicleFindMany = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/database/prisma/client', () => ({
  prisma: { vehicle: { findMany: vehicleFindMany } },
}));

import { listRentalDraftVehicleOptions } from './draft-vehicle-options';

describe('rental draft vehicle options', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only active real vehicles and keeps legally incomplete cars selectable for drafts', async () => {
    vehicleFindMany.mockResolvedValue([
      {
        id: 'vehicle-1',
        make: 'Kia',
        modelName: 'Ceed',
        model: 'Kia Ceed',
        registrationNumber: 'А429АУ997',
        vin: null,
        dailyPriceMinor: 300000,
        isRentalReady: false,
        status: 'IDLE',
        registrationCertificateNumber: null,
        vehiclePassportNumber: null,
        osagoInsurer: null,
        osagoPolicyNumber: null,
        osagoStartsAt: null,
        osagoEndsAt: null,
        cascoInsurer: null,
        cascoPolicyNumber: null,
        cascoStartsAt: null,
        cascoEndsAt: null,
        rentals: [],
        washRecords: [],
      },
    ]);

    await expect(listRentalDraftVehicleOptions('company-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'vehicle-1',
        label: 'Kia Ceed А429АУ997',
        available: true,
        reasons: [],
        legalReady: false,
        readiness: expect.objectContaining({
          ready: false,
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: 'VEHICLE_NOT_ENABLED' }),
            expect.objectContaining({ code: 'VEHICLE_VIN_MISSING' }),
          ]),
        }),
      }),
    ]);
    expect(vehicleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-1', archivedAt: null, isDemoImport: false },
      }),
    );
  });
});

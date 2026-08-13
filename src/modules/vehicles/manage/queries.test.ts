import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createVehicleManagementQueries } from './queries';

describe('tenant-scoped queries управления автопарком', () => {
  it('скрывает архив и сериализует Decimal, BigInt и Date в безопасный DTO', async () => {
    let args: unknown;
    const queries = createVehicleManagementQueries({
      async findMany(input) {
        args = input;
        return [
          {
            id: 'vehicle-1',
            internalNumber: 'RNT-001',
            make: 'Kia',
            modelName: "Cee'd",
            registrationNumber: 'А429АУ97',
            manufacturedYear: 2020,
            odometerKm: { toString: () => '15000.5' },
            valueMinor: BigInt(120000000),
            dailyPriceMinor: 350000,
            rangePriceMinor: BigInt(420050),
            depositMinor: BigInt(1000000),
            city: 'Москва',
            isRentalReady: true,
            status: 'UNKNOWN',
            archivedAt: null,
            updatedAt: new Date('2026-08-13T10:00:00.000Z'),
          },
        ];
      },
    });

    const vehicles = await queries.listForCompany('company-1');

    expect(args).toMatchObject({ where: { companyId: 'company-1', archivedAt: null } });
    expect(vehicles).toEqual([
      expect.objectContaining({
        odometerKm: 15000.5,
        valueMinor: '120000000',
        rangePriceMinor: '420050',
        depositMinor: '1000000',
        updatedAt: '2026-08-13T10:00:00.000Z',
      }),
    ]);
    expect(args).not.toMatchObject({ select: { vin: true } });
    expect(args).not.toMatchObject({ select: { registrationCertificateNumber: true } });
    expect(args).toMatchObject({ select: { rangePriceMinor: true } });
  });
});

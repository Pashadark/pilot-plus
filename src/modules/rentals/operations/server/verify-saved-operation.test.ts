import { describe, expect, it, vi } from 'vitest';

import { verifySavedRentalOperation } from './verify-saved-operation';

describe('verifySavedRentalOperation', () => {
  it('confirms the committed operation, vehicle mileage and every uploaded file', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      mileageKm: 83_273,
      vehicle: { id: 'vehicle-1', odometerKm: 83_273 },
      media: [{ id: 'photo-1' }, { id: 'video-1' }],
    });

    await expect(
      verifySavedRentalOperation(
        { findFirst },
        {
          companyId: 'company-1',
          rentalId: 'rental-1',
          operationId: 'operation-1',
          expectedMileageKm: 83_273,
          expectedMediaCount: 2,
        },
      ),
    ).resolves.toEqual({ mileageKm: 83_273, savedMediaCount: 2, vehicleId: 'vehicle-1' });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'operation-1',
          companyId: 'company-1',
          rentalId: 'rental-1',
          status: 'COMMITTED',
        },
      }),
    );
  });

  it.each([
    ['the operation is missing', null],
    [
      'the operation mileage differs',
      {
        mileageKm: 83_272,
        vehicle: { id: 'vehicle-1', odometerKm: 83_273 },
        media: [{ id: 'photo-1' }],
      },
    ],
    [
      'the vehicle mileage differs',
      {
        mileageKm: 83_273,
        vehicle: { id: 'vehicle-1', odometerKm: 83_272 },
        media: [{ id: 'photo-1' }],
      },
    ],
    [
      'an uploaded file is missing',
      {
        mileageKm: 83_273,
        vehicle: { id: 'vehicle-1', odometerKm: 83_273 },
        media: [],
      },
    ],
  ])('rejects success when %s', async (_label, stored) => {
    await expect(
      verifySavedRentalOperation(
        { findFirst: vi.fn().mockResolvedValue(stored) },
        {
          companyId: 'company-1',
          rentalId: 'rental-1',
          operationId: 'operation-1',
          expectedMileageKm: 83_273,
          expectedMediaCount: 1,
        },
      ),
    ).rejects.toThrow('Сервер не подтвердил сохранение операции');
  });
});

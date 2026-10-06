import { describe, expect, it } from 'vitest';
import {
  buildRentalArchiveStatusFilter,
  buildRentalVehicleFilter,
  parseRentalListMoscowBoundary,
  rentalListSelect,
} from './queries';

describe('buildRentalVehicleFilter', () => {
  it('применяет выбранный автомобиль к серверному запросу', () => {
    expect(buildRentalVehicleFilter({ vehicleId: 'vehicle-42' })).toBe('vehicle-42');
    expect(buildRentalVehicleFilter({ vehicleId: '  ' })).toBeUndefined();
  });
});

describe('parseRentalListMoscowBoundary', () => {
  it('rejects malformed dates and returns the exclusive next Moscow day', () => {
    expect(parseRentalListMoscowBoundary('2026-02-30')).toBeNull();
    expect(parseRentalListMoscowBoundary('2026/08/01')).toBeNull();
    expect(parseRentalListMoscowBoundary('2026-08-01', true)?.toISOString()).toBe(
      '2026-08-01T21:00:00.000Z',
    );
  });
});

describe('buildRentalArchiveStatusFilter', () => {
  it('по умолчанию скрывает закрытые договоры, а архив показывает только их', () => {
    expect(buildRentalArchiveStatusFilter({})).toEqual({ notIn: ['COMPLETED', 'CANCELLED'] });
    expect(buildRentalArchiveStatusFilter({ archive: '1' })).toEqual({
      in: ['COMPLETED', 'CANCELLED'],
    });
  });

  it('явно выбранный статус имеет приоритет над разделом', () => {
    expect(buildRentalArchiveStatusFilter({ status: 'COMPLETED' })).toBe('COMPLETED');
  });
});

describe('rentalListSelect', () => {
  it('loads the operational facts and primary vehicle image required by the timeline table', () => {
    expect(rentalListSelect.dailyRateMinor).toBe(true);
    expect(rentalListSelect.client.select).toEqual(
      expect.objectContaining({
        id: true,
        firstName: true,
        lastName: true,
        phoneEncrypted: true,
      }),
    );
    expect(rentalListSelect.vehicle.select).toEqual(
      expect.objectContaining({
        id: true,
        internalNumber: true,
        city: true,
        images: expect.objectContaining({
          orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
          take: 1,
        }),
      }),
    );
    expect(rentalListSelect.payments).toEqual(
      expect.objectContaining({ where: { status: 'CONFIRMED' } }),
    );
    expect(rentalListSelect.operations).toEqual(
      expect.objectContaining({ where: { status: 'COMMITTED' } }),
    );
  });
});

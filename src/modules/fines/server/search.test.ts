import { describe, expect, it } from 'vitest';

import { buildFineSearchWhere, matchesTollSearch } from './search';

describe('fine universal search', () => {
  it('searches every operational field from one query', () => {
    expect(buildFineSearchWhere('Camry')).toEqual({
      OR: expect.arrayContaining([
        { decreeNumber: { contains: 'Camry', mode: 'insensitive' } },
        { uin: { contains: 'Camry', mode: 'insensitive' } },
        { description: { contains: 'Camry', mode: 'insensitive' } },
        { address: { contains: 'Camry', mode: 'insensitive' } },
        { vehicle: { registrationNumberNormalized: { contains: 'CAMRY' } } },
        { vehicle: { make: { contains: 'Camry', mode: 'insensitive' } } },
        { vehicle: { modelName: { contains: 'Camry', mode: 'insensitive' } } },
        { vehicle: { model: { contains: 'Camry', mode: 'insensitive' } } },
        { client: { lastName: { contains: 'Camry', mode: 'insensitive' } } },
        { client: { firstName: { contains: 'Camry', mode: 'insensitive' } } },
        { client: { middleName: { contains: 'Camry', mode: 'insensitive' } } },
        { rental: { contractNumber: { contains: 'Camry', mode: 'insensitive' } } },
      ]),
    });
  });

  it('recognises Russian and ISO dates in Moscow time', () => {
    expect(buildFineSearchWhere('08.10.2026')).toEqual({
      offenseAt: {
        gte: new Date('2026-10-07T21:00:00.000Z'),
        lt: new Date('2026-10-08T21:00:00.000Z'),
      },
    });
    expect(buildFineSearchWhere('2026-10-08')).toEqual({
      offenseAt: {
        gte: new Date('2026-10-07T21:00:00.000Z'),
        lt: new Date('2026-10-08T21:00:00.000Z'),
      },
    });
  });

  it('finds toll debt by road, renter, vehicle, contract or date', () => {
    const toll = {
      vehicleLabel: 'Kia K5 · М022АН997',
      clientLabel: 'Мамаев Саид',
      rentalLabel: 'ME-2026-0076',
      roadLabel: 'М-12 Восток',
      description: 'Платный проезд',
      offenseAt: '2026-10-08T09:00:00.000Z',
      checkedAt: '2026-10-09T09:00:00.000Z',
    };

    expect(matchesTollSearch(toll, 'м-12')).toBe(true);
    expect(matchesTollSearch(toll, '08.10.2026')).toBe(true);
    expect(matchesTollSearch(toll, 'Camry')).toBe(false);
  });
});

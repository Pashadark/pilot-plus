import { describe, expect, it } from 'vitest';

import { buildCamryDamageImport } from './camry-damage-import';

describe('импорт повреждения Camry от 12.09.2026', () => {
  it('связывает только указанную машину, договор и клиента', () => {
    expect(
      buildCamryDamageImport({
        vehicle: {
          id: 'cmtdgxote000ttu18133knumk',
          companyId: 'company-1',
          registrationNumber: 'Х069АЕ997',
        },
        rental: {
          id: '0fae8f8b-70e4-4c1c-80ee-85129c00a496',
          vehicleId: 'cmtdgxote000ttu18133knumk',
          clientId: 'cmtg3v9sg0013tuuwxjoi49fh',
        },
      }),
    ).toMatchObject({
      vehicleId: 'cmtdgxote000ttu18133knumk',
      rentalId: '0fae8f8b-70e4-4c1c-80ee-85129c00a496',
      clientId: 'cmtg3v9sg0013tuuwxjoi49fh',
      recordType: 'REPAIR',
      status: 'IN_PROGRESS',
      damageReportedAt: new Date('2026-09-12T09:00:00.000Z'),
    });
  });

  it('останавливается при несовпадении договора с автомобилем', () => {
    expect(() =>
      buildCamryDamageImport({
        vehicle: {
          id: 'cmtdgxote000ttu18133knumk',
          companyId: 'company-1',
          registrationNumber: 'Х069АЕ997',
        },
        rental: {
          id: '0fae8f8b-70e4-4c1c-80ee-85129c00a496',
          vehicleId: 'other',
          clientId: 'cmtg3v9sg0013tuuwxjoi49fh',
        },
      }),
    ).toThrow('Договор не относится к Camry');
  });
});

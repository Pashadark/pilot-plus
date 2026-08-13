import { describe, expect, it } from 'vitest';

import {
  createFleetImportPreview,
  signFleetImportPreview,
  verifyFleetImportPreview,
} from './preview';

const rows = [
  {
    rowNumber: 2,
    make: 'Kia',
    model: "Cee'd",
    registrationNumberNormalized: 'А429АУ97',
    vinNormalized: null,
    year: 2020,
  },
  {
    rowNumber: 3,
    make: 'Skoda',
    model: 'Octavia',
    registrationNumberNormalized: 'Е435АН997',
    vinNormalized: 'VIN-2',
    year: 2019,
  },
];

describe('fleet import preview', () => {
  it('classifies additions, updates, unchanged, contradictory matches and optional-only archive', () => {
    const result = createFleetImportPreview(rows, [
      {
        id: 'same',
        registrationNumberNormalized: 'А429АУ97',
        vinNormalized: null,
        make: 'Kia',
        modelName: "Cee'd",
        manufacturedYear: 2020,
      },
      {
        id: 'by-vin',
        registrationNumberNormalized: 'Х000ХХ77',
        vinNormalized: 'VIN-2',
        make: 'Skoda',
        modelName: 'Rapid',
        manufacturedYear: 2019,
      },
      {
        id: 'archive',
        registrationNumberNormalized: 'М283АМ997',
        vinNormalized: null,
        make: 'Mercedes-Benz',
        modelName: 'E 220 d 4MATIC',
        manufacturedYear: 2019,
      },
    ]);

    expect(result.rows.map((row) => row.operation)).toEqual(['UNCHANGED', 'UPDATE']);
    expect(result.optionalArchives).toEqual([{ id: 'archive', internalNumber: undefined }]);
  });

  it('marks conflicting plate and VIN matches as an error', () => {
    const result = createFleetImportPreview(
      [rows[1]!],
      [
        {
          id: 'plate',
          registrationNumberNormalized: 'Е435АН997',
          vinNormalized: 'VIN-1',
          make: 'Skoda',
          modelName: 'Octavia',
          manufacturedYear: 2019,
        },
        {
          id: 'vin',
          registrationNumberNormalized: 'Х000ХХ77',
          vinNormalized: 'VIN-2',
          make: 'Skoda',
          modelName: 'Octavia',
          manufacturedYear: 2019,
        },
      ],
    );
    expect(result.rows[0]).toMatchObject({ operation: 'ERROR', code: 'CONTRADICTORY_MATCH' });
  });

  it('binds an opaque preview token to company, user, expiry and payload hash', () => {
    const token = signFleetImportPreview(
      { companyId: 'company-1', userId: 'user-1', expiresAt: 2_000, rows, archiveIds: [] },
      'test-secret',
    );
    expect(token).not.toContain('company-1');
    expect(token).not.toContain('user-1');
    expect(verifyFleetImportPreview(token, 'test-secret', 1_500)).toMatchObject({
      companyId: 'company-1',
    });
    expect(() => verifyFleetImportPreview(`${token}x`, 'test-secret', 1_500)).toThrow(
      'недействителен',
    );
    expect(() => verifyFleetImportPreview(token, 'test-secret', 2_000)).toThrow('истёк');
  });

  it('does not allow multiple import rows to mutate the same existing vehicle', () => {
    const result = createFleetImportPreview(
      [
        { ...rows[0]!, vinNormalized: 'VIN-1' },
        { ...rows[1]!, vinNormalized: 'VIN-1' },
      ],
      [
        {
          id: 'one',
          registrationNumberNormalized: 'А429АУ97',
          vinNormalized: 'VIN-1',
          make: 'Kia',
          modelName: "Cee'd",
          manufacturedYear: 2020,
        },
      ],
    );
    expect(result.rows[1]).toMatchObject({ operation: 'ERROR', code: 'DUPLICATE_EXISTING_MATCH' });
  });
});

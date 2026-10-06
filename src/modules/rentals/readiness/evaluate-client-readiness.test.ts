import { describe, expect, it } from 'vitest';

import { evaluateClientReadiness } from './evaluate-client-readiness';

describe('evaluateClientReadiness', () => {
  it('requires current clean passport and driver license files', () => {
    const result = evaluateClientReadiness(
      {
        id: 'client-1',
        status: 'VERIFIED',
        phone: '+7 999 000-00-00',
        passport: '4500 123456',
        driverLicense: '7700 123456',
        driverLicenseExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
        documents: [],
      },
      new Date('2026-09-02T00:00:00.000Z'),
    );

    expect(result).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'CLIENT_PASSPORT_FILE_MISSING' }),
        expect.objectContaining({ code: 'CLIENT_LICENSE_FILE_MISSING' }),
      ]),
    });
  });

  it('accepts only the clean current version and reports an expired license', () => {
    const result = evaluateClientReadiness(
      {
        id: 'client-1',
        status: 'VERIFIED',
        phone: '+7 999 000-00-00',
        passport: '4500 123456',
        driverLicense: '7700 123456',
        driverLicenseExpiresAt: new Date('2026-09-01T00:00:00.000Z'),
        documents: [
          {
            category: 'PASSPORT',
            archivedAt: null,
            currentVersion: 2,
            versions: [
              { version: 1, scanVerdict: 'CLEAN' },
              { version: 2, scanVerdict: 'ERROR' },
            ],
          },
          {
            category: 'DRIVER_LICENSE',
            archivedAt: null,
            currentVersion: 1,
            versions: [{ version: 1, scanVerdict: 'CLEAN' }],
          },
        ],
      },
      new Date('2026-09-02T00:00:00.000Z'),
    );

    expect(result.blockers.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['CLIENT_PASSPORT_FILE_UNCLEAN', 'CLIENT_LICENSE_EXPIRED']),
    );
  });

  it('is ready when required data and both clean current documents exist', () => {
    const result = evaluateClientReadiness(
      {
        id: 'client-1',
        status: 'VERIFIED',
        phone: '+7 999 000-00-00',
        passport: '4500 123456',
        driverLicense: '7700 123456',
        driverLicenseExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
        documents: ['PASSPORT', 'DRIVER_LICENSE'].map((category) => ({
          category,
          archivedAt: null,
          currentVersion: 1,
          versions: [{ version: 1, scanVerdict: 'CLEAN' }],
        })),
      },
      new Date('2026-09-02T00:00:00.000Z'),
    );

    expect(result).toMatchObject({ ready: true, blockers: [] });
  });
});

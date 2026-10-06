import { describe, expect, it } from 'vitest';

import { evaluateRentalPreflight } from './evaluate-rental-preflight';

describe('evaluateRentalPreflight', () => {
  it('combines blockers and warnings without losing their correction links', () => {
    const result = evaluateRentalPreflight({
      client: {
        ready: false,
        blockers: [
          {
            code: 'CLIENT_DOC',
            message: 'Нет паспорта',
            href: '/clients/c1?tab=documents',
            severity: 'BLOCKER',
          },
        ],
        warnings: [],
      },
      vehicle: {
        ready: true,
        blockers: [],
        warnings: [
          {
            code: 'NO_CASCO',
            message: 'Нет КАСКО',
            href: '/vehicles/v1/edit#insurance',
            severity: 'WARNING',
          },
        ],
      },
      companyReady: true,
      templateReady: false,
      calculationReady: true,
      available: true,
    });

    expect(result.ready).toBe(false);
    expect(result.blockers.map((issue) => issue.code)).toEqual([
      'CLIENT_DOC',
      'RENTAL_TEMPLATE_MISSING',
    ]);
    expect(result.warnings.map((issue) => issue.code)).toEqual(['NO_CASCO']);
  });
});

import { describe, expect, it } from 'vitest';

import { normalizeClientSearchParams } from './client-query';

describe('normalizeClientSearchParams', () => {
  it('keeps only valid client filters and normalizes invalid values on the server', () => {
    expect(
      normalizeClientSearchParams({
        q: ' Анна ',
        status: 'VERIFIED',
        documents: 'present',
        license: 'missing',
        page: '2',
      }),
    ).toEqual({ q: 'Анна', status: 'VERIFIED', documents: 'present', license: 'missing', page: 2 });
    expect(
      normalizeClientSearchParams({
        status: 'invalid',
        documents: 'yes',
        license: 'soon',
        page: '-1',
      }),
    ).toEqual({
      page: 1,
    });
  });
});

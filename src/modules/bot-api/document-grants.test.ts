import { afterEach, describe, expect, it, vi } from 'vitest';

import { signRentalDocumentGrant, verifyRentalDocumentGrant } from './document-grants';

describe('rental document grants', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts an exact unexpired claim and rejects tampering or expiry', () => {
    vi.stubEnv('PILOT_BOT_INVITE_SECRET', 'document-grant-secret-long-enough');
    const claims = {
      companyId: 'c1',
      clientId: 'cl1',
      rentalId: 'r1',
      version: 2,
      format: 'PDF' as const,
      expiresAt: 1_200_000,
    };
    const grant = signRentalDocumentGrant(claims);
    expect(() => verifyRentalDocumentGrant(claims, grant, 1_000_000)).not.toThrow();
    expect(() =>
      verifyRentalDocumentGrant({ ...claims, rentalId: 'r2' }, grant, 1_000_000),
    ).toThrow();
    expect(() => verifyRentalDocumentGrant(claims, grant, 1_200_000)).toThrow();
  });
});

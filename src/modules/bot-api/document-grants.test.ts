import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  signRentalDocumentGrant,
  verifyRentalDocumentGrant,
  authorizeRentalDocumentGrant,
} from './document-grants';

describe('rental document grants', () => {
  it('rejects a revoked identity even with a valid signed link', async () => {
    vi.stubEnv('PILOT_BOT_INVITE_SECRET', 'document-grant-secret-long-enough');
    const claims = {
      identityId: 'i',
      companyId: 'c',
      clientId: 'cl',
      rentalId: 'r',
      version: 1,
      format: 'PDF' as const,
      expiresAt: Date.now() + 60000,
    };
    const db = { telegramIdentity: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(
      authorizeRentalDocumentGrant(claims, signRentalDocumentGrant(claims), db as never),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('accepts an exact unexpired claim and rejects tampering or expiry', () => {
    vi.stubEnv('PILOT_BOT_INVITE_SECRET', 'document-grant-secret-long-enough');
    const claims = {
      identityId: 'i1',
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

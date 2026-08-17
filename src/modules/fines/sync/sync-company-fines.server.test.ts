import { beforeEach, describe, expect, it, vi } from 'vitest';

const findIntegration = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    fineIntegration: {
      findUnique: findIntegration,
      update: vi.fn(),
    },
  },
}));

import { syncCompanyFines } from './sync-company-fines.server';

describe('production company fine sync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fails closed before network access when the company integration is disabled', async () => {
    findIntegration.mockResolvedValue({ tokenEncrypted: 'encrypted', enabled: false });

    await expect(syncCompanyFines('company-a')).rejects.toThrow(
      'Интеграция Driver Helper не настроена.',
    );
  });
});

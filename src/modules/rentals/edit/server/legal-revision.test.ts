import { describe, expect, it, vi } from 'vitest';

import { enableRentalLegalRevision } from './legal-revision';

describe('enableRentalLegalRevision', () => {
  it('opens the immutable-field guard only through the current transaction', async () => {
    const transaction = { $queryRaw: vi.fn().mockResolvedValue([{ set_config: 'on' }]) };

    await enableRentalLegalRevision(transaction as never);

    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
  });
});

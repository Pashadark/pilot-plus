import { describe, expect, it, vi } from 'vitest';

import { listClientComments } from './queries';

describe('выборка комментариев клиента', () => {
  it('ограничивает комментарии tenant и по умолчанию скрывает архивные', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await listClientComments(
      { scope: 'COMPANY', companyIds: ['company-1'], user: { id: 'user-1' } },
      'client-1',
      false,
      { findMany },
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId: 'client-1',
          companyId: { in: ['company-1'] },
          hiddenAt: null,
        },
      }),
    );
  });
});

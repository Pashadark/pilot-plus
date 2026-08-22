import { describe, expect, it, vi } from 'vitest';

import { getClientRating, listClientRatings } from './queries';

const companyAccess = {
  scope: 'COMPANY' as const,
  companyIds: ['company-a'],
  user: { id: 'user-a' },
  canManage: false,
};

describe('client rating queries', () => {
  it('treats a client from another company as absent', async () => {
    const repository = { findFirst: vi.fn().mockResolvedValue(null) };

    await expect(
      getClientRating(companyAccess as never, 'client-b', repository),
    ).resolves.toBeNull();
    expect(repository.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'client-b', companyId: { in: ['company-a'] } }),
      }),
    );
  });

  it('projects only requested tenant-visible clients in one bounded query', async () => {
    const repository = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'client-a',
          _count: { rentals: 2 },
          ratingEvents: [{ delta: 8 }, { delta: 2 }],
        },
      ]),
    };

    const ratings = await listClientRatings(
      companyAccess as never,
      ['client-a', 'client-b'],
      repository,
    );

    expect(ratings.get('client-a')).toMatchObject({
      score: 65,
      completedRentals: 2,
      eventCount: 2,
    });
    expect(ratings.has('client-b')).toBe(false);
    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['client-a', 'client-b'] },
          companyId: { in: ['company-a'] },
        }),
      }),
    );
  });
});

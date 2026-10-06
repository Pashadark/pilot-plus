import { expect, it, vi } from 'vitest';
import { listClientFines } from './client-fines';
const identity = { kind: 'CLIENT', companyId: 'c', clientId: 'cl' } as never;
it('selects only own manager-confirmed fines and excludes internal fields', async () => {
  const findMany = vi.fn().mockResolvedValue([]);
  await listClientFines(identity, 0, { fine: { findMany } } as never);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        companyId: 'c',
        clientId: 'cl',
        assignmentConfirmedAt: { not: null },
        assignmentConfirmedByUserId: { not: null },
      },
    }),
  );
  expect(findMany.mock.calls[0][0].select).not.toHaveProperty('comment');
});
it('denies staff and unidentified clients before querying', async () => {
  const findMany = vi.fn();
  await expect(
    listClientFines({ kind: 'STAFF' } as never, 0, { fine: { findMany } } as never),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(findMany).not.toHaveBeenCalled();
});

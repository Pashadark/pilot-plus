import { describe, expect, it, vi } from 'vitest';

import { createOperationMediaRepository } from './execute-operation';

describe('operation media Prisma adapter', () => {
  it('places operation and media ownership filters inside Prisma where clauses', async () => {
    const rentalOperation = { findFirst: vi.fn().mockResolvedValue(null) };
    const rentalOperationMedia = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      updateMany: vi.fn(),
    };
    const repository = createOperationMediaRepository({
      rentalOperation,
      rentalOperationMedia,
    } as never);

    await repository.findOperation({
      companyId: 'company-1',
      operationId: 'operation-1',
      actorUserId: 'actor-1',
      status: 'DRAFT',
    });
    await repository.findMedia({
      companyId: 'company-1',
      operationId: 'operation-1',
      kind: 'DASHBOARD_PHOTO',
    });

    expect(rentalOperation.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        id: 'operation-1',
        actorUserId: 'actor-1',
        status: 'DRAFT',
      },
    });
    expect(rentalOperationMedia.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        operationId: 'operation-1',
        kind: 'DASHBOARD_PHOTO',
      },
    });
  });
});

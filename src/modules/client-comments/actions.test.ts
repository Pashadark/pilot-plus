import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAccess = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('@/modules/clients/access', () => ({ getClientAccess: getAccess }));
vi.mock('@/database/prisma/client', () => ({ prisma: { $transaction: transaction } }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { createClientCommentAction, hideClientCommentAction } from './actions';

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function database() {
  return {
    client: { findFirst: vi.fn().mockResolvedValue({ id: 'client-1', companyId: 'company-1' }) },
    rental: { findFirst: vi.fn().mockResolvedValue(null) },
    clientComment: {
      create: vi.fn().mockResolvedValue({ id: 'comment-1' }),
      findFirst: vi.fn().mockResolvedValue({
        id: 'comment-1',
        companyId: 'company-1',
        clientId: 'client-1',
        authorUserId: 'user-1',
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    companyMember: { findFirst: vi.fn().mockResolvedValue({ role: 'DISPATCHER' }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
}

describe('действия внутренних комментариев', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccess.mockResolvedValue({
      scope: 'COMPANY',
      companyIds: ['company-1'],
      canManage: true,
      user: { id: 'user-1', email: 'dispatcher@pilot.test' },
    });
  });

  it('создаёт комментарий и PII-safe аудит атомарно', async () => {
    const db = database();
    transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    const result = await createClientCommentAction(
      form({
        clientId: 'client-1',
        category: 'DAMAGE',
        severity: 'WARNING',
        text: 'Царапина на двери',
      }),
    );
    expect(result).toMatchObject({ ok: true, commentId: 'comment-1' });
    expect(db.clientComment.create).toHaveBeenCalled();
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('Царапина');
  });

  it('диспетчер скрывает свой комментарий в той же транзакции', async () => {
    const db = database();
    transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    const result = await hideClientCommentAction(
      form({ clientId: 'client-1', commentId: 'comment-1' }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(db.clientComment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorUserId: 'user-1' }) }),
    );
    expect(db.auditLog.create).toHaveBeenCalled();
  });
});

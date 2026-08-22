import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAccess = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('@/modules/clients/access', () => ({ getClientAccess: getAccess }));
vi.mock('@/database/prisma/client', () => ({ prisma: { $transaction: transaction } }));
vi.mock('next/cache', () => ({ revalidatePath }));

import {
  createClientCommentAction,
  hideClientCommentAction,
  resolveClientCommentAction,
  updateClientCommentAction,
} from './actions';

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function database() {
  return {
    client: { findFirst: vi.fn().mockResolvedValue({ id: 'client-1', companyId: 'company-1' }) },
    rental: { findFirst: vi.fn().mockResolvedValue({ id: 'rental-1' }) },
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
    clientRatingEvent: { create: vi.fn().mockResolvedValue({ id: 'rating-event-1' }) },
    companyMember: {
      findFirst: vi.fn(({ where }: { where: { role?: string } }) =>
        Promise.resolve(where.role === 'COMPANY_ADMIN' ? null : { role: 'DISPATCHER' }),
      ),
    },
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

  it('создаёт администраторскую проблемную заметку и один ручной ledger event атомарно', async () => {
    const db = database();
    transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    getAccess.mockResolvedValue({
      scope: 'SYSTEM',
      companyIds: [],
      canManage: true,
      user: { id: 'admin-1', email: 'admin@pilot.test' },
    });

    const result = await createClientCommentAction(
      form({
        clientId: 'client-1',
        rentalId: 'rental-1',
        category: 'PAYMENT',
        severity: 'WARNING',
        text: 'Отказывается оплачивать подтверждённый штраф',
        affectsRating: 'on',
        ratingDelta: '-15',
      }),
    );

    expect(result).toMatchObject({ ok: true, commentId: 'comment-1' });
    expect(db.clientComment.create).toHaveBeenCalledBefore(db.clientRatingEvent.create);
    expect(db.clientRatingEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'MANUAL',
        type: 'MANUAL_NEGATIVE',
        reason: 'MANUAL_COMMENT',
        delta: -15,
        commentId: 'comment-1',
        idempotencyKey: 'manual-comment:comment-1',
      }),
    });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('Отказывается');
  });

  it('не позволяет диспетчеру создавать ручное влияние на рейтинг', async () => {
    const db = database();
    transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    getAccess.mockResolvedValue({
      scope: 'COMPANY',
      companyIds: ['company-1'],
      canManage: true,
      user: { id: 'user-1', email: 'dispatcher@pilot.test' },
    });

    const result = await createClientCommentAction(
      form({
        clientId: 'client-1',
        category: 'POSITIVE',
        text: 'Аккуратный возврат',
        affectsRating: 'on',
        ratingDelta: '5',
      }),
    );

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(db.clientComment.create).not.toHaveBeenCalled();
  });

  it('не позволяет диспетчеру менять влияние на рейтинг при редактировании', async () => {
    const db = database();
    transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    getAccess.mockResolvedValue({
      scope: 'COMPANY',
      companyIds: ['company-1'],
      canManage: true,
      user: { id: 'user-1', email: 'dispatcher@pilot.test' },
    });

    const result = await updateClientCommentAction(
      form({
        clientId: 'client-1',
        commentId: 'comment-1',
        category: 'PAYMENT',
        text: 'Оплата после напоминания',
        affectsRating: 'on',
        ratingDelta: '-5',
      }),
    );

    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(db.clientComment.updateMany).not.toHaveBeenCalled();
  });

  it('открывает проблему при изменении обычной заметки на проблемную категорию', async () => {
    const db = database();
    db.clientComment.findFirst.mockResolvedValue({ problemStatus: null });
    transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));

    await expect(
      updateClientCommentAction(
        form({
          clientId: 'client-1',
          commentId: 'comment-1',
          category: 'PAYMENT',
          text: 'Нужно уточнить оплату',
        }),
      ),
    ).resolves.toMatchObject({ ok: true });

    expect(db.clientComment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          problemStatus: 'OPEN',
          resolvedAt: null,
          resolvedByUserId: null,
        }),
      }),
    );
  });

  it('очищает lifecycle при изменении открытой проблемы на обычную заметку', async () => {
    const db = database();
    db.clientComment.findFirst.mockResolvedValue({ problemStatus: 'OPEN' });
    transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));

    await expect(
      updateClientCommentAction(
        form({
          clientId: 'client-1',
          commentId: 'comment-1',
          category: 'GENERAL',
          text: 'Вопрос закрыт',
        }),
      ),
    ).resolves.toMatchObject({ ok: true });

    expect(db.clientComment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          problemStatus: null,
          resolvedAt: null,
          resolvedByUserId: null,
        }),
      }),
    );
  });

  it('сохраняет RESOLVED при изменении категории решённой проблемы', async () => {
    const db = database();
    const resolvedAt = new Date('2026-08-22T10:00:00.000Z');
    db.clientComment.findFirst.mockResolvedValue({
      problemStatus: 'RESOLVED',
      resolvedAt,
      resolvedByUserId: 'user-2',
    });
    transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));

    await expect(
      updateClientCommentAction(
        form({
          clientId: 'client-1',
          commentId: 'comment-1',
          category: 'DAMAGE',
          text: 'Уточнена категория замечания',
        }),
      ),
    ).resolves.toMatchObject({ ok: true });

    expect(db.clientComment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          problemStatus: 'RESOLVED',
          resolvedAt,
          resolvedByUserId: 'user-2',
        }),
      }),
    );
  });

  it('не перезаписывает проблему, решённую между чтением и updateMany', async () => {
    const db = database();
    db.clientComment.findFirst.mockResolvedValue({ problemStatus: 'OPEN' });
    db.clientComment.updateMany.mockImplementation(
      ({ where }: { where: { problemStatus?: string | null } }) =>
        Promise.resolve({ count: where.problemStatus === 'OPEN' ? 0 : 1 }),
    );
    transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));

    await expect(
      updateClientCommentAction(
        form({
          clientId: 'client-1',
          commentId: 'comment-1',
          category: 'GENERAL',
          text: 'Не должен стереть решение коллеги',
        }),
      ),
    ).resolves.toMatchObject({ ok: false, code: 'NOT_FOUND' });

    expect(db.clientComment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ problemStatus: 'OPEN' }) }),
    );
  });

  it('решает только открытую видимую проблему без изменения rating event', async () => {
    const db = database();
    transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));

    const result = await resolveClientCommentAction(
      form({ clientId: 'client-1', commentId: 'comment-1' }),
    );

    expect(result).toMatchObject({ ok: true, commentId: 'comment-1' });
    expect(db.clientComment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'comment-1',
          companyId: 'company-1',
          clientId: 'client-1',
          hiddenAt: null,
          problemStatus: 'OPEN',
        }),
        data: expect.objectContaining({ problemStatus: 'RESOLVED', resolvedByUserId: 'user-1' }),
      }),
    );
    expect(db.clientRatingEvent.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalled();
  });
});

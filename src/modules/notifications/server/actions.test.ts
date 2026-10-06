import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAdminCenterAccess: vi.fn(),
  auditLogFindFirst: vi.fn(),
  receiptUpsert: vi.fn(),
  markEventReadAction: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/modules/admin/access', () => ({ getAdminCenterAccess: mocks.getAdminCenterAccess }));
vi.mock('@/modules/events/actions', () => ({
  markEventReadAction: mocks.markEventReadAction,
  markEventsReadAction: vi.fn(),
}));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    auditLog: { findFirst: mocks.auditLogFindFirst },
    eventReadReceipt: { upsert: mocks.receiptUpsert },
  },
}));

import { markNotificationReadAction } from './actions';

describe('markNotificationReadAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminCenterAccess.mockResolvedValue({
      user: { id: 'super-1' },
      scope: 'SYSTEM',
      companyIds: [],
    });
    mocks.receiptUpsert.mockResolvedValue({});
  });

  it('сохраняет прочтение доступного audit-уведомления', async () => {
    mocks.auditLogFindFirst.mockResolvedValue({ companyId: 'company-2' });

    await expect(markNotificationReadAction('audit:audit-1')).resolves.toMatchObject({
      status: 'success',
    });
    expect(mocks.receiptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_eventKey: { userId: 'super-1', eventKey: 'audit:audit-1' } },
        create: expect.objectContaining({ companyId: 'company-2' }),
      }),
    );
  });

  it('передаёт обычные события существующей защищённой action', async () => {
    mocks.markEventReadAction.mockResolvedValue({ status: 'success', message: 'Готово' });
    await markNotificationReadAction('vehicle-event:event-1');
    expect(mocks.markEventReadAction).toHaveBeenCalledWith('vehicle-event:event-1');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAdminCenterAccess: vi.fn(),
  auditLogFindFirst: vi.fn(),
  receiptUpsert: vi.fn(),
  markEventReadAction: vi.fn(),
  markLowFuelNotificationsRead: vi.fn(),
  getNotificationPage: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('./queries', () => ({ getNotificationPage: mocks.getNotificationPage }));
vi.mock('./low-fuel', () => ({ markLowFuelNotificationsRead: mocks.markLowFuelNotificationsRead }));
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

import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  markEntireInboxReadAction,
} from './actions';

describe('markNotificationReadAction', () => {
  it('marks the complete inbox across server pages, not only visible ids', async () => {
    mocks.getAdminCenterAccess.mockResolvedValue(null);
    mocks.markLowFuelNotificationsRead.mockResolvedValue(true);
    const cursor = { before: '2026-10-18T00:00:00.000Z', beforeKey: 'low-fuel:a' };
    mocks.getNotificationPage
      .mockResolvedValueOnce({ items: [{ id: 'low-fuel:a', isRead: false }], nextCursor: cursor })
      .mockResolvedValueOnce({ items: [{ id: 'low-fuel:b', isRead: false }], nextCursor: null });
    expect(await markEntireInboxReadAction()).toMatchObject({ status: 'success' });
    expect(mocks.markLowFuelNotificationsRead).toHaveBeenCalledWith(['low-fuel:a']);
    expect(mocks.markLowFuelNotificationsRead).toHaveBeenCalledWith(['low-fuel:b']);
    expect(mocks.getNotificationPage).toHaveBeenLastCalledWith(cursor, false);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminCenterAccess.mockResolvedValue({
      user: { id: 'super-1' },
      scope: 'SYSTEM',
      companyIds: [],
    });
    mocks.receiptUpsert.mockResolvedValue({});
  });

  it('persists low-fuel receipts without requiring admin-center access', async () => {
    mocks.getAdminCenterAccess.mockResolvedValue(null);
    mocks.markLowFuelNotificationsRead.mockResolvedValue(true);
    expect(await markNotificationReadAction('low-fuel:episode')).toMatchObject({
      status: 'success',
    });
    expect(mocks.markLowFuelNotificationsRead).toHaveBeenCalledWith(['low-fuel:episode']);
    expect(mocks.markEventReadAction).not.toHaveBeenCalled();
  });

  it('marks all low-fuel notifications for an ordinary member', async () => {
    mocks.getAdminCenterAccess.mockResolvedValue(null);
    mocks.markLowFuelNotificationsRead.mockResolvedValue(true);
    expect(await markAllNotificationsReadAction(['low-fuel:episode'])).toMatchObject({
      status: 'success',
    });
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

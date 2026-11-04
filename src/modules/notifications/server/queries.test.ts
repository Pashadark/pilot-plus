import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEventTimeline: vi.fn(),
  getAdminCenterAccess: vi.fn(),
  auditLogFindMany: vi.fn(),
  receiptFindMany: vi.fn(),
  listLowFuelNotifications: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('./low-fuel', () => ({ listLowFuelNotifications: mocks.listLowFuelNotifications }));
vi.mock('@/modules/events/server/queries', () => ({ getEventTimeline: mocks.getEventTimeline }));
vi.mock('@/modules/admin/access', () => ({ getAdminCenterAccess: mocks.getAdminCenterAccess }));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    auditLog: { findMany: mocks.auditLogFindMany },
    eventReadReceipt: { findMany: mocks.receiptFindMany },
  },
}));

import { listNotificationsForCurrentUser, getNotificationPage } from './queries';

describe('listNotificationsForCurrentUser', () => {
  it('counts unread audit history with tenant scoping while loading only 21 candidates', async () => {
    mocks.getAdminCenterAccess.mockResolvedValue({user:{id:'admin-1'},scope:'COMPANY',companyIds:['company-1']});
    mocks.auditLogFindMany.mockResolvedValue([]);
    mocks.queryRaw.mockResolvedValue([{count:231n}]);
    const page = await getNotificationPage();
    expect(page.unreadCount).toBe(231);
    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({take:21,where:expect.objectContaining({companyId:{in:['company-1']}})}));
    expect(mocks.queryRaw.mock.calls[0][0].values).toContain('company-1');
    expect(mocks.queryRaw.mock.calls[0][0].values).toContain('admin-1');
  });
  it('supports a full count independently from the first page', async () => {
    mocks.getAdminCenterAccess.mockResolvedValue(null);
    mocks.listLowFuelNotifications.mockResolvedValue([]);
    mocks.getEventTimeline.mockResolvedValue({
      events: [],
      stats: { unread: 145 },
      nextCursor: null,
    });
    const page = await getNotificationPage();
    expect(page.unreadCount).toBe(145);
    expect(page.items).toEqual([]);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEventTimeline.mockResolvedValue({ events: [] });
    mocks.receiptFindMany.mockResolvedValue([]);
    mocks.listLowFuelNotifications.mockResolvedValue([]);
  });

  it('includes fresh low fuel for an ordinary company member', async () => {
    mocks.getAdminCenterAccess.mockResolvedValue(null);
    mocks.listLowFuelNotifications.mockResolvedValue([
      { id: 'low-fuel:episode', title: 'Мало топлива' },
    ]);
    expect(await listNotificationsForCurrentUser()).toEqual([
      { id: 'low-fuel:episode', title: 'Мало топлива' },
    ]);
  });

  it('показывает супер-админу действия всех компаний и объединяет их с событиями автопарка', async () => {
    mocks.getAdminCenterAccess.mockResolvedValue({
      user: { id: 'super-1', role: 'SUPER_ADMIN' },
      scope: 'SYSTEM',
      companyIds: [],
    });
    mocks.auditLogFindMany.mockResolvedValue([
      {
        id: 'audit-1',
        companyId: 'company-2',
        actorEmailSnapshot: 'manager@example.com',
        actorUser: { name: 'Менеджер' },
        action: 'CREATE',
        entityType: 'FINE',
        entityId: 'fine-1',
        entityLabel: 'Штраф',
        changes: null,
        company: { name: 'Вторая компания' },
        createdAt: new Date('2026-09-14T10:00:00.000Z'),
      },
    ]);

    const result = await listNotificationsForCurrentUser();

    expect(mocks.getEventTimeline).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ['ALERT', 'FUEL', 'MAINTENANCE', 'WASH', 'DEVICE', 'FIRMWARE', 'MANUAL'],
      }),
    );

    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ where: expect.anything() }),
    );
    expect(result[0]).toMatchObject({
      id: 'audit:audit-1',
      title: 'Новый штраф',
      companyLabel: 'Вторая компания',
      actorLabel: 'Менеджер',
    });
  });

  it('ограничивает администратора только его компаниями и учитывает прочитанные записи', async () => {
    mocks.getAdminCenterAccess.mockResolvedValue({
      user: { id: 'admin-1', role: 'MEMBER' },
      scope: 'COMPANY',
      companyIds: ['company-1'],
    });
    mocks.auditLogFindMany.mockResolvedValue([
      {
        id: 'audit-1',
        companyId: 'company-1',
        actorEmailSnapshot: 'admin@example.com',
        actorUser: null,
        action: 'UPDATE',
        entityType: 'VEHICLE',
        entityId: 'vehicle-1',
        entityLabel: 'Kia K5',
        changes: null,
        company: { name: 'Первая компания' },
        createdAt: new Date('2026-09-14T09:00:00.000Z'),
      },
    ]);
    mocks.receiptFindMany.mockResolvedValue([{ eventKey: 'audit:audit-1' }]);

    const result = await listNotificationsForCurrentUser();

    expect(mocks.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: { in: ['company-1'] } } }),
    );
    expect(result[0]).toMatchObject({ id: 'audit:audit-1', isRead: true });
  });
});

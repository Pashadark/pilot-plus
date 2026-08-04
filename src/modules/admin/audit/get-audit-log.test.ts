import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminCenterAccess } from '@/modules/admin/access';

const auditLogFindManyMock = vi.hoisted(() => vi.fn());

vi.mock('@/database/prisma/client', () => ({
  prisma: { auditLog: { findMany: auditLogFindManyMock } },
}));

import { getRecentAuditLog } from './get-audit-log';

const user = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Павел',
  role: 'SUPER_ADMIN' as const,
  canAccessAdmin: true,
};

const systemAccess: AdminCenterAccess = { user, scope: 'SYSTEM', companyIds: [] };
const companyAccess: AdminCenterAccess = {
  user: { ...user, role: 'MEMBER' },
  scope: 'COMPANY',
  companyIds: ['company-2', 'company-1'],
};

const selectedAuditFields = {
  id: true,
  actorEmailSnapshot: true,
  actorUser: { select: { name: true } },
  action: true,
  entityType: true,
  entityLabel: true,
  company: { select: { name: true } },
  createdAt: true,
};

describe('getRecentAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditLogFindManyMock.mockResolvedValue([]);
  });

  it('всегда ограничивает company scope доступными tenant ids', async () => {
    await getRecentAuditLog(companyAccess);

    expect(auditLogFindManyMock).toHaveBeenCalledExactlyOnceWith({
      where: { companyId: { in: ['company-2', 'company-1'] } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: selectedAuditFields,
    });
  });

  it('не добавляет tenant filter для system scope', async () => {
    await getRecentAuditLog(systemAccess, 12);

    expect(auditLogFindManyMock).toHaveBeenCalledExactlyOnceWith({
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: selectedAuditFields,
    });
  });

  it.each([
    { requested: 0, expected: 1 },
    { requested: 51, expected: 50 },
    { requested: 7.9, expected: 7 },
  ])('нормализует limit $requested в диапазон 1–50', async ({ requested, expected }) => {
    await getRecentAuditLog(systemAccess, requested);

    expect(auditLogFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: expected }),
    );
  });

  it('возвращает только сериализуемый DTO с безопасными labels', async () => {
    auditLogFindManyMock.mockResolvedValue([
      {
        id: 'audit-1',
        actorEmailSnapshot: 'snapshot@example.com',
        actorUser: { name: 'Павел Седов' },
        action: 'UPDATE',
        entityType: 'VEHICLE',
        entityLabel: 'А 123 МР 77',
        company: { name: 'Пилот' },
        createdAt: new Date('2026-08-04T08:00:00.000Z'),
      },
      {
        id: 'audit-2',
        actorEmailSnapshot: 'deleted@example.com',
        actorUser: null,
        action: 'DELETE',
        entityType: 'USER',
        entityLabel: null,
        company: null,
        createdAt: new Date('2026-08-04T07:00:00.000Z'),
      },
    ]);

    await expect(getRecentAuditLog(systemAccess)).resolves.toEqual([
      {
        id: 'audit-1',
        actorLabel: 'Павел Седов',
        action: 'UPDATE',
        entityType: 'VEHICLE',
        entityLabel: 'А 123 МР 77',
        companyLabel: 'Пилот',
        createdAt: '2026-08-04T08:00:00.000Z',
      },
      {
        id: 'audit-2',
        actorLabel: 'deleted@example.com',
        action: 'DELETE',
        entityType: 'USER',
        entityLabel: null,
        companyLabel: null,
        createdAt: '2026-08-04T07:00:00.000Z',
      },
    ]);
  });
});

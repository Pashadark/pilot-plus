import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditLogCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@/database/prisma/client', () => ({
  prisma: { auditLog: { create: auditLogCreateMock } },
}));

import { writeAuditLog } from './write-audit-log';

const input = {
  actor: { id: 'user-1', email: 'admin@example.com' },
  companyId: 'company-1',
  action: 'UPDATE' as const,
  entityType: 'VEHICLE' as const,
  entityId: 'vehicle-1',
  entityLabel: 'А 123 МР 77',
  changes: { status: { from: 'IDLE', to: 'MOVING' } },
};

describe('writeAuditLog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('записывает только безопасный снимок административного действия', async () => {
    auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

    await expect(writeAuditLog(input)).resolves.toBeUndefined();

    expect(auditLogCreateMock).toHaveBeenCalledExactlyOnceWith({
      data: {
        companyId: 'company-1',
        actorUserId: 'user-1',
        actorEmailSnapshot: 'admin@example.com',
        action: 'UPDATE',
        entityType: 'VEHICLE',
        entityId: 'vehicle-1',
        entityLabel: 'А 123 МР 77',
        changes: { status: { from: 'IDLE', to: 'MOVING' } },
      },
      select: { id: true },
    });
  });

  it.each(['password', 'passwordHash', 'token', 'tokenHash', 'secret', 'content', 'env'])(
    'отклоняет рекурсивный секретный ключ %s до записи Prisma',
    async (forbiddenKey) => {
      const marker = 'ЗНАЧЕНИЕ_НЕ_ДОЛЖНО_ПОПАСТЬ_В_ОШИБКУ';
      const changes = { safe: [{ nested: { [forbiddenKey]: marker } }] };

      const error = await writeAuditLog({ ...input, changes }).catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(marker);
      expect(auditLogCreateMock).not.toHaveBeenCalled();
    },
  );

  it('отклоняет changes больше 16 KiB до записи Prisma', async () => {
    await expect(
      writeAuditLog({ ...input, changes: { note: 'я'.repeat(16 * 1024) } }),
    ).rejects.toThrow('16 KiB');
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  it('заменяет ошибку сериализации безопасным сообщением без исходного payload', async () => {
    const changes: Record<string, unknown> = { note: 'НЕ_РАСКРЫВАТЬ' };
    changes.self = changes;

    const error = await writeAuditLog({ ...input, changes }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('НЕ_РАСКРЫВАТЬ');
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  it('проверяет нормализованный результат toJSON', async () => {
    await expect(
      writeAuditLog({ ...input, changes: { safe: { toJSON: () => ({ token: 'секрет' }) } } }),
    ).rejects.toThrow('запрещённые поля');
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });
});

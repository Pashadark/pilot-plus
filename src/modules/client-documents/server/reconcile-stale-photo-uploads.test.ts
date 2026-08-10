import { describe, expect, it, vi } from 'vitest';

import { reconcileStaleClientPhotoUploads } from './reconcile-stale-photo-uploads';

const now = new Date('2026-08-10T12:00:00.000Z');
const candidate = {
  id: 'photo-upload-1',
  uploadId: '123e4567-e89b-42d3-a456-426614174000',
  companyId: 'company-1',
  clientId: 'client-1',
  sourceStorageKey: 'companies/company-1/clients/client-1/photos/source/upload.jpg',
  finalStorageKey: 'companies/company-1/clients/client-1/photos/upload.webp',
  previousPhotoPath: 'companies/company-1/clients/client-1/photos/previous.webp',
  status: 'PENDING',
  sha256: 'a'.repeat(64),
  leaseExpiresAt: new Date('2026-08-10T11:59:00.000Z'),
  committedAt: null,
  createdAt: new Date('2026-08-10T11:30:00.000Z'),
  client: { photoPath: null, archivedAt: null },
};

function dependencies(overrides = {}) {
  const value = { ...candidate, ...overrides };
  const database = {
    clientPhotoUpload: {
      findMany: vi.fn().mockResolvedValue([value]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    client: { findFirst: vi.fn().mockResolvedValue(value.client) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    $transaction: vi.fn(),
  };
  database.$transaction.mockImplementation(
    async (operation: (transaction: typeof database) => unknown) => operation(database),
  );
  const storage = {
    putQuarantine: vi.fn(),
    openQuarantine: vi.fn(),
    removeQuarantine: vi.fn().mockResolvedValue(undefined),
    promote: vi.fn(),
    openPrivate: vi.fn(),
    removePrivate: vi.fn().mockResolvedValue(undefined),
    reserveQuarantine: vi.fn(),
    removeStaleQuarantine: vi.fn(),
  };
  return { database, storage };
}

describe('stale client photo upload reconciliation', () => {
  it('сохраняет final photo после ambiguous commit и удаляет только artifacts', async () => {
    const { database, storage } = dependencies({
      client: { photoPath: candidate.finalStorageKey, archivedAt: null },
    });

    await expect(
      reconcileStaleClientPhotoUploads({ database, storage, now, batchSize: 50 }),
    ).resolves.toEqual({ reconciled: 1, cleanupPending: 0, hasMore: false });

    expect(storage.removePrivate).not.toHaveBeenCalledWith(candidate.finalStorageKey);
    expect(storage.removePrivate).toHaveBeenCalledWith(candidate.sourceStorageKey);
    expect(storage.removePrivate).toHaveBeenCalledWith(candidate.previousPhotoPath);
    expect(database.clientPhotoUpload.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        id: candidate.id,
        companyId: candidate.companyId,
        clientId: candidate.clientId,
      }),
      data: { status: 'COMMITTED', leaseExpiresAt: null, committedAt: now },
    });
  });

  it('удаляет незакоммиченный final и аудитит fail-closed без path/PII', async () => {
    const { database, storage } = dependencies();

    await expect(reconcileStaleClientPhotoUploads({ database, storage, now })).resolves.toEqual({
      reconciled: 1,
      cleanupPending: 0,
      hasMore: false,
    });

    expect(storage.removePrivate).toHaveBeenCalledWith(candidate.finalStorageKey);
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        action: 'SCAN',
        entityType: 'CLIENT',
        entityId: 'client-1',
        changes: { sha256: 'a'.repeat(64), verdict: 'ERROR', reason: 'STALE_PHOTO_LEASE' },
      }),
      select: { id: true },
    });
    const audit = JSON.stringify(database.auditLog.create.mock.calls[0]?.[0]);
    expect(audit).not.toContain('storageKey');
    expect(audit).not.toContain('/photos/');
  });

  it('очищает исторически committed photo после следующей замены', async () => {
    const committedAt = new Date('2026-08-10T11:40:00.000Z');
    const { database, storage } = dependencies({
      status: 'CLEANUP_PENDING',
      committedAt,
      client: {
        photoPath: 'companies/company-1/clients/client-1/photos/newer.webp',
        archivedAt: true,
      },
    });

    await reconcileStaleClientPhotoUploads({ database, storage, now });

    expect(storage.removePrivate).toHaveBeenCalledWith(candidate.finalStorageKey);
    expect(storage.removePrivate).toHaveBeenCalledWith(candidate.previousPhotoPath);
    expect(database.client.findFirst).toHaveBeenCalledWith({
      where: { id: candidate.clientId, companyId: candidate.companyId },
      select: { photoPath: true },
    });
    expect(database.clientPhotoUpload.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ id: candidate.id, status: 'RECONCILING' }),
      data: { status: 'COMMITTED', leaseExpiresAt: null, committedAt },
    });
  });
});

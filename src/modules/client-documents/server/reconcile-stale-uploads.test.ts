import { describe, expect, it, vi } from 'vitest';

import { reconcileStaleClientDocumentUploads } from './reconcile-stale-uploads';

const now = new Date('2026-08-10T12:00:00.000Z');
const staleInitial = {
  id: 'version-1',
  uploadId: '123e4567-e89b-42d3-a456-426614174000',
  version: 1,
  storageKey: 'companies/company-1/clients/client-1/documents/document-1/1.jpg',
  sha256: 'a'.repeat(64),
  scanVerdict: null,
  scanLeaseExpiresAt: new Date('2026-08-10T11:59:00.000Z'),
  createdAt: new Date('2026-08-10T11:30:00.000Z'),
  document: {
    id: 'document-1',
    companyId: 'company-1',
    clientId: 'client-1',
    currentVersion: 1,
    status: 'PENDING',
    archivedAt: null,
  },
};

function dependencies(candidate = staleInitial) {
  const database = {
    clientDocumentVersion: {
      findMany: vi.fn().mockResolvedValue([candidate]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    clientDocument: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
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
    removeStaleQuarantine: vi.fn().mockResolvedValue(2),
  };
  return { database, storage };
}

describe('stale client document upload reconciliation', () => {
  it('fails an expired initial lease closed, audits it and removes stale storage', async () => {
    const { database, storage } = dependencies();

    await expect(
      reconcileStaleClientDocumentUploads({
        database,
        storage,
        now,
        staleAfterMs: 15 * 60_000,
        cleanupRetryMs: 5 * 60_000,
        batchSize: 50,
      }),
    ).resolves.toEqual({ recovered: 1, cleanupPending: 0, staleFilesRemoved: 2, hasMore: false });

    expect(database.clientDocumentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51,
        where: expect.objectContaining({ document: { archivedAt: null } }),
      }),
    );
    expect(database.clientDocument.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        companyId: 'company-1',
        clientId: 'client-1',
        currentVersion: 1,
        status: { in: ['UPLOADING', 'PENDING'] },
        archivedAt: null,
      },
      data: { status: 'ERROR' },
    });
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: null,
        actorEmailSnapshot: 'system@pilot-plus.local',
        companyId: 'company-1',
        action: 'SCAN',
        entityType: 'CLIENT_DOCUMENT',
        entityId: 'document-1',
        changes: {
          sha256: 'a'.repeat(64),
          verdict: 'ERROR',
          reason: 'STALE_SCAN_LEASE',
          version: 1,
        },
      }),
      select: { id: true },
    });
    expect(storage.removeQuarantine).toHaveBeenCalledWith(staleInitial.uploadId);
    expect(storage.removePrivate).toHaveBeenCalledWith(staleInitial.storageKey);
    expect(storage.removeStaleQuarantine).toHaveBeenCalledWith(
      new Date('2026-08-10T11:45:00.000Z'),
    );
  });

  it('keeps a CLEAN current version and schedules bounded cleanup retry for a stale replacement', async () => {
    const replacement = {
      ...staleInitial,
      id: 'version-2',
      version: 2,
      storageKey: 'companies/company-1/clients/client-1/documents/document-1/2.jpg',
      document: { ...staleInitial.document, currentVersion: 1, status: 'CLEAN' },
    };
    const { database, storage } = dependencies(replacement);
    storage.removePrivate.mockRejectedValueOnce(
      Object.assign(new Error('busy'), { code: 'EBUSY' }),
    );

    await expect(
      reconcileStaleClientDocumentUploads({
        database,
        storage,
        now,
        staleAfterMs: 15 * 60_000,
        cleanupRetryMs: 5 * 60_000,
      }),
    ).resolves.toEqual({ recovered: 1, cleanupPending: 1, staleFilesRemoved: 2, hasMore: false });

    expect(database.clientDocument.updateMany).not.toHaveBeenCalled();
    expect(database.clientDocumentVersion.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'version-2',
        uploadId: replacement.uploadId,
        documentId: 'document-1',
        document: {
          companyId: 'company-1',
          clientId: 'client-1',
          archivedAt: null,
        },
        scanVerdict: 'ERROR',
      },
      data: { scanLeaseExpiresAt: new Date('2026-08-10T12:05:00.000Z') },
    });
  });

  it('обрабатывает только bounded page и сигнализирует hasMore', async () => {
    const second = {
      ...staleInitial,
      id: 'version-2',
      uploadId: '223e4567-e89b-42d3-a456-426614174000',
      storageKey: 'companies/company-1/clients/client-1/documents/document-2/1.jpg',
      document: { ...staleInitial.document, id: 'document-2' },
    };
    const { database, storage } = dependencies();
    database.clientDocumentVersion.findMany.mockResolvedValue([staleInitial, second]);

    await expect(
      reconcileStaleClientDocumentUploads({ database, storage, now, batchSize: 1 }),
    ).resolves.toEqual({ recovered: 1, cleanupPending: 0, staleFilesRemoved: 2, hasMore: true });

    expect(storage.removePrivate).toHaveBeenCalledOnce();
    expect(storage.removePrivate).toHaveBeenCalledWith(staleInitial.storageKey);
  });
});

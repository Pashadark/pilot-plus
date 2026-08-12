import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

import { scanPendingUpload } from '../scan-upload';
import { reconcileStaleClientDocumentUploads } from './reconcile-stale-uploads';

const now = new Date('2026-08-10T12:00:00.000Z');
const staleInitial = {
  id: 'version-1',
  uploadId: '123e4567-e89b-42d3-a456-426614174000',
  version: 1,
  storageKey: 'companies/company-1/clients/client-1/documents/document-1/1.jpg',
  sha256: 'a'.repeat(64),
  bytes: 5,
  ledgerCommittedBytes: 0,
  scanVerdict: null as string | null,
  scanLeaseExpiresAt: new Date('2026-08-10T11:59:00.000Z') as Date | null,
  claimToken: null as string | null,
  scanRetryCount: 0,
  quarantineExpiresAt: new Date('2026-08-11T12:00:00.000Z'),
  cleanupPending: false,
  cleanupLeaseExpiresAt: null as Date | null,
  createdAt: new Date('2026-08-10T11:30:00.000Z'),
  document: {
    id: 'document-1',
    companyId: 'company-1',
    clientId: 'client-1',
    currentVersion: 1,
    status: 'PENDING' as string,
    archivedAt: null as Date | null,
  },
};

function dependencies(candidate = staleInitial) {
  const database = {
    clientDocumentVersion: {
      findMany: vi.fn().mockResolvedValue([candidate]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    clientDocument: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    clientUploadPermit: {
      findFirst: vi.fn().mockResolvedValue({ reservedBytes: 15 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    clientStorageLedger: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
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
    removeUploadArtifacts: vi.fn().mockResolvedValue(2),
    privateUsageBytes: vi.fn(),
  };
  return { database, storage };
}

describe('stale client document upload reconciliation', () => {
  it('не удаляет expired-mtime snapshot, если promotion heartbeat сохранил ownership', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pilot-reconcile-race-'));
    try {
      const storage = await LocalPrivateStorage.create(root);
      const uploadId = '123e4567-e89b-42d3-a456-426614174000';
      const finalKey = 'companies/company-1/clients/client-1/documents/document-1/1.jpg';
      await storage.putQuarantine(uploadId, Buffer.from('clean'));
      const empty = dependencies();
      empty.database.clientDocumentVersion.findMany.mockResolvedValue([]);

      const scanner = {
        getMetadata: vi.fn(async () => ({
          engine: 'ClamAV' as const,
          engineVersion: '1.4.3',
          signatureVersion: '27692',
        })),
        scanStream: vi.fn(async () => {
          const [snapshotName] = await readdir(join(root, 'quarantine'));
          const expired = new Date('2026-08-10T10:00:00.000Z');
          await utimes(join(root, 'quarantine', snapshotName), expired, expired);
          return { kind: 'clean' as const };
        }),
      };
      const renewPromotionLease = vi.fn(async () => {
        await reconcileStaleClientDocumentUploads({
          database: empty.database,
          storage,
          now,
          staleAfterMs: 15 * 60_000,
        });
        return true;
      });

      await expect(
        scanPendingUpload({
          storage,
          scanner,
          uploadId,
          storageKey: finalKey,
          renewPromotionLease,
        }),
      ).resolves.toMatchObject({ status: 'CLEAN' });
      await expect(storage.openPrivate(finalKey)).resolves.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

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
    ).resolves.toMatchObject({
      recovered: 1,
      cleanupPending: 0,
      staleFilesRemoved: 2,
      hasMore: false,
    });

    expect(database.clientDocumentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51,
        where: expect.objectContaining({ OR: expect.any(Array) }),
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
    expect(storage.removeUploadArtifacts).toHaveBeenCalledWith(staleInitial.uploadId);
    expect(storage.removePrivate).toHaveBeenCalledWith(staleInitial.storageKey);
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
    ).resolves.toMatchObject({
      recovered: 1,
      cleanupPending: 1,
      staleFilesRemoved: 2,
      hasMore: false,
    });

    expect(database.clientDocument.updateMany).not.toHaveBeenCalled();
    expect(database.clientDocumentVersion.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'version-2',
        uploadId: replacement.uploadId,
        scanVerdict: 'ERROR',
        claimToken: expect.any(String),
        scanLeaseExpiresAt: new Date('2026-08-10T12:05:00.000Z'),
      },
      data: {
        claimToken: null,
        scanLeaseExpiresAt: new Date('2026-08-10T12:05:00.000Z'),
      },
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
    ).resolves.toMatchObject({
      recovered: 1,
      cleanupPending: 0,
      staleFilesRemoved: 2,
      hasMore: true,
    });

    expect(storage.removePrivate).toHaveBeenCalledOnce();
    expect(storage.removePrivate).toHaveBeenCalledWith(staleInitial.storageKey);
  });

  it('повторно сканирует ERROR до expiry, продвигает CLEAN и завершает durable permit', async () => {
    const errorCandidate = {
      ...staleInitial,
      scanVerdict: 'ERROR',
      scanRetryCount: 1,
      document: { ...staleInitial.document, status: 'ERROR' },
    };
    const { database, storage } = dependencies(errorCandidate);
    const snapshot = {
      open: vi.fn().mockResolvedValue(Readable.from([Buffer.from('clean')])),
      promote: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
      release: vi.fn(),
    };
    storage.reserveQuarantine.mockResolvedValue(snapshot);
    const scanner = {
      getMetadata: vi.fn().mockResolvedValue({
        engine: 'ClamAV' as const,
        engineVersion: '1.4.3',
        signatureVersion: '27692',
      }),
      scanStream: vi.fn().mockResolvedValue({ kind: 'clean' as const }),
    };

    const result = await reconcileStaleClientDocumentUploads({
      database,
      storage,
      scanner,
      now,
    });

    expect(result.retried).toBe(1);
    expect(snapshot.promote).toHaveBeenCalledWith(errorCandidate.storageKey);
    expect(database.clientDocumentVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'version-1',
          scanVerdict: 'ERROR',
          claimToken: expect.any(String),
          scanLeaseExpiresAt: expect.any(Date),
        }),
        data: expect.objectContaining({
          scanVerdict: 'CLEAN',
          quarantineExpiresAt: null,
          claimToken: null,
        }),
      }),
    );
    expect(database.clientUploadPermit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ uploadId: errorCandidate.uploadId, status: 'ACTIVE' }),
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('не позволяет paused worker продвинуть файл после передачи lease новому claimToken', async () => {
    const errorCandidate = {
      ...staleInitial,
      scanVerdict: 'ERROR',
      scanRetryCount: 1,
      document: { ...staleInitial.document, status: 'ERROR' },
    };
    const { database, storage } = dependencies(errorCandidate);
    const snapshot = {
      open: vi.fn().mockResolvedValue(Readable.from([Buffer.from('clean')])),
      promote: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };
    storage.reserveQuarantine.mockResolvedValue(snapshot);
    const scanner = {
      getMetadata: vi.fn().mockResolvedValue({
        engine: 'ClamAV' as const,
        engineVersion: '1.4.3',
        signatureVersion: '27692',
      }),
      scanStream: vi.fn().mockResolvedValue({ kind: 'clean' as const }),
    };
    database.clientDocumentVersion.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValue({ count: 0 });

    const result = await reconcileStaleClientDocumentUploads({
      database,
      storage,
      scanner,
      now,
    });

    expect(result.retryPending).toBe(1);
    expect(snapshot.promote).not.toHaveBeenCalled();
    expect(database.auditLog.create).not.toHaveBeenCalled();
    expect(database.clientDocumentVersion.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          claimToken: expect.any(String),
          scanLeaseExpiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it('продлевает retry lease от текущего времени clock, а не от старта worker', async () => {
    const errorCandidate = {
      ...staleInitial,
      scanVerdict: 'ERROR',
      scanRetryCount: 1,
      document: { ...staleInitial.document, status: 'ERROR' },
    };
    const { database, storage } = dependencies(errorCandidate);
    const snapshot = {
      open: vi.fn().mockResolvedValue(Readable.from([Buffer.from('clean')])),
      promote: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };
    storage.reserveQuarantine.mockResolvedValue(snapshot);
    const scanner = {
      getMetadata: vi.fn().mockResolvedValue({
        engine: 'ClamAV' as const,
        engineVersion: '1.4.3',
        signatureVersion: '27692',
      }),
      scanStream: vi.fn().mockResolvedValue({ kind: 'clean' as const }),
    };
    const resumedAt = new Date('2026-08-10T12:10:00.000Z');

    await reconcileStaleClientDocumentUploads({
      database,
      storage,
      scanner,
      now,
      clock: () => resumedAt,
      staleAfterMs: 15 * 60_000,
    });

    expect(database.clientDocumentVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { scanLeaseExpiresAt: new Date('2026-08-10T12:25:00.000Z') },
      }),
    );
  });

  it('securely removes ERROR quarantine after bounded expiry and releases permit', async () => {
    const expired = {
      ...staleInitial,
      scanVerdict: 'ERROR',
      scanLeaseExpiresAt: null,
      scanRetryCount: 3,
      quarantineExpiresAt: new Date('2026-08-10T11:00:00.000Z'),
      document: { ...staleInitial.document, status: 'ERROR' },
    };
    const { database, storage } = dependencies(expired);

    const result = await reconcileStaleClientDocumentUploads({ database, storage, now });

    expect(result.expired).toBe(1);
    expect(storage.removeUploadArtifacts).toHaveBeenCalledWith(expired.uploadId);
    expect(database.clientUploadPermit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RELEASED' }) }),
    );
  });

  it('удаляет obsolete ERROR replacement, не откатывая более новую CLEAN-версию', async () => {
    const obsolete = {
      ...staleInitial,
      version: 2,
      scanVerdict: 'ERROR',
      scanRetryCount: 1,
      document: { ...staleInitial.document, currentVersion: 3, status: 'CLEAN' },
    };
    const { database, storage } = dependencies(obsolete);
    const scanner = {
      getMetadata: vi.fn(),
      scanStream: vi.fn(),
    };

    const result = await reconcileStaleClientDocumentUploads({
      database,
      storage,
      scanner,
      now,
    });

    expect(result.expired).toBe(1);
    expect(scanner.scanStream).not.toHaveBeenCalled();
    expect(storage.removeUploadArtifacts).toHaveBeenCalledWith(obsolete.uploadId);
    expect(database.clientDocument.updateMany).not.toHaveBeenCalled();
  });

  it('очищает все archive artifacts по durable cleanup lease', async () => {
    const archived = {
      ...staleInitial,
      scanVerdict: 'CLEAN',
      cleanupPending: true,
      cleanupLeaseExpiresAt: new Date('2026-08-10T11:59:00.000Z'),
      document: { ...staleInitial.document, status: 'ARCHIVED', archivedAt: now },
    };
    const { database, storage } = dependencies(archived);

    const result = await reconcileStaleClientDocumentUploads({ database, storage, now });

    expect(result.archivedCleaned).toBe(1);
    expect(storage.removePrivate).toHaveBeenCalledWith(archived.storageKey);
    expect(database.clientDocumentVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cleanupPending: true }),
        data: expect.objectContaining({ cleanupPending: false, cleanupLeaseExpiresAt: null }),
      }),
    );
  });
});

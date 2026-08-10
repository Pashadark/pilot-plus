import { describe, expect, it, vi } from 'vitest';

import { reconcileExpiredClientUploadPermits } from './reconcile-expired-upload-permits';

const now = new Date('2026-08-10T12:00:00.000Z');
const permit = {
  id: 'permit-1',
  uploadId: '123e4567-e89b-42d3-a456-426614174000',
  companyId: 'company-1',
  status: 'ACTIVE',
  leaseExpiresAt: new Date('2026-08-10T11:59:00.000Z'),
};

function dependencies(documentLinks = 0, photoLinks = 0) {
  const database = {
    clientUploadPermit: {
      findMany: vi.fn().mockResolvedValue([permit]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    clientDocumentVersion: { count: vi.fn().mockResolvedValue(documentLinks) },
    clientPhotoUpload: { count: vi.fn().mockResolvedValue(photoLinks) },
    $transaction: vi.fn(),
  };
  database.$transaction.mockImplementation(
    async (operation: (transaction: typeof database) => unknown) => operation(database),
  );
  const storage = { removeUploadArtifacts: vi.fn().mockResolvedValue(2) };
  return { database, storage };
}

describe('expired durable upload permit reconciliation', () => {
  it('claims and releases an orphan permit only after deleting its upload artifacts', async () => {
    const { database, storage } = dependencies();

    await expect(reconcileExpiredClientUploadPermits({ database, storage, now })).resolves.toEqual({
      released: 1,
      linked: 0,
      cleanupPending: 0,
      hasMore: false,
    });

    expect(storage.removeUploadArtifacts).toHaveBeenCalledWith(permit.uploadId);
    expect(database.clientUploadPermit.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: permit.id,
        uploadId: permit.uploadId,
        companyId: permit.companyId,
        status: 'RECONCILING',
      },
      data: { status: 'RELEASED', completedAt: now, leaseExpiresAt: now },
    });
  });

  it('keeps a permit leased when a durable document or photo row owns the upload', async () => {
    const { database, storage } = dependencies(1, 0);

    await expect(reconcileExpiredClientUploadPermits({ database, storage, now })).resolves.toEqual({
      released: 0,
      linked: 1,
      cleanupPending: 0,
      hasMore: false,
    });

    expect(storage.removeUploadArtifacts).not.toHaveBeenCalled();
    expect(database.clientDocumentVersion.count).toHaveBeenCalledWith({
      where: {
        uploadId: permit.uploadId,
        OR: [
          { scanVerdict: null },
          { scanVerdict: 'ERROR', storageDeletedAt: null },
          { cleanupPending: true },
        ],
      },
    });
    expect(database.clientPhotoUpload.count).toHaveBeenCalledWith({
      where: {
        uploadId: permit.uploadId,
        status: { in: ['PENDING', 'CLEANUP_PENDING', 'RECONCILING'] },
      },
    });
    expect(database.clientUploadPermit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: permit.id }),
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('leaves a retry lease when artifact cleanup fails', async () => {
    const { database, storage } = dependencies();
    storage.removeUploadArtifacts.mockRejectedValue(new Error('disk unavailable'));

    await expect(reconcileExpiredClientUploadPermits({ database, storage, now })).resolves.toEqual({
      released: 0,
      linked: 0,
      cleanupPending: 1,
      hasMore: false,
    });
    expect(database.clientUploadPermit.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RECONCILING' }),
      }),
    );
  });

  it('does not cleanup when another process already claimed the same permit', async () => {
    const { database, storage } = dependencies();
    database.clientUploadPermit.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(reconcileExpiredClientUploadPermits({ database, storage, now })).resolves.toEqual({
      released: 0,
      linked: 0,
      cleanupPending: 0,
      hasMore: false,
    });
    expect(storage.removeUploadArtifacts).not.toHaveBeenCalled();
  });
});

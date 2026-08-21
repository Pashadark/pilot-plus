import { describe, expect, it, vi } from 'vitest';

import { reconcileOperationMedia } from './reconcile-operation-media';

describe('reconcileOperationMedia', () => {
  it('claims an expired upload before cleanup and deletes only with the same token', async () => {
    const candidate = {
      id: 'media-1',
      uploadId: 'upload-1',
      storageKey: 'companies/company-1/rental-operations/operation-1/video.mp4',
      status: 'SCANNING',
      claimToken: 'dead-worker',
      leaseExpiresAt: new Date('2026-08-21T09:00:00Z'),
    };
    const repository = {
      findExpired: vi.fn().mockResolvedValue([candidate]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const storage = {
      removeUploadArtifacts: vi.fn().mockResolvedValue(1),
      removePrivate: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      reconcileOperationMedia({
        repository,
        storage,
        now: new Date('2026-08-21T10:00:00Z'),
        claimToken: () => 'reconciler-1',
        limit: 10,
      }),
    ).resolves.toEqual({ cleaned: 1, skipped: 0 });
    expect(repository.updateMany).toHaveBeenCalledBefore(storage.removeUploadArtifacts);
    expect(repository.deleteMany).toHaveBeenCalledWith({
      where: { id: 'media-1', status: 'CLEANING', claimToken: 'reconciler-1' },
    });
  });

  it('does not touch storage when another worker renews before the claim', async () => {
    const repository = {
      findExpired: vi.fn().mockResolvedValue([
        {
          id: 'media-1',
          uploadId: 'upload-1',
          storageKey: 'private-key',
          status: 'SCANNING',
          claimToken: 'worker-1',
          leaseExpiresAt: new Date('2026-08-21T09:00:00Z'),
        },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn(),
    };
    const storage = { removeUploadArtifacts: vi.fn(), removePrivate: vi.fn() };

    await expect(
      reconcileOperationMedia({
        repository,
        storage,
        now: new Date('2026-08-21T10:00:00Z'),
        claimToken: () => 'reconciler-1',
        limit: 10,
      }),
    ).resolves.toEqual({ cleaned: 0, skipped: 1 });
    expect(storage.removeUploadArtifacts).not.toHaveBeenCalled();
  });
});

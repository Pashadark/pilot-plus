import { describe, expect, it, vi } from 'vitest';

import { admitOperationMedia } from './admit-operation-media';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x01]);

function fixture() {
  const operation = {
    id: 'operation-1',
    companyId: 'company-1',
    rentalId: 'rental-1',
    actorUserId: 'user-1',
    status: 'DRAFT',
  };
  const repository = {
    findOperation: vi.fn().mockResolvedValue(operation),
    findMedia: vi.fn().mockResolvedValue(null),
    createMedia: vi.fn().mockResolvedValue({
      id: 'media-1',
      uploadId: 'upload-1',
      companyId: 'company-1',
      storageKey: 'companies/company-1/rental-operations/operation-1/dashboard-photo.jpg',
    }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const storage = {
    putQuarantine: vi.fn().mockResolvedValue(undefined),
    openQuarantine: vi.fn(),
    removeQuarantine: vi.fn(),
    promote: vi.fn(),
    openPrivate: vi.fn(),
    removePrivate: vi.fn(),
    removeUploadArtifacts: vi.fn(),
    reserveQuarantine: vi.fn(),
    privateUsageBytes: vi.fn(),
  };
  const scan = vi.fn().mockResolvedValue({ ok: true, status: 'CLEAN' });
  return { repository, storage, scan };
}

describe('admitOperationMedia', () => {
  it('binds a validated file to the exact draft operation before quarantine and scanning', async () => {
    const { repository, storage, scan } = fixture();

    const result = await admitOperationMedia({
      companyId: 'company-1',
      operationId: 'operation-1',
      actorUserId: 'user-1',
      kind: 'DASHBOARD_PHOTO',
      file: { name: 'dashboard.jpg', bytes: jpeg },
      repository,
      storage,
      scan,
      randomId: () => 'upload-1',
    });

    expect(result).toEqual({ mediaId: 'media-1', status: 'CLEAN' });
    expect(repository.createMedia).toHaveBeenCalledBefore(storage.putQuarantine);
    expect(storage.putQuarantine).toHaveBeenCalledWith('upload-1', jpeg);
    expect(scan).toHaveBeenCalledOnce();
  });

  it('rejects a tenant or actor mismatch before touching storage', async () => {
    const { repository, storage, scan } = fixture();
    repository.findOperation.mockResolvedValue(null);

    await expect(
      admitOperationMedia({
        companyId: 'other-company',
        operationId: 'operation-1',
        actorUserId: 'user-1',
        kind: 'DASHBOARD_PHOTO',
        file: { name: 'dashboard.jpg', bytes: jpeg },
        repository,
        storage,
        scan,
        randomId: () => 'upload-1',
      }),
    ).rejects.toThrow('Операция аренды недоступна.');
    expect(storage.putQuarantine).not.toHaveBeenCalled();
  });

  it('converges an already clean duplicate without writing another file', async () => {
    const { repository, storage, scan } = fixture();
    repository.findMedia.mockResolvedValue({ id: 'media-existing', status: 'CLEAN' });

    await expect(
      admitOperationMedia({
        companyId: 'company-1',
        operationId: 'operation-1',
        actorUserId: 'user-1',
        kind: 'DASHBOARD_PHOTO',
        file: { name: 'dashboard.jpg', bytes: jpeg },
        repository,
        storage,
        scan,
        randomId: () => 'upload-1',
      }),
    ).resolves.toEqual({ mediaId: 'media-existing', status: 'CLEAN' });
    expect(storage.putQuarantine).not.toHaveBeenCalled();
  });
});

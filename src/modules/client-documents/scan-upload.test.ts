import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import type { PrivateStorage } from '@/services/storage/private-storage';

import { scanPendingUpload } from './scan-upload';

function createStorage(bytes: Buffer) {
  const storage: PrivateStorage = {
    putQuarantine: vi.fn(),
    openQuarantine: vi.fn(async () => Readable.from([bytes])),
    removeQuarantine: vi.fn(),
    promote: vi.fn(),
    openPrivate: vi.fn(),
  };
  return storage;
}

describe('scanPendingUpload', () => {
  it('переносит чистый файл в закрытое хранилище и возвращает безопасный аудит', async () => {
    const storage = createStorage(Buffer.from('safe-document'));
    const scanner = { scanStream: vi.fn(async () => ({ kind: 'clean' as const })) };

    await expect(
      scanPendingUpload({
        storage,
        scanner,
        uploadId: 'upload-1',
        storageKey: 'companies/c1/clients/u1/documents/d1/v1',
      }),
    ).resolves.toEqual({
      status: 'CLEAN',
      audit: {
        verdict: 'CLEAN',
        sha256: '6f99f13c6e0f234ec7823144f5edd7b36f26a6ba9c1747c3dd3a5aeebd560ab5',
      },
    });

    expect(storage.promote).toHaveBeenCalledWith(
      'upload-1',
      'companies/c1/clients/u1/documents/d1/v1',
    );
    expect(storage.removeQuarantine).not.toHaveBeenCalled();
  });

  it('удаляет заражённый карантинный файл и блокирует документ', async () => {
    const storage = createStorage(Buffer.from('eicar'));
    const scanner = {
      scanStream: vi.fn(async () => ({ kind: 'infected' as const, threat: 'Eicar-Signature' })),
    };

    await expect(
      scanPendingUpload({ storage, scanner, uploadId: 'upload-2', storageKey: 'private/key' }),
    ).resolves.toMatchObject({
      status: 'BLOCKED',
      audit: { verdict: 'BLOCKED', signature: 'Eicar-Signature', sha256: expect.any(String) },
    });
    expect(storage.removeQuarantine).toHaveBeenCalledWith('upload-2');
    expect(storage.promote).not.toHaveBeenCalled();
  });

  it('оставляет карантинный файл недоступным при недоступном scanner', async () => {
    const storage = createStorage(Buffer.from('safe-document'));
    const scanner = { scanStream: vi.fn(async () => ({ kind: 'unavailable' as const })) };

    await expect(
      scanPendingUpload({ storage, scanner, uploadId: 'upload-3', storageKey: 'private/key' }),
    ).resolves.toMatchObject({ status: 'ERROR', audit: { verdict: 'ERROR' } });
    expect(storage.promote).not.toHaveBeenCalled();
    expect(storage.removeQuarantine).not.toHaveBeenCalled();
  });
});

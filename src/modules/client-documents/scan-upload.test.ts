import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import type { PrivateStorage, QuarantineSnapshot } from '@/services/storage/private-storage';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';

import { scanPendingUpload } from './scan-upload';

const scannerMetadata = {
  engine: 'ClamAV' as const,
  engineVersion: '1.4.3',
  signatureVersion: '27692',
};

function createStorage(bytes: Buffer) {
  const snapshot: QuarantineSnapshot = {
    open: vi.fn(async () => Readable.from([bytes])),
    promote: vi.fn(),
    remove: vi.fn(),
    release: vi.fn(),
  };
  const storage: PrivateStorage = {
    putQuarantine: vi.fn(),
    openQuarantine: vi.fn(async () => Readable.from([bytes])),
    removeQuarantine: vi.fn(),
    promote: vi.fn(),
    openPrivate: vi.fn(),
    removePrivate: vi.fn(),
    removeUploadArtifacts: vi.fn(),
    reserveQuarantine: vi.fn(async () => snapshot),
  };
  return { storage, snapshot };
}

describe('scanPendingUpload', () => {
  it('переносит чистый файл в закрытое хранилище и возвращает безопасный аудит', async () => {
    const { storage, snapshot } = createStorage(Buffer.from('safe-document'));
    const scanner = {
      getMetadata: vi.fn(async () => scannerMetadata),
      scanStream: vi.fn(async () => ({ kind: 'clean' as const })),
    };

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
        engine: 'ClamAV',
        signatureVersion: '27692',
      },
    });

    expect(snapshot.promote).toHaveBeenCalledWith('companies/c1/clients/u1/documents/d1/v1');
    expect(snapshot.remove).not.toHaveBeenCalled();
  });

  it('не продвигает CLEAN snapshot, если lease ownership утрачен', async () => {
    const { storage, snapshot } = createStorage(Buffer.from('safe-document'));
    const scanner = {
      getMetadata: vi.fn(async () => scannerMetadata),
      scanStream: vi.fn(async () => ({ kind: 'clean' as const })),
    };
    const renewPromotionLease = vi.fn(async () => false);

    await expect(
      scanPendingUpload({
        storage,
        scanner,
        uploadId: 'upload-lost-lease',
        storageKey: 'private/key',
        renewPromotionLease,
      }),
    ).resolves.toMatchObject({ status: 'ERROR', audit: { verdict: 'ERROR' } });

    expect(renewPromotionLease).toHaveBeenCalledOnce();
    expect(snapshot.promote).not.toHaveBeenCalled();
    expect(snapshot.remove).toHaveBeenCalledOnce();
  });

  it('удаляет заражённый карантинный файл и блокирует документ', async () => {
    const { storage, snapshot } = createStorage(Buffer.from('eicar'));
    const scanner = {
      getMetadata: vi.fn(async () => scannerMetadata),
      scanStream: vi.fn(async () => ({ kind: 'infected' as const, threat: 'Eicar-Signature' })),
    };

    await expect(
      scanPendingUpload({ storage, scanner, uploadId: 'upload-2', storageKey: 'private/key' }),
    ).resolves.toMatchObject({
      status: 'BLOCKED',
      audit: {
        verdict: 'BLOCKED',
        signature: 'Eicar-Signature',
        signatureVersion: '27692',
        sha256: expect.any(String),
      },
    });
    expect(snapshot.remove).toHaveBeenCalledOnce();
    expect(snapshot.promote).not.toHaveBeenCalled();
  });

  it('оставляет карантинный файл недоступным при недоступном scanner', async () => {
    const { storage, snapshot } = createStorage(Buffer.from('safe-document'));
    const scanner = {
      getMetadata: vi.fn(async () => scannerMetadata),
      scanStream: vi.fn(async () => ({ kind: 'unavailable' as const })),
    };

    await expect(
      scanPendingUpload({ storage, scanner, uploadId: 'upload-3', storageKey: 'private/key' }),
    ).resolves.toMatchObject({ status: 'ERROR', audit: { verdict: 'ERROR' } });
    expect(snapshot.promote).not.toHaveBeenCalled();
    expect(snapshot.remove).not.toHaveBeenCalled();
    expect(snapshot.release).toHaveBeenCalledOnce();
  });

  it('использует один зарезервированный snapshot при попытке подменить uploadId', async () => {
    const original = Buffer.from('проверенный snapshot');
    const replacement = Buffer.from('подмена после SHA');
    const snapshot: QuarantineSnapshot = {
      open: vi.fn(async () => Readable.from([original])),
      promote: vi.fn(),
      remove: vi.fn(),
      release: vi.fn(),
    };
    const storage: PrivateStorage = {
      putQuarantine: vi.fn(),
      openQuarantine: vi.fn(async () => Readable.from([replacement])),
      removeQuarantine: vi.fn(),
      promote: vi.fn(),
      openPrivate: vi.fn(),
      removePrivate: vi.fn(),
      removeUploadArtifacts: vi.fn(),
      reserveQuarantine: vi.fn(async () => snapshot),
    };
    const scanner = {
      getMetadata: vi.fn(async () => scannerMetadata),
      scanStream: vi.fn(async (stream: Readable) => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        expect(Buffer.concat(chunks)).toEqual(original);
        return { kind: 'clean' as const };
      }),
    };

    await expect(
      scanPendingUpload({ storage, scanner, uploadId: 'upload-4', storageKey: 'private/key' }),
    ).resolves.toMatchObject({
      status: 'CLEAN',
      audit: { sha256: '1b02c72a15063e10b2266a8a7b3dd7ed3164ec959958b8bda0adb5478cb98cef' },
    });
    expect(storage.openQuarantine).not.toHaveBeenCalled();
    expect(snapshot.open).toHaveBeenCalledTimes(2);
  });

  it('дожидается close scanner stream до release snapshot при connect failure', async () => {
    let scannerStream: Readable | undefined;
    const snapshot: QuarantineSnapshot = {
      open: vi.fn(async () => {
        scannerStream = Readable.from([Buffer.from('safe')]);
        return scannerStream;
      }),
      promote: vi.fn(),
      remove: vi.fn(),
      release: vi.fn(async () => {
        if (!scannerStream?.closed)
          throw new Error('Windows не позволяет освободить открытый файл.');
      }),
    };
    const storage: PrivateStorage = {
      putQuarantine: vi.fn(),
      openQuarantine: vi.fn(),
      removeQuarantine: vi.fn(),
      promote: vi.fn(),
      openPrivate: vi.fn(),
      removePrivate: vi.fn(),
      removeUploadArtifacts: vi.fn(),
      reserveQuarantine: vi.fn(async () => snapshot),
    };
    const scanner = new ClamAvClient({ host: '127.0.0.1', port: 1, timeoutMs: 50 });

    await expect(
      scanPendingUpload({ storage, scanner, uploadId: 'upload-5', storageKey: 'private/key' }),
    ).resolves.toMatchObject({ status: 'ERROR' });
    expect(snapshot.release).toHaveBeenCalledOnce();
  });
});

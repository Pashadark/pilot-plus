import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { scanOperationMedia } from './scan-operation-media';

describe('scanOperationMedia', () => {
  it('claims, scans, promotes, and finalizes only with the same ownership token', async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const promote = vi.fn().mockResolvedValue(undefined);
    const result = await scanOperationMedia({
      media: {
        id: 'media-1',
        uploadId: 'upload-1',
        companyId: 'company-1',
        storageKey: 'companies/company-1/rentals/rental-1/media-1.mp4',
        verifiedMime: 'video/mp4',
      },
      now: new Date('2026-08-21T09:00:00Z'),
      leaseMs: 60_000,
      repository: { updateMany },
      storage: {
        reserveQuarantine: vi.fn().mockResolvedValue({
          open: vi.fn().mockResolvedValue(Readable.from(Buffer.from('clean'))),
          promote,
          remove: vi.fn(),
          release: vi.fn(),
        }),
        removePrivate: vi.fn(),
      } as never,
      scanner: {
        getMetadata: vi.fn().mockResolvedValue({ engine: 'ClamAV', signatureVersion: '1' }),
        scanStream: vi.fn().mockResolvedValue({ kind: 'clean' }),
      },
      claimToken: 'claim-1',
    });
    expect(result).toEqual({ ok: true, status: 'CLEAN' });
    expect(promote).toHaveBeenCalledWith('companies/company-1/rentals/rental-1/media-1.mp4');
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'media-1', claimToken: 'claim-1' }),
      }),
    );
  });

  it('removes a promoted private file when terminal ownership is lost', async () => {
    const removePrivate = vi.fn().mockResolvedValue(undefined);
    const result = await scanOperationMedia({
      media: {
        id: 'media-1',
        uploadId: 'upload-1',
        companyId: 'company-1',
        storageKey: 'companies/company-1/rentals/rental-1/media-1.mp4',
        verifiedMime: 'video/mp4',
      },
      now: new Date('2026-08-21T09:00:00Z'),
      leaseMs: 60_000,
      repository: {
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      storage: {
        reserveQuarantine: vi.fn().mockResolvedValue({
          open: vi.fn().mockResolvedValue(Readable.from(Buffer.from('clean'))),
          promote: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn(),
          release: vi.fn(),
        }),
        removePrivate,
      } as never,
      scanner: {
        getMetadata: vi.fn().mockResolvedValue({ engine: 'ClamAV', signatureVersion: '1' }),
        scanStream: vi.fn().mockResolvedValue({ kind: 'clean' }),
      },
      claimToken: 'claim-1',
    });
    expect(result).toEqual({ ok: false, status: 'OWNERSHIP_LOST' });
    expect(removePrivate).toHaveBeenCalledTimes(1);
  });

  it('stores a derived WebP preview for a clean vehicle photo', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const createPreview = vi.fn().mockResolvedValue({
      mime: 'image/webp',
      bytes: 321,
      sha256: 'b'.repeat(64),
    });

    const result = await scanOperationMedia({
      media: {
        id: 'media-1',
        uploadId: 'upload-1',
        companyId: 'company-1',
        storageKey: 'companies/company-1/rentals/rental-1/dashboard.jpg',
        verifiedMime: 'image/jpeg',
      },
      now: new Date('2026-08-21T09:00:00Z'),
      leaseMs: 60_000,
      repository: { updateMany },
      storage: {
        reserveQuarantine: vi.fn().mockResolvedValue({
          open: vi.fn().mockResolvedValue(Readable.from(Buffer.from('clean'))),
          promote: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn(),
          release: vi.fn(),
        }),
        removePrivate: vi.fn(),
      } as never,
      scanner: {
        getMetadata: vi.fn().mockResolvedValue({ engine: 'ClamAV', signatureVersion: '1' }),
        scanStream: vi.fn().mockResolvedValue({ kind: 'clean' }),
      },
      claimToken: 'claim-1',
      randomId: () => 'preview-temp-1',
      createPreview,
    });

    expect(result).toEqual({ ok: true, status: 'CLEAN' });
    expect(createPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceStorageKey: 'companies/company-1/rentals/rental-1/dashboard.jpg',
        previewStorageKey:
          'companies/company-1/rentals/rental-1/dashboard.jpg.preview.webp',
        profile: 'RENTAL_VEHICLE_PHOTO',
        temporaryUploadId: 'preview-temp-1',
      }),
    );
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previewStorageKey:
            'companies/company-1/rentals/rental-1/dashboard.jpg.preview.webp',
          previewMime: 'image/webp',
          previewBytes: 321,
          previewSha256: 'b'.repeat(64),
          previewGeneratedAt: expect.any(Date),
        }),
      }),
    );
  });
});

import { describe, expect, it, vi } from 'vitest';

import { backfillPreviewSource } from './backfill-preview';

const candidates = [
  {
    id: 'document-version-1',
    companyId: 'company-1',
    storageKey: 'companies/c1/clients/u1/documents/d1/1.jpg',
    verifiedMime: 'image/jpeg',
  },
  {
    id: 'document-version-2',
    companyId: 'company-1',
    storageKey: 'companies/c1/clients/u1/documents/d2/1.png',
    verifiedMime: 'image/png',
  },
];

function fixture() {
  const findBatch = vi.fn().mockResolvedValueOnce(candidates).mockResolvedValueOnce([]);
  const commit = vi.fn().mockResolvedValue(true);
  const createPreview = vi.fn().mockResolvedValue({
    mime: 'image/webp',
    bytes: 321,
    sha256: 'b'.repeat(64),
  });
  const storage = { removePrivate: vi.fn().mockResolvedValue(undefined) };
  return { findBatch, commit, createPreview, storage };
}

describe('backfillPreviewSource', () => {
  it('reports eligible CLEAN images in dry-run without reading or writing storage', async () => {
    const fixtureValue = fixture();

    await expect(
      backfillPreviewSource({
        ...fixtureValue,
        source: 'CLIENT_DOCUMENT',
        profile: 'CLIENT_DOCUMENT',
        apply: false,
        batchSize: 50,
        randomId: () => 'preview-temp',
      }),
    ).resolves.toEqual({ eligible: 2, generated: 0, skipped: 0, failed: 0 });

    expect(fixtureValue.createPreview).not.toHaveBeenCalled();
    expect(fixtureValue.commit).not.toHaveBeenCalled();
  });

  it('creates and conditionally commits one preview per missing record', async () => {
    const fixtureValue = fixture();

    await expect(
      backfillPreviewSource({
        ...fixtureValue,
        source: 'CLIENT_DOCUMENT',
        profile: 'CLIENT_DOCUMENT',
        apply: true,
        batchSize: 50,
        randomId: vi
          .fn()
          .mockReturnValueOnce('preview-temp-1')
          .mockReturnValueOnce('preview-temp-2'),
      }),
    ).resolves.toEqual({ eligible: 2, generated: 2, skipped: 0, failed: 0 });

    expect(fixtureValue.createPreview).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sourceStorageKey: candidates[0].storageKey,
        previewStorageKey: `${candidates[0].storageKey}.preview.webp`,
        profile: 'CLIENT_DOCUMENT',
        temporaryUploadId: 'preview-temp-1',
      }),
    );
    expect(fixtureValue.commit).toHaveBeenCalledWith(
      candidates[0],
      expect.objectContaining({
        storageKey: `${candidates[0].storageKey}.preview.webp`,
        mime: 'image/webp',
        bytes: 321,
        sha256: 'b'.repeat(64),
        generatedAt: expect.any(Date),
      }),
    );
  });

  it('removes an unclaimed derivative when another worker wins the conditional update', async () => {
    const fixtureValue = fixture();
    fixtureValue.findBatch
      .mockReset()
      .mockResolvedValueOnce([candidates[0]])
      .mockResolvedValueOnce([]);
    fixtureValue.commit.mockResolvedValue(false);

    await expect(
      backfillPreviewSource({
        ...fixtureValue,
        source: 'CLIENT_DOCUMENT',
        profile: 'CLIENT_DOCUMENT',
        apply: true,
        batchSize: 50,
        randomId: () => 'preview-temp-1',
      }),
    ).resolves.toEqual({ eligible: 1, generated: 0, skipped: 1, failed: 0 });

    expect(fixtureValue.storage.removePrivate).toHaveBeenCalledWith(
      `${candidates[0].storageKey}.preview.webp`,
    );
  });

  it('continues the batch when a source file is missing or invalid', async () => {
    const fixtureValue = fixture();
    fixtureValue.createPreview
      .mockRejectedValueOnce(new Error('missing original'))
      .mockResolvedValueOnce({ mime: 'image/webp', bytes: 20, sha256: 'c'.repeat(64) });

    await expect(
      backfillPreviewSource({
        ...fixtureValue,
        source: 'CLIENT_DOCUMENT',
        profile: 'CLIENT_DOCUMENT',
        apply: true,
        batchSize: 50,
        randomId: () => 'preview-temp',
      }),
    ).resolves.toEqual({ eligible: 2, generated: 1, skipped: 0, failed: 1 });
  });
});

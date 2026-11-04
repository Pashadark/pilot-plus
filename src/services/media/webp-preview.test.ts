import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { createStoredWebpPreview, createWebpPreview } from './webp-preview';

describe('createWebpPreview', () => {
  it('creates a bounded metadata-free WebP document preview without enlarging it', async () => {
    const source = await sharp({
      create: { width: 320, height: 180, channels: 3, background: '#0067ff' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'private metadata' } } })
      .toBuffer();

    const result = await createWebpPreview({
      source,
      verifiedMime: 'image/jpeg',
      profile: 'CLIENT_DOCUMENT',
    });
    const metadata = await sharp(result.buffer).metadata();

    expect(result.mime).toBe('image/webp');
    expect(result.bytes).toBe(result.buffer.byteLength);
    expect(result.sha256).toBe(createHash('sha256').update(result.buffer).digest('hex'));
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(180);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it('applies EXIF orientation and the vehicle-photo size profile', async () => {
    const source = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: '#343438' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await createWebpPreview({
      source,
      verifiedMime: 'image/jpeg',
      profile: 'RENTAL_VEHICLE_PHOTO',
    });
    const metadata = await sharp(result.buffer).metadata();

    expect(metadata.width).toBe(540);
    expect(metadata.height).toBe(1080);
    expect(metadata.orientation).toBeUndefined();
  });

  it.each(['application/pdf', 'video/mp4', 'image/svg+xml'])(
    'rejects unsupported MIME type %s',
    async (verifiedMime) => {
      await expect(
        createWebpPreview({
          source: Buffer.from('not an image'),
          verifiedMime,
          profile: 'CLIENT_DOCUMENT',
        }),
      ).rejects.toThrow('WebP preview is not supported');
    },
  );
});

describe('createStoredWebpPreview', () => {
  it('writes the derived preview through quarantine and promotes it atomically', async () => {
    const source = await sharp({
      create: { width: 120, height: 80, channels: 3, background: '#0067ff' },
    })
      .png()
      .toBuffer();
    let quarantined: Uint8Array | undefined;
    const promoted: Array<[string, string]> = [];
    const storage = {
      openPrivate: async () => Readable.from(source),
      putQuarantine: async (_uploadId: string, bytes: Uint8Array) => {
        quarantined = bytes;
      },
      promote: async (uploadId: string, storageKey: string) => {
        promoted.push([uploadId, storageKey]);
      },
      removeUploadArtifacts: async () => 0,
    };

    const result = await createStoredWebpPreview({
      storage,
      sourceStorageKey: 'companies/c1/documents/d1/1.png',
      previewStorageKey: 'companies/c1/documents/d1/1.png.preview.webp',
      verifiedMime: 'image/png',
      profile: 'CLIENT_DOCUMENT',
      temporaryUploadId: 'preview-temp-1',
    });

    expect(quarantined?.byteLength).toBe(result.bytes);
    expect(await sharp(quarantined).metadata()).toMatchObject({ format: 'webp' });
    expect(promoted).toEqual([['preview-temp-1', 'companies/c1/documents/d1/1.png.preview.webp']]);
  });
});

import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

import sharp from 'sharp';

export type WebpPreviewProfile = 'CLIENT_DOCUMENT' | 'RENTAL_VEHICLE_PHOTO';

const profiles: Record<WebpPreviewProfile, { width: number; height: number; quality: number }> = {
  CLIENT_DOCUMENT: { width: 2200, height: 2200, quality: 82 },
  RENTAL_VEHICLE_PHOTO: { width: 1920, height: 1080, quality: 82 },
};

const supportedImageMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maximumInputPixels = 40_000_000;
const maximumSourceBytes = 15 * 1024 * 1024;

type PreviewStorage = {
  openPrivate(storageKey: string): Promise<Readable>;
  putQuarantine(uploadId: string, bytes: Uint8Array): Promise<void>;
  promote(uploadId: string, storageKey: string): Promise<void>;
  removeUploadArtifacts(uploadId: string): Promise<number>;
};

export function supportsWebpPreview(verifiedMime: string) {
  return supportedImageMimes.has(verifiedMime);
}

export async function createWebpPreview(input: {
  source: Uint8Array;
  verifiedMime: string;
  profile: WebpPreviewProfile;
}) {
  if (!supportsWebpPreview(input.verifiedMime)) {
    throw new Error(`WebP preview is not supported for MIME type ${input.verifiedMime}.`);
  }

  const profile = profiles[input.profile];
  const buffer = await sharp(input.source, {
    failOn: 'warning',
    limitInputPixels: maximumInputPixels,
    sequentialRead: true,
  })
    .rotate()
    .toColorspace('srgb')
    .resize({
      width: profile.width,
      height: profile.height,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: profile.quality, effort: 5 })
    .toBuffer();

  return {
    buffer,
    mime: 'image/webp' as const,
    bytes: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

async function readBounded(stream: Readable) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maximumSourceBytes) throw new Error('Image source exceeds preview size limit.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

export async function createStoredWebpPreview(input: {
  storage: PreviewStorage;
  sourceStorageKey: string;
  previewStorageKey: string;
  verifiedMime: string;
  profile: WebpPreviewProfile;
  temporaryUploadId: string;
}) {
  const source = await readBounded(await input.storage.openPrivate(input.sourceStorageKey));
  const preview = await createWebpPreview({
    source,
    verifiedMime: input.verifiedMime,
    profile: input.profile,
  });
  try {
    await input.storage.putQuarantine(input.temporaryUploadId, preview.buffer);
    await input.storage.promote(input.temporaryUploadId, input.previewStorageKey);
    return preview;
  } catch (error) {
    await input.storage.removeUploadArtifacts(input.temporaryUploadId).catch(() => 0);
    throw error;
  }
}

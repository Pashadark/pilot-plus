import sharp from 'sharp';

import type { ClientOcrDocumentKind } from './document-ocr';

export type ClientOcrImageCandidate = {
  rotation: 0 | 90 | 180 | 270;
  bytes: Buffer;
};

const clientOcrRotations = [0, 270, 90, 180] as const;

async function passportSpread(bytes: Uint8Array, rotation = 0) {
  return sharp(bytes, { failOn: 'none' }).rotate().rotate(rotation).png().toBuffer();
}

export async function preprocessRussianPassportForOcr(bytes: Uint8Array, rotation = 0) {
  const spread = await passportSpread(bytes, rotation);
  return sharp(spread).resize({ width: 1800 }).grayscale().normalize().sharpen().png().toBuffer();
}

export async function preprocessRussianPassportSerialForOcr(bytes: Uint8Array) {
  const [serial] = await createClientOcrNumberCandidates(bytes, 'PASSPORT_MAIN');
  if (!serial) throw new Error('PASSPORT_IMAGE_TOO_SMALL');
  return serial;
}

async function passportNumberCandidates(bytes: Uint8Array) {
  const spread = await passportSpread(bytes);
  const metadata = await sharp(spread).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 400 || height < 240) throw new Error('PASSPORT_IMAGE_TOO_SMALL');
  const stripWidth = Math.max(1, Math.round(width * 0.24));
  const strips = await Promise.all(
    [width - stripWidth, 0].map((left) =>
      sharp(spread).extract({ left, top: 0, width: stripWidth, height }).png().toBuffer(),
    ),
  );

  const candidates: Promise<Buffer>[] = [];
  for (const strip of strips) {
    for (const rotation of [270, 90]) {
      const rotated = await sharp(strip).rotate(rotation).png().toBuffer();
      const rotatedMetadata = await sharp(rotated).metadata();
      const rotatedWidth = rotatedMetadata.width ?? 0;
      const rotatedHeight = rotatedMetadata.height ?? 0;
      const halfWidth = Math.max(1, Math.floor(rotatedWidth / 2));
      for (const left of [0, rotatedWidth - halfWidth]) {
        candidates.push(
          sharp(rotated)
            .extract({ left, top: 0, width: halfWidth, height: rotatedHeight })
            .resize({ width: 1800 })
            .grayscale()
            .normalize()
            .sharpen()
            .png()
            .toBuffer(),
        );
      }
    }
  }
  return Promise.all(candidates);
}

export async function preprocessDriverLicenseForOcr(bytes: Uint8Array, rotation = 0) {
  return sharp(bytes, { failOn: 'none' })
    .rotate()
    .rotate(rotation)
    .grayscale()
    .resize({ width: 1800 })
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

async function preprocessRegistrationForOcr(bytes: Uint8Array, rotation = 0) {
  return sharp(bytes, { failOn: 'none' })
    .rotate()
    .rotate(rotation)
    .grayscale()
    .resize({ width: 1600, withoutEnlargement: true })
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

export async function createClientOcrImageCandidates(
  bytes: Uint8Array,
  kind: ClientOcrDocumentKind,
): Promise<ClientOcrImageCandidate[]> {
  return Promise.all(
    clientOcrRotations.map(async (rotation) => ({
      rotation,
      bytes:
        kind === 'PASSPORT_MAIN'
          ? await preprocessRussianPassportForOcr(bytes, rotation)
          : kind === 'DRIVER_LICENSE'
            ? await preprocessDriverLicenseForOcr(bytes, rotation)
            : await preprocessRegistrationForOcr(bytes, rotation),
    })),
  );
}

export async function createClientOcrNumberCandidates(
  bytes: Uint8Array,
  kind: ClientOcrDocumentKind,
) {
  if (kind === 'PASSPORT_MAIN') return passportNumberCandidates(bytes);
  if (kind === 'PASSPORT_REGISTRATION') return [];

  const metadata = await sharp(bytes).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 400 || height < 240) throw new Error('DRIVER_LICENSE_IMAGE_TOO_SMALL');
  const cropSpecs = [
    {
      left: 0,
      top: Math.round(height * 0.5),
      width: Math.round(width * 0.75),
      height: Math.max(1, height - Math.round(height * 0.5)),
    },
    {
      left: 0,
      top: Math.round(height * 0.58),
      width,
      height: Math.max(1, Math.round(height * 0.3)),
    },
  ];
  return Promise.all(
    cropSpecs.map((crop) =>
      sharp(bytes)
        .extract(crop)
        .resize({ width: 2000 })
        .normalize()
        .sharpen()
        .png()
        .toBuffer(),
    ),
  );
}

/**
 * Extracts the portrait area from a conventional Russian passport identity
 * spread. The result is intentionally shown for human review before it is
 * persisted as the client's profile photo.
 */
export async function extractRussianPassportPortrait(bytes: Uint8Array) {
  let image = sharp(bytes, { failOn: 'none' }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 320 || height < 240) throw new Error('PASSPORT_IMAGE_TOO_SMALL');

  if (height > width) {
    image = image.rotate(90);
  }
  const normalized = await image.png().toBuffer();
  const oriented = await sharp(normalized).metadata();
  const orientedWidth = oriented.width ?? width;
  const orientedHeight = oriented.height ?? height;
  const left = Math.round(orientedWidth * 0.05);
  const top = Math.round(orientedHeight * 0.25);
  const cropWidth = Math.max(1, Math.round(orientedWidth * 0.28));
  const cropHeight = Math.max(1, Math.round(orientedHeight * 0.62));

  return sharp(normalized)
    .extract({
      left: Math.min(left, orientedWidth - 1),
      top: Math.min(top, orientedHeight - 1),
      width: Math.min(cropWidth, orientedWidth - left),
      height: Math.min(cropHeight, orientedHeight - top),
    })
    .resize(480, 640, { fit: 'cover', position: 'attention' })
    .webp({ quality: 86 })
    .toBuffer();
}

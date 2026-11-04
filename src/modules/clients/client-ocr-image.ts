import sharp from 'sharp';

async function passportSpread(bytes: Uint8Array) {
  let image = sharp(bytes, { failOn: 'none' }).rotate();
  const metadata = await image.metadata();
  if ((metadata.height ?? 0) > (metadata.width ?? 0)) image = image.rotate(90);
  return image.png().toBuffer();
}

export async function preprocessRussianPassportForOcr(bytes: Uint8Array) {
  const spread = await passportSpread(bytes);
  return sharp(spread).resize({ width: 1800 }).grayscale().normalize().sharpen().png().toBuffer();
}

export async function preprocessRussianPassportSerialForOcr(bytes: Uint8Array) {
  const spread = await passportSpread(bytes);
  const metadata = await sharp(spread).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 400 || height < 240) throw new Error('PASSPORT_IMAGE_TOO_SMALL');
  const stripWidth = Math.max(1, Math.round(width * 0.24));

  const serialStrip = await sharp(spread)
    .extract({ left: width - stripWidth, top: 0, width: stripWidth, height })
    .rotate(90)
    .png()
    .toBuffer();

  return sharp(serialStrip)
    .resize({ width: 1800 })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

export async function preprocessDriverLicenseForOcr(bytes: Uint8Array) {
  return sharp(bytes, { failOn: 'none' })
    .rotate()
    .grayscale()
    .blur(1)
    .resize({ width: 900, withoutEnlargement: true })
    .normalize()
    .png()
    .toBuffer();
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

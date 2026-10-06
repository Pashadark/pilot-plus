import sharp from 'sharp';

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

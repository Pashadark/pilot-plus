import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  createClientOcrImageCandidates,
  createClientOcrNumberCandidates,
  extractRussianPassportPortrait,
  preprocessDriverLicenseForOcr,
  preprocessRussianPassportForOcr,
  preprocessRussianPassportSerialForOcr,
} from './client-ocr-image';

describe('passport OCR preprocessing', () => {
  it('prepares both vertical passport edges for serial-number OCR', async () => {
    const source = await sharp({
      create: { width: 1800, height: 1080, channels: 3, background: '#f4f1ea' },
    })
      .png()
      .toBuffer();

    const candidates = await createClientOcrNumberCandidates(source, 'PASSPORT_MAIN');
    const metadata = await Promise.all(
      candidates.map((candidate) => sharp(candidate).metadata()),
    );

    expect(candidates).toHaveLength(8);
    expect(metadata.every((item) => item.width === 1800)).toBe(true);
  });

  it('keeps all four physical document orientations available for OCR', async () => {
    const source = await sharp({
      create: { width: 1200, height: 2000, channels: 3, background: '#f4f1ea' },
    })
      .png()
      .toBuffer();

    const candidates = await createClientOcrImageCandidates(source, 'PASSPORT_MAIN');

    expect(candidates.map((candidate) => candidate.rotation)).toEqual([0, 270, 90, 180]);
    await expect(
      Promise.all(candidates.map((candidate) => sharp(candidate.bytes).metadata())),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 1800, height: 3000 }),
        expect.objectContaining({ width: 1800, height: 1080 }),
      ]),
    );
  });

  it('prepares the full spread and rotates the serial-number edge into a text line', async () => {
    const source = await sharp({
      create: { width: 2000, height: 1200, channels: 3, background: '#f4f1ea' },
    })
      .png()
      .toBuffer();

    const [spread, serial] = await Promise.all([
      preprocessRussianPassportForOcr(source),
      preprocessRussianPassportSerialForOcr(source),
    ]);
    const spreadMetadata = await sharp(spread).metadata();
    const serialMetadata = await sharp(serial).metadata();

    expect(spreadMetadata.format).toBe('png');
    expect(spreadMetadata.width).toBe(1800);
    expect(serialMetadata.format).toBe('png');
    expect(serialMetadata.width).toBeGreaterThan(serialMetadata.height ?? 0);
  });
});

describe('preprocessDriverLicenseForOcr', () => {
  it('увеличивает мелкий текст на фото прав перед распознаванием', async () => {
    const source = await sharp({
      create: {
        width: 960,
        height: 1280,
        channels: 3,
        background: '#ffffff',
      },
    })
      .jpeg()
      .toBuffer();

    const result = await preprocessDriverLicenseForOcr(source, 270);
    const metadata = await sharp(result).metadata();

    expect(metadata.width).toBe(1800);
    expect(metadata.height).toBe(1350);
  });

  it('prepares the lower-left licence area for number OCR', async () => {
    const source = await sharp({
      create: { width: 1800, height: 1350, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();

    const candidates = await createClientOcrNumberCandidates(source, 'DRIVER_LICENSE');
    const metadata = await Promise.all(
      candidates.map((candidate) => sharp(candidate).metadata()),
    );

    expect(candidates).toHaveLength(2);
    expect(metadata.every((item) => item.width === 2000)).toBe(true);
  });
});

describe('extractRussianPassportPortrait', () => {
  it('вырезает портрет из стандартной левой зоны разворота паспорта', async () => {
    const source = await sharp({
      create: { width: 2000, height: 1200, channels: 3, background: '#f4f1ea' },
    })
      .composite([
        {
          input: { create: { width: 560, height: 744, channels: 3, background: '#d36b45' } },
          left: 100,
          top: 300,
        },
      ])
      .png()
      .toBuffer();

    const result = await extractRussianPassportPortrait(source);
    const metadata = await sharp(result).metadata();
    const pixel = await sharp(result).resize(1, 1).raw().toBuffer();

    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(480);
    expect(metadata.height).toBe(640);
    expect(pixel[0]).toBeGreaterThan(pixel[1]);
    expect(pixel[1]).toBeGreaterThan(pixel[2]);
  });
});

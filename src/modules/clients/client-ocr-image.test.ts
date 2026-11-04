import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  extractRussianPassportPortrait,
  preprocessDriverLicenseForOcr,
  preprocessRussianPassportForOcr,
  preprocessRussianPassportSerialForOcr,
} from './client-ocr-image';

describe('passport OCR preprocessing', () => {
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
  it('уменьшает большое фото прав перед распознаванием', async () => {
    const source = await sharp({
      create: {
        width: 2880,
        height: 3840,
        channels: 3,
        background: '#ffffff',
      },
    })
      .jpeg()
      .toBuffer();

    const result = await preprocessDriverLicenseForOcr(source);
    const metadata = await sharp(result).metadata();

    expect(metadata.width).toBe(900);
    expect(metadata.height).toBe(1200);
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

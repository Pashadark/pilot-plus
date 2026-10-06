import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { preprocessDriverLicenseForOcr } from './client-ocr-image';

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

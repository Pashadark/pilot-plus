import { readFileSync } from 'node:fs';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const faviconPath = new URL('./favicon.ico', import.meta.url);

function readIcoEntries(buffer: Buffer) {
  const count = buffer.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const entryOffset = 6 + index * 16;
    return {
      width: buffer[entryOffset] || 256,
      height: buffer[entryOffset + 1] || 256,
      length: buffer.readUInt32LE(entryOffset + 8),
      offset: buffer.readUInt32LE(entryOffset + 12),
    };
  });
}

describe('Supa Pro favicon', () => {
  it('contains the approved multi-size blue СП mark', async () => {
    const buffer = readFileSync(faviconPath);
    const entries = readIcoEntries(buffer);
    expect(entries.map((entry) => entry.width)).toEqual(expect.arrayContaining([16, 32, 48, 64]));

    const largest = entries.toSorted((left, right) => right.width - left.width)[0];
    const frame = buffer.subarray(largest.offset, largest.offset + largest.length);
    const { data, info } = await sharp(frame)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (y * info.width + x) * 4;
      return [...data.subarray(offset, offset + 4)];
    };

    expect(pixel(0, 0)[3]).toBe(0);
    const brandPixel = pixel(Math.floor(info.width * 0.2), Math.floor(info.height / 2));
    expect(brandPixel[2]).toBeGreaterThan(180);
    expect(brandPixel[0]).toBeLessThan(80);
    const centralWhitePixels = Array.from({ length: Math.floor(info.width * 0.5) }, (_, x) =>
      Array.from({ length: Math.floor(info.height * 0.5) }, (_, y) =>
        pixel(x + Math.floor(info.width * 0.25), y + Math.floor(info.height * 0.25)),
      ),
    )
      .flat()
      .filter((rgba) => rgba.slice(0, 3).every((channel) => channel > 220) && rgba[3] > 220);
    expect(centralWhitePixels.length).toBeGreaterThan(20);
  });
});

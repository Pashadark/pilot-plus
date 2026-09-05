import { writeFile } from 'node:fs/promises';

import sharp from 'sharp';

const sizes = [16, 32, 48, 64];
const source = Buffer.from(`
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="240" height="240" rx="58" fill="#0B63F6"/>
    <text x="128" y="139" text-anchor="middle" dominant-baseline="middle"
      fill="#FFFFFF" font-family="Arial, 'Segoe UI', sans-serif" font-size="105" font-weight="700">СП</text>
  </svg>
`);

const frames = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()),
);
const headerSize = 6 + frames.length * 16;
const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);

let imageOffset = headerSize;
frames.forEach((frame, index) => {
  const entryOffset = 6 + index * 16;
  const size = sizes[index];
  header[entryOffset] = size === 256 ? 0 : size;
  header[entryOffset + 1] = size === 256 ? 0 : size;
  header[entryOffset + 2] = 0;
  header[entryOffset + 3] = 0;
  header.writeUInt16LE(1, entryOffset + 4);
  header.writeUInt16LE(32, entryOffset + 6);
  header.writeUInt32LE(frame.length, entryOffset + 8);
  header.writeUInt32LE(imageOffset, entryOffset + 12);
  imageOffset += frame.length;
});

await writeFile(new URL('../src/app/favicon.ico', import.meta.url), Buffer.concat([header, ...frames]));


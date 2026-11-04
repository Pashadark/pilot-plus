import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

const root = resolve('public/supa-car/brand');
const iconSource = resolve(root, 'supa-car-app-icon.svg');
const splashSource = resolve(root, 'supa-car-splash.svg');
const outputs = [
  [resolve(root, 'png/supa-car-icon-48.png'), iconSource, 48, 48],
  [resolve(root, 'png/supa-car-icon-72.png'), iconSource, 72, 72],
  [resolve(root, 'png/supa-car-icon-96.png'), iconSource, 96, 96],
  [resolve(root, 'png/supa-car-icon-144.png'), iconSource, 144, 144],
  [resolve(root, 'png/supa-car-icon-192.png'), iconSource, 192, 192],
  [resolve(root, 'png/supa-car-icon-512.png'), iconSource, 512, 512],
  [resolve(root, 'png/supa-car-icon-1024.png'), iconSource, 1024, 1024],
  [resolve(root, 'png/supa-car-splash-1080x1920.png'), splashSource, 1080, 1920],
];

for (const [output, source, width, height] of outputs) {
  await mkdir(dirname(output), { recursive: true });
  await sharp(source, { density: 288 }).resize(width, height).png().toFile(output);
}

console.log(`Exported ${outputs.length} SUPA CAR brand assets.`);

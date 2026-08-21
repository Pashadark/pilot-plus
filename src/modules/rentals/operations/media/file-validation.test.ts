import { describe, expect, it } from 'vitest';

import { validateOperationMediaFile } from './file-validation';

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const mp4 = Uint8Array.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

describe('rental operation media validation', () => {
  it('accepts a dashboard JPEG and an inspection MP4 by content signature', () => {
    expect(
      validateOperationMediaFile({ kind: 'DASHBOARD_PHOTO', name: 'panel.jpg', bytes: jpeg }),
    ).toMatchObject({ mime: 'image/jpeg', extension: 'jpg', bytes: 4 });
    expect(
      validateOperationMediaFile({ kind: 'INSPECTION_VIDEO', name: 'car.mp4', bytes: mp4 }),
    ).toMatchObject({ mime: 'video/mp4', extension: 'mp4', bytes: 12 });
  });

  it('rejects mismatched kinds and extensions', () => {
    expect(() =>
      validateOperationMediaFile({ kind: 'INSPECTION_VIDEO', name: 'car.mp4', bytes: jpeg }),
    ).toThrow('Видео осмотра');
    expect(() =>
      validateOperationMediaFile({ kind: 'DASHBOARD_PHOTO', name: 'panel.png', bytes: jpeg }),
    ).toThrow('Расширение файла');
  });

  it('enforces separate photo and video limits before storage', () => {
    expect(() =>
      validateOperationMediaFile({
        kind: 'DASHBOARD_PHOTO',
        name: 'panel.jpg',
        bytes: { byteLength: 15 * 1024 * 1024 + 1 } as Uint8Array,
      }),
    ).toThrow('15 МБ');
    expect(() =>
      validateOperationMediaFile({
        kind: 'INSPECTION_VIDEO',
        name: 'car.mp4',
        bytes: { byteLength: 150 * 1024 * 1024 + 1 } as Uint8Array,
      }),
    ).toThrow('150 МБ');
  });
});

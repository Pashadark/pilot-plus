import { describe, expect, it } from 'vitest';

import { validateMaintenanceAttachment } from './attachments';

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
const docx = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);

describe('maintenance attachment validation', () => {
  it('recognises supported files by signature and calculates sha256', () => {
    expect(validateMaintenanceAttachment({ name: 'damage.jpg', bytes: jpeg })).toMatchObject({
      mime: 'image/jpeg',
      extension: 'jpg',
      bytes: 4,
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(validateMaintenanceAttachment({ name: 'order.pdf', bytes: pdf })).toMatchObject({
      mime: 'application/pdf',
      extension: 'pdf',
    });
    expect(validateMaintenanceAttachment({ name: 'order.docx', bytes: docx })).toMatchObject({
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    });
  });

  it('rejects extension mismatch and files above 15 MB', () => {
    expect(() => validateMaintenanceAttachment({ name: 'damage.png', bytes: jpeg })).toThrow(
      'Расширение файла',
    );
    expect(() =>
      validateMaintenanceAttachment({
        name: 'damage.jpg',
        bytes: { byteLength: 15 * 1024 * 1024 + 1 } as Uint8Array,
      }),
    ).toThrow('15 МБ');
  });
});

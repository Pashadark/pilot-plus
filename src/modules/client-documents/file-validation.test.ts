import { describe, expect, it } from 'vitest';

import { maxUploadedFileBytes, detectAllowedFile, validateUploadedFile } from './file-validation';

describe('проверка загружаемого файла', () => {
  it.each([
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), { mime: 'image/jpeg', extension: 'jpg' }],
    [
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      { mime: 'image/png', extension: 'png' },
    ],
    [Buffer.from('524946460000000057454250', 'hex'), { mime: 'image/webp', extension: 'webp' }],
    [Buffer.from('%PDF-1.7'), { mime: 'application/pdf', extension: 'pdf' }],
  ])('распознаёт разрешённый формат по сигнатуре', (bytes, expected) => {
    expect(detectAllowedFile(bytes)).toEqual(expected);
  });

  it('отклоняет SVG независимо от заявленного расширения', () => {
    const svgBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    expect(() => detectAllowedFile(svgBytes)).toThrow('Тип файла не поддерживается.');
    expect(() => validateUploadedFile({ name: 'document.pdf', bytes: svgBytes })).toThrow(
      'Тип файла не поддерживается.',
    );
  });

  it('сверяет заявленное расширение с фактической сигнатурой', () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    expect(() => validateUploadedFile({ name: 'passport.pdf', bytes: jpegBytes })).toThrow(
      'Расширение файла не соответствует его содержимому.',
    );
  });

  it.each(['pdf', 'jpg', 'png', 'webp'])('не считает имя без точки расширением: %s', (name) => {
    expect(() => validateUploadedFile({ name, bytes: Buffer.from('%PDF-1.7') })).toThrow(
      'Расширение файла не соответствует его содержимому.',
    );
  });

  it('не принимает файл больше 15 МБ', () => {
    const bytes = Buffer.alloc(maxUploadedFileBytes + 1);
    bytes.set(Buffer.from('%PDF-'));

    expect(() => validateUploadedFile({ name: 'contract.pdf', bytes })).toThrow(
      'Размер файла не должен превышать 15 МБ.',
    );
  });
});

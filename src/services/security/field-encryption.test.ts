import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { normalizeRussianPhone } from '@/shared/utils/phone';

import { blindIndex, decryptField, encryptField } from './field-encryption';

const encryptionKey = randomBytes(32).toString('base64');
const searchKey = randomBytes(32).toString('base64');
const encryptionSource = readFileSync(new URL('./field-encryption.ts', import.meta.url), 'utf8');

describe('шифрование полей клиента', () => {
  it('шифрует значение AES-256-GCM и восстанавливает его только исходным ключом', () => {
    const encrypted = encryptField('4510 123456', encryptionKey);

    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/);
    expect(encrypted).not.toContain('123456');
    expect(decryptField(encrypted, encryptionKey)).toBe('4510 123456');
  });

  it('останавливает доступ при подмене payload или неверном ключе', () => {
    const encrypted = encryptField('секретные данные', encryptionKey);

    expect(() => decryptField(`${encrypted}x`, encryptionKey)).toThrow(
      'Не удалось расшифровать защищённое поле.',
    );
    expect(() => decryptField(encrypted, randomBytes(32).toString('base64'))).toThrow(
      'Не удалось расшифровать защищённое поле.',
    );
  });

  it('отклоняет отсутствующий, неканонический и неверной длины ключ шифрования', () => {
    const nonCanonicalKey = encryptionKey.replace(/=$/, '');
    const shortKey = randomBytes(31).toString('base64');

    for (const invalidKey of ['', nonCanonicalKey, shortKey]) {
      expect(() => encryptField('защищённые данные', invalidKey)).toThrow(
        'Не удалось зашифровать защищённое поле.',
      );
    }
  });

  it('принимает явный normalizer для доменного blind index телефона', () => {
    expect(blindIndex('8 (999) 123-45-67', searchKey, normalizeRussianPhone)).toBe(
      blindIndex('+7 (999) 123-45-67', searchKey, normalizeRussianPhone),
    );
    expect(blindIndex('79991234567', searchKey, normalizeRussianPhone)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('остаётся чистым Node-модулем для standalone CLI seed', () => {
    expect(encryptionSource).not.toContain("import 'server-only';");
  });
});

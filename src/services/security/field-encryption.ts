import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PAYLOAD_VERSION = 'v1';
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]*$/;

function isCanonicalBase64Url(value: string, allowEmpty = false): boolean {
  if ((!allowEmpty && !value) || !BASE64_URL_PATTERN.test(value)) return false;
  return Buffer.from(value, 'base64url').toString('base64url') === value;
}

function encryptionKey(key: string): Buffer {
  if (!key) throw new Error('Некорректный ключ шифрования клиентских данных.');

  const decoded = Buffer.from(key, 'base64');
  const canonical = decoded.toString('base64');
  if (decoded.length !== 32 || canonical !== key) {
    throw new Error('Некорректный ключ шифрования клиентских данных.');
  }

  return decoded;
}

function parsePayload(payload: string): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = payload.split('.');
  if (
    version !== PAYLOAD_VERSION ||
    extra !== undefined ||
    encodedIv === undefined ||
    encodedTag === undefined ||
    encodedCiphertext === undefined ||
    !isCanonicalBase64Url(encodedIv) ||
    !isCanonicalBase64Url(encodedTag) ||
    !isCanonicalBase64Url(encodedCiphertext, true)
  ) {
    throw new Error('Некорректный формат защищённого поля.');
  }

  const iv = Buffer.from(encodedIv, 'base64url');
  const tag = Buffer.from(encodedTag, 'base64url');
  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Некорректный формат защищённого поля.');
  }

  return { iv, tag, ciphertext: Buffer.from(encodedCiphertext, 'base64url') };
}

export type BlindIndexNormalizer = (value: string) => string;

export function encryptField(plaintext: string, key: string): string {
  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, encryptionKey(key), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return [
      PAYLOAD_VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  } catch {
    throw new Error('Не удалось зашифровать защищённое поле.');
  }
}

export function decryptField(payload: string, key: string): string {
  try {
    const { iv, tag, ciphertext } = parsePayload(payload);
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(key), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Не удалось расшифровать защищённое поле.');
  }
}

export function blindIndex(
  value: string,
  searchKey: string,
  normalize: BlindIndexNormalizer,
): string {
  if (!searchKey) {
    throw new Error('Ключ поиска клиентских данных не настроен.');
  }

  return createHmac('sha256', searchKey).update(normalize(value), 'utf8').digest('hex');
}

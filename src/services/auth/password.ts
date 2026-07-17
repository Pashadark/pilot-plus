import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const MINIMUM_PASSWORD_LENGTH = 12;

function scrypt(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error('Пароль должен содержать не менее 12 символов.');
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  try {
    const [algorithm, n, r, p, encodedSalt, encodedKey, extra] = encodedHash.split('$');

    if (
      extra !== undefined ||
      algorithm !== 'scrypt' ||
      n !== String(SCRYPT_N) ||
      r !== String(SCRYPT_R) ||
      p !== String(SCRYPT_P) ||
      !isCanonicalBase64Url(encodedSalt) ||
      !isCanonicalBase64Url(encodedKey)
    ) {
      return false;
    }

    const salt = Buffer.from(encodedSalt, 'base64url');
    const expectedKey = Buffer.from(encodedKey, 'base64url');

    if (salt.length !== SALT_LENGTH || expectedKey.length !== KEY_LENGTH) {
      return false;
    }

    const actualKey = await scrypt(password, salt, KEY_LENGTH);

    return actualKey.length === expectedKey.length && timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

function isCanonicalBase64Url(value: string | undefined): value is string {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return false;
  }

  return Buffer.from(value, 'base64url').toString('base64url') === value;
}

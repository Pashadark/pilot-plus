import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

type AccessIdentity = {
  ownerProfileId: string;
  sessionId: string;
};

type AccessPayload = {
  v: 1;
  sub: string;
  sid: string;
  exp: number;
};

function assertSecret(secret: string): void {
  if (secret.length < 32) {
    throw new Error('SUPA CAR auth secret must contain at least 32 characters.');
  }
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');
}

export function issueAccessToken(
  identity: AccessIdentity,
  secret: string,
  now = Date.now(),
): { token: string; expiresAt: Date } {
  assertSecret(secret);
  const expiresAt = new Date(now + ACCESS_TOKEN_TTL_MS);
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      sub: identity.ownerProfileId,
      sid: identity.sessionId,
      exp: expiresAt.getTime(),
    } satisfies AccessPayload),
    'utf8',
  ).toString('base64url');

  return { token: `${payload}.${sign(payload, secret)}`, expiresAt };
}

export function verifyAccessToken(
  token: string,
  secret: string,
  now = Date.now(),
): AccessIdentity | null {
  try {
    assertSecret(secret);
    const [encodedPayload, encodedSignature, extra] = token.split('.');
    if (!encodedPayload || !encodedSignature || extra !== undefined) return null;

    const actual = Buffer.from(encodedSignature, 'base64url');
    const expected = Buffer.from(sign(encodedPayload, secret), 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<AccessPayload>;
    if (
      payload.v !== 1 ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.sid !== 'string' ||
      !payload.sid ||
      typeof payload.exp !== 'number' ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= now
    ) {
      return null;
    }

    return { ownerProfileId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export function prepareRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashRefreshToken(token);
  return { token, tokenHash };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

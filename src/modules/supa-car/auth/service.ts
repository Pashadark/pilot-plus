export class OwnerAuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'OwnerAuthError';
  }
}

export interface OwnerAuthRepository {
  findByPhone(phoneE164: string): Promise<{
    id: string;
    displayName: string;
    phoneE164: string;
    passwordHash: string;
    status: 'ACTIVE' | 'BLOCKED';
  } | null>;
  createSession(input: {
    ownerProfileId: string;
    refreshTokenHash: string;
    deviceName: string | null;
    expiresAt: Date;
  }): Promise<{ id: string }>;
}

type LoginOwnerInput = {
  phone: string;
  password: string;
  deviceName?: string;
};

export async function loginOwner(
  input: LoginOwnerInput,
  repository: OwnerAuthRepository,
  secret: string,
  now = new Date(),
): Promise<{
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  owner: { id: string; displayName: string; phoneMasked: string };
}> {
  let phoneE164: string;
  try {
    phoneE164 = normalizeOwnerPhone(input.phone);
  } catch {
    throw new OwnerAuthError('INVALID_CREDENTIALS', 401);
  }

  const owner = await repository.findByPhone(phoneE164);
  const passwordMatches = await verifyPassword(
    input.password,
    owner?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!owner || owner.status !== 'ACTIVE' || !passwordMatches) {
    throw new OwnerAuthError('INVALID_CREDENTIALS', 401);
  }

  const refresh = prepareRefreshToken();
  const persistedSession = await repository.createSession({
    ownerProfileId: owner.id,
    refreshTokenHash: refresh.tokenHash,
    deviceName: input.deviceName?.trim().slice(0, 120) || null,
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
  });
  const access = issueAccessToken(
    { ownerProfileId: owner.id, sessionId: persistedSession.id },
    secret,
    now.getTime(),
  );

  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken: refresh.token,
    owner: {
      id: owner.id,
      displayName: owner.displayName,
      phoneMasked: `${owner.phoneE164.slice(0, 2)} *** ***-**-${owner.phoneE164.slice(-2)}`,
    },
  };
}
import { verifyPassword } from '@/services/auth/password';

import { normalizeOwnerPhone } from './phone';
import { issueAccessToken, prepareRefreshToken } from './session';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = [
  'scrypt',
  '16384',
  '8',
  '1',
  Buffer.alloc(16).toString('base64url'),
  Buffer.alloc(64).toString('base64url'),
].join('$');

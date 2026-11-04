export interface OwnerAccessRepository {
  findActiveSession(input: { sessionId: string; ownerProfileId: string; now: Date }): Promise<{
    id: string;
    companyId: string;
    displayName: string;
    phoneE164: string;
  } | null>;
}

export async function authenticateOwnerRequest(
  request: Request,
  repository: OwnerAccessRepository,
  secret: string,
  now = new Date(),
): Promise<{
  id: string;
  companyId: string;
  displayName: string;
  phoneE164: string;
}> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const claims = token ? verifyAccessToken(token, secret, now.getTime()) : null;
  if (!claims) throw new OwnerAuthError('UNAUTHORIZED', 401);

  const owner = await repository.findActiveSession({
    sessionId: claims.sessionId,
    ownerProfileId: claims.ownerProfileId,
    now,
  });
  if (!owner) throw new OwnerAuthError('UNAUTHORIZED', 401);
  return owner;
}
import { OwnerAuthError } from './service';
import { verifyAccessToken } from './session';

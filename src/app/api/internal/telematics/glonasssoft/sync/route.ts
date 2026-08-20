import { timingSafeEqual } from 'node:crypto';

import { syncCompanyLatestPositions } from '@/modules/telematics/glonasssoft/sync-company.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) return error('UNAUTHORIZED', 401);
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > 2_048) {
    return error('INVALID_REQUEST', 400);
  }
  let input: unknown;
  try {
    const text = await request.text();
    if (text.length > 2_048) return error('INVALID_REQUEST', 400);
    input = JSON.parse(text);
  } catch {
    return error('INVALID_REQUEST', 400);
  }
  if (
    typeof input !== 'object' ||
    input === null ||
    !('companyId' in input) ||
    typeof input.companyId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(input.companyId)
  ) {
    return error('INVALID_REQUEST', 400);
  }
  try {
    const result = await syncCompanyLatestPositions(input.companyId);
    return Response.json(result, { headers: HEADERS });
  } catch {
    return error('SYNC_UNAVAILABLE', 503);
  }
}

function authorized(request: Request): boolean {
  const expected = process.env.PILOT_TELEMATICS_SERVICE_TOKEN;
  const authorization = request.headers.get('authorization');
  const provided = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || expected.length < 24 || !provided) return false;
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(provided, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function error(code: string, status: number) {
  return Response.json({ error: { code } }, { status, headers: HEADERS });
}

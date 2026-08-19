import { timingSafeEqual } from 'node:crypto';

export interface BotServiceAuth {
  service: 'TELEGRAM_BOT';
}

export class BotApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'BotApiError';
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authenticateBotRequest(request: Request): Promise<BotServiceAuth> {
  const authorization = request.headers.get('authorization');
  const expected = process.env.PILOT_BOT_SERVICE_TOKEN;
  const provided = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || expected.length < 24 || !provided || !safeEqual(provided, expected)) {
    throw new BotApiError('UNAUTHORIZED', 401);
  }
  return { service: 'TELEGRAM_BOT' };
}

export function botErrorResponse(error: unknown): Response {
  if (error instanceof BotApiError) {
    return Response.json(
      { error: { code: error.code } },
      { status: error.status, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  return Response.json(
    { error: { code: 'INTERNAL_ERROR' } },
    { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

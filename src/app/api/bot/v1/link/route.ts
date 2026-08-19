import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import { linkIdentitySchema } from '@/modules/bot-api/contracts';
import { linkTelegramIdentity } from '@/modules/bot-api/invitations';

export async function POST(request: Request): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const length = Number(request.headers.get('content-length') ?? '0');
    if (!Number.isFinite(length) || length > 4096) throw new BotApiError('INVALID_REQUEST', 400);
    const parsed = linkIdentitySchema.safeParse(await request.json());
    if (!parsed.success) throw new BotApiError('INVALID_REQUEST', 400);
    const profile = await linkTelegramIdentity(parsed.data);
    return Response.json(profile, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return botErrorResponse(error);
  }
}

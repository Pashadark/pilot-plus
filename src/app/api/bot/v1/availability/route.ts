import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import { listBotAvailability } from '@/modules/bot-api/rental-requests';
import { resolveBotIdentity } from '@/modules/bot-api/queries';

export async function GET(request: Request): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const telegramUserId = request.headers.get('x-telegram-user-id');
    if (!telegramUserId) throw new BotApiError('IDENTITY_REQUIRED', 401);
    const url = new URL(request.url);
    const startsAt = new Date(url.searchParams.get('startsAt') ?? '');
    const endsAt = new Date(url.searchParams.get('endsAt') ?? '');
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()))
      throw new BotApiError('INVALID_REQUEST', 400);
    const identity = await resolveBotIdentity(telegramUserId);
    return Response.json(
      { items: await listBotAvailability(identity, startsAt, endsAt) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return botErrorResponse(error);
  }
}

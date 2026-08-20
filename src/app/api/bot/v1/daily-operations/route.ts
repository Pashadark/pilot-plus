import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import { listDailyOperations } from '@/modules/bot-api/daily-operations';
import { resolveBotIdentity } from '@/modules/bot-api/queries';

export async function GET(request: Request): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const telegramUserId = request.headers.get('x-telegram-user-id');
    if (!telegramUserId) throw new BotApiError('IDENTITY_REQUIRED', 401);
    const date = new URL(request.url).searchParams.get('date') ?? undefined;
    const result = await listDailyOperations(await resolveBotIdentity(telegramUserId), date);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return botErrorResponse(error);
  }
}

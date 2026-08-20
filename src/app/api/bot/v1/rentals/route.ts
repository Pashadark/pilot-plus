import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import { listClientRentals, resolveBotIdentity } from '@/modules/bot-api/queries';

export async function GET(request: Request): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const telegramUserId = request.headers.get('x-telegram-user-id');
    if (!telegramUserId) throw new BotApiError('IDENTITY_REQUIRED', 401);
    const identity = await resolveBotIdentity(telegramUserId);
    const rentals = await listClientRentals(identity);
    return Response.json({ items: rentals }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return botErrorResponse(error);
  }
}

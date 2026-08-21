import { authenticateBotRequest, botErrorResponse, BotApiError } from '@/modules/bot-api/auth';
import { resolveBotIdentity } from '@/modules/bot-api/queries';
import { listStaffOperationalRentals } from '@/modules/bot-api/staff-rental-operations';

export async function GET(request: Request) {
  try {
    await authenticateBotRequest(request);
    const telegramUserId = request.headers.get('x-telegram-user-id');
    if (!telegramUserId) throw new BotApiError('IDENTITY_REQUIRED', 401);
    const result = await listStaffOperationalRentals(await resolveBotIdentity(telegramUserId));
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return botErrorResponse(error);
  }
}

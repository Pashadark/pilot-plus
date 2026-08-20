import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import { createRentalDocumentGrant, resolveBotIdentity } from '@/modules/bot-api/queries';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const telegramUserId = request.headers.get('x-telegram-user-id');
    if (!telegramUserId) throw new BotApiError('IDENTITY_REQUIRED', 401);
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(id)) throw new BotApiError('NOT_FOUND', 404);
    const identity = await resolveBotIdentity(telegramUserId);
    const grants = await createRentalDocumentGrant(identity, id);
    return Response.json({ items: grants }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return botErrorResponse(error);
  }
}

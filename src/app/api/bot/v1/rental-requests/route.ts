import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import { botRentalRequestSchema, createBotRentalRequest } from '@/modules/bot-api/rental-requests';
import { resolveBotIdentity } from '@/modules/bot-api/queries';

export async function POST(request: Request): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const telegramUserId = request.headers.get('x-telegram-user-id');
    const idempotencyKey = request.headers.get('idempotency-key');
    if (!telegramUserId || !idempotencyKey) throw new BotApiError('INVALID_REQUEST', 400);
    const parsed = botRentalRequestSchema.safeParse(await request.json());
    if (!parsed.success) throw new BotApiError('INVALID_REQUEST', 400);
    const identity = await resolveBotIdentity(telegramUserId);
    const result = await createBotRentalRequest(identity, parsed.data, idempotencyKey);
    return Response.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return botErrorResponse(error);
  }
}

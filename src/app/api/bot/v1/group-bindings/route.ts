import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import { bindTelegramWorkGroup, telegramWorkGroupSchema } from '@/modules/bot-api/group-bindings';
import { resolveBotIdentity } from '@/modules/bot-api/queries';

export async function POST(request: Request): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const telegramUserId = request.headers.get('x-telegram-user-id');
    const length = Number(request.headers.get('content-length') ?? '0');
    if (!telegramUserId || !Number.isFinite(length) || length > 4096)
      throw new BotApiError('INVALID_REQUEST', 400);
    const parsed = telegramWorkGroupSchema.safeParse(await request.json());
    if (!parsed.success) throw new BotApiError('INVALID_REQUEST', 400);
    const identity = await resolveBotIdentity(telegramUserId);
    const result = await bindTelegramWorkGroup(identity, parsed.data);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return botErrorResponse(error);
  }
}

import { z } from 'zod';

import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import { enqueueManualReturnReminder } from '@/modules/bot-api/notifications';
import { resolveBotIdentity } from '@/modules/bot-api/queries';

const schema = z.object({ rentalId: z.string().min(1).max(64) });

export async function POST(request: Request): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const telegramUserId = request.headers.get('x-telegram-user-id');
    if (!telegramUserId) throw new BotApiError('IDENTITY_REQUIRED', 401);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new BotApiError('INVALID_REQUEST', 400);
    const queued = await enqueueManualReturnReminder(
      await resolveBotIdentity(telegramUserId),
      parsed.data.rentalId,
      new Date(),
    );
    return Response.json(
      { ok: true, queued },
      { status: 202, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return botErrorResponse(error);
  }
}

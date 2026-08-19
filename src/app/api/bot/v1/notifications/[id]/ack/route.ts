import { z } from 'zod';

import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import { ackNotificationJob, rescheduleNotificationJob } from '@/modules/bot-api/notifications';

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  claimToken: z.string().min(16).max(256),
  success: z.boolean(),
  errorCode: z.string().max(64).optional(),
});

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(id)) throw new BotApiError('NOT_FOUND', 404);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new BotApiError('INVALID_REQUEST', 400);
    if (parsed.data.success) await ackNotificationJob(id, parsed.data.claimToken);
    else
      await rescheduleNotificationJob(
        id,
        parsed.data.claimToken,
        parsed.data.errorCode ?? 'TELEGRAM_SEND_FAILED',
      );
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return botErrorResponse(error);
  }
}

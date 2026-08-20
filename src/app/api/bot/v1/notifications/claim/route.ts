import { z } from 'zod';

import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import {
  claimNotificationJobs,
  enqueueDailyOperationsDigests,
  enqueueReturnReminders,
} from '@/modules/bot-api/notifications';

const schema = z.object({ workerId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/u) });

export async function POST(request: Request): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new BotApiError('INVALID_REQUEST', 400);
    const now = new Date();
    await Promise.all([enqueueReturnReminders(now), enqueueDailyOperationsDigests(now)]);
    return Response.json(
      { items: await claimNotificationJobs(new Date(), parsed.data.workerId) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return botErrorResponse(error);
  }
}

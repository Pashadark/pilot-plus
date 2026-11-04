import { z } from 'zod';

import { BotApiError, authenticateBotRequest, botErrorResponse } from '@/modules/bot-api/auth';
import {
  claimNotificationJobs,
  enqueueDailyOperationsDigests,
  enqueueOperationalAlerts,
  enqueueReturnReminders,
} from '@/modules/bot-api/notifications';
import { syncDueCompanyFines } from '@/modules/bot-api/scheduled-fine-sync';

const schema = z.object({
  workerId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/u),
  audience: z.enum(['CLIENT', 'STAFF']).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    await authenticateBotRequest(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new BotApiError('INVALID_REQUEST', 400);
    const now = new Date();
    await Promise.allSettled([
      enqueueReturnReminders(now),
      enqueueDailyOperationsDigests(now),
      enqueueOperationalAlerts(now),
      syncDueCompanyFines(now),
    ]);
    return Response.json(
      {
        items: parsed.data.audience
          ? await claimNotificationJobs(
              new Date(),
              parsed.data.workerId,
              undefined,
              parsed.data.audience,
            )
          : await claimNotificationJobs(new Date(), parsed.data.workerId),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return botErrorResponse(error);
  }
}

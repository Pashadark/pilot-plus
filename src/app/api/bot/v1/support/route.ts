import { z } from 'zod';
import { authenticateBotRequest, botErrorResponse, BotApiError } from '@/modules/bot-api/auth';
import { resolveBotIdentity } from '@/modules/bot-api/queries';
import { sendClientSupport } from '@/modules/bot-api/client-support';
const schema = z.object({
  text: z.string().trim().min(1).max(1500),
  fineId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,128}$/)
    .optional(),
  key: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
});
export async function POST(request: Request) {
  try {
    await authenticateBotRequest(request);
    const user = request.headers.get('x-telegram-user-id');
    if (!user) throw new BotApiError('IDENTITY_REQUIRED', 401);
    const body = await request.text();
    if (body.length > 5000) throw new BotApiError('INVALID_REQUEST', 400);
    const parsed = schema.safeParse(JSON.parse(body));
    if (!parsed.success) throw new BotApiError('INVALID_REQUEST', 400);
    return Response.json(await sendClientSupport(await resolveBotIdentity(user), parsed.data), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return botErrorResponse(error);
  }
}

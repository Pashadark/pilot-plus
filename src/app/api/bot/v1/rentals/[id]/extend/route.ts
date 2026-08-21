import { authenticateBotRequest, botErrorResponse, BotApiError } from '@/modules/bot-api/auth';
import { resolveBotIdentity } from '@/modules/bot-api/queries';
import { executeStaffExtension } from '@/modules/bot-api/staff-rental-operations';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await authenticateBotRequest(request);
    const telegramUserId = request.headers.get('x-telegram-user-id');
    const length = Number(request.headers.get('content-length') ?? 0);
    if (!telegramUserId) throw new BotApiError('IDENTITY_REQUIRED', 401);
    if (!Number.isFinite(length) || length <= 0 || length > 4096)
      throw new BotApiError('INVALID_REQUEST', 400);
    const body = await request.json();
    if (!body || typeof body !== 'object') throw new BotApiError('INVALID_REQUEST', 400);
    const { id } = await context.params;
    const result = await executeStaffExtension(await resolveBotIdentity(telegramUserId), id, {
      idempotencyKey: String(body.idempotencyKey ?? ''),
      occurredAt: String(body.occurredAt ?? ''),
      nextEndsAt: String(body.nextEndsAt ?? ''),
      notes: String(body.notes ?? ''),
    });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return botErrorResponse(error);
  }
}

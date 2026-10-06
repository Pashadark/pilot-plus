import { authenticateBotRequest, botErrorResponse, BotApiError } from '@/modules/bot-api/auth';
import { resolveBotIdentity } from '@/modules/bot-api/queries';
import { listClientFines } from '@/modules/bot-api/client-fines';
export async function GET(request: Request) {
  try {
    await authenticateBotRequest(request);
    const user = request.headers.get('x-telegram-user-id');
    if (!user) throw new BotApiError('IDENTITY_REQUIRED', 401);
    return Response.json(
      await listClientFines(
        await resolveBotIdentity(user),
        Number(new URL(request.url).searchParams.get('page') ?? 0),
      ),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return botErrorResponse(error);
  }
}

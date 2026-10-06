import { getCurrentUser } from '@/modules/auth/dal';
import {
  getOnlineMapTrackHistory,
  mapTrackHistoryErrorStatus,
  TrackHistoryError,
} from '@/modules/online-map/server/track-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: HEADERS });
  }

  const url = new URL(request.url);
  try {
    const data = await getOnlineMapTrackHistory(user, {
      vehicleId: url.searchParams.get('vehicleId') ?? '',
      from: url.searchParams.get('from') ?? '',
      to: url.searchParams.get('to') ?? '',
    });
    return Response.json(data, { headers: HEADERS });
  } catch (error) {
    const status = mapTrackHistoryErrorStatus(error);
    const message = error instanceof TrackHistoryError ? error.message : 'Не удалось загрузить маршрут.';
    return Response.json({ error: message }, { status, headers: HEADERS });
  }
}

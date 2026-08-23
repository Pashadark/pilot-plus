import { prisma } from '@/database/prisma/client';
import { getCurrentUser } from '@/modules/auth/dal';
import { createLiveMapStream } from '@/modules/online-map/server/live-stream';
import { listOnlineMapVehicles } from '@/modules/online-map/server/queries';
import { livePositionChannel } from '@/modules/telematics/live-position-events';
import { createRedisSubscriber } from '@/services/redis/client.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, max-age=0',
  'Content-Type': 'text/event-stream; charset=utf-8',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: HEADERS });

  const companyIds =
    user.role === 'SUPER_ADMIN'
      ? (
          await prisma.telematicsIntegration.findMany({
            where: { provider: 'GLONASSSOFT', enabled: true },
            select: { companyId: true },
            take: 100,
          })
        ).map((row) => row.companyId)
      : (
          await prisma.companyMember.findMany({
            where: { userId: user.id },
            select: { companyId: true },
            take: 100,
          })
        ).map((row) => row.companyId);
  if (companyIds.length === 0) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403, headers: HEADERS });
  }

  const subscriber = await createRedisSubscriber();
  const stream = createLiveMapStream({
    channels: [...new Set(companyIds)].sort().map(livePositionChannel),
    subscriber,
    loadSnapshot: () => listOnlineMapVehicles(user),
    signal: request.signal,
  });
  return new Response(stream, { headers: HEADERS });
}

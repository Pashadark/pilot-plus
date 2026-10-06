import { readSession } from '@/services/auth/session';
import { canViewMonitor } from '@/modules/system-health/monitor-model';
import { getMonitorSnapshot } from '@/modules/system-health/monitor-server';

export async function GET() {
  const user = await readSession();
  if (!canViewMonitor(user))
    return Response.json({ error: 'FORBIDDEN' }, { status: user ? 403 : 401 });
  try {
    return Response.json(await getMonitorSnapshot(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return Response.json(
      { error: 'MONITOR_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

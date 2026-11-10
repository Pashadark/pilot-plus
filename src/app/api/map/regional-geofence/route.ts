import { getCurrentUser } from '@/modules/auth/dal';
import { getActiveVehicleRegionalGeofence } from '@/modules/regional-geofences/server/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const vehicleId = new URL(request.url).searchParams.get('vehicleId')?.trim();
  if (!vehicleId || vehicleId.length > 191) {
    return Response.json({ error: 'INVALID_VEHICLE_ID' }, { status: 400 });
  }
  const geofence = await getActiveVehicleRegionalGeofence(user, vehicleId);
  return Response.json(
    { geofence },
    { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } },
  );
}

import { Readable } from 'node:stream';

import { prisma } from '@/database/prisma/client';
import {
  canManageVehicleCompany,
  getVehicleManagementAccess,
} from '@/modules/vehicles/manage/access';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

function unavailable() {
  return new Response('Фотография недоступна.', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; imageId: string }> },
) {
  const access = await getVehicleManagementAccess();
  if (!access) return unavailable();
  const { id, imageId } = await context.params;
  const image = await prisma.vehicleImage.findFirst({
    where: {
      id: imageId,
      vehicleId: id,
      sourceUrl: 'private-upload',
      vehicle: { archivedAt: null },
    },
    select: { id: true, vehicleId: true, vehicle: { select: { companyId: true } } },
  });
  if (!image || !canManageVehicleCompany(access, image.vehicle.companyId)) return unavailable();
  const storageKey = `companies/${image.vehicle.companyId}/vehicles/${id}/images/${imageId}.webp`;
  try {
    const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
    if (!root) return unavailable();
    const storage = await LocalPrivateStorage.create(root);
    const stream = await storage.openPrivate(storageKey);
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return unavailable();
  }
}

import { Readable } from 'node:stream';

import { prisma } from '@/database/prisma/client';
import {
  canManageVehicleCompany,
  getVehicleManagementAccess,
} from '@/modules/vehicles/manage/access';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

function unavailable() {
  return new Response('Документ недоступен.', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

function encodedFilename(value: string) {
  const safe = value
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .slice(0, 180)
    .toWellFormed();
  return encodeURIComponent(safe || 'document').replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await context.params;
  const access = await getVehicleManagementAccess();
  const document = await prisma.vehicleDocument.findFirst({
    where: { id: documentId, vehicleId: id, vehicle: { archivedAt: null } },
    select: {
      id: true,
      storageKey: true,
      originalName: true,
      verifiedMime: true,
      vehicle: { select: { companyId: true } },
    },
  });
  if (
    !document?.storageKey ||
    !document.originalName ||
    !document.verifiedMime ||
    !canManageVehicleCompany(access, document.vehicle.companyId)
  )
    return unavailable();

  try {
    const storage = await LocalPrivateStorage.create(privateStorageRoot());
    const stream = await storage.openPrivate(document.storageKey);
    await prisma.auditLog.create({
      data: {
        companyId: document.vehicle.companyId,
        actorUserId: access!.user.id,
        actorEmailSnapshot: access!.user.email,
        action: 'DOWNLOAD',
        entityType: 'VEHICLE',
        entityId: id,
        entityLabel: 'Документ автомобиля',
        changes: { documentId },
      },
    });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename(document.originalName)}`,
        'Content-Type': document.verifiedMime,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return unavailable();
  }
}

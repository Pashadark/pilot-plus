import { Readable } from 'node:stream';

import { prisma } from '@/database/prisma/client';
import { writeAuditLog } from '@/modules/admin/audit';
import { getDownloadableClientPhoto } from '@/modules/client-documents/server/queries';
import { getClientAccess } from '@/modules/clients/access';
import { isClientPhotoRevision } from '@/modules/clients/photo-revision';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

type PhotoContext = { params: Promise<{ id: string }> };

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

function unavailable() {
  return new Response('Фотография недоступна.', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function GET(request: Request, context: PhotoContext) {
  const access = await getClientAccess('VIEW_CLIENTS');
  if (!access) {
    return new Response('Доступ к фотографиям клиентов запрещён.', {
      status: 403,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const { id } = await context.params;
  const revision = new URL(request.url).searchParams.get('v');
  if (!isClientPhotoRevision(revision)) return unavailable();

  const initial = await getDownloadableClientPhoto(access, id, revision);
  if (!initial) return unavailable();

  let stream: Readable;
  try {
    const storage = await LocalPrivateStorage.create(privateStorageRoot());
    stream = await storage.openPrivate(initial.storageKey);
  } catch {
    return unavailable();
  }

  try {
    const authorized = await prisma.$transaction(async (transaction) => {
      const current = await getDownloadableClientPhoto(access, id, revision, transaction);
      if (
        !current ||
        current.companyId !== initial.companyId ||
        current.clientId !== initial.clientId ||
        current.storageKey !== initial.storageKey ||
        current.revision !== initial.revision
      ) {
        return null;
      }

      await writeAuditLog(
        {
          actor: { id: access.user.id, email: access.user.email },
          action: 'VIEW',
          companyId: current.companyId,
          entityType: 'CLIENT',
          entityId: current.clientId,
          entityLabel: 'Фотография клиента',
          changes: { revision: current.revision },
        },
        transaction,
      );
      return current;
    });

    if (!authorized) {
      stream.destroy();
      return unavailable();
    }

    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    stream.destroy();
    return unavailable();
  }
}

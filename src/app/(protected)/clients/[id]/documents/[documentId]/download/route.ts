import { Readable } from 'node:stream';

import { prisma } from '@/database/prisma/client';
import { writeAuditLog } from '@/modules/admin/audit';
import { getDownloadableClientDocument } from '@/modules/client-documents/server/queries';
import { getClientAccess } from '@/modules/clients/access';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

type DownloadContext = {
  params: Promise<{ id: string; documentId: string }>;
};

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

export async function GET(request: Request, context: DownloadContext) {
  const access = await getClientAccess('VIEW_CLIENTS');
  if (!access) {
    return new Response('Доступ к документам клиентов запрещён.', {
      status: 403,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const { id: clientId, documentId } = await context.params;
  const preview = new URL(request.url).searchParams.get('preview') === '1';
  const initial = await getDownloadableClientDocument(access, clientId, documentId);
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
      const current = await getDownloadableClientDocument(
        access,
        clientId,
        documentId,
        transaction,
      );
      if (
        !current ||
        current.storageKey !== initial.storageKey ||
        current.version !== initial.version ||
        current.sha256 !== initial.sha256
      ) {
        return null;
      }

      const auditBase = {
        actor: { id: access.user.id, email: access.user.email },
        companyId: current.companyId,
        entityType: 'CLIENT_DOCUMENT' as const,
        entityId: current.documentId,
        entityLabel: 'Документ клиента',
        changes: { sha256: current.sha256, version: current.version },
      };
      await writeAuditLog({ ...auditBase, action: preview ? 'VIEW' : 'DOWNLOAD' }, transaction);
      return current;
    });

    if (!authorized) {
      stream.destroy();
      return unavailable();
    }

    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename*=UTF-8''${encodedFilename(authorized.originalName)}`,
        'Content-Type': authorized.verifiedMime,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    stream.destroy();
    return unavailable();
  }
}

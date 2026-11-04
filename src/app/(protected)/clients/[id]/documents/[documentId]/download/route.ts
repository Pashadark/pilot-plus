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

function selectedAsset(
  document: {
    storageKey: string;
    verifiedMime: string;
    sha256: string;
    previewStorageKey: string | null;
    previewMime: string | null;
    previewSha256: string | null;
  },
  preview: boolean,
) {
  if (
    preview &&
    document.previewStorageKey &&
    document.previewMime === 'image/webp' &&
    document.previewSha256
  ) {
    return {
      storageKey: document.previewStorageKey,
      mime: document.previewMime,
      sha256: document.previewSha256,
    };
  }
  return {
    storageKey: document.storageKey,
    mime: document.verifiedMime,
    sha256: document.sha256,
  };
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
  const searchParams = new URL(request.url).searchParams;
  const preview = searchParams.get('preview') === '1';
  const rawVersion = searchParams.get('v');
  if (preview && (!rawVersion || !/^[1-9]\d{0,8}$/u.test(rawVersion))) {
    return unavailable();
  }
  const expectedVersion = preview ? Number(rawVersion) : undefined;
  const initial = await getDownloadableClientDocument(
    access,
    clientId,
    documentId,
    expectedVersion,
  );
  if (!initial) return unavailable();
  const initialAsset = selectedAsset(initial, preview);

  let stream: Readable;
  try {
    const storage = await LocalPrivateStorage.create(privateStorageRoot());
    stream = await storage.openPrivate(initialAsset.storageKey);
  } catch {
    return unavailable();
  }

  try {
    const authorized = await prisma.$transaction(async (transaction) => {
      const current = await getDownloadableClientDocument(
        access,
        clientId,
        documentId,
        expectedVersion,
        transaction,
      );
      if (
        !current ||
        current.version !== initial.version ||
        current.sha256 !== initial.sha256
      ) {
        return null;
      }
      const currentAsset = selectedAsset(current, preview);
      if (
        currentAsset.storageKey !== initialAsset.storageKey ||
        currentAsset.mime !== initialAsset.mime ||
        currentAsset.sha256 !== initialAsset.sha256
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
      return { current, asset: currentAsset };
    });

    if (!authorized) {
      stream.destroy();
      return unavailable();
    }

    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename*=UTF-8''${encodedFilename(authorized.current.originalName)}`,
        'Content-Type': authorized.asset.mime,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    stream.destroy();
    return unavailable();
  }
}

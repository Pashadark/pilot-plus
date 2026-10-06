import { Readable } from 'node:stream';

import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

function unavailable() {
  return new Response('Файл недоступен.', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function encodedFilename(value: string) {
  const safe = value
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .slice(0, 180)
    .toWellFormed();
  return encodeURIComponent(safe || 'attachment').replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ recordId: string; attachmentId: string }> },
) {
  const session = await getAuthenticatedSession();
  if (!session) return unavailable();
  const { recordId, attachmentId } = await context.params;
  const attachment = await prisma.maintenanceAttachment.findFirst({
    where: {
      id: attachmentId,
      maintenanceRecordId: recordId,
      maintenanceRecord: {
        vehicle: { company: { members: { some: { userId: session.user.id } } } },
      },
    },
    select: { id: true, storageKey: true, originalName: true, verifiedMime: true },
  });
  if (!attachment) return unavailable();

  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) return unavailable();
  try {
    const storage = await LocalPrivateStorage.create(root);
    const stream = await storage.openPrivate(attachment.storageKey);
    const download = new URL(request.url).searchParams.get('download') === '1';
    const disposition =
      !download && attachment.verifiedMime.startsWith('image/') ? 'inline' : 'attachment';
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedFilename(attachment.originalName)}`,
        'Content-Type': attachment.verifiedMime,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return unavailable();
  }
}

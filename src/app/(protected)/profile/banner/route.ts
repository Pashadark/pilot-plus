import { Readable } from 'node:stream';
import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

function unavailable() {
  return new Response('Фон профиля недоступен.', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function GET() {
  const session = await getAuthenticatedSession();
  if (!session) return new Response('Доступ запрещён.', { status: 403 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { profileBannerPath: true },
  });
  const expectedPrefix = `users/${session.user.id}/profile-banner/`;
  if (!user?.profileBannerPath?.startsWith(expectedPrefix) || !user.profileBannerPath.endsWith('.webp')) {
    return unavailable();
  }
  try {
    const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
    if (!root) return unavailable();
    const storage = await LocalPrivateStorage.create(root);
    const stream = await storage.openPrivate(user.profileBannerPath);
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return unavailable();
  }
}

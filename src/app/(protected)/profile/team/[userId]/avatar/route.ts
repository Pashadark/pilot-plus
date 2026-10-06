import { Readable } from 'node:stream';
import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

function unavailable() {
  return new Response('Аватар недоступен.', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ userId: string }> }) {
  const session = await getAuthenticatedSession();
  if (!session) return new Response('Доступ запрещён.', { status: 403 });
  const { userId } = await context.params;
  const target = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      ...(session.user.role === 'SUPER_ADMIN'
        ? {}
        : {
            memberships: {
              some: {
                company: { members: { some: { userId: session.user.id } } },
              },
            },
          }),
    },
    select: { avatarPath: true },
  });
  const expectedPrefix = `users/${userId}/avatar/`;
  if (!target?.avatarPath?.startsWith(expectedPrefix) || !target.avatarPath.endsWith('.webp')) {
    return unavailable();
  }
  try {
    const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
    if (!root) return unavailable();
    const storage = await LocalPrivateStorage.create(root);
    const stream = await storage.openPrivate(target.avatarPath);
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

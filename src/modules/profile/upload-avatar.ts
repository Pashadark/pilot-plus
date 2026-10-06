'use server';

import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import sharp from 'sharp';

import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

export type AvatarActionState = { status: 'idle' | 'success' | 'error'; message?: string };

const maxAvatarBytes = 5 * 1024 * 1024;

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

export async function uploadAvatarAction(
  _state: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  const session = await getAuthenticatedSession();
  if (!session) return { status: 'error', message: 'Сессия истекла. Войдите снова.' };

  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Выберите фотографию.' };
  }
  if (file.size > maxAvatarBytes) {
    return { status: 'error', message: 'Фотография должна быть не больше 5 МБ.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const scan = await ClamAvClient.fromEnvironment().scanStream(Readable.from(Buffer.from(bytes)));
    if (scan.kind !== 'clean') {
      return {
        status: 'error',
        message:
          scan.kind === 'infected'
            ? 'Файл заблокирован проверкой безопасности.'
            : 'Не удалось проверить файл. Повторите позже.',
      };
    }

    const image = sharp(bytes, { failOn: 'error' });
    const metadata = await image.metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp', 'avif'].includes(metadata.format)) {
      return { status: 'error', message: 'Поддерживаются JPG, PNG, WebP и AVIF.' };
    }
    const normalized = await image
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .webp({ quality: 84 })
      .toBuffer();

    const storage = await LocalPrivateStorage.create(privateStorageRoot());
    const uploadId = `avatar-${randomUUID()}`;
    const storageKey = `users/${session.user.id}/avatar/${uploadId}.webp`;
    await storage.putQuarantine(uploadId, normalized);
    await storage.promote(uploadId, storageKey);

    const previous = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { avatarPath: true },
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarPath: storageKey },
    });
    if (previous?.avatarPath && previous.avatarPath !== storageKey) {
      await storage.removePrivate(previous.avatarPath).catch(() => undefined);
    }

    revalidatePath('/profile');
    revalidatePath('/', 'layout');
    return { status: 'success', message: 'Аватар обновлён.' };
  } catch {
    return { status: 'error', message: 'Не удалось обработать фотографию.' };
  }
}

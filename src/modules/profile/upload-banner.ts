'use server';

import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { revalidatePath } from 'next/cache';
import sharp from 'sharp';

import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';
import type { AvatarActionState } from './upload-avatar';

const maxBannerBytes = 8 * 1024 * 1024;

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

export async function uploadProfileBannerAction(
  _state: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  const session = await getAuthenticatedSession();
  if (!session) return { status: 'error', message: 'Сессия истекла. Войдите снова.' };
  const file = formData.get('banner');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Выберите изображение.' };
  }
  if (file.size > maxBannerBytes) {
    return { status: 'error', message: 'Изображение должно быть не больше 8 МБ.' };
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
      .resize(1600, 480, { fit: 'cover', position: 'centre' })
      .webp({ quality: 86 })
      .toBuffer();
    const storage = await LocalPrivateStorage.create(privateStorageRoot());
    const uploadId = `profile-banner-${randomUUID()}`;
    const storageKey = `users/${session.user.id}/profile-banner/${uploadId}.webp`;
    await storage.putQuarantine(uploadId, normalized);
    await storage.promote(uploadId, storageKey);

    const previous = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { profileBannerPath: true },
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { profileBannerPath: storageKey },
    });
    if (previous?.profileBannerPath && previous.profileBannerPath !== storageKey) {
      await storage.removePrivate(previous.profileBannerPath).catch(() => undefined);
    }
    revalidatePath('/profile');
    return { status: 'success', message: 'Фон профиля обновлён.' };
  } catch {
    return { status: 'error', message: 'Не удалось обработать изображение.' };
  }
}

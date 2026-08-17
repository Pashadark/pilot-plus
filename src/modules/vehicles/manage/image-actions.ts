'use server';

import { randomUUID } from 'node:crypto';

import sharp from 'sharp';
import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';
import { scanPendingUpload } from '@/modules/client-documents/scan-upload';
import { validateUploadedFile } from '@/modules/client-documents/file-validation';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

import { canManageVehicleCompany, getVehicleManagementAccess } from './access';

export type VehicleImageActionState = { ok: boolean; message: string };

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

async function streamBytes(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function editableVehicle(vehicleId: string) {
  const access = await getVehicleManagementAccess();
  if (!access) return null;
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, archivedAt: null },
    select: { id: true, companyId: true, make: true, modelName: true },
  });
  if (!vehicle || !canManageVehicleCompany(access, vehicle.companyId)) return null;
  return { access, vehicle };
}

function refresh(vehicleId: string) {
  revalidatePath('/vehicles');
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/edit`);
}

export async function uploadVehicleImageAction(
  formData: FormData,
): Promise<VehicleImageActionState> {
  const vehicleId = String(formData.get('vehicleId') ?? '').trim();
  const context = await editableVehicle(vehicleId);
  if (!context) return { ok: false, message: 'Автомобиль недоступен.' };
  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) return { ok: false, message: 'Выберите фотографию.' };
  if (files.length > 4) return { ok: false, message: 'За один раз можно загрузить до 4 фото.' };
  const count = await prisma.vehicleImage.count({ where: { vehicleId } });
  if (count + files.length > 12)
    return { ok: false, message: 'Для автомобиля доступно до 12 фото.' };

  const storage = await LocalPrivateStorage.create(privateStorageRoot());
  let position = count;
  let activeUploadId: string | null = null;
  let activeSourceKey: string | null = null;
  try {
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const validated = validateUploadedFile({ name: file.name, bytes });
      if (!validated.mime.startsWith('image/'))
        throw new Error('Разрешены только JPG, PNG и WebP.');
      const imageId = randomUUID();
      const uploadId = randomUUID();
      activeUploadId = uploadId;
      const sourceKey = `companies/${context.vehicle.companyId}/vehicles/${vehicleId}/source/${uploadId}.${validated.extension}`;
      activeSourceKey = sourceKey;
      const finalKey = `companies/${context.vehicle.companyId}/vehicles/${vehicleId}/images/${imageId}.webp`;
      await storage.putQuarantine(uploadId, bytes);
      const scan = await scanPendingUpload({
        storage,
        scanner: ClamAvClient.fromEnvironment(),
        uploadId,
        storageKey: sourceKey,
      });
      if (scan.status !== 'CLEAN') throw new Error('Антивирусная проверка не пройдена.');
      const normalized = await sharp(await streamBytes(await storage.openPrivate(sourceKey)))
        .rotate()
        .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer();
      const normalizedId = `normalized-${uploadId}`;
      await storage.putQuarantine(normalizedId, normalized);
      await storage.promote(normalizedId, finalKey);
      try {
        await prisma.$transaction(async (transaction) => {
          const primary = position === 0;
          await transaction.vehicleImage.create({
            data: {
              id: imageId,
              vehicleId,
              localPath: `/vehicles/${vehicleId}/images/${imageId}`,
              sourceUrl: 'private-upload',
              alt: `${context.vehicle.make} ${context.vehicle.modelName}`,
              position,
              isPrimary: primary,
            },
          });
          await transaction.auditLog.create({
            data: {
              companyId: context.vehicle.companyId,
              actorUserId: context.access.user.id,
              actorEmailSnapshot: context.access.user.email,
              action: 'CREATE',
              entityType: 'VEHICLE',
              entityId: vehicleId,
              entityLabel: 'Фотография автомобиля',
              changes: { imageId, primary, sha256: scan.audit.sha256 },
            },
          });
        });
      } catch (error) {
        await storage.removePrivate(finalKey).catch(() => undefined);
        throw error;
      } finally {
        await storage.removePrivate(sourceKey).catch(() => undefined);
      }
      activeUploadId = null;
      activeSourceKey = null;
      position += 1;
    }
    refresh(vehicleId);
    return { ok: true, message: 'Фотографии загружены.' };
  } catch (error) {
    if (activeUploadId) await storage.removeUploadArtifacts(activeUploadId).catch(() => undefined);
    if (activeSourceKey) await storage.removePrivate(activeSourceKey).catch(() => undefined);
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Не удалось загрузить фото.',
    };
  }
}

async function imageContext(vehicleId: string, imageId: string) {
  const context = await editableVehicle(vehicleId);
  if (!context) return null;
  const image = await prisma.vehicleImage.findFirst({ where: { id: imageId, vehicleId } });
  return image ? { ...context, image } : null;
}

export async function setPrimaryVehicleImageAction(
  formData: FormData,
): Promise<VehicleImageActionState> {
  const vehicleId = String(formData.get('vehicleId') ?? '');
  const imageId = String(formData.get('imageId') ?? '');
  const context = await imageContext(vehicleId, imageId);
  if (!context) return { ok: false, message: 'Фотография недоступна.' };
  await prisma.$transaction([
    prisma.vehicleImage.updateMany({ where: { vehicleId }, data: { isPrimary: false } }),
    prisma.vehicleImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ]);
  refresh(vehicleId);
  return { ok: true, message: 'Основная фотография изменена.' };
}

export async function moveVehicleImageAction(formData: FormData): Promise<VehicleImageActionState> {
  const vehicleId = String(formData.get('vehicleId') ?? '');
  const imageId = String(formData.get('imageId') ?? '');
  const direction = String(formData.get('direction') ?? '');
  const context = await imageContext(vehicleId, imageId);
  if (!context || !['up', 'down'].includes(direction))
    return { ok: false, message: 'Фотография недоступна.' };
  const neighbor = await prisma.vehicleImage.findFirst({
    where: {
      vehicleId,
      position:
        direction === 'up' ? { lt: context.image.position } : { gt: context.image.position },
    },
    orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbor) return { ok: true, message: 'Порядок не изменён.' };
  await prisma.$transaction([
    prisma.vehicleImage.update({ where: { id: context.image.id }, data: { position: -1 } }),
    prisma.vehicleImage.update({
      where: { id: neighbor.id },
      data: { position: context.image.position },
    }),
    prisma.vehicleImage.update({
      where: { id: context.image.id },
      data: { position: neighbor.position },
    }),
  ]);
  refresh(vehicleId);
  return { ok: true, message: 'Порядок фотографий изменён.' };
}

export async function deleteVehicleImageAction(
  formData: FormData,
): Promise<VehicleImageActionState> {
  const vehicleId = String(formData.get('vehicleId') ?? '');
  const imageId = String(formData.get('imageId') ?? '');
  const context = await imageContext(vehicleId, imageId);
  if (!context) return { ok: false, message: 'Фотография недоступна.' };
  await prisma.vehicleImage.delete({ where: { id: imageId } });
  if (context.image.sourceUrl === 'private-upload') {
    const key = `companies/${context.vehicle.companyId}/vehicles/${vehicleId}/images/${imageId}.webp`;
    const storage = await LocalPrivateStorage.create(privateStorageRoot());
    await storage.removePrivate(key).catch(() => undefined);
  }
  const remaining = await prisma.vehicleImage.findMany({
    where: { vehicleId },
    orderBy: { position: 'asc' },
  });
  await prisma.$transaction(
    remaining.map((image, index) =>
      prisma.vehicleImage.update({
        where: { id: image.id },
        data: { position: index, isPrimary: index === 0 ? true : image.isPrimary },
      }),
    ),
  );
  refresh(vehicleId);
  return { ok: true, message: 'Фотография удалена.' };
}

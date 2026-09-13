import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { prisma } from '../src/database/prisma/client';
import { validateMaintenanceAttachment } from '../src/modules/maintenance/attachments';
import {
  buildCamryDamageImport,
  CAMRY_DAMAGE_IMPORT,
} from '../src/modules/maintenance/server/camry-damage-import';
import { LocalPrivateStorage } from '../src/services/storage/local-private-storage';

async function main() {
  const apply = process.argv.includes('--apply');
  const photoPaths = process.argv.slice(2).filter((value) => value !== '--apply');
  if (photoPaths.length !== 3) {
    throw new Error('Укажите ровно три пути к фотографиям повреждения.');
  }

  const [vehicle, rental, existing] = await Promise.all([
    prisma.vehicle.findUniqueOrThrow({
      where: { id: CAMRY_DAMAGE_IMPORT.vehicleId },
      select: { id: true, companyId: true, registrationNumber: true },
    }),
    prisma.rental.findUniqueOrThrow({
      where: { id: CAMRY_DAMAGE_IMPORT.rentalId },
      select: { id: true, vehicleId: true, clientId: true, contractNumber: true },
    }),
    prisma.maintenanceRecord.findFirst({
      where: {
        vehicleId: CAMRY_DAMAGE_IMPORT.vehicleId,
        rentalId: CAMRY_DAMAGE_IMPORT.rentalId,
        recordType: 'REPAIR',
        damageReportedAt: new Date('2026-09-12T09:00:00.000Z'),
      },
      select: { id: true },
    }),
  ]);
  const data = buildCamryDamageImport({ vehicle, rental });
  const photos = await Promise.all(
    photoPaths.map(async (path) => {
      const bytes = new Uint8Array(await readFile(path));
      return { path, bytes, validated: validateMaintenanceAttachment({ name: path, bytes }) };
    }),
  );

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        existingRecordId: existing?.id ?? null,
        vehicle: vehicle.registrationNumber,
        rental: rental.contractNumber,
        clientId: rental.clientId,
        photos: photos.map(({ path, validated }) => ({
          path,
          bytes: validated.bytes,
          mime: validated.mime,
        })),
      },
      null,
      2,
    ),
  );
  if (!apply || existing) return;

  const storageRoot = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!storageRoot) throw new Error('PRIVATE_STORAGE_ROOT не настроен.');
  const storage = await LocalPrivateStorage.create(storageRoot);
  const recordId = randomUUID();
  const storedKeys: string[] = [];
  const attachments = [];
  try {
    for (const [index, photo] of photos.entries()) {
      const attachmentId = randomUUID();
      const uploadId = randomUUID();
      const storageKey = `companies/${vehicle.companyId}/vehicles/${vehicle.id}/maintenance/${recordId}/${attachmentId}.${photo.validated.extension}`;
      await storage.putQuarantine(uploadId, photo.bytes);
      await storage.promote(uploadId, storageKey);
      storedKeys.push(storageKey);
      attachments.push({
        id: attachmentId,
        kind: 'DAMAGE_BEFORE' as const,
        storageKey,
        originalName: `camry-x069ae997-damage-2026-09-12-${index + 1}.${photo.validated.extension}`,
        verifiedMime: photo.validated.mime,
        sha256: photo.validated.sha256,
        bytes: photo.validated.bytes,
        caption: `Повреждение до ремонта, фото ${index + 1}`,
      });
    }

    await prisma.$transaction([
      prisma.maintenanceRecord.create({
        data: {
          id: recordId,
          ...data,
          attachments: { create: attachments },
          workItems: {
            create: [{ title: 'Дефектовка повреждений', position: 0 }],
          },
        },
      }),
      prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { status: 'MAINTENANCE' },
      }),
    ]);
    console.log(JSON.stringify({ createdRecordId: recordId, status: 'IN_PROGRESS' }));
  } catch (error) {
    await Promise.all(storedKeys.map((key) => storage.removePrivate(key).catch(() => undefined)));
    throw error;
  }
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';
import { validateUploadedFile } from '@/modules/client-documents/file-validation';
import { scanPendingUpload } from '@/modules/client-documents/scan-upload';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

import { canManageVehicleCompany, getVehicleManagementAccess } from './access';

export type VehicleDocumentActionState = { ok: boolean; message: string };

const documentTypes = new Set(['STS', 'PTS', 'OSAGO', 'CASCO', 'MAINTENANCE', 'REPAIR', 'OTHER']);

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

function refresh(vehicleId: string) {
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/edit`);
}

export async function uploadVehicleDocumentAction(
  formData: FormData,
): Promise<VehicleDocumentActionState> {
  const vehicleId = String(formData.get('vehicleId') ?? '').trim();
  const type = String(formData.get('type') ?? '')
    .trim()
    .toUpperCase();
  const title = String(formData.get('title') ?? '')
    .trim()
    .slice(0, 160);
  const expiresAtRaw = String(formData.get('expiresAt') ?? '').trim();
  const file = formData.get('file');
  if (!documentTypes.has(type)) return { ok: false, message: 'Выберите тип документа.' };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, message: 'Выберите файл документа.' };

  const access = await getVehicleManagementAccess();
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, archivedAt: null },
    select: { id: true, companyId: true },
  });
  if (!access || !vehicle || !canManageVehicleCompany(access, vehicle.companyId)) {
    return { ok: false, message: 'Автомобиль недоступен.' };
  }

  let expiresAt: Date | null = null;
  if (expiresAtRaw) {
    expiresAt = new Date(`${expiresAtRaw}T00:00:00.000Z`);
    if (Number.isNaN(expiresAt.valueOf()))
      return { ok: false, message: 'Проверьте срок действия.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let validated: ReturnType<typeof validateUploadedFile>;
  try {
    validated = validateUploadedFile({ name: file.name, bytes });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Файл не принят.' };
  }

  const documentId = randomUUID();
  const uploadId = randomUUID();
  const storageKey = `companies/${vehicle.companyId}/vehicles/${vehicle.id}/documents/${documentId}.${validated.extension}`;
  const storage = await LocalPrivateStorage.create(privateStorageRoot());
  try {
    await storage.putQuarantine(uploadId, bytes);
    const scan = await scanPendingUpload({
      storage,
      scanner: ClamAvClient.fromEnvironment(),
      uploadId,
      storageKey,
    });
    if (scan.status !== 'CLEAN') throw new Error('Антивирусная проверка не пройдена.');

    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.vehicleDocument.create({
          data: {
            id: documentId,
            vehicleId,
            type,
            title: title || file.name.replace(/\.[^.]+$/u, ''),
            expiresAt,
            storageKey,
            originalName: file.name.slice(0, 220),
            verifiedMime: validated.mime,
            sha256: scan.audit.sha256,
            bytes: validated.bytes,
          },
        });
        await transaction.auditLog.create({
          data: {
            companyId: vehicle.companyId,
            actorUserId: access.user.id,
            actorEmailSnapshot: access.user.email,
            action: 'CREATE',
            entityType: 'VEHICLE',
            entityId: vehicle.id,
            entityLabel: 'Документ автомобиля',
            changes: { documentId, type, sha256: scan.audit.sha256 },
          },
        });
      });
    } catch (error) {
      await storage.removePrivate(storageKey).catch(() => undefined);
      throw error;
    }
    refresh(vehicleId);
    return { ok: true, message: 'Документ загружен и проверен.' };
  } catch (error) {
    await storage.removeUploadArtifacts(uploadId).catch(() => undefined);
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Не удалось загрузить документ.',
    };
  }
}

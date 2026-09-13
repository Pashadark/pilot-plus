'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

import { validateMaintenanceAttachment } from './attachments';
import { canTransitionMaintenance } from './status';
import type { MaintenanceStatus, OperationActionState } from './types';
import { parseMaintenanceInput, parseRepairInput } from './validation';

const SESSION_ERROR: OperationActionState = {
  status: 'error',
  message: 'Сессия истекла. Войдите снова.',
};
const VEHICLE_UNAVAILABLE_ERROR: OperationActionState = {
  status: 'error',
  message: 'Автомобиль недоступен.',
};
const INVALID_TRANSITION_ERROR: OperationActionState = {
  status: 'error',
  message: 'Недопустимый переход статуса ТО.',
};
const RECORD_UNAVAILABLE_ERROR: OperationActionState = {
  status: 'error',
  message: 'Запись ТО недоступна или уже изменилась.',
};
const SAVE_ERROR: OperationActionState = {
  status: 'error',
  message: 'Не удалось сохранить ТО. Попробуйте позже.',
};

const statuses: readonly MaintenanceStatus[] = [
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'CANCELLED',
  'DAMAGE_REPORTED',
  'WAITING_REPAIR',
];

const attachmentInputs = [
  ['damageBeforeFiles', 'DAMAGE_BEFORE'],
  ['repairAfterFiles', 'REPAIR_AFTER'],
  ['documentFiles', 'DOCUMENT'],
  ['receiptFiles', 'RECEIPT'],
] as const;

function formString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function parseStatus(value: string): MaintenanceStatus | null {
  return statuses.find((status) => status === value) ?? null;
}

function vehicleMembershipWhere(vehicleId: string, userId: string) {
  return {
    id: vehicleId,
    company: { members: { some: { userId } } },
  };
}

function transitionData(
  targetStatus: MaintenanceStatus,
): Prisma.MaintenanceRecordUpdateManyMutationInput {
  if (targetStatus === 'COMPLETED') {
    return { status: targetStatus, completedAt: new Date() };
  }

  return { status: targetStatus };
}

export async function createMaintenanceAction(
  _previousState: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const session = await getAuthenticatedSession();
  if (!session) return SESSION_ERROR;

  const input = parseMaintenanceInput(formData);
  if (!input.ok) return input.state;

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: vehicleMembershipWhere(input.data.vehicleId, session.user.id),
      select: {
        id: true,
        positions: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: { odometerKm: true },
        },
      },
    });
    if (!vehicle) return VEHICLE_UNAVAILABLE_ERROR;

    await prisma.maintenanceRecord.create({
      data: {
        ...input.data,
        odometerKm:
          vehicle.positions[0]?.odometerKm === null || !vehicle.positions[0]
            ? null
            : Number(vehicle.positions[0].odometerKm.toString()),
        status: 'PLANNED',
      },
    });
  } catch {
    return SAVE_ERROR;
  }

  revalidatePath('/maintenance');
  return { status: 'success', message: 'ТО запланировано.' };
}

function privateStorageRoot() {
  const configured = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return './.pilot-private-storage';
  throw new Error('Приватное хранилище не настроено.');
}

export async function createRepairAction(
  _previousState: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const session = await getAuthenticatedSession();
  if (!session) return SESSION_ERROR;

  const input = parseRepairInput(formData);
  if (!input.ok) return input.state;

  const files = attachmentInputs.flatMap(([field, kind]) =>
    formData
      .getAll(field)
      .filter((value): value is File => value instanceof File && value.size > 0)
      .map((file) => ({ file, kind })),
  );
  if (files.length > 12) {
    return { status: 'error', message: 'К одной записи можно добавить не более 12 файлов.' };
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: vehicleMembershipWhere(input.data.vehicleId, session.user.id),
    select: { id: true, companyId: true },
  });
  if (!vehicle) return VEHICLE_UNAVAILABLE_ERROR;

  const rental = input.data.rentalId
    ? await prisma.rental.findFirst({
        where: {
          id: input.data.rentalId,
          vehicleId: vehicle.id,
          company: { members: { some: { userId: session.user.id } } },
        },
        select: { id: true, clientId: true },
      })
    : null;
  if (input.data.rentalId && !rental) {
    return { status: 'error', message: 'Выбранная аренда не относится к этому автомобилю.' };
  }

  const recordId = randomUUID();
  const promotedKeys: string[] = [];
  const preparedAttachments: Array<{
    id: string;
    kind: (typeof attachmentInputs)[number][1];
    storageKey: string;
    originalName: string;
    verifiedMime: string;
    sha256: string;
    bytes: number;
  }> = [];
  let storage: Awaited<ReturnType<typeof LocalPrivateStorage.create>> | null = null;

  try {
    if (files.length) storage = await LocalPrivateStorage.create(privateStorageRoot());
    for (const { file, kind } of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const validated = validateMaintenanceAttachment({ name: file.name, bytes });
      const attachmentId = randomUUID();
      const uploadId = randomUUID();
      const storageKey = `companies/${vehicle.companyId}/vehicles/${vehicle.id}/maintenance/${recordId}/${attachmentId}.${validated.extension}`;
      await storage?.putQuarantine(uploadId, bytes);
      await storage?.promote(uploadId, storageKey);
      promotedKeys.push(storageKey);
      preparedAttachments.push({
        id: attachmentId,
        kind,
        storageKey,
        originalName: file.name.slice(0, 220),
        verifiedMime: validated.mime,
        sha256: validated.sha256,
        bytes: validated.bytes,
      });
    }

    await prisma.maintenanceRecord.create({
      data: {
        id: recordId,
        vehicleId: vehicle.id,
        rentalId: rental?.id ?? null,
        clientId: rental?.clientId ?? null,
        title: input.data.title,
        description: input.data.description,
        recordType: 'REPAIR',
        kind: 'OTHER',
        status: input.data.status,
        damageReportedAt: input.data.damageReportedAt,
        startedAt: input.data.status === 'IN_PROGRESS' ? new Date() : null,
        odometerKm: input.data.odometerKm,
        provider: input.data.provider,
        costMinor: input.data.costMinor,
        notes: input.data.notes,
        workItems: {
          create: input.data.workItems.map((item, position) => ({ ...item, position })),
        },
        attachments: { create: preparedAttachments },
      },
    });
  } catch (error) {
    if (storage) {
      await Promise.all(
        promotedKeys.map((storageKey) => storage.removePrivate(storageKey).catch(() => undefined)),
      );
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Не удалось добавить ремонт.',
    };
  }

  revalidatePath('/maintenance');
  revalidatePath(`/vehicles/${vehicle.id}`);
  return { status: 'success', message: 'Ремонт добавлен.' };
}

export async function transitionMaintenanceAction(
  _previousState: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  const session = await getAuthenticatedSession();
  if (!session) return SESSION_ERROR;

  const recordId = formString(formData, 'recordId');
  const fromStatus = parseStatus(formString(formData, 'fromStatus'));
  const toStatus = parseStatus(formString(formData, 'toStatus'));

  if (!recordId || !fromStatus || !toStatus || !canTransitionMaintenance(fromStatus, toStatus)) {
    return INVALID_TRANSITION_ERROR;
  }

  try {
    const statusWhere =
      fromStatus === 'OVERDUE'
        ? {
            status: 'PLANNED' as const,
            scheduledAt: { lt: new Date() },
          }
        : { status: fromStatus };
    const updated = await prisma.maintenanceRecord.updateMany({
      where: {
        id: recordId,
        ...statusWhere,
        vehicle: { company: { members: { some: { userId: session.user.id } } } },
      },
      data: transitionData(toStatus),
    });
    if (updated.count !== 1) return RECORD_UNAVAILABLE_ERROR;
  } catch {
    return SAVE_ERROR;
  }

  revalidatePath('/maintenance');
  return { status: 'success', message: 'Статус ТО обновлён.' };
}

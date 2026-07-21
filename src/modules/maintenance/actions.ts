'use server';

import { revalidatePath } from 'next/cache';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';

import { canTransitionMaintenance } from './status';
import type { MaintenanceStatus, OperationActionState } from './types';
import { parseMaintenanceInput } from './validation';

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
];

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
      select: { id: true },
    });
    if (!vehicle) return VEHICLE_UNAVAILABLE_ERROR;

    await prisma.maintenanceRecord.create({
      data: {
        ...input.data,
        status: 'PLANNED',
      },
    });
  } catch {
    return SAVE_ERROR;
  }

  revalidatePath('/maintenance');
  return { status: 'success', message: 'ТО запланировано.' };
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
    const updated = await prisma.maintenanceRecord.updateMany({
      where: {
        id: recordId,
        status: fromStatus,
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

'use server';

import { revalidatePath } from 'next/cache';

import { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';

import { canUpdateFirmware } from './firmware';
import type { DeviceActionState } from './types';
import {
  bindDeviceSchema,
  cancelDeviceCommandSchema,
  createDeviceCommandSchema,
  createDeviceSchema,
} from './validation';

const SESSION_ERROR: DeviceActionState = {
  success: false,
  message: 'Сессия истекла. Войдите снова.',
};
const DEVICE_UNAVAILABLE_ERROR: DeviceActionState = {
  success: false,
  message: 'Устройство недоступно.',
};
const VEHICLE_UNAVAILABLE_ERROR: DeviceActionState = {
  success: false,
  message: 'Автомобиль недоступен.',
};
const VEHICLE_OCCUPIED_ERROR: DeviceActionState = {
  success: false,
  message: 'К этому автомобилю уже привязано устройство Pilot Connect.',
};
const COMMAND_CONFLICT_ERROR: DeviceActionState = {
  success: false,
  message: 'Для устройства уже выполняется команда.',
};
const FIRMWARE_UNAVAILABLE_ERROR: DeviceActionState = {
  success: false,
  message: 'Выбранная версия прошивки недоступна.',
};
const COMMAND_UNAVAILABLE_ERROR: DeviceActionState = {
  success: false,
  message: 'Команда недоступна или уже отправлена.',
};

type AuthorizedDeviceContext = {
  companyId: string;
  userId: string;
};

function formValue(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

function validationState(error: {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}): DeviceActionState {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0,
    ),
  );

  return {
    success: false,
    message: 'Проверьте заполнение полей.',
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
  };
}

function uniqueFieldState(error: unknown): DeviceActionState | null {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2002') {
    return null;
  }

  const meta =
    'meta' in error && typeof error.meta === 'object' && error.meta !== null ? error.meta : null;
  const target = meta && 'target' in meta ? meta.target : undefined;
  const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  const fieldErrors: Record<string, string[]> = {};

  if (fields.includes('serialNumber'))
    fieldErrors.serialNumber = ['Серийный номер уже используется.'];
  if (fields.includes('imei')) fieldErrors.imei = ['IMEI уже используется.'];

  return Object.keys(fieldErrors).length > 0
    ? { success: false, message: 'Не удалось добавить устройство. Проверьте данные.', fieldErrors }
    : { success: false, message: 'Не удалось сохранить устройство. Попробуйте позже.' };
}

function isTransactionConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

async function getAuthorizedDeviceContext(): Promise<AuthorizedDeviceContext | null> {
  const session = await getAuthenticatedSession();
  if (!session) return null;

  const membership = await prisma.companyMember.findFirst({
    where: { userId: session.user.id, role: 'ADMIN' },
    select: { companyId: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) return null;

  return { companyId: membership.companyId, userId: session.user.id };
}

function revalidateDevices(deviceId: string): void {
  revalidatePath('/devices');
  revalidatePath(`/devices/${deviceId}`);
}

export async function createDeviceAction(
  _previousState: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState> {
  const parsed = createDeviceSchema.safeParse({
    name: formValue(formData, 'name'),
    serialNumber: formValue(formData, 'serialNumber'),
    imei: formValue(formData, 'imei'),
    hardwareVersion: formValue(formData, 'hardwareVersion'),
    firmwareVersion: formValue(formData, 'firmwareVersion'),
    vehicleId: formValue(formData, 'vehicleId'),
  });
  if (!parsed.success) return validationState(parsed.error);

  const context = await getAuthorizedDeviceContext();
  if (!context) return SESSION_ERROR;

  try {
    const device = await prisma.$transaction(async (transaction) => {
      if (parsed.data.vehicleId) {
        const vehicle = await transaction.vehicle.findFirst({
          where: { id: parsed.data.vehicleId, companyId: context.companyId },
          select: { id: true, device: { select: { id: true } } },
        });
        if (!vehicle) return null;
        if (vehicle.device) return VEHICLE_OCCUPIED_ERROR;
      }

      return transaction.device.create({
        data: {
          companyId: context.companyId,
          name: parsed.data.name,
          serialNumber: parsed.data.serialNumber,
          imei: parsed.data.imei,
          hardwareVersion: parsed.data.hardwareVersion,
          firmwareVersion: parsed.data.firmwareVersion,
          vehicleId: parsed.data.vehicleId ?? null,
        },
        select: { id: true },
      });
    });
    if (device === null) return VEHICLE_UNAVAILABLE_ERROR;
    if ('success' in device) return device;

    revalidateDevices(device.id);
    return { success: true, message: 'Устройство добавлено.' };
  } catch (error) {
    return (
      uniqueFieldState(error) ?? {
        success: false,
        message: 'Не удалось сохранить устройство. Попробуйте позже.',
      }
    );
  }
}

export async function bindDeviceAction(
  _previousState: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState> {
  const parsed = bindDeviceSchema.safeParse({
    deviceId: formValue(formData, 'deviceId'),
    vehicleId: formValue(formData, 'vehicleId'),
  });
  if (!parsed.success) return validationState(parsed.error);

  const context = await getAuthorizedDeviceContext();
  if (!context) return SESSION_ERROR;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const device = await transaction.device.findFirst({
        where: { id: parsed.data.deviceId, companyId: context.companyId },
        select: { id: true, vehicleId: true },
      });
      if (!device) return DEVICE_UNAVAILABLE_ERROR;

      if (parsed.data.vehicleId) {
        const vehicle = await transaction.vehicle.findFirst({
          where: { id: parsed.data.vehicleId, companyId: context.companyId },
          select: { id: true, device: { select: { id: true } } },
        });
        if (!vehicle) return VEHICLE_UNAVAILABLE_ERROR;
        if (vehicle.device && vehicle.device.id !== device.id) return VEHICLE_OCCUPIED_ERROR;
      }

      const updated = await transaction.device.updateMany({
        where: { id: device.id, companyId: context.companyId },
        data: { vehicleId: parsed.data.vehicleId ?? null },
      });
      if (updated.count !== 1) return DEVICE_UNAVAILABLE_ERROR;

      return { deviceId: device.id };
    });
    if ('success' in result) return result;

    revalidateDevices(result.deviceId);
    return {
      success: true,
      message: parsed.data.vehicleId
        ? 'Автомобиль привязан к устройству.'
        : 'Автомобиль отвязан от устройства.',
    };
  } catch (error) {
    if (uniqueFieldState(error)) return VEHICLE_OCCUPIED_ERROR;
    return { success: false, message: 'Не удалось изменить привязку. Попробуйте позже.' };
  }
}

export async function createDeviceCommandAction(
  _previousState: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState> {
  const parsed = createDeviceCommandSchema.safeParse({
    deviceId: formValue(formData, 'deviceId'),
    type: formValue(formData, 'type'),
    ...(formValue(formData, 'firmwareReleaseId')
      ? { firmwareReleaseId: formValue(formData, 'firmwareReleaseId') }
      : {}),
  });
  if (!parsed.success) return validationState(parsed.error);

  const context = await getAuthorizedDeviceContext();
  if (!context) return SESSION_ERROR;

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const device = await transaction.device.findFirst({
          where: { id: parsed.data.deviceId, companyId: context.companyId },
          select: { id: true, firmwareVersion: true },
        });
        if (!device) return DEVICE_UNAVAILABLE_ERROR;

        const activeCommand = await transaction.deviceCommand.findFirst({
          where: {
            companyId: context.companyId,
            deviceId: device.id,
            status: { in: ['PENDING', 'SENT'] },
          },
          select: { id: true },
        });
        if (activeCommand) return COMMAND_CONFLICT_ERROR;

        let firmwareReleaseId: string | undefined;
        let targetFirmwareVersion: string | undefined;
        let payload: Prisma.InputJsonValue;

        if (parsed.data.type === 'UPDATE_FIRMWARE') {
          const firmware = await transaction.firmwareRelease.findFirst({
            where: { id: parsed.data.firmwareReleaseId },
            select: { id: true, version: true },
          });
          if (!firmware || !canUpdateFirmware(device.firmwareVersion, firmware.version)) {
            return FIRMWARE_UNAVAILABLE_ERROR;
          }
          firmwareReleaseId = firmware.id;
          targetFirmwareVersion = firmware.version;
          payload = { command: 'update_firmware', version: firmware.version };
        } else if (parsed.data.type === 'REBOOT') {
          payload = { command: 'reboot' };
        } else {
          payload = { command: 'shutdown' };
        }

        await transaction.deviceCommand.create({
          data: {
            companyId: context.companyId,
            deviceId: device.id,
            createdByUserId: context.userId,
            type: parsed.data.type,
            status: 'PENDING',
            firmwareReleaseId,
            targetFirmwareVersion,
            payload,
          },
        });

        return { deviceId: device.id, type: parsed.data.type };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if ('success' in result) return result;

    revalidateDevices(result.deviceId);
    return {
      success: true,
      message:
        result.type === 'UPDATE_FIRMWARE'
          ? 'Команда обновления прошивки добавлена в очередь.'
          : 'Команда добавлена в очередь.',
    };
  } catch (error) {
    if (isTransactionConflict(error)) return COMMAND_CONFLICT_ERROR;
    return { success: false, message: 'Не удалось добавить команду в очередь. Попробуйте позже.' };
  }
}

export async function cancelDeviceCommandAction(
  _previousState: DeviceActionState,
  formData: FormData,
): Promise<DeviceActionState> {
  const parsed = cancelDeviceCommandSchema.safeParse({
    commandId: formValue(formData, 'commandId'),
  });
  if (!parsed.success) return validationState(parsed.error);

  const context = await getAuthorizedDeviceContext();
  if (!context) return SESSION_ERROR;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const command = await transaction.deviceCommand.findFirst({
        where: { id: parsed.data.commandId, companyId: context.companyId },
        select: { deviceId: true },
      });
      if (!command) return COMMAND_UNAVAILABLE_ERROR;

      const updated = await transaction.deviceCommand.updateMany({
        where: { id: parsed.data.commandId, companyId: context.companyId, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      if (updated.count !== 1) return COMMAND_UNAVAILABLE_ERROR;

      return { deviceId: command.deviceId };
    });
    if ('success' in result) return result;

    revalidateDevices(result.deviceId);
    return { success: true, message: 'Команда отменена.' };
  } catch {
    return { success: false, message: 'Не удалось отменить команду. Попробуйте позже.' };
  }
}

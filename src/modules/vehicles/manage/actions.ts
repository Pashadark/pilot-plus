'use server';

import { randomUUID } from 'node:crypto';

import { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { revalidatePath } from 'next/cache';

import { requireVehicleManagementAccess, VehicleManagementAccessDeniedError } from './access';
import { vehicleIdSchema, vehicleInputSchema, type VehicleInput } from './validation';

export type VehicleActionState =
  | { ok: true; vehicleId: string }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]> };

type Transaction = Prisma.TransactionClient;

const SAVE_ERROR: VehicleActionState = {
  ok: false,
  code: 'SAVE_FAILED',
  message: 'Не удалось сохранить автомобиль. Попробуйте позже.',
};
const FORBIDDEN_ERROR: VehicleActionState = {
  ok: false,
  code: 'FORBIDDEN',
  message: 'Управление автопарком недоступно.',
};
const NOT_FOUND_ERROR: VehicleActionState = {
  ok: false,
  code: 'NOT_FOUND',
  message: 'Автомобиль недоступен или уже изменён.',
};
const ACTIVE_RENTAL_ERROR: VehicleActionState = {
  ok: false,
  code: 'ACTIVE_RENTAL',
  message: 'Нельзя архивировать автомобиль с подтверждённой или активной арендой.',
};

function valuesFromFormData(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
}

function validationError(error: {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}) {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0,
    ),
  );
  return {
    ok: false as const,
    code: 'VALIDATION',
    message: 'Проверьте заполнение полей автомобиля.',
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
  };
}

function duplicateError(
  field: 'registrationNumber' | 'vin' | 'internalNumber',
): VehicleActionState {
  const labels = {
    registrationNumber: 'Государственный номер уже используется в этой компании.',
    vin: 'VIN уже используется в этой компании.',
    internalNumber: 'Внутренний номер уже используется в этой компании.',
  };
  return {
    ok: false,
    code: 'DUPLICATE',
    message: 'Не удалось сохранить автомобиль: найдены дублирующиеся данные.',
    fieldErrors: { [field]: [labels[field]] },
  };
}

function knownDatabaseError(error: unknown): VehicleActionState | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  if (error.code === 'P2034') {
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'Данные автомобиля изменились параллельно. Повторите действие.',
    };
  }
  if (error.code !== 'P2002') return null;

  const target =
    'meta' in error &&
    typeof error.meta === 'object' &&
    error.meta !== null &&
    'target' in error.meta
      ? error.meta.target
      : undefined;
  const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  if (fields.some((field) => field.includes('registrationNumberNormalized'))) {
    return duplicateError('registrationNumber');
  }
  if (fields.some((field) => field.includes('vinNormalized'))) return duplicateError('vin');
  if (fields.some((field) => field.includes('internalNumber')))
    return duplicateError('internalNumber');
  return { ok: false, code: 'DUPLICATE', message: 'Автомобиль с такими данными уже существует.' };
}

async function findDuplicate(
  transaction: Transaction,
  companyId: string,
  input: VehicleInput,
  excludeVehicleId?: string,
) {
  return transaction.vehicle.findFirst({
    where: {
      companyId,
      ...(excludeVehicleId ? { id: { not: excludeVehicleId } } : {}),
      OR: [
        { registrationNumberNormalized: input.registrationNumberNormalized },
        ...(input.vinNormalized ? [{ vinNormalized: input.vinNormalized }] : []),
        { internalNumber: input.internalNumber },
      ],
    },
    select: {
      id: true,
      registrationNumberNormalized: true,
      vinNormalized: true,
      internalNumber: true,
    },
  });
}

function duplicateFromVehicle(
  vehicle: {
    registrationNumberNormalized: string | null;
    vinNormalized: string | null;
    internalNumber: string;
  },
  input: VehicleInput,
): VehicleActionState {
  if (vehicle.registrationNumberNormalized === input.registrationNumberNormalized) {
    return duplicateError('registrationNumber');
  }
  if (input.vinNormalized && vehicle.vinNormalized === input.vinNormalized)
    return duplicateError('vin');
  return duplicateError('internalNumber');
}

function vehicleData(input: VehicleInput): Prisma.VehicleUncheckedCreateInput {
  return {
    companyId: input.companyId,
    sourceKey: `manual:${randomUUID()}`,
    internalNumber: input.internalNumber,
    model: `${input.make} ${input.model}`,
    city: input.city,
    office: input.office ?? null,
    registrationNumber: input.registrationNumberNormalized,
    registrationNumberNormalized: input.registrationNumberNormalized,
    vin: input.vinNormalized,
    vinNormalized: input.vinNormalized,
    make: input.make,
    modelName: input.model,
    manufacturedYear: input.year,
    color: input.color ?? null,
    category: input.category ?? null,
    bodyType: input.bodyType ?? null,
    transmission: input.transmission,
    engineLiters: input.engineLiters ?? null,
    fuelType: input.fuelType,
    seats: input.seats,
    dailyPriceMinor: input.dailyPriceMinor,
    currency: 'RUB',
    odometerKm: input.odometerKm ?? null,
    valueMinor: input.valueMinor ?? null,
    depositMinor: input.depositMinor ?? null,
    includedMileageKm: input.includedMileageKm ?? null,
    overageMileagePriceMinor: input.overageMileagePriceMinor ?? null,
    missingFuelPriceMinor: input.missingFuelPriceMinor ?? null,
    registrationCertificateNumber: input.registrationCertificateNumber ?? null,
    vehiclePassportNumber: input.vehiclePassportNumber ?? null,
    osagoInsurer: input.osagoInsurer ?? null,
    osagoPolicyNumber: input.osagoPolicyNumber ?? null,
    osagoStartsAt: input.osagoStartsAt ?? null,
    osagoEndsAt: input.osagoEndsAt ?? null,
    cascoInsurer: input.cascoInsurer ?? null,
    cascoPolicyNumber: input.cascoPolicyNumber ?? null,
    cascoStartsAt: input.cascoStartsAt ?? null,
    cascoEndsAt: input.cascoEndsAt ?? null,
    isRentalReady: input.isRentalReady,
    rentalReadyAt: input.isRentalReady ? new Date() : null,
    status: input.status,
    originalPrice: `${(input.dailyPriceMinor / 100).toLocaleString('ru-RU')} ₽`,
    features: [],
    isDemoImport: false,
  };
}

function vehicleUpdateData(input: VehicleInput): Prisma.VehicleUncheckedUpdateInput {
  const { companyId: _companyId, sourceKey: _sourceKey, ...data } = vehicleData(input);
  return data;
}

function auditChanges(input: VehicleInput, operation: 'created' | 'updated' | 'archived') {
  if (operation === 'archived') return { archived: true };
  return {
    [operation]: true,
    make: input.make,
    model: input.model,
    year: input.year,
    city: input.city,
    status: input.status,
    isRentalReady: input.isRentalReady,
  };
}

async function writeVehicleAudit(
  transaction: Transaction,
  input: {
    actorUserId: string;
    actorEmail: string;
    companyId: string;
    vehicleId: string;
    label: string;
  },
  changes: Record<string, unknown>,
  action: 'CREATE' | 'UPDATE' | 'ARCHIVE',
) {
  await transaction.auditLog.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      actorEmailSnapshot: input.actorEmail,
      action,
      entityType: 'VEHICLE',
      entityId: input.vehicleId,
      entityLabel: input.label,
      changes: changes as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

async function createOrUpdate(
  operation: 'create' | 'update',
  formData: FormData,
): Promise<VehicleActionState> {
  const values = valuesFromFormData(formData);
  const { vehicleId: submittedVehicleId, ...inputValues } = values;
  const parsed = vehicleInputSchema.safeParse(inputValues);
  if (!parsed.success) return validationError(parsed.error);
  const vehicleId = operation === 'update' ? submittedVehicleId?.trim() : undefined;
  if (operation === 'update' && !vehicleId) return NOT_FOUND_ERROR;

  let access;
  try {
    access = await requireVehicleManagementAccess(parsed.data.companyId);
  } catch (error) {
    if (error instanceof VehicleManagementAccessDeniedError) return FORBIDDEN_ERROR;
    return SAVE_ERROR;
  }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const company = await transaction.company.findUnique({
          where: { id: parsed.data.companyId },
          select: { id: true },
        });
        if (!company) return NOT_FOUND_ERROR;

        if (operation === 'update') {
          const existing = await transaction.vehicle.findFirst({
            where: { id: vehicleId, companyId: parsed.data.companyId, archivedAt: null },
            select: { id: true, internalNumber: true },
          });
          if (!existing) return NOT_FOUND_ERROR;
        }

        const duplicate = await findDuplicate(
          transaction,
          parsed.data.companyId,
          parsed.data,
          vehicleId,
        );
        if (duplicate) return duplicateFromVehicle(duplicate, parsed.data);

        const data = vehicleData(parsed.data);
        const vehicle =
          operation === 'create'
            ? await transaction.vehicle.create({ data, select: { id: true, internalNumber: true } })
            : await transaction.vehicle.update({
                where: { id: vehicleId },
                data: vehicleUpdateData(parsed.data),
                select: { id: true, internalNumber: true },
              });

        await writeVehicleAudit(
          transaction,
          {
            actorUserId: access.user.id,
            actorEmail: access.user.email,
            companyId: parsed.data.companyId,
            vehicleId: vehicle.id,
            label: `Автомобиль ${vehicle.internalNumber}`,
          },
          auditChanges(parsed.data, operation === 'create' ? 'created' : 'updated'),
          operation === 'create' ? 'CREATE' : 'UPDATE',
        );
        return { ok: true as const, vehicleId: vehicle.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (result.ok) revalidatePath('/vehicles');
    return result;
  } catch (error) {
    return knownDatabaseError(error) ?? SAVE_ERROR;
  }
}

export async function createVehicleAction(
  _previousState: VehicleActionState | null,
  formData: FormData,
): Promise<VehicleActionState> {
  return createOrUpdate('create', formData);
}

export async function updateVehicleAction(
  _previousState: VehicleActionState | null,
  formData: FormData,
): Promise<VehicleActionState> {
  return createOrUpdate('update', formData);
}

export async function archiveVehicleAction(
  _previousState: VehicleActionState | null,
  formData: FormData,
): Promise<VehicleActionState> {
  const parsed = vehicleIdSchema.safeParse(valuesFromFormData(formData));
  if (!parsed.success) return validationError(parsed.error);

  let access;
  try {
    access = await requireVehicleManagementAccess(parsed.data.companyId);
  } catch (error) {
    if (error instanceof VehicleManagementAccessDeniedError) return FORBIDDEN_ERROR;
    return SAVE_ERROR;
  }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const vehicle = await transaction.vehicle.findFirst({
          where: {
            id: parsed.data.vehicleId,
            companyId: parsed.data.companyId,
            archivedAt: null,
          },
          select: { id: true, internalNumber: true },
        });
        if (!vehicle) return NOT_FOUND_ERROR;

        const activeRental = await transaction.rental.findFirst({
          where: {
            companyId: parsed.data.companyId,
            vehicleId: vehicle.id,
            status: { in: ['CONFIRMED', 'ACTIVE'] },
          },
          select: { id: true },
        });
        if (activeRental) return ACTIVE_RENTAL_ERROR;

        const updated = await transaction.vehicle.updateMany({
          where: { id: vehicle.id, companyId: parsed.data.companyId, archivedAt: null },
          data: { archivedAt: new Date(), archivedByUserId: access.user.id },
        });
        if (updated.count !== 1) return NOT_FOUND_ERROR;

        await writeVehicleAudit(
          transaction,
          {
            actorUserId: access.user.id,
            actorEmail: access.user.email,
            companyId: parsed.data.companyId,
            vehicleId: vehicle.id,
            label: `Автомобиль ${vehicle.internalNumber}`,
          },
          auditChanges({} as VehicleInput, 'archived'),
          'ARCHIVE',
        );
        return { ok: true as const, vehicleId: vehicle.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (result.ok) revalidatePath('/vehicles');
    return result;
  } catch (error) {
    return knownDatabaseError(error) ?? SAVE_ERROR;
  }
}

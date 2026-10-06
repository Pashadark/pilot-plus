'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/database/prisma/client';
import { readSession } from '@/services/auth/session';
import { requireVehicleManagementAccess } from '@/modules/vehicles/manage/access';
import { validServiceInterval } from './service-meter';

export async function readServicePlan(vehicleId: string) {
  const user = await readSession();
  if (!user) throw new Error('Войдите снова');
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      archivedAt: null,
      ...(user.role === 'SUPER_ADMIN'
        ? {}
        : { company: { members: { some: { userId: user.id } } } }),
    },
    select: {
      companyId: true,
      odometerKm: true,
      positions: { orderBy: { recordedAt: 'desc' }, take: 1, select: { odometerKm: true } },
      rentalOperations: {
        where: {
          status: 'COMMITTED',
          type: { in: ['HANDOVER', 'RETURN'] },
          mileageKm: { not: null },
        },
        orderBy: { occurredAt: 'desc' },
        take: 1,
        select: { mileageKm: true },
      },
      maintenanceRecords: {
        where: { recordType: 'MAINTENANCE', status: { in: ['PLANNED', 'OVERDUE'] } },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
        take: 1,
        select: {
          id: true,
          title: true,
          odometerKm: true,
          targetOdometerKm: true,
          scheduledAt: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!vehicle) throw new Error('Автомобиль недоступен');
  let canEdit = false;
  try {
    await requireVehicleManagementAccess(vehicle.companyId);
    canEdit = true;
  } catch {
    /* Read-only member. */
  }
  const readings = [
    vehicle.odometerKm,
    vehicle.positions[0]?.odometerKm,
    vehicle.rentalOperations[0]?.mileageKm,
  ]
    .filter((v) => v != null)
    .map(Number)
    .filter(Number.isFinite);
  const record = vehicle.maintenanceRecords[0];
  return {
    canEdit,
    current: readings.length ? Math.max(...readings) : null,
    record: record
      ? {
          id: record.id,
          title: record.title,
          last: record.odometerKm === null ? null : Number(record.odometerKm),
          next: record.targetOdometerKm === null ? null : Number(record.targetOdometerKm),
          date: record.scheduledAt?.toISOString().slice(0, 10) ?? '',
          version: record.updatedAt.toISOString(),
        }
      : null,
  };
}

export async function saveServicePlan(vehicleId: string, form: FormData) {
  const user = await readSession();
  if (!user) return { ok: false, message: 'Войдите снова.' };
  const last = String(form.get('last') ?? '');
  const next = String(form.get('next') ?? '');
  const date = String(form.get('date') ?? '');
  if (
    !validServiceInterval(last, next) ||
    (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))))
  )
    return { ok: false, message: 'Проверьте пробег: следующее ТО должно быть позже последнего.' };
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        archivedAt: null,
        ...(user.role === 'SUPER_ADMIN'
          ? {}
          : { company: { members: { some: { userId: user.id } } } }),
      },
      select: { id: true, companyId: true, model: true },
    });
    if (!vehicle) return { ok: false, message: 'Автомобиль недоступен.' };
    await requireVehicleManagementAccess(vehicle.companyId);
    await prisma.$transaction(
      async (tx) => {
        const id = String(form.get('recordId') ?? '');
        const version = String(form.get('version') ?? '');
        const data = {
          odometerKm: Number(last),
          targetOdometerKm: Number(next),
          scheduledAt: date ? new Date(`${date}T12:00:00+03:00`) : null,
        };
        if (id) {
          if (!Number.isFinite(Date.parse(version))) throw new Error('STALE');
          const result = await tx.maintenanceRecord.updateMany({
            where: {
              id,
              vehicleId,
              updatedAt: new Date(version),
              recordType: 'MAINTENANCE',
              status: { in: ['PLANNED', 'OVERDUE'] },
            },
            data,
          });
          if (result.count !== 1) throw new Error('STALE');
        } else {
          const existing = await tx.maintenanceRecord.count({
            where: { vehicleId, recordType: 'MAINTENANCE', status: { in: ['PLANNED', 'OVERDUE'] } },
          });
          if (existing) throw new Error('STALE');
          await tx.maintenanceRecord.create({
            data: {
              ...data,
              vehicleId,
              title: 'Плановое ТО',
              kind: 'INSPECTION',
              recordType: 'MAINTENANCE',
              status: 'PLANNED',
            },
          });
        }
        await tx.auditLog.create({
          data: {
            companyId: vehicle.companyId,
            actorUserId: user.id,
            actorEmailSnapshot: user.email,
            action: 'UPDATE',
            entityType: 'VEHICLE',
            entityId: vehicleId,
            entityLabel: vehicle.model,
            changes: {
              servicePlan: {
                lastOdometerKm: Number(last),
                targetOdometerKm: Number(next),
                date: date || null,
              },
            },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    revalidatePath('/vehicles');
    revalidatePath('/map');
    revalidatePath('/maintenance');
    revalidatePath(`/vehicles/${vehicleId}`);
    return { ok: true, message: 'Следующее ТО сохранено.' };
  } catch {
    return {
      ok: false,
      message: 'Не удалось сохранить. Проверьте права или обновите данные и повторите.',
    };
  }
}

'use server';

import { prisma } from '@/database/prisma/client';
import { calculateRental } from '@/modules/rentals/domain/calculate-rental';

import { requireRentalAccess, RentalAccessDeniedError } from './access';

export type RentalActionResult =
  { ok: true; rentalId: string } | { ok: false; code: string; message: string };
const forbidden = {
  ok: false as const,
  code: 'FORBIDDEN',
  message: 'Доступ к договорам аренды запрещён.',
};

function input(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '').trim();
  const rentalId = String(formData.get('rentalId') ?? '').trim();
  if (!companyId || !rentalId) throw new Error('VALIDATION');
  return { companyId, rentalId };
}

function draftValues(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '').trim();
  const clientId = String(formData.get('clientId') ?? '').trim();
  const vehicleId = String(formData.get('vehicleId') ?? '').trim();
  const templateVersionId = String(formData.get('templateVersionId') ?? '').trim();
  const startsAt = new Date(String(formData.get('startsAt') ?? ''));
  const endsAt = new Date(String(formData.get('endsAt') ?? ''));
  const dailyMinor = Number(formData.get('dailyMinor'));
  const discountMinor = Number(formData.get('discountMinor') ?? 0);
  const servicesMinor = Number(formData.get('servicesMinor') ?? 0);
  if (!companyId || !clientId || !vehicleId || !templateVersionId) throw new Error('VALIDATION');
  return {
    companyId,
    clientId,
    vehicleId,
    templateVersionId,
    startsAt,
    endsAt,
    dailyMinor,
    discountMinor,
    servicesMinor,
  };
}

async function saveDraft(formData: FormData, rentalId?: string): Promise<RentalActionResult> {
  try {
    const value = draftValues(formData);
    const access = await requireRentalAccess(value.companyId);
    const calculation = calculateRental(value);
    const result = await prisma.$transaction(async (tx) => {
      const [client, vehicle, template] = await Promise.all([
        tx.client.findFirst({
          where: { id: value.clientId, companyId: value.companyId, archivedAt: null },
          select: { id: true },
        }),
        tx.vehicle.findFirst({
          where: {
            id: value.vehicleId,
            companyId: value.companyId,
            archivedAt: null,
            isRentalReady: true,
          },
          select: { id: true },
        }),
        tx.contractTemplateVersion.findFirst({
          where: { id: value.templateVersionId, companyId: value.companyId, isPublished: true },
          select: { id: true },
        }),
      ]);
      if (!client || !vehicle || !template) throw new Error('NOT_FOUND');
      const data = {
        clientId: client.id,
        vehicleId: vehicle.id,
        templateVersionId: template.id,
        startsAt: value.startsAt,
        endsAt: value.endsAt,
        currency: 'RUB',
        dailyRateMinor: BigInt(value.dailyMinor),
        billableDays: calculation.days,
        basePriceMinor: BigInt(calculation.days * value.dailyMinor),
        discountMinor: BigInt(calculation.discountMinor),
        servicesMinor: BigInt(calculation.servicesMinor),
        totalPriceMinor: BigInt(calculation.agreedTotalMinor),
        snapshotVersion: 1,
        snapshot: { schemaVersion: 1, draft: true },
      };
      const saved = rentalId
        ? await tx.rental.update({ where: { id: rentalId }, data, select: { id: true } })
        : await tx.rental.create({
            data: { companyId: value.companyId, createdByUserId: access.user.id, ...data },
            select: { id: true },
          });
      await tx.auditLog.create({
        data: {
          companyId: value.companyId,
          actorUserId: access.user.id,
          actorEmailSnapshot: access.user.email,
          action: rentalId ? 'UPDATE' : 'CREATE',
          entityType: 'SYSTEM',
          entityId: saved.id,
          entityLabel: 'Договор аренды',
          changes: { status: 'DRAFT' },
        },
      });
      return saved;
    });
    return { ok: true, rentalId: result.id };
  } catch {
    return { ok: false, code: 'SAVE_FAILED', message: 'Не удалось сохранить черновик договора.' };
  }
}

export async function createRentalDraftAction(
  _state: RentalActionResult | null,
  formData: FormData,
) {
  return saveDraft(formData);
}
export async function updateRentalDraftAction(
  _state: RentalActionResult | null,
  formData: FormData,
) {
  const rentalId = String(formData.get('rentalId') ?? '').trim();
  return rentalId
    ? saveDraft(formData, rentalId)
    : { ok: false as const, code: 'VALIDATION', message: 'Не указан черновик договора.' };
}

export async function cancelRentalAction(
  _state: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  try {
    const value = input(formData);
    const access = await requireRentalAccess(value.companyId);
    const updated = await prisma.$transaction(async (tx) => {
      const rental = await tx.rental.findFirst({
        where: {
          id: value.rentalId,
          companyId: value.companyId,
          status: { in: ['DRAFT', 'CONFIRMED'] },
        },
        select: { id: true },
      });
      if (!rental) return null;
      const result = await tx.rental.update({
        where: { id: rental.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          companyId: value.companyId,
          actorUserId: access.user.id,
          actorEmailSnapshot: access.user.email,
          action: 'UPDATE',
          entityType: 'SYSTEM',
          entityId: result.id,
          entityLabel: 'Договор аренды',
          changes: { status: 'CANCELLED' },
        },
      });
      return result;
    });
    return updated
      ? { ok: true, rentalId: updated.id }
      : { ok: false, code: 'NOT_FOUND', message: 'Договор недоступен для отмены.' };
  } catch (error) {
    return error instanceof RentalAccessDeniedError
      ? forbidden
      : { ok: false, code: 'SAVE_FAILED', message: 'Не удалось отменить договор.' };
  }
}

'use server';

import { prisma } from '@/database/prisma/client';
import { calculateRental } from '@/modules/rentals/domain/calculate-rental';

import { requireRentalAccess, RentalAccessDeniedError } from './access';
import { confirmRental } from './confirm-rental';
import { generateRentalDocumentPair } from './generate-rental-documents';

export type RentalActionResult =
  | { ok: true; rentalId: string; contractNumber?: string; documentVersion?: number }
  | {
      ok: false;
      code: string;
      message: string;
      confirmedNeedsDocuments?: boolean;
      rentalId?: string;
      contractNumber?: string;
    };
const forbidden = {
  ok: false as const,
  code: 'FORBIDDEN',
  message: 'Доступ к договорам аренды запрещён.',
};
function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

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
  const discountMinor = Number(formData.get('discountMinor') ?? 0);
  const servicesMinor = Number(formData.get('servicesMinor') ?? 0);
  const issuance: Record<string, string | number | null> = Object.fromEntries(
    [
      'pickupAddress',
      'returnAddress',
      'startMileageKm',
      'returnMileageKm',
      'startFuelPercent',
      'returnFuelPercent',
      'territory',
      'paymentTerms',
      'allowedDrivers',
      'conditions',
      'depositMinor',
    ].map((key) => [key, String(formData.get(key) ?? '').trim() || null]),
  );
  if (issuance.depositMinor !== null) {
    const depositMinor = Number(issuance.depositMinor);
    if (!Number.isSafeInteger(depositMinor) || depositMinor < 0) throw new Error('VALIDATION');
    issuance.depositMinor = depositMinor;
  }
  if (!companyId || !clientId || !vehicleId || !templateVersionId) throw new Error('VALIDATION');
  return {
    companyId,
    clientId,
    vehicleId,
    templateVersionId,
    startsAt,
    endsAt,
    discountMinor,
    servicesMinor,
    issuance,
  };
}

async function saveDraft(formData: FormData, rentalId?: string): Promise<RentalActionResult> {
  try {
    const value = draftValues(formData);
    const access = await requireRentalAccess(value.companyId);
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
            isDemoImport: false,
          },
          select: {
            id: true,
            dailyPriceMinor: true,
            depositMinor: true,
            includedMileageKm: true,
            overageMileagePriceMinor: true,
            missingFuelPriceMinor: true,
          },
        }),
        tx.contractTemplateVersion.findFirst({
          where: { id: value.templateVersionId, companyId: value.companyId, isPublished: true },
          select: { id: true },
        }),
      ]);
      if (!client || !vehicle || !template) throw new Error('NOT_FOUND');
      const calculation = calculateRental({
        startsAt: value.startsAt,
        endsAt: value.endsAt,
        dailyMinor: vehicle.dailyPriceMinor,
        discountMinor: value.discountMinor,
        serviceMinor: value.servicesMinor,
      });
      const data = {
        clientId: client.id,
        vehicleId: vehicle.id,
        templateVersionId: template.id,
        startsAt: value.startsAt,
        endsAt: value.endsAt,
        currency: 'RUB',
        dailyRateMinor: BigInt(vehicle.dailyPriceMinor),
        billableDays: calculation.days,
        basePriceMinor: BigInt(calculation.days) * BigInt(vehicle.dailyPriceMinor),
        discountMinor: BigInt(calculation.discountMinor),
        servicesMinor: BigInt(calculation.servicesMinor),
        totalPriceMinor: BigInt(calculation.agreedTotalMinor),
        depositMinor: vehicle.depositMinor,
        includedMileageKm: vehicle.includedMileageKm,
        overageMileagePriceMinor: vehicle.overageMileagePriceMinor,
        missingFuelPriceMinor: vehicle.missingFuelPriceMinor,
        snapshotVersion: 1,
        snapshot: { schemaVersion: 1, draft: true, issuance: value.issuance },
      };
      let savedId: string;
      if (rentalId) {
        const updated = await tx.rental.updateMany({
          where: { id: rentalId, companyId: value.companyId, status: 'DRAFT' },
          data,
        });
        if (updated.count === 0) throw new Error('NOT_DRAFT');
        savedId = rentalId;
      } else {
        const created = await tx.rental.create({
          data: { companyId: value.companyId, createdByUserId: access.user.id, ...data },
          select: { id: true },
        });
        savedId = created.id;
      }
      await tx.auditLog.create({
        data: {
          companyId: value.companyId,
          actorUserId: access.user.id,
          actorEmailSnapshot: access.user.email,
          action: rentalId ? 'UPDATE' : 'CREATE',
          entityType: 'RENTAL',
          entityId: savedId,
          entityLabel: 'Договор аренды',
          changes: { status: 'DRAFT' },
        },
      });
      return { id: savedId };
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

export async function confirmRentalAction(
  _state: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  try {
    const value = input(formData);
    const confirmed = await confirmRental(value.companyId, value.rentalId);
    return { ok: true, rentalId: confirmed.rentalId, contractNumber: confirmed.contractNumber };
  } catch (error) {
    return error instanceof RentalAccessDeniedError
      ? forbidden
      : error instanceof Error && error.message === 'Автомобиль уже занят на выбранный период.'
        ? {
            ok: false,
            code: 'OVERLAP',
            message: 'Автомобиль уже занят на выбранный период.',
          }
        : isPrismaCode(error, 'P2002')
          ? {
              ok: false,
              code: 'CONFLICT',
              message: 'Договор уже подтверждён или номер занят. Обновите страницу.',
            }
          : { ok: false, code: 'CONFIRM_FAILED', message: 'Не удалось подтвердить договор.' };
  }
}

export async function confirmAndGenerateRentalAction(
  _state: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  const confirmed = await confirmRentalAction(null, formData);
  if (!confirmed.ok) return confirmed;
  try {
    const document = await generateRentalDocumentPair({
      companyId: String(formData.get('companyId') ?? '').trim(),
      rentalId: confirmed.rentalId,
    });
    return { ...confirmed, documentVersion: document.version };
  } catch {
    return {
      ok: false,
      code: 'DOCUMENT_FAILED',
      message: 'Договор подтверждён, но файлы не готовы. Повторите создание документов безопасно.',
      confirmedNeedsDocuments: true,
      rentalId: confirmed.rentalId,
      contractNumber: confirmed.contractNumber,
    };
  }
}

export async function generateRentalDocumentsAction(
  _state: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  try {
    const value = input(formData);
    const document = await generateRentalDocumentPair(value);
    return { ok: true, rentalId: value.rentalId, documentVersion: document.version };
  } catch {
    return {
      ok: false,
      code: 'DOCUMENT_FAILED',
      message: 'Не удалось подготовить файлы договора. Повторите попытку.',
      confirmedNeedsDocuments: true,
      rentalId: String(formData.get('rentalId') ?? '').trim() || undefined,
    };
  }
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
          entityType: 'RENTAL',
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

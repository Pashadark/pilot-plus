'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';
import { calculateRental } from '@/modules/rentals/domain/calculate-rental';
import { createRentalExtension } from '@/modules/rentals/operations/server/extend-rental';
import { createRentalHandover } from '@/modules/rentals/operations/server/handover-rental';
import { createRentalReturn } from '@/modules/rentals/operations/server/return-rental';
import { executeOperationWithEvidence } from '@/modules/rentals/operations/server/execute-with-evidence';
import { createOperationDraftPreparer } from '@/modules/rentals/operations/server/prepare-operation';
import { admitOperationMedia } from '@/modules/rentals/operations/media/admit-operation-media';
import { scanOperationMedia } from '@/modules/rentals/operations/media/scan-operation-media';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';
import {
  validateExtensionCommand,
  validateHandoverCommand,
  validateReturnCommand,
} from '@/modules/rentals/operations/validation';

import { requireRentalAccess, RentalAccessDeniedError } from './access';
import { confirmRental } from './confirm-rental';
import { generateRentalDocumentPair } from './generate-rental-documents';

export type RentalActionResult =
  | {
      ok: true;
      rentalId: string;
      operationId?: string;
      contractNumber?: string;
      documentVersion?: number;
    }
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
const operationFailed = (message: string): RentalActionResult => ({
  ok: false,
  code: 'OPERATION_FAILED',
  message,
});
function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function input(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '').trim();
  const rentalId = String(formData.get('rentalId') ?? '').trim();
  if (!companyId || !rentalId) throw new Error('VALIDATION');
  return { companyId, rentalId };
}

function operationIdentity(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '').trim();
  const rentalId = String(formData.get('rentalId') ?? '').trim();
  if (!companyId || !rentalId) throw new Error('VALIDATION');
  return { companyId, rentalId };
}

function optionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? '').trim();
  return raw ? Number(raw) : undefined;
}

function operationActor(access: Awaited<ReturnType<typeof requireRentalAccess>>) {
  return { id: access.user.id, scope: access.scope } as const;
}

const handoverUseCase = createRentalHandover(prisma as never);
const extensionUseCase = createRentalExtension(prisma as never);
const returnUseCase = createRentalReturn(prisma as never);
const prepareOperation = createOperationDraftPreparer(prisma as never);

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

async function operationFile(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) return undefined;
  return { name: value.name, bytes: new Uint8Array(await value.arrayBuffer()) };
}

async function operationEvidenceFiles(formData: FormData) {
  const [video, dashboardPhoto] = await Promise.all([
    operationFile(formData, 'inspectionVideo'),
    operationFile(formData, 'dashboardPhoto'),
  ]);
  return { video, dashboardPhoto };
}

async function admitEvidence(input: {
  companyId: string;
  actorUserId: string;
  operationId: string;
  kind: 'INSPECTION_VIDEO' | 'DASHBOARD_PHOTO';
  file: { name: string; bytes: Uint8Array };
}) {
  const storage = await LocalPrivateStorage.create(privateStorageRoot());
  const repository = {
    findOperation: (value: Parameters<typeof prisma.rentalOperation.findFirst>[0]) =>
      prisma.rentalOperation.findFirst(value as never) as never,
    findMedia: (value: Parameters<typeof prisma.rentalOperationMedia.findFirst>[0]) =>
      prisma.rentalOperationMedia.findFirst(value as never) as never,
    createMedia: (value: Record<string, unknown>) =>
      prisma.rentalOperationMedia.create({
        data: value,
        select: { id: true, uploadId: true, companyId: true, storageKey: true },
      } as never) as never,
    updateMany: (value: Parameters<typeof prisma.rentalOperationMedia.updateMany>[0]) =>
      prisma.rentalOperationMedia.updateMany(value as never),
  };
  return admitOperationMedia({
    ...input,
    repository: repository as never,
    storage,
    randomId: randomUUID,
    scan: (media) =>
      scanOperationMedia({
        media,
        now: new Date(),
        leaseMs: 120_000,
        claimToken: randomUUID(),
        repository: prisma.rentalOperationMedia,
        storage,
        scanner: ClamAvClient.fromEnvironment(),
      }),
  });
}

export async function handoverRentalAction(
  _state: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  try {
    const identity = operationIdentity(formData);
    const access = await requireRentalAccess(identity.companyId);
    const evidence = await operationEvidenceFiles(formData);
    const submittedEvidenceStatus =
      evidence.video && evidence.dashboardPhoto
        ? 'COMPLETE'
        : evidence.video
          ? 'DASHBOARD_PHOTO_MISSING'
          : evidence.dashboardPhoto
            ? 'VIDEO_MISSING'
            : 'MISSING';
    const command = validateHandoverCommand({
      rentalId: identity.rentalId,
      idempotencyKey: String(formData.get('idempotencyKey') ?? ''),
      occurredAt: String(formData.get('occurredAt') ?? ''),
      mileageKm: Number(formData.get('mileageKm')),
      fuelLevelPercent: Number(formData.get('fuelLevelPercent')),
      evidenceStatus: submittedEvidenceStatus,
      evidenceMissingReason: String(formData.get('evidenceMissingReason') ?? ''),
      fulfillmentMethod: String(formData.get('fulfillmentMethod')) as never,
      fulfillmentAddress: String(formData.get('fulfillmentAddress') ?? ''),
      depositStatus: String(formData.get('depositStatus')) as never,
      depositAmountMinor: optionalNumber(formData, 'depositAmountMinor'),
      depositPaymentMethod: String(formData.get('depositPaymentMethod') ?? '') as never,
    });
    const actor = operationActor(access);
    const result = await executeOperationWithEvidence({
      command,
      ...evidence,
      prepare: (preparedCommand) =>
        prepareOperation({
          companyId: identity.companyId,
          actor,
          rentalId: preparedCommand.rentalId,
          type: 'HANDOVER',
          idempotencyKey: preparedCommand.idempotencyKey,
          occurredAt: preparedCommand.occurredAt,
        }),
      admit: ({ operationId, kind, file }) =>
        admitEvidence({
          companyId: identity.companyId,
          actorUserId: access.user.id,
          operationId,
          kind,
          file,
        }),
      commit: (finalCommand) =>
        handoverUseCase({ companyId: identity.companyId, actor, command: finalCommand }),
    });
    revalidatePath(`/rentals/${identity.rentalId}`);
    revalidatePath('/rentals');
    return { ok: true, ...result };
  } catch (error) {
    return error instanceof RentalAccessDeniedError
      ? forbidden
      : operationFailed(error instanceof Error ? error.message : 'Не удалось сохранить выдачу.');
  }
}

export async function extendRentalAction(
  _state: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  try {
    const identity = operationIdentity(formData);
    const access = await requireRentalAccess(identity.companyId);
    const command = validateExtensionCommand({
      rentalId: identity.rentalId,
      idempotencyKey: String(formData.get('idempotencyKey') ?? ''),
      occurredAt: String(formData.get('occurredAt') ?? ''),
      nextEndsAt: String(formData.get('nextEndsAt') ?? ''),
      notes: String(formData.get('notes') ?? ''),
    });
    const result = await extensionUseCase({
      companyId: identity.companyId,
      actor: operationActor(access),
      command,
    });
    revalidatePath(`/rentals/${identity.rentalId}`);
    revalidatePath('/rentals');
    return { ok: true, ...result };
  } catch (error) {
    return error instanceof RentalAccessDeniedError
      ? forbidden
      : operationFailed(error instanceof Error ? error.message : 'Не удалось продлить аренду.');
  }
}

export async function returnRentalAction(
  _state: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  try {
    const identity = operationIdentity(formData);
    const access = await requireRentalAccess(identity.companyId);
    const evidence = await operationEvidenceFiles(formData);
    const submittedEvidenceStatus =
      evidence.video && evidence.dashboardPhoto
        ? 'COMPLETE'
        : evidence.video
          ? 'DASHBOARD_PHOTO_MISSING'
          : evidence.dashboardPhoto
            ? 'VIDEO_MISSING'
            : 'MISSING';
    const command = validateReturnCommand({
      rentalId: identity.rentalId,
      idempotencyKey: String(formData.get('idempotencyKey') ?? ''),
      occurredAt: String(formData.get('occurredAt') ?? ''),
      mileageKm: Number(formData.get('mileageKm')),
      fuelLevelPercent: Number(formData.get('fuelLevelPercent')),
      evidenceStatus: submittedEvidenceStatus,
      evidenceMissingReason: String(formData.get('evidenceMissingReason') ?? ''),
      vehicleCondition: String(formData.get('vehicleCondition')) as never,
      damageDescription: String(formData.get('damageDescription') ?? ''),
      depositStatus: String(formData.get('depositStatus')) as never,
      depositAmountMinor: optionalNumber(formData, 'depositAmountMinor'),
      depositWithheldMinor: optionalNumber(formData, 'depositWithheldMinor'),
      depositResolutionReason: String(formData.get('depositResolutionReason') ?? ''),
    });
    const actor = operationActor(access);
    const result = await executeOperationWithEvidence({
      command,
      ...evidence,
      prepare: (preparedCommand) =>
        prepareOperation({
          companyId: identity.companyId,
          actor,
          rentalId: preparedCommand.rentalId,
          type: 'RETURN',
          idempotencyKey: preparedCommand.idempotencyKey,
          occurredAt: preparedCommand.occurredAt,
        }),
      admit: ({ operationId, kind, file }) =>
        admitEvidence({
          companyId: identity.companyId,
          actorUserId: access.user.id,
          operationId,
          kind,
          file,
        }),
      commit: (finalCommand) =>
        returnUseCase({ companyId: identity.companyId, actor, command: finalCommand }),
    });
    revalidatePath(`/rentals/${identity.rentalId}`);
    revalidatePath('/rentals');
    return { ok: true, ...result };
  } catch (error) {
    return error instanceof RentalAccessDeniedError
      ? forbidden
      : operationFailed(error instanceof Error ? error.message : 'Не удалось принять возврат.');
  }
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

'use server';

import { revalidatePath } from 'next/cache';

import { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { calculateRental } from '@/modules/rentals/domain/calculate-rental';
import { STANDARD_DAILY_MILEAGE_LIMIT_KM } from '@/modules/rentals/domain/mileage-policy';
import {
  calculateEditedRental,
  parseRentalTermsForm,
} from '@/modules/rentals/edit/server/update-rental-terms';
import { enableRentalLegalRevision } from '@/modules/rentals/edit/server/legal-revision';
import { createRentalExtension } from '@/modules/rentals/operations/server/extend-rental';
import {
  executeHandoverOperation,
  executeReturnOperation,
  executeWeeklyInspectionOperation,
} from '@/modules/rentals/operations/server/execute-operation';
import { verifySavedRentalOperation } from '@/modules/rentals/operations/server/verify-saved-operation';
import {
  validateExtensionCommand,
  validateHandoverCommand,
  validateReturnCommand,
} from '@/modules/rentals/operations/validation';

import { canEditRental, requireRentalAccess, RentalAccessDeniedError } from './access';
import { confirmRental } from './confirm-rental';
import { generateRentalDocumentPair } from './generate-rental-documents';

export type RentalActionResult =
  | {
      ok: true;
      rentalId: string;
      operationId?: string;
      contractNumber?: string;
      documentVersion?: number;
      mileageKm?: number;
      savedMediaCount?: number;
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
function safeOperationMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (
    /prisma\.|ConnectorError|PostgresError|Unknown argument|\bP\d{4}\b|Failed to find Server Action/i.test(
      error.message,
    )
  ) {
    return fallback;
  }
  return error.message;
}
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

const extensionUseCase = createRentalExtension(prisma as never);

async function operationFile(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) return undefined;
  return { name: value.name, bytes: new Uint8Array(await value.arrayBuffer()) };
}

async function operationEvidenceFiles(formData: FormData) {
  const [video, dashboardPhoto, bodyPhotoFront, bodyPhotoRear, bodyPhotoLeft, bodyPhotoRight] =
    await Promise.all([
      operationFile(formData, 'inspectionVideo'),
      operationFile(formData, 'dashboardPhoto'),
      operationFile(formData, 'bodyPhotoFront'),
      operationFile(formData, 'bodyPhotoRear'),
      operationFile(formData, 'bodyPhotoLeft'),
      operationFile(formData, 'bodyPhotoRight'),
    ]);
  const additionalFiles = [
    { kind: 'BODY_PHOTO_FRONT' as const, file: bodyPhotoFront },
    { kind: 'BODY_PHOTO_REAR' as const, file: bodyPhotoRear },
    { kind: 'BODY_PHOTO_LEFT' as const, file: bodyPhotoLeft },
    { kind: 'BODY_PHOTO_RIGHT' as const, file: bodyPhotoRight },
  ].flatMap((item) => (item.file ? [{ kind: item.kind, file: item.file }] : []));
  return { video, dashboardPhoto, additionalFiles };
}

function evidenceFileCount(evidence: Awaited<ReturnType<typeof operationEvidenceFiles>>) {
  return (
    Number(Boolean(evidence.video)) +
    Number(Boolean(evidence.dashboardPhoto)) +
    evidence.additionalFiles.length
  );
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
    const result = await executeHandoverOperation({
      companyId: identity.companyId,
      actor,
      command,
      ...evidence,
    });
    const verified = await verifySavedRentalOperation(prisma.rentalOperation, {
      companyId: identity.companyId,
      rentalId: identity.rentalId,
      operationId: result.operationId,
      expectedMileageKm: command.mileageKm,
      expectedMediaCount: evidenceFileCount(evidence),
    });
    revalidatePath(`/rentals/${identity.rentalId}`);
    revalidatePath('/rentals');
    revalidatePath(`/vehicles/${verified.vehicleId}`);
    revalidatePath('/vehicles');
    revalidatePath('/maintenance');
    return { ok: true, ...result, ...verified };
  } catch (error) {
    return error instanceof RentalAccessDeniedError
      ? forbidden
      : operationFailed(safeOperationMessage(error, 'Не удалось сохранить выдачу.'));
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
      : operationFailed(safeOperationMessage(error, 'Не удалось продлить аренду.'));
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
      evidenceMissingReason:
        submittedEvidenceStatus === 'COMPLETE'
          ? ''
          : 'Файловая фиксация возврата приложена частично или пропущена.',
      vehicleCondition: String(formData.get('vehicleCondition')) as never,
      damageDescription: String(formData.get('damageDescription') ?? ''),
    });
    const actor = operationActor(access);
    const result = await executeReturnOperation({
      companyId: identity.companyId,
      actor,
      command,
      video: evidence.video,
      dashboardPhoto: evidence.dashboardPhoto,
      additionalFiles: evidence.additionalFiles,
    });
    const verified = await verifySavedRentalOperation(prisma.rentalOperation, {
      companyId: identity.companyId,
      rentalId: identity.rentalId,
      operationId: result.operationId,
      expectedMileageKm: command.mileageKm,
      expectedMediaCount: evidenceFileCount(evidence),
    });
    revalidatePath(`/rentals/${identity.rentalId}`);
    revalidatePath('/rentals');
    revalidatePath(`/vehicles/${verified.vehicleId}`);
    revalidatePath('/vehicles');
    revalidatePath('/maintenance');
    return { ok: true, ...result, ...verified };
  } catch (error) {
    return error instanceof RentalAccessDeniedError
      ? forbidden
      : operationFailed(safeOperationMessage(error, 'Не удалось принять возврат.'));
  }
}

export async function weeklyInspectionRentalAction(
  _state: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  try {
    const identity = operationIdentity(formData);
    const access = await requireRentalAccess(identity.companyId);
    const evidence = await operationEvidenceFiles(formData);
    const files = [
      ...(evidence.video ? [{ kind: 'INSPECTION_VIDEO' as const, file: evidence.video }] : []),
      ...(evidence.dashboardPhoto
        ? [{ kind: 'DASHBOARD_PHOTO' as const, file: evidence.dashboardPhoto }]
        : []),
      ...evidence.additionalFiles,
    ];
    if (files.length !== 6) {
      return operationFailed('Загрузите фото приборки, кузов с четырёх сторон и видео.');
    }
    const occurredAt = new Date(String(formData.get('occurredAt') ?? ''));
    const idempotencyKey = String(formData.get('idempotencyKey') ?? '').trim();
    if (!Number.isFinite(occurredAt.getTime()) || !idempotencyKey) {
      return operationFailed('Проверьте дату еженедельного осмотра.');
    }
    const result = await executeWeeklyInspectionOperation({
      companyId: identity.companyId,
      actor: operationActor(access),
      command: {
        rentalId: identity.rentalId,
        idempotencyKey,
        occurredAt,
        mileageKm: optionalNumber(formData, 'mileageKm'),
        fuelLevelPercent: optionalNumber(formData, 'fuelLevelPercent'),
      },
      files,
    });
    revalidatePath(`/rentals/${identity.rentalId}`);
    revalidatePath('/rentals');
    return { ok: true, ...result };
  } catch (error) {
    return error instanceof RentalAccessDeniedError
      ? forbidden
      : operationFailed(safeOperationMessage(error, 'Не удалось сохранить еженедельный осмотр.'));
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
  const agreementType: 'STANDARD' | 'LEASE_TO_OWN' =
    formData.get('agreementType') === 'LEASE_TO_OWN' ? 'LEASE_TO_OWN' : 'STANDARD';
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
    agreementType,
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
        agreementType: value.agreementType,
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
        includedMileageKm:
          value.agreementType === 'LEASE_TO_OWN' ? null : STANDARD_DAILY_MILEAGE_LIMIT_KM,
        overageMileagePriceMinor: vehicle.overageMileagePriceMinor,
        missingFuelPriceMinor: vehicle.missingFuelPriceMinor,
        snapshotVersion: 1,
        snapshot: {
          schemaVersion: 1,
          draft: true,
          agreementType: value.agreementType,
          issuance: value.issuance,
        },
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

export async function updateRentalTermsAction(
  _state: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  try {
    const value = parseRentalTermsForm(formData);
    const access = await requireRentalAccess(value.companyId);
    const calculation = calculateEditedRental(value);
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.rental.findFirst({
        where: { id: value.rentalId, companyId: value.companyId },
        select: {
          id: true,
          status: true,
          contractNumber: true,
          clientId: true,
          updatedAt: true,
          vehicleId: true,
          startsAt: true,
          endsAt: true,
          dailyRateMinor: true,
          discountMinor: true,
          servicesMinor: true,
          depositMinor: true,
          includedMileageKm: true,
          overageMileagePriceMinor: true,
          missingFuelPriceMinor: true,
          snapshotVersion: true,
          snapshot: true,
        },
      });
      if (!current) throw new Error('NOT_FOUND');
      if (!canEditRental(access, value.companyId, current.status))
        throw new RentalAccessDeniedError();
      if (current.updatedAt.getTime() !== value.updatedAt.getTime()) throw new Error('STALE');
      const vehicle = await tx.vehicle.findFirst({
        where: {
          id: value.vehicleId,
          companyId: value.companyId,
          archivedAt: null,
          isDemoImport: false,
        },
        select: {
          id: true,
          make: true,
          modelName: true,
          registrationNumber: true,
          vin: true,
          manufacturedYear: true,
          color: true,
          bodyType: true,
          transmission: true,
          fuelType: true,
          seats: true,
          registrationCertificateNumber: true,
          vehiclePassportNumber: true,
          osagoInsurer: true,
          osagoPolicyNumber: true,
          osagoStartsAt: true,
          osagoEndsAt: true,
          cascoInsurer: true,
          cascoPolicyNumber: true,
          cascoStartsAt: true,
          cascoEndsAt: true,
          includedMileageKm: true,
          overageMileagePriceMinor: true,
          missingFuelPriceMinor: true,
        },
      });
      if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');
      const overlap = await tx.rental.findFirst({
        where: {
          companyId: value.companyId,
          vehicleId: value.vehicleId,
          id: { not: value.rentalId },
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          startsAt: { lt: value.endsAt },
          endsAt: { gt: value.startsAt },
        },
        select: { id: true },
      });
      if (overlap) throw new Error('OVERLAP');
      const snapshot =
        typeof current.snapshot === 'object' && current.snapshot && !Array.isArray(current.snapshot)
          ? (structuredClone(current.snapshot) as Record<string, unknown>)
          : {};
      const oldIssuance =
        typeof snapshot.issuance === 'object' &&
        snapshot.issuance &&
        !Array.isArray(snapshot.issuance)
          ? (snapshot.issuance as Record<string, unknown>)
          : {};
      snapshot.issuance = {
        ...oldIssuance,
        pickupAddress: value.pickupAddress,
        returnAddress: value.returnAddress,
        paymentTerms: value.paymentTerms,
        territory: value.territory,
        allowedDrivers: value.allowedDrivers,
        depositMinor: value.depositMinor,
      };
      const oldRental =
        typeof snapshot.rental === 'object' && snapshot.rental && !Array.isArray(snapshot.rental)
          ? (snapshot.rental as Record<string, unknown>)
          : {};
      snapshot.rental = {
        ...oldRental,
        startsAt: value.startsAt.toISOString(),
        endsAt: value.endsAt.toISOString(),
        days: calculation.days,
        calculatedTotalMinor: calculation.calculatedTotalMinor,
        agreedTotalMinor: calculation.agreedTotalMinor,
        discountMinor: value.discountMinor,
        servicesMinor: value.servicesMinor,
        depositMinor: value.depositMinor,
        pickupAddress: value.pickupAddress,
        returnAddress: value.returnAddress,
      };
      const oldVehicle =
        typeof snapshot.vehicle === 'object' && snapshot.vehicle && !Array.isArray(snapshot.vehicle)
          ? (snapshot.vehicle as Record<string, unknown>)
          : {};
      snapshot.vehicle = {
        ...oldVehicle,
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.modelName,
        registrationNumber: vehicle.registrationNumber,
        vin: vehicle.vin,
        year: vehicle.manufacturedYear,
        color: vehicle.color,
        bodyType: vehicle.bodyType,
        transmission: vehicle.transmission,
        fuelType: vehicle.fuelType,
        seats: vehicle.seats,
        registrationCertificateNumber: vehicle.registrationCertificateNumber,
        vehiclePassportNumber: vehicle.vehiclePassportNumber,
        osagoInsurer: vehicle.osagoInsurer,
        osagoPolicyNumber: vehicle.osagoPolicyNumber,
        osagoStartsAt: vehicle.osagoStartsAt?.toISOString().slice(0, 10),
        osagoEndsAt: vehicle.osagoEndsAt?.toISOString().slice(0, 10),
        cascoInsurer: vehicle.cascoInsurer,
        cascoPolicyNumber: vehicle.cascoPolicyNumber,
        cascoStartsAt: vehicle.cascoStartsAt?.toISOString().slice(0, 10),
        cascoEndsAt: vehicle.cascoEndsAt?.toISOString().slice(0, 10),
        includedMileageKm: value.includedMileageKm,
        overageMileagePriceMinor: value.overageMileagePriceMinor,
        missingFuelPriceMinor: value.missingFuelPriceMinor,
        dailyMinor: value.dailyRateMinor,
        depositMinor: value.depositMinor,
      };
      if (current.status !== 'DRAFT') await enableRentalLegalRevision(tx);
      const updated = await tx.rental.updateMany({
        where: { id: value.rentalId, companyId: value.companyId, updatedAt: value.updatedAt },
        data: {
          vehicleId: value.vehicleId,
          startsAt: value.startsAt,
          endsAt: value.endsAt,
          dailyRateMinor: BigInt(value.dailyRateMinor),
          billableDays: calculation.days,
          basePriceMinor: BigInt(calculation.days) * BigInt(value.dailyRateMinor),
          discountMinor: BigInt(value.discountMinor),
          servicesMinor: BigInt(value.servicesMinor),
          totalPriceMinor: BigInt(calculation.agreedTotalMinor),
          depositMinor: BigInt(value.depositMinor),
          includedMileageKm: value.includedMileageKm,
          overageMileagePriceMinor: BigInt(value.overageMileagePriceMinor),
          missingFuelPriceMinor: BigInt(value.missingFuelPriceMinor),
          snapshotVersion: { increment: 1 },
          snapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      if (updated.count !== 1) throw new Error('STALE');
      await tx.auditLog.create({
        data: {
          companyId: value.companyId,
          actorUserId: access.user.id,
          actorEmailSnapshot: access.user.email,
          action: 'UPDATE',
          entityType: 'RENTAL',
          entityId: current.id,
          entityLabel: current.contractNumber ?? 'Черновик договора',
          changes: {
            reason: 'CORE_TERMS_EDITED',
            before: {
              vehicleId: current.vehicleId,
              startsAt: current.startsAt.toISOString(),
              endsAt: current.endsAt.toISOString(),
              dailyRateMinor: current.dailyRateMinor.toString(),
              discountMinor: current.discountMinor.toString(),
              servicesMinor: current.servicesMinor.toString(),
              depositMinor: current.depositMinor?.toString() ?? null,
              includedMileageKm: current.includedMileageKm,
              overageMileagePriceMinor: current.overageMileagePriceMinor?.toString() ?? null,
              missingFuelPriceMinor: current.missingFuelPriceMinor?.toString() ?? null,
            },
            after: {
              vehicleId: value.vehicleId,
              startsAt: value.startsAt.toISOString(),
              endsAt: value.endsAt.toISOString(),
              dailyRateMinor: String(value.dailyRateMinor),
              discountMinor: String(value.discountMinor),
              servicesMinor: String(value.servicesMinor),
              depositMinor: String(value.depositMinor),
              includedMileageKm: value.includedMileageKm,
              overageMileagePriceMinor: String(value.overageMileagePriceMinor),
              missingFuelPriceMinor: String(value.missingFuelPriceMinor),
            },
          },
        },
      });
      return { id: current.id, status: current.status, contractNumber: current.contractNumber };
    });
    revalidatePath('/rentals');
    revalidatePath(`/rentals/${result.id}`);
    revalidatePath(`/rentals/${result.id}/edit`);
    if (result.status === 'DRAFT')
      return { ok: true, rentalId: result.id, contractNumber: result.contractNumber ?? undefined };
    try {
      const document = await generateRentalDocumentPair({
        companyId: value.companyId,
        rentalId: result.id,
      });
      return {
        ok: true,
        rentalId: result.id,
        contractNumber: result.contractNumber ?? undefined,
        documentVersion: document.version,
      };
    } catch {
      return {
        ok: false,
        code: 'DOCUMENT_FAILED',
        message: 'Условия сохранены, но новая версия документов не создана.',
        confirmedNeedsDocuments: true,
        rentalId: result.id,
      };
    }
  } catch (error) {
    if (error instanceof RentalAccessDeniedError) return forbidden;
    const code = error instanceof Error ? error.message : '';
    if (code === 'STALE')
      return {
        ok: false,
        code,
        message: 'Договор уже изменён другим сотрудником. Обновите страницу.',
      };
    if (code === 'OVERLAP')
      return { ok: false, code, message: 'Автомобиль уже занят на выбранный период.' };
    return {
      ok: false,
      code: 'SAVE_FAILED',
      message: 'Не удалось сохранить договор. Повторите попытку.',
    };
  }
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

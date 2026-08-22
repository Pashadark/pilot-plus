import { calculateReturnCharges } from '../calculation';
import { deriveEvidenceStatus } from '../evidence-status';
import type { RentalDepositStatus, RentalEvidenceStatus, RentalVehicleCondition } from '../types';
import { recordAutomaticRatingEvent } from '@/modules/client-rating/automatic-events';

type Count = { count: number };
type Transaction = {
  companyMember: { findFirst(args: unknown): Promise<{ id: string } | null> };
  user: { findFirst(args: unknown): Promise<{ id: string } | null> };
  rentalOperation: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
    create(args: unknown): Promise<{ id: string }>;
    updateMany(args: unknown): Promise<Count>;
  };
  rentalOperationMedia: {
    findMany(args: unknown): Promise<{ kind: string; status: string }[]>;
  };
  rental: {
    findFirst(args: unknown): Promise<{
      id: string;
      clientId: string;
      vehicleId: string;
      endsAt: Date;
      billableDays: number;
      includedMileageKm: number | null;
      overageMileagePriceMinor: bigint | null;
      missingFuelPriceMinor: bigint | null;
    } | null>;
    updateMany(args: unknown): Promise<Count>;
  };
  clientRatingEvent: {
    createMany(args: unknown): Promise<{ count: number }>;
  };
  clientComment: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
  auditLog: { create(args: unknown): Promise<unknown> };
};
type Database = {
  $transaction<T>(
    work: (tx: Transaction) => Promise<T>,
    options: { isolationLevel: 'Serializable' },
  ): Promise<T>;
};
function prismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
function safeMinor(value: bigint | null, label: string) {
  if (value === null || value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(`${label} не настроена.`);
  return Number(value);
}
async function authorize(
  tx: Transaction,
  companyId: string,
  actor: { id: string; scope: 'SYSTEM' | 'COMPANY' },
) {
  const allowed =
    actor.scope === 'SYSTEM'
      ? await tx.user.findFirst({
          where: { id: actor.id, role: 'SUPER_ADMIN', isActive: true },
          select: { id: true },
        })
      : await tx.companyMember.findFirst({
          where: { companyId, userId: actor.id, role: { in: ['COMPANY_ADMIN', 'DISPATCHER'] } },
          select: { id: true },
        });
  if (!allowed) throw new Error('Доступ к операциям аренды запрещён.');
}

export function createRentalReturn(database: Database) {
  return async function complete(input: {
    companyId: string;
    actor: { id: string; scope: 'SYSTEM' | 'COMPANY' };
    command: {
      rentalId: string;
      idempotencyKey: string;
      occurredAt: Date;
      mileageKm: number;
      fuelLevelPercent: number;
      evidenceStatus: RentalEvidenceStatus;
      evidenceMissingReason?: string;
      vehicleCondition: RentalVehicleCondition;
      damageDescription?: string;
      depositStatus: RentalDepositStatus;
      depositAmountMinor?: number;
      depositWithheldMinor?: number;
      depositResolutionReason?: string;
    };
  }) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await database.$transaction(
          async (tx) => {
            await authorize(tx, input.companyId, input.actor);
            const existing = await tx.rentalOperation.findFirst({
              where: { companyId: input.companyId, idempotencyKey: input.command.idempotencyKey },
              select: { id: true, rentalId: true, status: true, type: true },
            });
            if (existing) {
              if (
                existing.status === 'COMMITTED' &&
                existing.type === 'RETURN' &&
                existing.rentalId === input.command.rentalId
              )
                return { operationId: String(existing.id), rentalId: String(existing.rentalId) };
              if (
                existing.status !== 'DRAFT' ||
                existing.type !== 'RETURN' ||
                existing.rentalId !== input.command.rentalId ||
                existing.actorUserId !== input.actor.id
              )
                throw new Error('Ключ операции уже использован.');
            }
            const rental = await tx.rental.findFirst({
              where: { id: input.command.rentalId, companyId: input.companyId, status: 'ACTIVE' },
              select: {
                id: true,
                clientId: true,
                vehicleId: true,
                endsAt: true,
                billableDays: true,
                includedMileageKm: true,
                overageMileagePriceMinor: true,
                missingFuelPriceMinor: true,
              },
            });
            if (!rental) throw new Error('Активный договор не найден.');
            const handover = await tx.rentalOperation.findFirst({
              where: {
                companyId: input.companyId,
                rentalId: rental.id,
                type: 'HANDOVER',
                status: 'COMMITTED',
              },
              select: { mileageKm: true, fuelLevelPercent: true },
              orderBy: { occurredAt: 'desc' },
            });
            if (
              !handover ||
              typeof handover.mileageKm !== 'number' ||
              typeof handover.fuelLevelPercent !== 'number'
            )
              throw new Error('Нет показателей выдачи автомобиля.');
            const charges = calculateReturnCharges({
              handoverMileageKm: handover.mileageKm,
              returnMileageKm: input.command.mileageKm,
              billableDays: rental.billableDays,
              includedMileageKmPerDay: rental.includedMileageKm ?? 0,
              overageMileagePriceMinor: safeMinor(
                rental.overageMileagePriceMinor,
                'Цена перепробега',
              ),
              handoverFuelLevelPercent: handover.fuelLevelPercent,
              returnFuelLevelPercent: input.command.fuelLevelPercent,
              missingFuelPriceMinor: safeMinor(rental.missingFuelPriceMinor, 'Цена топлива'),
            });
            const updated = await tx.rental.updateMany({
              where: { id: rental.id, companyId: input.companyId, status: 'ACTIVE' },
              data: { status: 'COMPLETED', completedAt: input.command.occurredAt },
            });
            if (updated.count !== 1)
              throw Object.assign(new Error('Stale rental'), { code: 'P2034' });
            let evidenceStatus = input.command.evidenceStatus;
            if (existing) {
              const media = await tx.rentalOperationMedia.findMany({
                where: { companyId: input.companyId, operationId: existing.id, status: 'CLEAN' },
                select: { kind: true, status: true },
              });
              evidenceStatus = deriveEvidenceStatus({
                hasVideo: media.some((item) => item.kind === 'INSPECTION_VIDEO'),
                hasDashboardPhoto: media.some((item) => item.kind === 'DASHBOARD_PHOTO'),
              });
              if (evidenceStatus !== 'COMPLETE' && !input.command.evidenceMissingReason)
                throw new Error('Причина отсутствия фиксации обязательна.');
            }
            const operationData = {
              companyId: input.companyId,
              rentalId: rental.id,
              clientId: rental.clientId,
              vehicleId: rental.vehicleId,
              actorUserId: input.actor.id,
              type: 'RETURN',
              status: 'COMMITTED',
              idempotencyKey: input.command.idempotencyKey,
              occurredAt: input.command.occurredAt,
              committedAt: input.command.occurredAt,
              evidenceStatus,
              evidenceMissingReason: input.command.evidenceMissingReason,
              mileageKm: input.command.mileageKm,
              fuelLevelPercent: input.command.fuelLevelPercent,
              mileageChargeMinor: BigInt(charges.mileageChargeMinor),
              fuelChargeMinor: BigInt(charges.fuelChargeMinor),
              totalChargeMinor: BigInt(charges.totalChargeMinor),
              depositStatus: input.command.depositStatus,
              depositAmountMinor:
                input.command.depositAmountMinor === undefined
                  ? undefined
                  : BigInt(input.command.depositAmountMinor),
              depositWithheldMinor:
                input.command.depositWithheldMinor === undefined
                  ? undefined
                  : BigInt(input.command.depositWithheldMinor),
              depositResolutionReason: input.command.depositResolutionReason,
              vehicleCondition: input.command.vehicleCondition,
              damageDescription: input.command.damageDescription,
            };
            let operation: { id: string };
            if (existing) {
              const committed = await tx.rentalOperation.updateMany({
                where: {
                  id: String(existing.id),
                  companyId: input.companyId,
                  status: 'DRAFT',
                  actorUserId: input.actor.id,
                },
                data: operationData,
              });
              if (committed.count !== 1)
                throw Object.assign(new Error('Stale operation status'), { code: 'P2034' });
              operation = { id: String(existing.id) };
            } else {
              operation = await tx.rentalOperation.create({
                data: operationData,
                select: { id: true },
              });
            }
            const openProblem =
              input.command.vehicleCondition === 'GOOD'
                ? await tx.clientComment.findFirst({
                    where: {
                      companyId: input.companyId,
                      rentalId: rental.id,
                      hiddenAt: null,
                      problemStatus: 'OPEN',
                    },
                    select: { id: true },
                  })
                : null;
            if (input.command.vehicleCondition === 'GOOD' && !openProblem) {
              await recordAutomaticRatingEvent(tx, {
                companyId: input.companyId,
                clientId: rental.clientId,
                rentalId: rental.id,
                vehicleId: rental.vehicleId,
                type: 'CLEAN_RENTAL',
                reason: 'CLEAN_RENTAL_COMPLETED',
                delta: 8,
                idempotencyKey: `rental:${rental.id}:clean-completion`,
              });
            }
            if (input.command.occurredAt <= rental.endsAt) {
              await recordAutomaticRatingEvent(tx, {
                companyId: input.companyId,
                clientId: rental.clientId,
                rentalId: rental.id,
                vehicleId: rental.vehicleId,
                type: 'ON_TIME_RETURN',
                reason: 'ON_TIME_RETURN_COMPLETED',
                delta: 2,
                idempotencyKey: `rental:${rental.id}:on-time-return`,
              });
            }
            await tx.auditLog.create({
              data: {
                companyId: input.companyId,
                actorUserId: input.actor.id,
                actorEmailSnapshot: 'redacted@audit.invalid',
                action: 'UPDATE',
                entityType: 'RENTAL',
                entityId: rental.id,
                entityLabel: 'Возврат автомобиля',
                changes: {
                  operationId: operation.id,
                  totalChargeMinor: charges.totalChargeMinor,
                  evidenceStatus,
                },
              },
            });
            return { operationId: operation.id, rentalId: rental.id };
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if (prismaCode(error, 'P2034') && attempt < 3) continue;
        throw error;
      }
    }
    throw new Error('Не удалось принять возврат автомобиля.');
  };
}

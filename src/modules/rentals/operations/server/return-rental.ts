import { calculateReturnCharges } from '../calculation';
import { deriveReturnEvidenceStatus } from '../evidence-status';
import type { RentalEvidenceStatus, RentalVehicleCondition } from '../types';
import { recordAutomaticRatingEvent } from '@/modules/client-rating/automatic-events';
import { enqueueRentalLifecycleNotifications } from './enqueue-lifecycle-notifications';

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
      agreementType: 'STANDARD' | 'LEASE_TO_OWN';
      includedMileageKm: number | null;
      overageMileagePriceMinor: bigint | null;
      missingFuelPriceMinor: bigint | null;
      vehicle: {
        includedMileageKm: number | null;
        overageMileagePriceMinor: bigint | null;
        missingFuelPriceMinor: bigint | null;
      };
    } | null>;
    updateMany(args: unknown): Promise<Count>;
  };
  vehicle: { updateMany(args: unknown): Promise<Count> };
  maintenanceRecord?: {
    findFirst(args: unknown): Promise<{ id: string; targetOdometerKm: unknown | null } | null>;
    create(args: unknown): Promise<{ id: string }>;
    updateMany(args: unknown): Promise<Count>;
  };
  clientRatingEvent: {
    createMany(args: unknown): Promise<{ count: number }>;
  };
  clientComment: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
  telegramGroupBinding?: Parameters<
    typeof enqueueRentalLifecycleNotifications
  >[0]['telegramGroupBinding'];
  telegramIdentity?: Parameters<typeof enqueueRentalLifecycleNotifications>[0]['telegramIdentity'];
  botNotificationJob?: Parameters<
    typeof enqueueRentalLifecycleNotifications
  >[0]['botNotificationJob'];
  auditLog: { create(args: unknown): Promise<unknown> };
};
type Database = {
  $transaction<T>(
    work: (tx: Transaction) => Promise<T>,
    options: { isolationLevel: 'Serializable' },
  ): Promise<T>;
};
const MAINTENANCE_INTERVAL_KM = 7_000;
const DEFAULT_MISSING_FUEL_PRICE_MINOR = BigInt(15_000);
function prismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
function safeMinor(value: bigint | null, label: string) {
  if (value === null || value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(`${label} не настроена.`);
  return Number(value);
}

export function resolveReturnPricing(input: {
  agreementType?: 'STANDARD' | 'LEASE_TO_OWN';
  includedMileageKm: number | null;
  overageMileagePriceMinor: bigint | null;
  missingFuelPriceMinor: bigint | null;
  vehicle?: {
    includedMileageKm: number | null;
    overageMileagePriceMinor: bigint | null;
    missingFuelPriceMinor: bigint | null;
  };
}) {
  const leaseToOwn = input.agreementType === 'LEASE_TO_OWN';
  return {
    includedMileageKmPerDay: leaseToOwn
      ? 0
      : (input.includedMileageKm ?? input.vehicle?.includedMileageKm ?? 0),
    overageMileagePriceMinor: leaseToOwn
      ? 0
      : safeMinor(
          input.overageMileagePriceMinor ?? input.vehicle?.overageMileagePriceMinor ?? null,
          'Цена перепробега',
        ),
    missingFuelPriceMinor: safeMinor(
      input.missingFuelPriceMinor ??
        input.vehicle?.missingFuelPriceMinor ??
        DEFAULT_MISSING_FUEL_PRICE_MINOR,
      'Цена топлива',
    ),
  };
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
    };
  }) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await database.$transaction(
          async (tx) => {
            await authorize(tx, input.companyId, input.actor);
            const existing = await tx.rentalOperation.findFirst({
              where: { companyId: input.companyId, idempotencyKey: input.command.idempotencyKey },
              select: {
                id: true,
                rentalId: true,
                actorUserId: true,
                status: true,
                type: true,
              },
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
                agreementType: true,
                includedMileageKm: true,
                overageMileagePriceMinor: true,
                missingFuelPriceMinor: true,
                vehicle: {
                  select: {
                    includedMileageKm: true,
                    overageMileagePriceMinor: true,
                    missingFuelPriceMinor: true,
                  },
                },
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
            const hasHandoverReadings =
              Boolean(handover) &&
              typeof handover?.mileageKm === 'number' &&
              typeof handover?.fuelLevelPercent === 'number';
            const pricing = resolveReturnPricing(rental);
            const charges = calculateReturnCharges({
              // Для импортированных старых договоров показателей выдачи может не быть.
              // В таком случае используем показатели возврата как нейтральную базу и не
              // начисляем неподтверждённые перепробег и топливо.
              handoverMileageKm: hasHandoverReadings
                ? (handover?.mileageKm as number)
                : input.command.mileageKm,
              returnMileageKm: input.command.mileageKm,
              billableDays: rental.billableDays,
              includedMileageKmPerDay: pricing.includedMileageKmPerDay,
              overageMileagePriceMinor: pricing.overageMileagePriceMinor,
              handoverFuelLevelPercent: hasHandoverReadings
                ? (handover?.fuelLevelPercent as number)
                : input.command.fuelLevelPercent,
              returnFuelLevelPercent: input.command.fuelLevelPercent,
              missingFuelPriceMinor: pricing.missingFuelPriceMinor,
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
              evidenceStatus = deriveReturnEvidenceStatus({
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
              evidenceMissingReason:
                evidenceStatus === 'COMPLETE' ? null : input.command.evidenceMissingReason,
              mileageKm: input.command.mileageKm,
              fuelLevelPercent: input.command.fuelLevelPercent,
              mileageChargeMinor: BigInt(charges.mileageChargeMinor),
              fuelChargeMinor: BigInt(charges.fuelChargeMinor),
              totalChargeMinor: BigInt(charges.totalChargeMinor),
              depositStatus: null,
              depositAmountMinor: null,
              depositWithheldMinor: null,
              depositResolutionReason: null,
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
            const vehicleUpdated = await tx.vehicle.updateMany({
              where: { id: rental.vehicleId, companyId: input.companyId },
              data: { odometerKm: input.command.mileageKm },
            });
            if (vehicleUpdated.count !== 1)
              throw Object.assign(new Error('Stale vehicle'), { code: 'P2034' });
            if (tx.maintenanceRecord) {
              const openMaintenance = await tx.maintenanceRecord.findFirst({
                where: {
                  vehicleId: rental.vehicleId,
                  status: { in: ['PLANNED', 'IN_PROGRESS'] },
                },
                select: { id: true, targetOdometerKm: true },
                orderBy: { createdAt: 'desc' },
              });
              if (!openMaintenance) {
                await tx.maintenanceRecord.create({
                  data: {
                    vehicleId: rental.vehicleId,
                    title: 'Плановое ТО через 7 000 км',
                    kind: 'INSPECTION',
                    status: 'PLANNED',
                    odometerKm: input.command.mileageKm,
                    targetOdometerKm: input.command.mileageKm + MAINTENANCE_INTERVAL_KM,
                  },
                  select: { id: true },
                });
              } else if (openMaintenance.targetOdometerKm === null) {
                const maintenanceUpdated = await tx.maintenanceRecord.updateMany({
                  where: {
                    id: openMaintenance.id,
                    vehicleId: rental.vehicleId,
                    status: { in: ['PLANNED', 'IN_PROGRESS'] },
                    targetOdometerKm: null,
                  },
                  data: {
                    odometerKm: input.command.mileageKm,
                    targetOdometerKm: input.command.mileageKm + MAINTENANCE_INTERVAL_KM,
                  },
                });
                if (maintenanceUpdated.count !== 1)
                  throw Object.assign(new Error('Stale maintenance'), { code: 'P2034' });
              }
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
                  handoverReadingsMissing: !hasHandoverReadings,
                },
              },
            });
            await enqueueRentalLifecycleNotifications(tx, {
              companyId: input.companyId,
              rentalId: rental.id,
              operationId: operation.id,
              kind: 'RETURN',
              occurredAt: input.command.occurredAt,
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

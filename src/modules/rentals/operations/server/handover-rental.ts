import type {
  RentalDepositStatus,
  RentalEvidenceStatus,
  RentalFulfillmentMethod,
  RentalPaymentMethod,
} from '../types';

type Count = { count: number };
type Transaction = {
  companyMember: { findFirst(args: unknown): Promise<{ id: string } | null> };
  user: { findFirst(args: unknown): Promise<{ id: string } | null> };
  rentalOperation: {
    findFirst(args: unknown): Promise<{
      id: string;
      rentalId: string;
      status: string;
      type: string;
    } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  rental: {
    findFirst(args: unknown): Promise<{
      id: string;
      companyId: string;
      clientId: string;
      vehicleId: string;
      status: string;
    } | null>;
    updateMany(args: unknown): Promise<Count>;
  };
  auditLog: { create(args: unknown): Promise<unknown> };
};
type Database = {
  $transaction<T>(
    work: (transaction: Transaction) => Promise<T>,
    options: { isolationLevel: 'Serializable' },
  ): Promise<T>;
};

type HandoverCommand = {
  rentalId: string;
  idempotencyKey: string;
  occurredAt: Date;
  mileageKm: number;
  fuelLevelPercent: number;
  evidenceStatus: RentalEvidenceStatus;
  evidenceMissingReason?: string;
  fulfillmentMethod: RentalFulfillmentMethod;
  fulfillmentAddress?: string;
  depositStatus: RentalDepositStatus;
  depositAmountMinor?: number;
  depositPaymentMethod?: RentalPaymentMethod;
};

function prismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

async function authorize(
  transaction: Transaction,
  companyId: string,
  actor: { id: string; scope: 'SYSTEM' | 'COMPANY' },
) {
  if (actor.scope === 'SYSTEM') {
    const user = await transaction.user.findFirst({
      where: { id: actor.id, role: 'SUPER_ADMIN', isActive: true },
      select: { id: true },
    });
    if (user) return;
  } else {
    const membership = await transaction.companyMember.findFirst({
      where: {
        companyId,
        userId: actor.id,
        role: { in: ['COMPANY_ADMIN', 'DISPATCHER'] },
      },
      select: { id: true },
    });
    if (membership) return;
  }
  throw new Error('Доступ к операциям аренды запрещён.');
}

export function createRentalHandover(database: Database) {
  return async function handover(input: {
    companyId: string;
    actor: { id: string; scope: 'SYSTEM' | 'COMPANY' };
    command: HandoverCommand;
  }) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await database.$transaction(
          async (transaction) => {
            await authorize(transaction, input.companyId, input.actor);
            const existing = await transaction.rentalOperation.findFirst({
              where: { companyId: input.companyId, idempotencyKey: input.command.idempotencyKey },
              select: { id: true, rentalId: true, status: true, type: true },
            });
            if (existing) {
              if (
                existing.status === 'COMMITTED' &&
                existing.type === 'HANDOVER' &&
                existing.rentalId === input.command.rentalId
              )
                return { operationId: existing.id, rentalId: existing.rentalId };
              throw new Error('Ключ операции уже использован.');
            }
            const rental = await transaction.rental.findFirst({
              where: {
                id: input.command.rentalId,
                companyId: input.companyId,
                status: 'CONFIRMED',
              },
              select: {
                id: true,
                companyId: true,
                clientId: true,
                vehicleId: true,
                status: true,
              },
            });
            if (!rental) throw new Error('Подтверждённый договор не найден.');
            const activated = await transaction.rental.updateMany({
              where: { id: rental.id, companyId: input.companyId, status: 'CONFIRMED' },
              data: { status: 'ACTIVE', activatedAt: input.command.occurredAt },
            });
            if (activated.count !== 1)
              throw Object.assign(new Error('Stale rental status'), { code: 'P2034' });
            const operation = await transaction.rentalOperation.create({
              data: {
                companyId: input.companyId,
                rentalId: rental.id,
                clientId: rental.clientId,
                vehicleId: rental.vehicleId,
                actorUserId: input.actor.id,
                type: 'HANDOVER',
                status: 'COMMITTED',
                idempotencyKey: input.command.idempotencyKey,
                occurredAt: input.command.occurredAt,
                committedAt: input.command.occurredAt,
                evidenceStatus: input.command.evidenceStatus,
                evidenceMissingReason: input.command.evidenceMissingReason,
                fulfillmentMethod: input.command.fulfillmentMethod,
                fulfillmentAddress: input.command.fulfillmentAddress,
                mileageKm: input.command.mileageKm,
                fuelLevelPercent: input.command.fuelLevelPercent,
                depositStatus: input.command.depositStatus,
                depositAmountMinor:
                  input.command.depositAmountMinor === undefined
                    ? undefined
                    : BigInt(input.command.depositAmountMinor),
                depositPaymentMethod: input.command.depositPaymentMethod,
              },
              select: { id: true },
            });
            await transaction.auditLog.create({
              data: {
                companyId: input.companyId,
                actorUserId: input.actor.id,
                actorEmailSnapshot: 'redacted@audit.invalid',
                action: 'UPDATE',
                entityType: 'RENTAL',
                entityId: rental.id,
                entityLabel: 'Выдача автомобиля',
                changes: {
                  operationId: operation.id,
                  type: 'HANDOVER',
                  evidenceStatus: input.command.evidenceStatus,
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
    throw new Error('Не удалось сохранить выдачу автомобиля.');
  };
}

import type { RentalOperationType } from '../types';

type Transaction = {
  companyMember: { findFirst(args: unknown): Promise<{ id: string } | null> };
  user: { findFirst(args: unknown): Promise<{ id: string } | null> };
  rental: {
    findFirst(args: unknown): Promise<{
      id: string;
      clientId: string;
      vehicleId: string;
    } | null>;
  };
  rentalOperation: {
    findFirst(args: unknown): Promise<{
      id: string;
      rentalId: string;
      actorUserId: string;
      type: string;
      status: string;
    } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
};
type Database = {
  $transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>;
};

async function authorize(
  transaction: Transaction,
  companyId: string,
  actor: { id: string; scope: 'SYSTEM' | 'COMPANY' },
) {
  const allowed =
    actor.scope === 'SYSTEM'
      ? await transaction.user.findFirst({
          where: { id: actor.id, role: 'SUPER_ADMIN', isActive: true },
          select: { id: true },
        })
      : await transaction.companyMember.findFirst({
          where: {
            companyId,
            userId: actor.id,
            role: { in: ['COMPANY_ADMIN', 'DISPATCHER'] },
          },
          select: { id: true },
        });
  if (!allowed) throw new Error('Доступ к операциям аренды запрещён.');
}

export function createOperationDraftPreparer(database: Database) {
  return async function prepare(input: {
    companyId: string;
    actor: { id: string; scope: 'SYSTEM' | 'COMPANY' };
    rentalId: string;
    type: Exclude<RentalOperationType, 'EXTENSION'>;
    idempotencyKey: string;
    occurredAt: Date;
  }) {
    return database.$transaction(async (transaction) => {
      await authorize(transaction, input.companyId, input.actor);
      const existing = await transaction.rentalOperation.findFirst({
        where: { companyId: input.companyId, idempotencyKey: input.idempotencyKey },
        select: { id: true, rentalId: true, actorUserId: true, type: true, status: true },
      });
      if (existing) {
        if (
          existing.status === 'DRAFT' &&
          existing.type === input.type &&
          existing.rentalId === input.rentalId &&
          existing.actorUserId === input.actor.id
        )
          return { operationId: existing.id };
        throw new Error('Ключ операции уже использован.');
      }
      const expectedStatus = input.type === 'HANDOVER' ? 'CONFIRMED' : 'ACTIVE';
      const rental = await transaction.rental.findFirst({
        where: { id: input.rentalId, companyId: input.companyId, status: expectedStatus },
        select: { id: true, clientId: true, vehicleId: true },
      });
      if (!rental) throw new Error('Договор недоступен для операции.');
      const operation = await transaction.rentalOperation.create({
        data: {
          companyId: input.companyId,
          rentalId: rental.id,
          clientId: rental.clientId,
          vehicleId: rental.vehicleId,
          actorUserId: input.actor.id,
          type: input.type,
          status: 'DRAFT',
          idempotencyKey: input.idempotencyKey,
          occurredAt: input.occurredAt,
          evidenceStatus: 'MISSING',
        },
        select: { id: true },
      });
      return { operationId: operation.id };
    });
  };
}

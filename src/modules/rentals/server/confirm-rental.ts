import 'server-only';

import { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import { requireRentalAccess } from './access';

type ConfirmationTransaction = {
  rental: {
    findFirst(args: unknown): Promise<{
      id: string;
      vehicleId?: string;
      startsAt?: Date;
      endsAt?: Date;
      status?: string;
    } | null>;
    update(args: unknown): Promise<{ id: string }>;
  };
  auditLog?: { create(args: unknown): Promise<unknown> };
};

type ConfirmationDatabase = {
  transaction<T>(work: (transaction: ConfirmationTransaction) => Promise<T>): Promise<T>;
};

export function createRentalConfirmation(database: ConfirmationDatabase) {
  return async function confirm(input: {
    companyId: string;
    rentalId: string;
    actor?: { id: string; email: string };
  }) {
    return database.transaction(async (transaction) => {
      const rental = await transaction.rental.findFirst({
        where: { id: input.rentalId, companyId: input.companyId, status: 'DRAFT' },
        select: { id: true, vehicleId: true, startsAt: true, endsAt: true, status: true },
      });
      if (!rental) throw new Error('Черновик аренды недоступен или уже подтверждён.');
      const overlap = await transaction.rental.findFirst({
        where: {
          companyId: input.companyId,
          vehicleId: rental.vehicleId,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          id: { not: input.rentalId },
          startsAt: { lt: rental.endsAt },
          endsAt: { gt: rental.startsAt },
        },
        select: { id: true },
      });
      if (overlap) throw new Error('Автомобиль уже занят на выбранный период.');
      const updated = await transaction.rental.update({
        where: { id: input.rentalId },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
        select: { id: true },
      });
      if (input.actor && transaction.auditLog)
        await transaction.auditLog.create({
          data: {
            companyId: input.companyId,
            actorUserId: input.actor.id,
            actorEmailSnapshot: input.actor.email,
            action: 'UPDATE',
            entityType: 'RENTAL',
            entityId: updated.id,
            entityLabel: 'Договор аренды',
            changes: { status: 'CONFIRMED' },
          },
        });
      return { rentalId: updated.id };
    });
  };
}

export async function retrySerializable<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (!(
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034'
      )) {
        throw error;
      }
    }
  }
  throw lastError;
}

const confirmation = createRentalConfirmation({
  transaction: (work) =>
    prisma.$transaction((transaction) => work(transaction as unknown as ConfirmationTransaction), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }),
});

export async function confirmRental(companyId: string, rentalId: string) {
  await requireRentalAccess(companyId);
  return retrySerializable(() => confirmation({ companyId, rentalId }));
}

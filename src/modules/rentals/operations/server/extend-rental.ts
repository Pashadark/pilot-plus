import { calculateExtensionCharges } from '../calculation';

type Count = { count: number };
type Transaction = {
  companyMember: { findFirst(args: unknown): Promise<{ id: string } | null> };
  user: { findFirst(args: unknown): Promise<{ id: string } | null> };
  rentalOperation: {
    findFirst(
      args: unknown,
    ): Promise<{ id: string; rentalId: string; status: string; type: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  rental: {
    findFirst(args: unknown): Promise<{
      id: string;
      clientId: string;
      vehicleId: string;
      startsAt: Date;
      endsAt: Date;
      dailyRateMinor: bigint;
      totalPriceMinor: bigint;
      billableDays: number;
    } | null>;
    findMany(args: unknown): Promise<Array<{ id: string }>>;
    updateMany(args: unknown): Promise<Count>;
  };
  maintenanceRecord: { findFirst(args: unknown): Promise<{ id: string } | null> };
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

export function createRentalExtension(database: Database) {
  return async function extend(input: {
    companyId: string;
    actor: { id: string; scope: 'SYSTEM' | 'COMPANY' };
    command: {
      rentalId: string;
      idempotencyKey: string;
      occurredAt: Date;
      nextEndsAt: Date;
      notes?: string;
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
                existing.type === 'EXTENSION' &&
                existing.rentalId === input.command.rentalId
              )
                return { operationId: existing.id, rentalId: existing.rentalId };
              throw new Error('Ключ операции уже использован.');
            }
            const rental = await tx.rental.findFirst({
              where: { id: input.command.rentalId, companyId: input.companyId, status: 'ACTIVE' },
              select: {
                id: true,
                clientId: true,
                vehicleId: true,
                startsAt: true,
                endsAt: true,
                dailyRateMinor: true,
                totalPriceMinor: true,
                billableDays: true,
              },
            });
            if (!rental) throw new Error('Активный договор не найден.');
            if (rental.dailyRateMinor > BigInt(Number.MAX_SAFE_INTEGER))
              throw new Error('Тариф договора некорректен.');
            const calculation = calculateExtensionCharges({
              previousEndsAt: rental.endsAt,
              nextEndsAt: input.command.nextEndsAt,
              dailyRateMinor: Number(rental.dailyRateMinor),
            });
            const [overlaps, maintenance] = await Promise.all([
              tx.rental.findMany({
                where: {
                  id: { not: rental.id },
                  companyId: input.companyId,
                  vehicleId: rental.vehicleId,
                  status: { in: ['CONFIRMED', 'ACTIVE'] },
                  startsAt: { lt: input.command.nextEndsAt },
                  endsAt: { gt: rental.endsAt },
                },
                select: { id: true },
                take: 1,
              }),
              tx.maintenanceRecord.findFirst({
                where: {
                  vehicleId: rental.vehicleId,
                  status: { in: ['PLANNED', 'IN_PROGRESS'] },
                  scheduledAt: { lt: input.command.nextEndsAt },
                  scheduledEndsAt: { gt: rental.endsAt },
                },
                select: { id: true },
              }),
            ]);
            if (overlaps.length || maintenance)
              throw new Error('Автомобиль занят на период продления.');
            const nextTotal = rental.totalPriceMinor + BigInt(calculation.extensionChargeMinor);
            const updated = await tx.rental.updateMany({
              where: {
                id: rental.id,
                companyId: input.companyId,
                status: 'ACTIVE',
                endsAt: rental.endsAt,
              },
              data: {
                endsAt: input.command.nextEndsAt,
                billableDays: rental.billableDays + calculation.additionalDays,
                basePriceMinor: { increment: BigInt(calculation.extensionChargeMinor) },
                totalPriceMinor: nextTotal,
              },
            });
            if (updated.count !== 1)
              throw Object.assign(new Error('Stale rental'), { code: 'P2034' });
            const operation = await tx.rentalOperation.create({
              data: {
                companyId: input.companyId,
                rentalId: rental.id,
                clientId: rental.clientId,
                vehicleId: rental.vehicleId,
                actorUserId: input.actor.id,
                type: 'EXTENSION',
                status: 'COMMITTED',
                idempotencyKey: input.command.idempotencyKey,
                occurredAt: input.command.occurredAt,
                committedAt: input.command.occurredAt,
                evidenceStatus: 'MISSING',
                evidenceMissingReason: 'Для продления фото- и видеофиксация не требуется.',
                previousStartsAt: rental.startsAt,
                previousEndsAt: rental.endsAt,
                nextStartsAt: rental.startsAt,
                nextEndsAt: input.command.nextEndsAt,
                previousTotalPriceMinor: rental.totalPriceMinor,
                nextTotalPriceMinor: nextTotal,
                extensionChargeMinor: BigInt(calculation.extensionChargeMinor),
                notes: input.command.notes,
              },
              select: { id: true },
            });
            await tx.auditLog.create({
              data: {
                companyId: input.companyId,
                actorUserId: input.actor.id,
                actorEmailSnapshot: 'redacted@audit.invalid',
                action: 'UPDATE',
                entityType: 'RENTAL',
                entityId: rental.id,
                entityLabel: 'Продление аренды',
                changes: {
                  operationId: operation.id,
                  previousEndsAt: rental.endsAt,
                  nextEndsAt: input.command.nextEndsAt,
                  extensionChargeMinor: calculation.extensionChargeMinor,
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
    throw new Error('Не удалось продлить аренду.');
  };
}

import 'server-only';

import type { PaymentCommand, SignatureCommand } from '../validation';

type Actor = { id: string; email: string };
type RentalRow = { id: string; companyId: string; status: string; contractNumber: string | null };
type PaymentRow = { id: string };

type SettlementTransaction = {
  rental: {
    findFirst(args: { where: { companyId: string; id: string } }): Promise<RentalRow | null>;
  };
  rentalPayment: {
    findUnique(args: {
      where: {
        companyId_rentalId_idempotencyKey: {
          companyId: string;
          rentalId: string;
          idempotencyKey: string;
        };
      };
      select: { id: true };
    }): Promise<PaymentRow | null>;
    create(args: { data: Record<string, unknown> }): Promise<PaymentRow>;
  };
  rentalSignature: {
    upsert(args: {
      where: { companyId_rentalId_party: { companyId: string; rentalId: string; party: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<PaymentRow>;
  };
  auditLog: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
};

type SettlementDatabase = {
  $transaction<T>(callback: (transaction: SettlementTransaction) => Promise<T>): Promise<T>;
};

const editableStatuses = new Set(['DRAFT', 'CONFIRMED', 'ACTIVE']);

async function requireRental(
  transaction: SettlementTransaction,
  companyId: string,
  rentalId: string,
) {
  const rental = await transaction.rental.findFirst({ where: { companyId, id: rentalId } });
  if (!rental) throw new Error('Договор не найден или недоступен.');
  if (!editableStatuses.has(rental.status)) {
    throw new Error('Расчёты по закрытому или отменённому договору нельзя изменять.');
  }
  return rental;
}

function auditData(input: {
  companyId: string;
  rental: RentalRow;
  actor: Actor;
  changes: Record<string, unknown>;
}) {
  return {
    companyId: input.companyId,
    actorUserId: input.actor.id,
    actorEmailSnapshot: input.actor.email,
    action: 'UPDATE',
    entityType: 'RENTAL',
    entityId: input.rental.id,
    entityLabel: input.rental.contractNumber ?? 'Черновик договора',
    changes: input.changes,
  };
}

export function createRentalSettlementService(
  database: SettlementDatabase,
  now: () => Date = () => new Date(),
) {
  return {
    recordPayment(input: { companyId: string; actor: Actor; command: PaymentCommand }) {
      return database.$transaction(async (transaction) => {
        const rental = await requireRental(transaction, input.companyId, input.command.rentalId);
        const key = {
          companyId: input.companyId,
          rentalId: rental.id,
          idempotencyKey: input.command.idempotencyKey,
        };
        const existing = await transaction.rentalPayment.findUnique({
          where: { companyId_rentalId_idempotencyKey: key },
          select: { id: true },
        });
        if (existing) return { id: existing.id, reused: true as const };

        const payment = await transaction.rentalPayment.create({
          data: {
            ...key,
            kind: input.command.kind,
            status: input.command.status,
            amountMinor: input.command.amountMinor,
            method: input.command.method,
            reference: input.command.reference,
            comment: input.command.comment,
            recordedByUserId: input.actor.id,
          },
        });
        await transaction.auditLog.create({
          data: auditData({
            companyId: input.companyId,
            rental,
            actor: input.actor,
            changes: {
              settlement: 'PAYMENT_RECORDED',
              paymentId: payment.id,
              kind: input.command.kind,
              status: input.command.status,
              amountMinor: input.command.amountMinor.toString(),
              method: input.command.method,
            },
          }),
        });
        return { id: payment.id, reused: false as const };
      });
    },

    setSignature(input: { companyId: string; actor: Actor; command: SignatureCommand }) {
      return database.$transaction(async (transaction) => {
        const rental = await requireRental(transaction, input.companyId, input.command.rentalId);
        const signedAt = input.command.status === 'SIGNED' ? now() : null;
        const facts = {
          status: input.command.status,
          signedByName: input.command.status === 'SIGNED' ? input.command.signedByName : null,
          signedAt,
          comment: input.command.comment,
          recordedByUserId: input.actor.id,
        };
        const signature = await transaction.rentalSignature.upsert({
          where: {
            companyId_rentalId_party: {
              companyId: input.companyId,
              rentalId: rental.id,
              party: input.command.party,
            },
          },
          create: {
            companyId: input.companyId,
            rentalId: rental.id,
            party: input.command.party,
            ...facts,
          },
          update: facts,
        });
        await transaction.auditLog.create({
          data: auditData({
            companyId: input.companyId,
            rental,
            actor: input.actor,
            changes: {
              settlement: 'SIGNATURE_UPDATED',
              signatureId: signature.id,
              party: input.command.party,
              status: input.command.status,
            },
          }),
        });
        return { id: signature.id };
      });
    },
  };
}

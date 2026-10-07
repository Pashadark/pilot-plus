import type { AdmittedBookingReceipt } from './payment-receipt';

type BookingRental = {
  id: string;
  companyId: string;
  status: string;
  totalPriceMinor: bigint;
  contractNumber: string | null;
  vehicleId: string;
  startsAt: Date;
  endsAt: Date;
};

type BookingTransaction = {
  rental: {
    findFirst(args: unknown): Promise<BookingRental | { id: string } | null>;
  };
  rentalPayment: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  rentalPaymentReceipt: { create(args: unknown): Promise<{ id: string }> };
  auditLog: { create(args: unknown): Promise<unknown> };
};

type BookingDatabase = {
  $transaction<T>(work: (transaction: BookingTransaction) => Promise<T>): Promise<T>;
};

export function createBookingFinalizer(database: BookingDatabase) {
  return (input: {
    companyId: string;
    rentalId: string;
    actorUserId: string;
    actorEmail: string;
    idempotencyKey: string;
    receipt: AdmittedBookingReceipt;
    method?: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  }) =>
    database.$transaction(async (transaction) => {
      const rental = (await transaction.rental.findFirst({
        where: { id: input.rentalId, companyId: input.companyId, status: 'CONFIRMED' },
        select: {
          id: true,
          companyId: true,
          status: true,
          totalPriceMinor: true,
          contractNumber: true,
          vehicleId: true,
          startsAt: true,
          endsAt: true,
        },
      })) as BookingRental | null;
      if (!rental || !rental.contractNumber) throw new Error('BOOKING_NOT_CONFIRMED');

      const overlap = await transaction.rental.findFirst({
        where: {
          companyId: input.companyId,
          vehicleId: rental.vehicleId,
          id: { not: rental.id },
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          startsAt: { lt: rental.endsAt },
          endsAt: { gt: rental.startsAt },
        },
        select: { id: true },
      });
      if (overlap) throw new Error('VEHICLE_UNAVAILABLE');

      const existing = await transaction.rentalPayment.findUnique({
        where: {
          companyId_rentalId_idempotencyKey: {
            companyId: input.companyId,
            rentalId: rental.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
        select: { id: true },
      });
      if (existing) {
        return {
          rentalId: rental.id,
          contractNumber: rental.contractNumber,
          paymentId: existing.id,
          reused: true as const,
        };
      }

      const payment = await transaction.rentalPayment.create({
        data: {
          companyId: input.companyId,
          rentalId: rental.id,
          kind: 'RENT',
          status: 'CONFIRMED',
          amountMinor: rental.totalPriceMinor,
          currency: 'RUB',
          method: input.method ?? 'TRANSFER',
          reference: 'Фотография чека бронирования',
          comment: 'Оплата подтверждена при создании бронирования.',
          idempotencyKey: input.idempotencyKey,
          recordedByUserId: input.actorUserId,
        },
        select: { id: true },
      });
      await transaction.rentalPaymentReceipt.create({
        data: {
          companyId: input.companyId,
          paymentId: payment.id,
          storageKey: input.receipt.storageKey,
          originalName: input.receipt.originalName,
          verifiedMime: input.receipt.verifiedMime,
          bytes: input.receipt.bytes,
          sha256: input.receipt.sha256,
          scanEngine: input.receipt.scanEngine,
          signatureVersion: input.receipt.signatureVersion,
          scannedAt: input.receipt.scannedAt,
        },
      });
      await transaction.auditLog.create({
        data: {
          companyId: input.companyId,
          actorUserId: input.actorUserId,
          actorEmailSnapshot: input.actorEmail,
          action: 'UPDATE',
          entityType: 'RENTAL',
          entityId: rental.id,
          entityLabel: rental.contractNumber,
          changes: {
            booking: 'PAYMENT_CONFIRMED',
            paymentId: payment.id,
            receiptStorageKey: input.receipt.storageKey,
          },
        },
      });
      return {
        rentalId: rental.id,
        contractNumber: rental.contractNumber,
        paymentId: payment.id,
        reused: false as const,
      };
    });
}

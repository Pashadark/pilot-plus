import { prisma } from '../src/database/prisma/client';
import { planOwnerConfirmedPaymentReconciliation } from '../src/modules/rentals/server/owner-confirmed-payment-reconciliation';

async function main() {
  const apply = process.argv.includes('--apply');
  const actor = await prisma.user.findFirstOrThrow({
    where: { role: 'SUPER_ADMIN', isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  const rentals = await prisma.rental.findMany({
    where: { status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] } },
    select: {
      id: true,
      companyId: true,
      contractNumber: true,
      status: true,
      currency: true,
      totalPriceMinor: true,
      payments: {
        where: {
          kind: 'RENT',
          status: { in: ['CONFIRMED', 'REFUNDED', 'PARTIALLY_REFUNDED'] },
        },
        select: { status: true, amountMinor: true, idempotencyKey: true },
      },
    },
    orderBy: { startsAt: 'asc' },
  });
  const plan = planOwnerConfirmedPaymentReconciliation(
    rentals.map((rental) => ({
      ...rental,
      confirmedRentMinor: rental.payments
        .filter((payment) => payment.status === 'CONFIRMED')
        .reduce((total, payment) => total + payment.amountMinor, BigInt(0)),
      refundedRentMinor: rental.payments
        .filter(
          (payment) =>
            payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED',
        )
        .reduce((total, payment) => total + payment.amountMinor, BigInt(0)),
      existingIdempotencyKeys: rental.payments.flatMap((payment) =>
        payment.idempotencyKey ? [payment.idempotencyKey] : [],
      ),
    })),
  );

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        rentals: plan.length,
        totalsByCurrency: Object.fromEntries(
          Array.from(new Set(plan.map((item) => item.currency))).map((currency) => [
            currency,
            plan
              .filter((item) => item.currency === currency)
              .reduce((total, item) => total + item.amountMinor, BigInt(0))
              .toString(),
          ]),
        ),
        contracts: plan.map((item) => item.contractNumber),
      },
      null,
      2,
    ),
  );
  if (!apply || plan.length === 0) return;

  await prisma.$transaction(
    plan.map((item) =>
      prisma.rentalPayment.upsert({
        where: {
          companyId_rentalId_idempotencyKey: {
            companyId: item.companyId,
            rentalId: item.rentalId,
            idempotencyKey: item.idempotencyKey,
          },
        },
        create: {
          companyId: item.companyId,
          rentalId: item.rentalId,
          kind: 'RENT',
          status: 'CONFIRMED',
          amountMinor: item.amountMinor,
          currency: item.currency,
          method: 'OTHER',
          comment: 'Оплата подтверждена владельцем при полной сверке договоров аренды.',
          idempotencyKey: item.idempotencyKey,
          recordedByUserId: actor.id,
        },
        update: {},
      }),
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

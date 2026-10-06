import { prisma } from '../src/database/prisma/client';
import { buildHistoricalPaymentBackfillPlan } from '../src/modules/rentals/server/historical-payment-backfill';

function importedFrom(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>).importedFrom;
  return typeof value === 'string' ? value : null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const actor = await prisma.user.findFirstOrThrow({
    where: { role: 'SUPER_ADMIN', isActive: true },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });
  const rentals = await prisma.rental.findMany({
    where: { status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] } },
    select: {
      id: true,
      companyId: true,
      contractNumber: true,
      status: true,
      totalPriceMinor: true,
      snapshot: true,
      payments: {
        where: { kind: 'RENT', status: 'CONFIRMED' },
        select: { amountMinor: true },
      },
    },
    orderBy: { startsAt: 'asc' },
  });
  const plan = buildHistoricalPaymentBackfillPlan(
    rentals.map((rental) => ({
      ...rental,
      importedFrom: importedFrom(rental.snapshot),
      paidMinor: rental.payments.reduce((total, payment) => total + payment.amountMinor, BigInt(0)),
    })),
  );

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        actor: actor.email,
        rentals: plan.length,
        totalMinor: plan.reduce((total, item) => total + item.amountMinor, BigInt(0)).toString(),
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
          currency: 'RUB',
          method: 'OTHER',
          comment:
            'Историческая оплата подтверждена владельцем при сверке импортированных договоров.',
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

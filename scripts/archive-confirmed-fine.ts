import { prisma } from '../src/database/prisma/client';
import { reconcileFineDepositReservation } from '../src/modules/deposits/server/fine-reservation';
import { archiveConfirmedFine } from '../src/modules/fines/sync/archive-confirmed-fine';
import { parseArchiveConfirmedFineArgs } from './archive-confirmed-fine-input';

async function main() {
  const input = parseArchiveConfirmedFineArgs(process.argv.slice(2));
  const result = await archiveConfirmedFine(prisma, reconcileFineDepositReservation, {
    ...input,
    now: new Date(),
  });
  console.log(JSON.stringify(result));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Не удалось архивировать штраф.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import type { Prisma } from '@/database/generated/prisma';

/** Opens the database trigger guard only for the lifetime of the current transaction. */
export async function enableRentalLegalRevision(
  transaction: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<void> {
  await transaction.$queryRaw`SELECT set_config('pilot.rental_legal_revision', 'on', true)`;
}

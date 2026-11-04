import 'server-only';

import type { RentalAccess } from '@/modules/rentals/server/access';

import { getDepositWorkspace } from './queries';

export async function getUrgentDepositSidebarCount(access: RentalAccess | null) {
  if (!access) return 0;
  try {
    const workspace = await getDepositWorkspace(access);
    return workspace.summary.urgentCount;
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_DEPOSIT_LEDGER') return 0;
    throw error;
  }
}

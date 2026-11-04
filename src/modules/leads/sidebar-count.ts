import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { ClientAccess } from '@/modules/clients/access';

/** Number of leads that still require an operator action. */
export async function getOpenLeadSidebarCount(
  access: Pick<ClientAccess, 'scope' | 'companyIds'> | null,
): Promise<number> {
  if (!access) return 0;

  return prisma.lead.count({
    where: {
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
      status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
    },
  });
}

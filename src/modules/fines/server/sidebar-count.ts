import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { FineAccess } from '../types';

export async function getOpenFineSidebarCount(access: Pick<FineAccess, 'scope' | 'companyIds'> | null) {
  if (!access) return 0;
  return prisma.fine.count({
    where: {
      ...(access.scope === 'COMPANY' ? { companyId: { in: [...access.companyIds] } } : {}),
      status: { in: ['NEW', 'UNPAID', 'OVERDUE'] },
    },
  });
}

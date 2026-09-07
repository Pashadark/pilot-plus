import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { ClientAccess } from '@/modules/clients/access';
import { decryptField } from '@/services/security/field-encryption';

import type { LeadItem } from './types';

function encryptionKey() {
  const value = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!value) throw new Error('Ключ защиты клиентских данных не настроен.');
  return value;
}

export async function listLeads(access: ClientAccess): Promise<LeadItem[]> {
  const rows = await prisma.lead.findMany({
    where: access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } },
    select: {
      id: true,
      name: true,
      lastName: true,
      phoneEncrypted: true,
      source: true,
      commentEncrypted: true,
      status: true,
      nextContactAt: true,
      createdAt: true,
      company: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 300,
  });
  const key = encryptionKey();
  return rows.map((row) => ({
    id: row.id,
    companyName: row.company.name,
    name: row.name,
    lastName: row.lastName,
    phone: decryptField(row.phoneEncrypted, key),
    source: row.source,
    comment: row.commentEncrypted ? decryptField(row.commentEncrypted, key) : null,
    status: row.status,
    assignedToName: row.assignedTo?.name ?? null,
    nextContactAt: row.nextContactAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listLeadCompanies(access: ClientAccess) {
  return prisma.company.findMany({
    where: access.scope === 'SYSTEM' ? {} : { id: { in: [...access.companyIds] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { AdminCenterAccess } from '@/modules/admin/access';
import { getRecentAuditLog } from '@/modules/admin/audit';

import type { AdminCompanyProfile, AdminOverview } from './types';

function getCompanyProfilesWhere(access: AdminCenterAccess) {
  return access.scope === 'SYSTEM' ? { isDemo: true } : { id: { in: [...access.companyIds] } };
}

function toCompanyProfile(company: {
  id: string;
  name: string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  directorName: string | null;
  legalAddress: string | null;
  actualAddress: string | null;
  phone: string | null;
  email: string | null;
  isDemo: boolean;
  members: readonly {
    role: 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER' | 'VIEWER';
    user: { id: string; name: string; email: string; isActive: boolean };
  }[];
}): AdminCompanyProfile {
  return {
    id: company.id,
    name: company.name,
    inn: company.inn,
    kpp: company.kpp,
    ogrn: company.ogrn,
    directorName: company.directorName,
    legalAddress: company.legalAddress,
    actualAddress: company.actualAddress,
    phone: company.phone,
    email: company.email,
    isDemo: company.isDemo,
    team: company.members.map(({ role, user }) => ({ ...user, role })),
  };
}

function getCompanyProfiles(access: AdminCenterAccess) {
  return prisma.company.findMany({
    where: getCompanyProfilesWhere(access),
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      inn: true,
      kpp: true,
      ogrn: true,
      directorName: true,
      legalAddress: true,
      actualAddress: true,
      phone: true,
      email: true,
      isDemo: true,
      members: {
        orderBy: { user: { name: 'asc' } },
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true, isActive: true } },
        },
      },
    },
  });
}

export async function getAdminOverview(access: AdminCenterAccess): Promise<AdminOverview> {
  if (access.scope === 'SYSTEM') {
    const [companies, users, vehicles, devices, recentAudit, companyProfiles] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.vehicle.count(),
      prisma.device.count(),
      getRecentAuditLog(access),
      getCompanyProfiles(access),
    ]);

    return {
      scope: access.scope,
      companies,
      users,
      vehicles,
      devices,
      recentAudit,
      companyProfiles: companyProfiles.map(toCompanyProfile),
    };
  }

  const companyIds = [...access.companyIds];
  const [companies, memberships, vehicles, devices, recentAudit, companyProfiles] =
    await Promise.all([
      prisma.company.count({ where: { id: { in: companyIds } } }),
      prisma.companyMember.findMany({
        where: { companyId: { in: companyIds } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.vehicle.count({ where: { companyId: { in: companyIds } } }),
      prisma.device.count({ where: { companyId: { in: companyIds } } }),
      getRecentAuditLog(access),
      getCompanyProfiles(access),
    ]);

  return {
    scope: access.scope,
    companies,
    users: memberships.length,
    vehicles,
    devices,
    recentAudit,
    companyProfiles: companyProfiles.map(toCompanyProfile),
  };
}

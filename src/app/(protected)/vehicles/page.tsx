import { requireAdmin } from '@/modules/auth/dal';
import { prisma } from '@/database/prisma/client';
import { VehicleListPage } from '@/modules/vehicles/components/VehicleListPage';
import { getVehicleManagementAccess } from '@/modules/vehicles/manage/access';
import { listVehiclesForUser } from '@/modules/vehicles/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function VehiclesPage() {
  const user = await requireAdmin();
  const vehicles = await listVehiclesForUser(user.id);
  const access = await getVehicleManagementAccess();
  const manageableCompanies = access
    ? await prisma.company.findMany({
        where: access.scope === 'SYSTEM' ? {} : { id: { in: [...access.companyIds] } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : [];
  const memberships =
    access?.scope === 'COMPANY'
      ? await prisma.companyMember.findMany({
          where: { userId: access.user.id, companyId: { in: [...access.companyIds] } },
          select: { companyId: true, role: true },
        })
      : [];

  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Автомобили' }]}>
      <VehicleListPage
        vehicles={vehicles}
        manageableCompanies={manageableCompanies.map((company) => ({
          id: company.id,
          label: company.name,
          canArchive:
            access?.scope === 'SYSTEM' ||
            memberships.some(
              (membership) =>
                membership.companyId === company.id && membership.role === 'COMPANY_ADMIN',
            ),
        }))}
      />
    </AppShell>
  );
}

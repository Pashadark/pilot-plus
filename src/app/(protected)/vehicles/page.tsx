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
  const managementCompanyId =
    access?.scope === 'COMPANY'
      ? access.companyIds[0]
      : access?.scope === 'SYSTEM'
        ? (await prisma.company.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } }))
            ?.id
        : undefined;

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Автомобили' }]}>
      <VehicleListPage vehicles={vehicles} managementCompanyId={managementCompanyId} />
    </AppShell>
  );
}

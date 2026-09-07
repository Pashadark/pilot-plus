import { requireClientAccess } from '@/modules/clients/access';
import { LeadsPage } from '@/modules/leads/components/LeadsPage';
import { listLeadCompanies, listLeads } from '@/modules/leads/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default async function LeadsRoute() {
  const access = await requireClientAccess('MANAGE_CLIENTS');
  const [leads, companies] = await Promise.all([listLeads(access), listLeadCompanies(access)]);
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Заявки' }]}>
      <LeadsPage leads={leads} companies={companies} />
    </AppShell>
  );
}

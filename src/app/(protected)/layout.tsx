import { requireAdmin } from '@/modules/auth/dal';
import { getClientAccess } from '@/modules/clients/access';
import { getRentalAccessForUser } from '@/modules/rentals/server/access';
import { getCachedSystemHealthSummary } from '@/modules/system-health/get-system-health-summary';
import { AppShellUserProvider } from '@/shared/components/app-shell/AppShell';
import { ToastProvider } from '@/shared/providers/ToastProvider';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [systemHealthSummary, clientAccess, rentalAccess] = await Promise.all([
    getCachedSystemHealthSummary(),
    getClientAccess('VIEW_CLIENTS'),
    getRentalAccessForUser(user),
  ]);
  const shellUser = {
    ...user,
    capabilities: [clientAccess ? 'CLIENTS' : null, rentalAccess ? 'RENTALS' : null].filter(
      Boolean,
    ) as ('CLIENTS' | 'RENTALS')[],
  };
  return (
    <AppShellUserProvider user={shellUser} systemHealthSummary={systemHealthSummary}>
      <ToastProvider>{children}</ToastProvider>
    </AppShellUserProvider>
  );
}

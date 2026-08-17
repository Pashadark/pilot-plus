import { requireAdmin } from '@/modules/auth/dal';
import { getClientAccess } from '@/modules/clients/access';
import { getRentalAccessForUser } from '@/modules/rentals/server/access';
import { getFineAccessForUser } from '@/modules/fines/access';
import { getCachedSystemHealthSummary } from '@/modules/system-health/get-system-health-summary';
import { AppShellUserProvider } from '@/shared/components/app-shell/AppShell';
import { ToastProvider } from '@/shared/providers/ToastProvider';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [systemHealthSummary, clientAccess, rentalAccess, fineAccess] = await Promise.all([
    getCachedSystemHealthSummary(),
    getClientAccess('VIEW_CLIENTS'),
    getRentalAccessForUser(user),
    getFineAccessForUser(user),
  ]);
  const shellUser = {
    ...user,
    capabilities: [
      clientAccess ? 'CLIENTS' : null,
      rentalAccess ? 'RENTALS' : null,
      fineAccess ? 'FINES' : null,
    ].filter(Boolean) as ('CLIENTS' | 'RENTALS' | 'FINES')[],
  };
  return (
    <AppShellUserProvider user={shellUser} systemHealthSummary={systemHealthSummary}>
      <ToastProvider>{children}</ToastProvider>
    </AppShellUserProvider>
  );
}

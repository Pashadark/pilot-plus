import { requireAdmin } from '@/modules/auth/dal';
import { getCachedSystemHealthSummary } from '@/modules/system-health/get-system-health-summary';
import { AppShellUserProvider } from '@/shared/components/app-shell/AppShell';
import { ToastProvider } from '@/shared/providers/ToastProvider';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const systemHealthSummary = await getCachedSystemHealthSummary();
  return (
    <AppShellUserProvider user={user} systemHealthSummary={systemHealthSummary}>
      <ToastProvider>{children}</ToastProvider>
    </AppShellUserProvider>
  );
}

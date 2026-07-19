import { requireAdmin } from '@/modules/auth/dal';
import { AppShellUserProvider } from '@/shared/components/app-shell/AppShell';
import { ToastProvider } from '@/shared/providers/ToastProvider';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <AppShellUserProvider user={user}>
      <ToastProvider>{children}</ToastProvider>
    </AppShellUserProvider>
  );
}

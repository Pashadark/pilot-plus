import { requireAdmin } from '@/modules/auth/dal';
import { ToastProvider } from '@/shared/providers/ToastProvider';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <ToastProvider>{children}</ToastProvider>;
}

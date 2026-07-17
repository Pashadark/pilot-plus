import { requireAdmin } from '@/modules/auth/dal';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

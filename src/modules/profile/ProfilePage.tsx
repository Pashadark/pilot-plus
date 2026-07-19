import { redirect } from 'next/navigation';

import { getAuthenticatedSession } from '@/services/auth/session';
import { AppShell } from '@/shared/components/app-shell/AppShell';

import { ProfileForms } from './ProfileForms';

export async function ProfilePage() {
  const session = await getAuthenticatedSession();
  if (!session) redirect('/login');

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Профиль' }]}>
      <main className="grid min-w-0 gap-5 p-4 sm:p-6">
        <header>
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--color-primary)] uppercase">
            Учётная запись
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Профиль администратора
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)] sm:text-base">
            Управляйте личными данными и безопасностью учётной записи Pilot+.
          </p>
        </header>
        <ProfileForms user={session.user} />
      </main>
    </AppShell>
  );
}

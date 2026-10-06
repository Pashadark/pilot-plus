import { redirect } from 'next/navigation';

import { getAuthenticatedSession } from '@/services/auth/session';
import { AppShell } from '@/shared/components/app-shell/AppShell';

import { getProfileViewModel } from './get-profile-view-model';
import { ProfileWorkspace } from './ProfileWorkspace';
import { getAvitoProfileControl } from './avito-actions';

export async function ProfilePage() {
  const session = await getAuthenticatedSession();
  if (!session) redirect('/login');
  const profile = await getProfileViewModel(session);
  const avito = await getAvitoProfileControl();

  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Профиль' }]}>
      <section aria-labelledby="profile-page-title" className="grid min-w-0 gap-5 p-4 sm:p-6">
        <ProfileWorkspace profile={profile} avito={avito} />
      </section>
    </AppShell>
  );
}

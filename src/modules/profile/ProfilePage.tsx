import { redirect } from 'next/navigation';

import { getAuthenticatedSession } from '@/services/auth/session';
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { Avatar, Badge, Card, PageHeader } from '@/shared/ui';

import { ProfileForms } from './ProfileForms';

export async function ProfilePage() {
  const session = await getAuthenticatedSession();
  if (!session) redirect('/login');

  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Профиль' }]}>
      <section aria-labelledby="profile-page-title" className="grid min-w-0 gap-5 p-4 sm:p-6">
        <PageHeader
          eyebrow="Учётная запись"
          title="Профиль администратора"
          titleId="profile-page-title"
          description="Управляйте личными данными и безопасностью учётной записи Pilot+."
        />
        <Card className="flex min-w-0 items-center gap-4 p-4 sm:p-5">
          <Avatar name={session.user.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-bold text-[var(--color-text)]">{session.user.name}</p>
            <p className="truncate text-sm text-[var(--color-text-secondary)]">
              {session.user.email}
            </p>
            <Badge tone="primary" className="mt-2">
              Администратор
            </Badge>
          </div>
        </Card>
        <ProfileForms user={session.user} />
      </section>
    </AppShell>
  );
}

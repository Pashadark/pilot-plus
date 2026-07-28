import { EventTimelineSkeleton } from '@/modules/events/components/EventTimelineSkeleton';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default function EventsLoading() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'История событий' }]}>
      <EventTimelineSkeleton />
    </AppShell>
  );
}

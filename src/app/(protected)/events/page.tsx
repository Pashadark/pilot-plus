import { EventsPage } from '@/modules/events/components/EventsPage';
import { getEventTimeline, type TimelineFilters } from '@/modules/events/server/queries';
import { AppShell } from '@/shared/components/app-shell/AppShell';

const categoryValues = new Set([
  'MOVEMENT',
  'TRIP',
  'STOP',
  'ALERT',
  'FUEL',
  'MAINTENANCE',
  'WASH',
  'DEVICE',
  'FIRMWARE',
  'MANUAL',
]);
const severityValues = new Set(['INFO', 'WARNING', 'DANGER']);

function one(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}
function listed(value: string | undefined, allowed: Set<string>) {
  return value?.split(',').filter((item) => allowed.has(item));
}

function filtersFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): TimelineFilters {
  const read = one(searchParams.read);
  const limitValue = one(searchParams.limit);
  const limit = limitValue && /^\d+$/.test(limitValue) ? Number(limitValue) : 30;
  return {
    search: one(searchParams.search),
    vehicleId: one(searchParams.vehicle),
    categories: listed(one(searchParams.category), categoryValues) as TimelineFilters['categories'],
    severities: listed(one(searchParams.severity), severityValues) as TimelineFilters['severities'],
    read: read === 'read' || read === 'unread' ? read : 'all',
    from: one(searchParams.from),
    to: one(searchParams.to),
    before: one(searchParams.before),
    beforeKey: one(searchParams.beforeKey),
    limit: Math.min(50, Math.max(1, limit)),
  };
}

export default async function EventsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = filtersFromSearchParams(await searchParams);
  const timeline = await getEventTimeline(filters);
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'История событий' }]}>
      <EventsPage {...timeline} filters={filters} />
    </AppShell>
  );
}

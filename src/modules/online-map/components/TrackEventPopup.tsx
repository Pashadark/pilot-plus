import { Badge } from '@/shared/ui';

import type { VehicleTrackEventView } from '../track-types';

export function TrackEventPopup({ event, count }: { event: VehicleTrackEventView; count: number }) {
  return (
    <article aria-label={`Событие: ${event.title}`} className="min-w-56 space-y-2 p-1">
      <div className="flex items-center justify-between gap-3">
        <strong>{event.title}</strong>
        {count > 1 ? <Badge>{count} события</Badge> : null}
      </div>
      <p>
        {event.timestamp} · {event.speedKph} км/ч
      </p>
      <p>{event.address}</p>
      <p>{event.description}</p>
    </article>
  );
}

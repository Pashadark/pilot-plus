export interface LivePositionEvent {
  companyId: string;
  vehicleIds: string[];
  emittedAt: string;
}

export interface LivePositionPublisher {
  publish(channel: string, payload: string): Promise<unknown>;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/u;

export function livePositionChannel(companyId: string): string {
  if (!SAFE_ID.test(companyId)) throw new Error('INVALID_LIVE_POSITION_EVENT');
  return `pilot:map:${companyId}`;
}

export async function publishLivePositionEvent(
  event: LivePositionEvent,
  publisher: LivePositionPublisher,
): Promise<void> {
  const emittedAt = new Date(event.emittedAt);
  if (
    !SAFE_ID.test(event.companyId) ||
    event.vehicleIds.length === 0 ||
    event.vehicleIds.some((id) => !SAFE_ID.test(id)) ||
    Number.isNaN(emittedAt.getTime()) ||
    emittedAt.toISOString() !== event.emittedAt
  ) {
    throw new Error('INVALID_LIVE_POSITION_EVENT');
  }
  const payload: LivePositionEvent = {
    companyId: event.companyId,
    vehicleIds: [...new Set(event.vehicleIds)].sort(),
    emittedAt: event.emittedAt,
  };
  await publisher.publish(livePositionChannel(event.companyId), JSON.stringify(payload));
}

import 'server-only';
import { getEventTimeline } from '@/modules/events/server/queries';
import { buildEventNotifications } from '../domain/build-notifications';

export async function listNotificationsForCurrentUser() {
  return buildEventNotifications((await getEventTimeline({ read: 'all', limit: 20 })).events);
}

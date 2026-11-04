'use server';
import { getWorkdayEventsForCurrentUser } from './server/queries';
export async function loadWorkdayEvents(day: string) {
  return getWorkdayEventsForCurrentUser(day);
}

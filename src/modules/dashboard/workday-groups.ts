import type { DashboardWorkItemDto } from './overview-types';
const day = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function groupWorkdayItems(items: readonly DashboardWorkItemDto[], now: string) {
  const today = day.format(new Date(now));
  const tomorrow = day.format(new Date(new Date(now).getTime() + 86_400_000));
  const groups = {
    overdue: [] as DashboardWorkItemDto[],
    today: [] as DashboardWorkItemDto[],
    tomorrow: [] as DashboardWorkItemDto[],
    other: [] as DashboardWorkItemDto[],
    otherTotal: 0,
  };
  const sorted = [...items].sort(
    (a, b) =>
      Number(Boolean(a.unscheduled)) - Number(Boolean(b.unscheduled)) ||
      a.scheduledAt.localeCompare(b.scheduledAt) ||
      a.id.localeCompare(b.id),
  );
  for (const item of sorted) {
    const date = new Date(item.scheduledAt);
    const dateKey = Number.isNaN(date.getTime()) ? null : day.format(date);
    if (item.unscheduled) groups.other.push(item);
    else if (item.overdue) groups.overdue.push(item);
    else if (dateKey === today) groups.today.push(item);
    else if (dateKey === tomorrow) groups.tomorrow.push(item);
    else groups.other.push(item);
  }
  groups.otherTotal = groups.other.length;
  groups.other = groups.other.slice(0, 20);
  return groups;
}

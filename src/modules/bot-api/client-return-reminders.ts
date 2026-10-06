export function returnReminderStage(now: Date, endsAt: Date): '24h' | '3h' | '30m' | null {
  const remaining = endsAt.getTime() - now.getTime();
  if (remaining <= 0 || remaining > 24 * 60 * 60_000) return null;
  if (remaining <= 30 * 60_000) return '30m';
  if (remaining <= 3 * 60 * 60_000) return '3h';
  return '24h';
}

export function canViewMonitor(user: { role: string } | null) {
  return user?.role === 'SUPER_ADMIN';
}

export function resourceUsage(total: number, available: number) {
  if (
    !Number.isFinite(total) ||
    !Number.isFinite(available) ||
    total <= 0 ||
    available < 0 ||
    available > total
  )
    return null;
  return {
    total,
    available,
    used: total - available,
    percent: Math.round(((total - available) / total) * 100),
  };
}

export type MonitorState = 'healthy' | 'degraded' | 'unavailable' | 'unknown' | 'disabled';
export interface MonitorCard {
  key: string;
  label: string;
  status: MonitorState;
  message: string;
  checkedAt: string;
  metrics: { label: string; value: string; percent?: number }[];
}
export interface MonitorSnapshot {
  checkedAt: string;
  cards: MonitorCard[];
}

import { describe, expect, it } from 'vitest';
import { remoteMonitorCards } from './remote-monitor';

const now = Date.parse('2026-09-27T15:00:00Z');
const sample = {
  checkedAt: new Date(now).toISOString(),
  latencyMs: 120,
  diskTotal: 100,
  diskAvailable: 40,
  ramTotal: 100,
  ramAvailable: 70,
  cpu: 12,
  uptime: 90000,
  bot: 'healthy',
  redis: 'healthy',
};
describe('remote monitor', () => {
  it('shows real resources and process health', () => {
    const [host, bot] = remoteMonitorCards(sample, now);
    expect(host.status).toBe('healthy');
    expect(host.metrics.find((m) => m.label === 'Диск')?.percent).toBe(60);
    expect(bot.status).toBe('healthy');
  });
  it('never treats stale data as healthy', () => {
    expect(remoteMonitorCards(sample, now + 61000).every((c) => c.status === 'unknown')).toBe(true);
  });
  it('handles missing and malformed data', () => {
    for (const value of [null, {}, { ...sample, cpu: NaN }, { ...sample, diskAvailable: 101 }]) {
      expect(remoteMonitorCards(value, now).every((c) => c.status === 'unknown')).toBe(true);
    }
  });
  it('reports failure and resource pressure independently', () => {
    const [host, bot] = remoteMonitorCards({ ...sample, diskAvailable: 10, bot: 'unhealthy' }, now);
    expect(host.status).toBe('degraded');
    expect(bot.status).toBe('unavailable');
  });
});

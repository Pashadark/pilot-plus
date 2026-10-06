import { describe, expect, it } from 'vitest';

import type { TimewebMonitorSnapshot } from './timeweb-monitor';
import { timewebSnapshotToCard } from './timeweb-monitor-card';

const now = new Date('2026-10-07T10:00:00.000Z');
const snapshot: TimewebMonitorSnapshot = {
  checkedAt: '2026-10-07T09:30:00.000Z',
  balance: 2450.12,
  currency: 'RUB',
  hourlyCost: 14.5833,
  dailyCost: 349.9992,
  monthlyCost: 10_500,
  hoursLeft: 200,
  depletesAt: '2026-10-15T17:30:00.000Z',
  autopayEnabled: false,
  discountPercent: 5,
  discountEndsAt: '2026-12-31T21:00:00.000Z',
  alertActive: false,
  servers: [
    { name: 'Mysterious Lacerta', status: 'on' },
    { name: 'Database', status: 'off' },
  ],
};

describe('Timeweb monitor card', () => {
  it('shows fresh billing and server facts without raw provider data', () => {
    const card = timewebSnapshotToCard(snapshot, now);

    expect(card.status).toBe('healthy');
    expect(card.label).toBe('Timeweb Cloud');
    expect(card.metrics).toEqual(
      expect.arrayContaining([
        { label: 'Баланс', value: '2 450,12 ₽' },
        { label: 'Средств хватит', value: '8 дн. 8 ч.' },
        { label: 'Пополнить примерно до', value: '15.10.2026, 20:30' },
        { label: 'Расход в час', value: '14,58 ₽' },
        { label: 'Расход в сутки', value: '350 ₽' },
        { label: 'Расход в месяц', value: '10 500 ₽' },
        { label: 'Автоплатёж', value: 'Не подключён' },
        { label: 'Скидка', value: '5%' },
        { label: 'Серверы', value: '1 работает, 1 требует внимания' },
      ]),
    );
  });

  it('warns at seven days and marks stale data as unknown', () => {
    const pending = timewebSnapshotToCard({ ...snapshot, hoursLeft: 168 }, now);
    expect(pending.status).toBe('degraded');
    expect(pending.message).toContain('не поставлено в очередь');
    expect(
      timewebSnapshotToCard({ ...snapshot, hoursLeft: 168, alertActive: true }, now).message,
    ).toContain('поставлено в очередь');
    expect(timewebSnapshotToCard(snapshot, new Date('2026-10-07T12:00:01.000Z')).status).toBe(
      'unknown',
    );
  });

  it('returns an honest unknown card when no snapshot exists', () => {
    const card = timewebSnapshotToCard(null, now);
    expect(card.status).toBe('unknown');
    expect(card.metrics).toEqual([]);
    expect(card.message).toContain('ещё не получены');
  });
});

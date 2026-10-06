import { describe, expect, it } from 'vitest';

import {
  buildTimewebSnapshot,
  formatTimewebAlert,
  shouldEnqueueTimewebAlert,
} from './timeweb-monitor';

const checkedAt = new Date('2026-10-07T09:00:00.000Z');

function finances(hoursLeft: unknown = 200) {
  return {
    finances: {
      balance: 2450.125,
      total_balance: 2450.125,
      currency: 'RUB',
      hourly_cost: 14.5833,
      monthly_cost: 10_500,
      hours_left: hoursLeft,
      discount_percent: 5,
      discount_end_date_at: '2026-12-31T21:00:00Z',
      autopay_card_info: { last_four: '1234' },
      secret: 'must-not-leak',
    },
  };
}

const servers = {
  servers: [
    { id: 1, name: 'Mysterious Lacerta', status: 'on', cpu: 4, ram: 8192 },
    { id: 2, name: 'Database', status: 'off' },
  ],
};

describe('Timeweb monitor model', () => {
  it('normalizes finances and servers without retaining raw or secret fields', () => {
    const snapshot = buildTimewebSnapshot(finances(), servers, null, checkedAt);

    expect(snapshot).toMatchObject({
      checkedAt: checkedAt.toISOString(),
      balance: 2450.125,
      currency: 'RUB',
      hourlyCost: 14.5833,
      dailyCost: 349.9992,
      monthlyCost: 10_500,
      hoursLeft: 200,
      depletesAt: '2026-10-15T17:00:00.000Z',
      autopayEnabled: true,
      discountPercent: 5,
      alertActive: false,
      servers: [
        { name: 'Mysterious Lacerta', status: 'on' },
        { name: 'Database', status: 'off' },
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain('must-not-leak');
    expect(JSON.stringify(snapshot)).not.toContain('1234');
  });

  it('does not invent a depletion date when hours_left is invalid', () => {
    const snapshot = buildTimewebSnapshot(finances('unknown'), servers, null, checkedAt);

    expect(snapshot.hoursLeft).toBeNull();
    expect(snapshot.depletesAt).toBeNull();
  });

  it('crosses the warning threshold at 168 hours and not at 169', () => {
    const safe = buildTimewebSnapshot(finances(169), servers, null, checkedAt);
    const low = buildTimewebSnapshot(finances(168), servers, safe, checkedAt);

    expect(shouldEnqueueTimewebAlert(safe, safe)).toBe(false);
    expect(shouldEnqueueTimewebAlert(safe, low)).toBe(true);
  });

  it('does not repeat below threshold and resets after a refill', () => {
    const firstLow = buildTimewebSnapshot(finances(120), servers, null, checkedAt);
    firstLow.alertActive = true;
    const repeatedLow = buildTimewebSnapshot(finances(100), servers, firstLow, checkedAt);
    const refilled = buildTimewebSnapshot(finances(300), servers, firstLow, checkedAt);
    const lowAgain = buildTimewebSnapshot(finances(160), servers, refilled, checkedAt);

    expect(repeatedLow.alertActive).toBe(true);
    expect(shouldEnqueueTimewebAlert(firstLow, repeatedLow)).toBe(false);
    expect(refilled.alertActive).toBe(false);
    expect(shouldEnqueueTimewebAlert(refilled, lowAgain)).toBe(true);
  });

  it('formats a concise Russian group alert', () => {
    const snapshot = buildTimewebSnapshot(finances(167), servers, null, checkedAt);

    expect(formatTimewebAlert(snapshot)).toContain('Timeweb: заканчиваются средства');
    expect(formatTimewebAlert(snapshot)).toContain('Баланс: 2 450,13 ₽');
    expect(formatTimewebAlert(snapshot)).toContain('Осталось: 6 дн. 23 ч.');
    expect(formatTimewebAlert(snapshot)).toContain('Расход: 350 ₽ в сутки');
    expect(formatTimewebAlert(snapshot)).toContain('Пополнить примерно до: 14.10.2026, 11:00');
  });
});

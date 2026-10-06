import { describe, expect, it, vi } from 'vitest';

import { providerCooldownMs, runLiveWorker } from './live-worker';

describe('непрерывный worker GLONASSSoft', () => {
  it.each([
    ['RATE_LIMITED', 60_000],
    ['INVALID_REQUEST', 1_800_000],
    ['AUTH_REJECTED', 1_800_000],
    ['FORBIDDEN', 1_800_000],
    ['TIMEOUT', 30_000],
  ])('ставит защитную паузу после %s', (code, expected) => {
    expect(providerCooldownMs(Object.assign(new Error('safe'), { code }))).toBe(expected);
  });

  it('не перекрывает циклы и публикует только новые позиции', async () => {
    const abort = new AbortController();
    const order: string[] = [];
    const sync = vi.fn(async () => {
      order.push('sync:start');
      await Promise.resolve();
      order.push('sync:end');
      abort.abort();
      return { requested: 10, saved: 1, skipped: 0, changedVehicleIds: ['vehicle-1'] };
    });
    const publish = vi.fn(async () => order.push('publish'));
    const delay = vi.fn(async () => order.push('delay'));

    await runLiveWorker(
      { intervalMs: 2_000, signal: abort.signal },
      {
        listCompanies: vi.fn().mockResolvedValue([{ companyId: 'company-a' }]),
        sync,
        publish,
        delay,
        now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(500),
      },
    );

    expect(sync).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-a', vehicleIds: ['vehicle-1'] }),
    );
    expect(order).toEqual(['sync:start', 'sync:end', 'publish']);
    expect(delay).not.toHaveBeenCalled();
  });

  it('ждёт остаток двухсекундного такта и не публикует повторы', async () => {
    const abort = new AbortController();
    const delay = vi.fn(async (milliseconds: number) => {
      expect(milliseconds).toBe(1_500);
      abort.abort();
    });

    await runLiveWorker(
      { intervalMs: 2_000, signal: abort.signal },
      {
        listCompanies: vi.fn().mockResolvedValue([{ companyId: 'company-a' }]),
        sync: vi.fn().mockResolvedValue({
          requested: 10,
          saved: 0,
          skipped: 0,
          changedVehicleIds: [],
        }),
        publish: vi.fn(),
        delay,
        now: vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(500),
      },
    );
  });

  it('ошибка одной компании не мешает следующей', async () => {
    const abort = new AbortController();
    const sync = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('secret'), { code: 'TIMEOUT' }))
      .mockImplementationOnce(async () => {
        abort.abort();
        return { requested: 1, saved: 0, skipped: 0, changedVehicleIds: [] };
      });

    await runLiveWorker(
      { intervalMs: 2_000, signal: abort.signal },
      {
        listCompanies: vi
          .fn()
          .mockResolvedValue([{ companyId: 'company-a' }, { companyId: 'company-b' }]),
        sync,
        publish: vi.fn(),
        delay: vi.fn(),
        now: vi.fn().mockReturnValue(0),
        log: vi.fn(),
      },
    );

    expect(sync).toHaveBeenCalledTimes(2);
  });
});

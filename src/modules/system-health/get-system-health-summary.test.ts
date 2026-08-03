import { describe, expect, it, vi } from 'vitest';

import {
  createCachedSystemHealthSummary,
  summarizeSystemHealth,
} from './get-system-health-summary';
import type { ServiceHealth, SystemHealthSummary } from './types';

const checkedAt = '2026-07-20T12:00:00.000Z';

function service(
  key: ServiceHealth['key'],
  status: ServiceHealth['status'],
  nextCheckedAt = checkedAt,
): ServiceHealth {
  return {
    key,
    label: key,
    status,
    message: `raw error from ${key}.internal:5432`,
    latencyMs: 12,
    checkedAt: nextCheckedAt,
  };
}

describe('summarizeSystemHealth', () => {
  it('возвращает компактный безопасный DTO без массивов сервисов и деталей probes', () => {
    const summary = summarizeSystemHealth([
      service('api', 'healthy'),
      service('postgresql', 'healthy'),
      service('redis', 'unavailable', '2026-07-20T12:00:01.000Z'),
      service('mqtt', 'unconfigured'),
    ]);

    expect(summary).toEqual({
      state: 'degraded',
      count: 2,
      total: 4,
      checkedAt: '2026-07-20T12:00:01.000Z',
    });
    expect(Object.keys(summary).sort()).toEqual(['checkedAt', 'count', 'state', 'total'].sort());
    expect(JSON.stringify(summary)).not.toMatch(/service|error|internal|5432|host|port/i);
  });

  it('различает полностью здоровое и полностью недоступное состояние', () => {
    expect(
      summarizeSystemHealth([
        service('postgresql', 'healthy'),
        service('redis', 'healthy'),
        service('mqtt', 'healthy'),
      ]),
    ).toMatchObject({ state: 'healthy', count: 3 });
    expect(
      summarizeSystemHealth([
        service('postgresql', 'unavailable'),
        service('redis', 'unavailable'),
        service('mqtt', 'unconfigured'),
      ]),
    ).toMatchObject({ state: 'unavailable', count: 0 });
  });
});

describe('createCachedSystemHealthSummary', () => {
  it('изолирует Next cache за внедряемой обёрткой с коротким TTL', async () => {
    const check = vi
      .fn()
      .mockResolvedValue([
        service('postgresql', 'healthy'),
        service('redis', 'healthy'),
        service('mqtt', 'healthy'),
      ]);
    const cache = vi.fn((loader: () => Promise<SystemHealthSummary>) => loader);

    const getSummary = createCachedSystemHealthSummary(cache, check);
    await expect(getSummary()).resolves.toMatchObject({ state: 'healthy', count: 3 });

    expect(cache).toHaveBeenCalledWith(expect.any(Function), ['pilot-system-health-summary'], {
      revalidate: 30,
    });
    expect(check).toHaveBeenCalledOnce();
  });
});

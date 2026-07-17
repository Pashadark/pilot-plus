import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  record: null as null | {
    email: string;
    failedAttempts: number;
    lastFailedAt: Date | null;
    lockedUntil: Date | null;
  },
}));

const repository = vi.hoisted(() => ({
  findUnique: vi.fn(async () => state.record),
  upsert: vi.fn(async ({ create, update }: { create: typeof state.record; update: object }) => {
    state.record = state.record ? { ...state.record, ...update } : create;
    return state.record;
  }),
  deleteMany: vi.fn(async () => {
    state.record = null;
    return { count: 1 };
  }),
}));

vi.mock('@/database/prisma/client', () => ({
  prisma: {
    loginThrottle: repository,
    $transaction: vi.fn(async (callback: (tx: { loginThrottle: typeof repository }) => unknown) =>
      callback({ loginThrottle: repository }),
    ),
  },
}));

import { clearLoginFailures, isLoginLocked, recordLoginFailure } from './throttle';

describe('ограничение попыток входа', () => {
  beforeEach(() => {
    state.record = null;
    vi.clearAllMocks();
  });

  it('блокирует email на 15 минут после пятой ошибки', async () => {
    const now = new Date('2026-07-17T08:00:00.000Z');

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await recordLoginFailure('admin@example.com', new Date(now.getTime() + attempt * 1000));
      await expect(isLoginLocked('admin@example.com', now)).resolves.toBe(false);
    }

    const fifthFailure = new Date(now.getTime() + 5000);
    await recordLoginFailure('admin@example.com', fifthFailure);

    await expect(isLoginLocked('admin@example.com', fifthFailure)).resolves.toBe(true);
    expect(state.record?.lockedUntil).toEqual(new Date(fifthFailure.getTime() + 15 * 60 * 1000));
  });

  it('сбрасывает истёкшую серию и удаляет throttle после успеха', async () => {
    const oldFailure = new Date('2026-07-17T07:00:00.000Z');
    state.record = {
      email: 'admin@example.com',
      failedAttempts: 5,
      lastFailedAt: oldFailure,
      lockedUntil: new Date('2026-07-17T07:15:00.000Z'),
    };

    const now = new Date('2026-07-17T08:00:00.000Z');
    await expect(isLoginLocked('admin@example.com', now)).resolves.toBe(false);
    await recordLoginFailure('admin@example.com', now);
    expect(state.record?.failedAttempts).toBe(1);

    await clearLoginFailures('admin@example.com');
    expect(state.record).toBeNull();
  });
});

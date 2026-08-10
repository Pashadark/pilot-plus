import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UploadPermitDatabase } from './upload-resource-controls';

const now = new Date('2026-08-10T12:00:00.000Z');

function dependencies() {
  const permit = {
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: { reservedBytes: 0 } }),
    create: vi.fn().mockResolvedValue({
      id: 'permit-1',
      uploadId: '123e4567-e89b-42d3-a456-426614174000',
      leaseExpiresAt: new Date('2026-08-10T12:15:00.000Z'),
    }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const database = {
    clientUploadPermit: permit,
    $transaction: vi.fn(
      async (operation: (transaction: { clientUploadPermit: typeof permit }) => unknown) =>
        operation({ clientUploadPermit: permit }),
    ),
  };
  return { database: database as unknown as UploadPermitDatabase, permit };
}

describe('durable client upload resource controls', () => {
  beforeEach(() => vi.resetModules());

  it('создаёт PostgreSQL permit до буферизации и учитывает tenant private usage в quota', async () => {
    const { acquireClientUploadPermit } = await import('./upload-resource-controls');
    const { database, permit } = dependencies();

    await expect(
      acquireClientUploadPermit({
        database,
        now,
        uploadId: '123e4567-e89b-42d3-a456-426614174000',
        companyId: 'company-1',
        userId: 'user-1',
        kind: 'DOCUMENT',
        requestedBytes: 15,
        privateBytes: 70,
        limits: {
          windowMs: 60_000,
          userRate: 10,
          companyRate: 20,
          userConcurrent: 2,
          companyConcurrent: 5,
          companyQuotaBytes: 100,
          leaseMs: 15 * 60_000,
        },
      }),
    ).resolves.toMatchObject({ ok: true, permitId: 'permit-1' });

    expect(permit.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-1', status: { in: ['ACTIVE', 'RECONCILING'] } },
        _sum: { reservedBytes: true },
      }),
    );
    expect(permit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reservedBytes: 15 }) }),
    );
  });

  it.each([
    ['USER_RATE', { call: 0, value: 10 }],
    ['COMPANY_RATE', { call: 1, value: 20 }],
    ['USER_CONCURRENT', { call: 2, value: 2 }],
    ['COMPANY_CONCURRENT', { call: 3, value: 5 }],
  ] as const)('отклоняет %s durable limit с русским retry сообщением', async (reason, setup) => {
    const { acquireClientUploadPermit } = await import('./upload-resource-controls');
    const { database, permit } = dependencies();
    permit.count.mockImplementation(async () => {
      const call = permit.count.mock.calls.length - 1;
      return call === setup.call ? setup.value : 0;
    });

    const result = await acquireClientUploadPermit({
      database,
      now,
      uploadId: '123e4567-e89b-42d3-a456-426614174000',
      companyId: 'company-1',
      userId: 'user-1',
      kind: 'PHOTO',
      requestedBytes: 10,
      privateBytes: 0,
      limits: {
        windowMs: 60_000,
        userRate: 10,
        companyRate: 20,
        userConcurrent: 2,
        companyConcurrent: 5,
        companyQuotaBytes: 100,
        leaseMs: 15 * 60_000,
      },
    });

    expect(result).toMatchObject({ ok: false, reason });
    if (result.ok) throw new Error('Ожидался отказ durable limit.');
    expect(result.message).toMatch(/Повторите/u);
    expect(permit.create).not.toHaveBeenCalled();
  });

  it('отклоняет quota до чтения bytes и не создаёт permit', async () => {
    const { acquireClientUploadPermit } = await import('./upload-resource-controls');
    const { database, permit } = dependencies();
    permit.aggregate.mockResolvedValue({ _sum: { reservedBytes: 20 } });

    const result = await acquireClientUploadPermit({
      database,
      now,
      uploadId: '123e4567-e89b-42d3-a456-426614174000',
      companyId: 'company-1',
      userId: 'user-1',
      kind: 'DOCUMENT',
      requestedBytes: 15,
      privateBytes: 70,
      limits: {
        windowMs: 60_000,
        userRate: 10,
        companyRate: 20,
        userConcurrent: 2,
        companyConcurrent: 5,
        companyQuotaBytes: 100,
        leaseMs: 15 * 60_000,
      },
    });

    expect(result).toMatchObject({ ok: false, reason: 'COMPANY_QUOTA' });
    if (result.ok) throw new Error('Ожидался отказ tenant quota.');
    expect(result.message).toMatch(/хранилищ/u);
    expect(permit.create).not.toHaveBeenCalled();
  });

  it('renew/release используют tenant-scoped conditional updates и переживают другой process', async () => {
    const { renewClientUploadPermit, releaseClientUploadPermit } =
      await import('./upload-resource-controls');
    const { database, permit } = dependencies();

    await expect(
      renewClientUploadPermit(database, {
        uploadId: '123e4567-e89b-42d3-a456-426614174000',
        companyId: 'company-1',
        now,
        leaseMs: 60_000,
      }),
    ).resolves.toBe(true);
    await expect(
      releaseClientUploadPermit(database, {
        uploadId: '123e4567-e89b-42d3-a456-426614174000',
        companyId: 'company-1',
        now,
        status: 'COMPLETED',
      }),
    ).resolves.toBe(true);

    expect(permit.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
    expect(permit.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-1', status: 'ACTIVE' }),
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('повторяет Serializable transaction после конфликта параллельного process', async () => {
    const { acquireClientUploadPermit } = await import('./upload-resource-controls');
    const { database } = dependencies();
    vi.mocked(database.$transaction).mockRejectedValueOnce(
      Object.assign(new Error('serialization conflict'), { code: 'P2034' }),
    );

    await expect(
      acquireClientUploadPermit({
        database,
        now,
        uploadId: '123e4567-e89b-42d3-a456-426614174000',
        companyId: 'company-1',
        userId: 'user-1',
        kind: 'DOCUMENT',
        requestedBytes: 15,
        privateBytes: 0,
        limits: {
          windowMs: 60_000,
          userRate: 10,
          companyRate: 20,
          userConcurrent: 2,
          companyConcurrent: 5,
          companyQuotaBytes: 100,
          leaseMs: 15 * 60_000,
        },
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(database.$transaction).toHaveBeenCalledTimes(2);
  });
});

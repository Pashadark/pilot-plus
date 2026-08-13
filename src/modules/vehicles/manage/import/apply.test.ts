import { describe, expect, it, vi } from 'vitest';

import { applyFleetImport } from './apply';

const rows = [
  {
    rowNumber: 2,
    make: 'Kia',
    model: "Cee'd",
    registrationNumberNormalized: 'А429АУ97',
    vinNormalized: null,
    year: 2020,
  },
];

describe('fleet import apply', () => {
  it('is idempotent, archives only selected optional records, and writes sanitized audit in its transaction', async () => {
    const database = {
      vehicle: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'old',
              registrationNumberNormalized: 'М283АМ997',
              vinNormalized: null,
              make: 'Mercedes-Benz',
              modelName: 'E 220 d 4MATIC',
              manufacturedYear: 2019,
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'kia',
              registrationNumberNormalized: 'А429АУ97',
              vinNormalized: null,
              make: 'Kia',
              modelName: "Cee'd",
              manufacturedYear: 2020,
            },
            {
              id: 'old',
              registrationNumberNormalized: 'М283АМ997',
              vinNormalized: null,
              make: 'Mercedes-Benz',
              modelName: 'E 220 d 4MATIC',
              manufacturedYear: 2019,
            },
          ]),
        create: vi.fn().mockResolvedValue({ id: 'kia' }),
        update: vi.fn().mockResolvedValue({ id: 'kia' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit' }) },
    };
    const transaction = vi.fn(async (callback) => callback(database));

    const first = await applyFleetImport({
      transaction,
      companyId: 'company-1',
      actor: { id: 'user-1', email: 'admin@pilot.test' },
      rows,
      archiveIds: ['old'],
      allowArchive: true,
    });
    const second = await applyFleetImport({
      transaction,
      companyId: 'company-1',
      actor: { id: 'user-1', email: 'admin@pilot.test' },
      rows,
      archiveIds: [],
    });

    expect(first).toEqual({ ok: true, created: 1, updated: 0, unchanged: 0, archived: 1 });
    expect(second).toEqual({ ok: true, created: 0, updated: 0, unchanged: 1, archived: 0 });
    expect(database.vehicle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'old', companyId: 'company-1', archivedAt: null } }),
    );
    expect(JSON.stringify(database.auditLog.create.mock.calls)).not.toContain('А429');
    expect(JSON.stringify(database.auditLog.create.mock.calls)).not.toContain('VIN');
  });

  it('prechecks archive blockers before creating or updating anything', async () => {
    const database = {
      vehicle: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'old',
            registrationNumberNormalized: 'М283АМ997',
            vinNormalized: null,
            make: 'Mercedes-Benz',
            modelName: 'E 220 d 4MATIC',
            manufacturedYear: 2019,
          },
        ]),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      rental: { findFirst: vi.fn().mockResolvedValue({ id: 'active' }) },
      auditLog: { create: vi.fn() },
    };
    await expect(
      applyFleetImport({
        transaction: async (callback) => callback(database),
        companyId: 'company-1',
        actor: { id: 'user-1', email: 'admin@pilot.test' },
        rows,
        archiveIds: ['old'],
        allowArchive: true,
      }),
    ).rejects.toThrow('ACTIVE_RENTAL');
    expect(database.vehicle.create).not.toHaveBeenCalled();
    expect(database.vehicle.update).not.toHaveBeenCalled();
  });
});

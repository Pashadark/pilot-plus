import { describe, expect, it, vi } from 'vitest';

import { applyRealFleetPreview, createRealFleetPreview, RealFleetApplyError } from './actions';
import type { ExistingFleetRow, ProviderFleetRow } from './fleet-reconciliation';

const provider: ProviderFleetRow[] = [
  { externalId: 'polo-provider', name: 'Volkswagen Polo A156AX997' },
];

const existing: ExistingFleetRow[] = [
  {
    id: 'polo',
    plate: 'А156АХ997',
    make: 'Volkswagen',
    model: 'Polo',
    references: 1,
    isDemoImport: false,
  },
  {
    id: 'demo',
    plate: 'О001ОО77',
    make: 'Demo',
    model: 'Car',
    references: 0,
    isDemoImport: true,
  },
];

function database() {
  return {
    vehicle: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(async ({ data }: { data: { registrationNumberNormalized: string } }) => ({
        id: `created-${data.registrationNumberNormalized}`,
      })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    telematicsVehicleLink: { upsert: vi.fn().mockResolvedValue({ id: 'link' }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit' }) },
  };
}

describe('защищённое применение реального автопарка', () => {
  it('не раскрывает список машин в токене и проверяет срок, компанию и пользователя', async () => {
    const prepared = createRealFleetPreview({
      companyId: 'company-a',
      userId: 'admin-a',
      existing,
      provider,
      secret: 'preview-secret',
      now: 1_000,
    });
    expect(prepared.token).not.toContain('А156АХ997');

    const transaction = vi.fn();
    for (const input of [
      { companyId: 'company-b', userId: 'admin-a', now: 1_001 },
      { companyId: 'company-a', userId: 'admin-b', now: 1_001 },
      { companyId: 'company-a', userId: 'admin-a', now: 1_000 + 15 * 60 * 1_000 + 1 },
    ]) {
      await expect(
        applyRealFleetPreview({
          ...input,
          token: prepared.token,
          secret: 'preview-secret',
          transaction,
          loadExisting: vi.fn(),
        }),
      ).rejects.toBeInstanceOf(RealFleetApplyError);
    }
    expect(transaction).not.toHaveBeenCalled();
  });

  it('отвергает изменившуюся базу до любой записи', async () => {
    const prepared = createRealFleetPreview({
      companyId: 'company-a',
      userId: 'admin-a',
      existing,
      provider,
      secret: 'preview-secret',
      now: 1_000,
    });
    const db = database();

    await expect(
      applyRealFleetPreview({
        companyId: 'company-a',
        userId: 'admin-a',
        now: 1_001,
        token: prepared.token,
        secret: 'preview-secret',
        transaction: (callback) => callback(db),
        loadExisting: vi
          .fn()
          .mockResolvedValue([...existing, { ...existing[0]!, id: 'duplicate' }]),
      }),
    ).rejects.toMatchObject({ code: 'PREVIEW_CHANGED' });
    expect(db.vehicle.create).not.toHaveBeenCalled();
    expect(db.vehicle.deleteMany).not.toHaveBeenCalled();
  });

  it('применяет неизменный preview атомарно и пишет только обезличенный аудит', async () => {
    const prepared = createRealFleetPreview({
      companyId: 'company-a',
      userId: 'admin-a',
      existing,
      provider,
      secret: 'preview-secret',
      now: 1_000,
    });
    const db = database();
    const transaction = vi.fn((callback) => callback(db));

    await expect(
      applyRealFleetPreview({
        companyId: 'company-a',
        userId: 'admin-a',
        now: 1_001,
        token: prepared.token,
        secret: 'preview-secret',
        transaction,
        loadExisting: vi.fn().mockResolvedValue(existing),
      }),
    ).resolves.toMatchObject({ created: 9, deleted: 1, linked: 1 });

    expect(transaction).toHaveBeenCalledOnce();
    expect(db.vehicle.deleteMany).toHaveBeenCalledWith({
      where: { id: 'demo', companyId: 'company-a', isDemoImport: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-a',
        actorEmailSnapshot: 'redacted@audit.invalid',
        changes: expect.objectContaining({ created: 9, deleted: 1, linked: 1 }),
      }),
    });
  });
});

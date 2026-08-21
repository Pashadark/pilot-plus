import { describe, expect, it, vi } from 'vitest';

import { executeOperationWithEvidence } from './execute-with-evidence';

describe('executeOperationWithEvidence', () => {
  it('prepares, admits both files, then commits with server-derived COMPLETE evidence', async () => {
    const prepare = vi.fn().mockResolvedValue({ operationId: 'operation-1' });
    const admit = vi.fn().mockResolvedValue({ status: 'CLEAN' });
    const commit = vi.fn().mockResolvedValue({ operationId: 'operation-1', rentalId: 'rental-1' });

    await expect(
      executeOperationWithEvidence({
        command: {
          rentalId: 'rental-1',
          idempotencyKey: 'key-1',
          occurredAt: new Date('2026-08-21T10:00:00Z'),
          evidenceStatus: 'MISSING',
        },
        video: { name: 'car.mp4', bytes: new Uint8Array([1]) },
        dashboardPhoto: { name: 'dash.jpg', bytes: new Uint8Array([2]) },
        prepare,
        admit,
        commit,
      }),
    ).resolves.toEqual({ operationId: 'operation-1', rentalId: 'rental-1' });
    expect(prepare).toHaveBeenCalledOnce();
    expect(admit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ operationId: 'operation-1', kind: 'INSPECTION_VIDEO' }),
    );
    expect(admit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ operationId: 'operation-1', kind: 'DASHBOARD_PHOTO' }),
    );
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ evidenceStatus: 'COMPLETE' }));
  });

  it('commits a reasoned missing-evidence operation without creating an upload draft', async () => {
    const prepare = vi.fn();
    const admit = vi.fn();
    const commit = vi.fn().mockResolvedValue({ operationId: 'operation-2', rentalId: 'rental-1' });

    await executeOperationWithEvidence({
      command: {
        rentalId: 'rental-1',
        idempotencyKey: 'key-2',
        occurredAt: new Date('2026-08-21T10:00:00Z'),
        evidenceStatus: 'MISSING',
        evidenceMissingReason: 'Телефон разрядился',
      },
      prepare,
      admit,
      commit,
    });
    expect(prepare).not.toHaveBeenCalled();
    expect(admit).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ evidenceStatus: 'MISSING' }));
  });
});

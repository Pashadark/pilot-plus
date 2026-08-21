import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRentalAccess: vi.fn(),
  findFirst: vi.fn(),
  storageCreate: vi.fn(),
  openPrivate: vi.fn(),
  writeAuditLog: vi.fn(),
  transaction: vi.fn(),
  membership: vi.fn(),
}));

vi.mock('@/modules/rentals/server/access', () => ({ getRentalAccess: mocks.getRentalAccess }));
vi.mock('@/services/storage/local-private-storage', () => ({
  LocalPrivateStorage: { create: mocks.storageCreate },
}));
vi.mock('@/modules/admin/audit', () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock('@/database/prisma/client', () => ({
  prisma: { $transaction: mocks.transaction },
}));

import { GET } from './route';

process.env.PRIVATE_STORAGE_ROOT = 'C:\\pilot-private-test';

const target = {
  id: 'media-1',
  companyId: 'company-1',
  operationId: 'operation-1',
  kind: 'INSPECTION_VIDEO' as const,
  status: 'CLEAN' as const,
  originalName: 'Выдача.mp4',
  verifiedMime: 'video/mp4',
  storageKey: 'companies/company-1/rentals/rental-1/operations/operation-1/video.mp4',
  sha256: 'a'.repeat(64),
  operation: { rentalId: 'rental-1', status: 'COMMITTED' as const },
};
const context = {
  params: Promise.resolve({
    id: 'rental-1',
    operationId: 'operation-1',
    kind: 'INSPECTION_VIDEO',
  }),
};

describe('protected rental operation media route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRentalAccess.mockResolvedValue({
      user: { id: 'operator-1', email: 'operator@example.test' },
      scope: 'COMPANY',
      companyIds: ['company-1'],
    });
    mocks.findFirst.mockResolvedValue(target);
    mocks.membership.mockResolvedValue({ id: 'member-1' });
    mocks.transaction.mockImplementation(async (operation: (transaction: object) => unknown) =>
      operation({
        rentalOperationMedia: { findFirst: mocks.findFirst },
        companyMember: { findFirst: mocks.membership },
        user: { findFirst: vi.fn() },
        auditLog: { create: vi.fn() },
      }),
    );
    mocks.storageCreate.mockResolvedValue({ openPrivate: mocks.openPrivate });
    mocks.openPrivate.mockResolvedValue(Readable.from([Buffer.from('safe-video')]));
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  it('streams only the exact clean media from a committed operation', async () => {
    const response = await GET(
      new Request(
        'http://localhost/rentals/rental-1/operations/operation-1/media/INSPECTION_VIDEO',
      ),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain('inline');
    await expect(response.text()).resolves.toBe('safe-video');
    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
    expect(mocks.openPrivate).toHaveBeenCalledWith(target.storageKey);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'VIEW',
        entityType: 'RENTAL',
        entityId: 'rental-1',
        changes: { operationId: 'operation-1', mediaKind: 'INSPECTION_VIDEO' },
      }),
      expect.any(Object),
    );
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(target.storageKey);
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(target.originalName);
  });

  it('does not touch private storage after membership revocation', async () => {
    mocks.membership.mockResolvedValue(null);

    const response = await GET(
      new Request(
        'http://localhost/rentals/rental-1/operations/operation-1/media/INSPECTION_VIDEO',
      ),
      context,
    );

    expect(response.status).toBe(404);
    expect(mocks.openPrivate).not.toHaveBeenCalled();
  });

  it('rejects path-shaped identifiers and unknown media kinds before database or storage access', async () => {
    const response = await GET(new Request('http://localhost/invalid'), {
      params: Promise.resolve({ id: '../rental', operationId: 'operation/secret', kind: 'FILE' }),
    });

    expect(response.status).toBe(404);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.openPrivate).not.toHaveBeenCalled();
  });
});

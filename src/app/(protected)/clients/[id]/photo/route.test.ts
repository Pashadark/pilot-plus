import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getClientAccess: vi.fn(),
  getDownloadableClientPhoto: vi.fn(),
  storageCreate: vi.fn(),
  openPrivate: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock('@/modules/clients/access', () => ({ getClientAccess: mocks.getClientAccess }));
vi.mock('@/modules/client-documents/server/queries', () => ({
  getDownloadableClientPhoto: mocks.getDownloadableClientPhoto,
}));
vi.mock('@/services/storage/local-private-storage', () => ({
  LocalPrivateStorage: { create: mocks.storageCreate },
}));
vi.mock('@/database/prisma/client', () => ({
  prisma: { $transaction: mocks.transaction },
}));
vi.mock('@/modules/admin/audit', () => ({ writeAuditLog: mocks.writeAuditLog }));

import { GET } from './route';

process.env.PRIVATE_STORAGE_ROOT = 'C:\\pilot-private-test';

const access = {
  user: {
    id: 'viewer-1',
    email: 'viewer@example.test',
    name: 'Наблюдатель',
    role: 'MEMBER' as const,
    canAccessAdmin: false,
  },
  scope: 'COMPANY' as const,
  companyIds: ['company-1'],
  canManage: false,
};
const context = { params: Promise.resolve({ id: 'client-1' }) };
const currentRevision = 'm1abc';
const photoRequest = (revision = currentRevision) =>
  new Request(`http://localhost/photo?v=${revision}`);

describe('protected client photo route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientAccess.mockResolvedValue(access);
    mocks.getDownloadableClientPhoto.mockResolvedValue({
      companyId: 'company-1',
      clientId: 'client-1',
      storageKey: 'companies/company-1/clients/client-1/photos/clean.webp',
      revision: currentRevision,
    });
    mocks.storageCreate.mockResolvedValue({ openPrivate: mocks.openPrivate });
    mocks.openPrivate.mockResolvedValue(Readable.from([Buffer.from('safe-webp')]));
    mocks.transaction.mockImplementation(async (operation: (transaction: object) => unknown) =>
      operation({ client: { findFirst: vi.fn() }, auditLog: { create: vi.fn() } }),
    );
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  it('denies DRIVER before reading private metadata', async () => {
    mocks.getClientAccess.mockResolvedValue(null);

    const response = await GET(photoRequest(), context);

    expect(response.status).toBe(403);
    expect(mocks.getDownloadableClientPhoto).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', new Request('http://localhost/photo')],
    ['unsafe', new Request('http://localhost/photo?v=unsafe%2Fpath')],
  ])('rejects a %s revision before reading private metadata', async (_label, request) => {
    const response = await GET(request, context);

    expect(response.status).toBe(404);
    expect(mocks.getDownloadableClientPhoto).not.toHaveBeenCalled();
    expect(mocks.openPrivate).not.toHaveBeenCalled();
  });

  it('hides cross-tenant and missing photos behind the same 404', async () => {
    mocks.getDownloadableClientPhoto.mockResolvedValue(null);

    const response = await GET(photoRequest(), context);

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Фотография недоступна.');
    expect(mocks.openPrivate).not.toHaveBeenCalled();
  });

  it('streams a tenant photo without exposing its storage key', async () => {
    const response = await GET(photoRequest(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect([...response.headers.values()].join(' ')).not.toContain('companies/company-1');
    await expect(response.text()).resolves.toBe('safe-webp');
    expect(mocks.getDownloadableClientPhoto).toHaveBeenCalledWith(
      access,
      'client-1',
      currentRevision,
    );
    expect(mocks.getDownloadableClientPhoto).toHaveBeenCalledTimes(2);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'VIEW',
        entityType: 'CLIENT',
        entityId: 'client-1',
        changes: { revision: currentRevision },
      }),
      expect.any(Object),
    );
  });

  it('does not open storage for a stale but well-formed revision', async () => {
    mocks.getDownloadableClientPhoto.mockResolvedValue(null);

    const response = await GET(photoRequest('stale1'), context);

    expect(response.status).toBe(404);
    expect(mocks.getDownloadableClientPhoto).toHaveBeenCalledWith(access, 'client-1', 'stale1');
    expect(mocks.openPrivate).not.toHaveBeenCalled();
  });
});

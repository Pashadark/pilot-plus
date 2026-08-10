import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getClientAccess: vi.fn(),
  getDownloadableClientPhoto: vi.fn(),
  storageCreate: vi.fn(),
  openPrivate: vi.fn(),
}));

vi.mock('@/modules/clients/access', () => ({ getClientAccess: mocks.getClientAccess }));
vi.mock('@/modules/client-documents/server/queries', () => ({
  getDownloadableClientPhoto: mocks.getDownloadableClientPhoto,
}));
vi.mock('@/services/storage/local-private-storage', () => ({
  LocalPrivateStorage: { create: mocks.storageCreate },
}));

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

describe('protected client photo route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientAccess.mockResolvedValue(access);
    mocks.getDownloadableClientPhoto.mockResolvedValue({
      companyId: 'company-1',
      clientId: 'client-1',
      storageKey: 'companies/company-1/clients/client-1/photos/clean.webp',
    });
    mocks.storageCreate.mockResolvedValue({ openPrivate: mocks.openPrivate });
    mocks.openPrivate.mockResolvedValue(Readable.from([Buffer.from('safe-webp')]));
  });

  it('denies DRIVER before reading private metadata', async () => {
    mocks.getClientAccess.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/photo'), context);

    expect(response.status).toBe(403);
    expect(mocks.getDownloadableClientPhoto).not.toHaveBeenCalled();
  });

  it('hides cross-tenant and missing photos behind the same 404', async () => {
    mocks.getDownloadableClientPhoto.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/photo'), context);

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Фотография недоступна.');
    expect(mocks.openPrivate).not.toHaveBeenCalled();
  });

  it('streams a tenant photo without exposing its storage key', async () => {
    const response = await GET(new Request('http://localhost/photo'), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect([...response.headers.values()].join(' ')).not.toContain('companies/company-1');
    await expect(response.text()).resolves.toBe('safe-webp');
  });
});

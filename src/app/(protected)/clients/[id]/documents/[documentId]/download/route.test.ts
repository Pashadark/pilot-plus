import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getClientAccess: vi.fn(),
  getDownloadableClientDocument: vi.fn(),
  storageCreate: vi.fn(),
  openPrivate: vi.fn(),
  writeAuditLog: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/modules/clients/access', () => ({ getClientAccess: mocks.getClientAccess }));
vi.mock('@/modules/client-documents/server/queries', () => ({
  getDownloadableClientDocument: mocks.getDownloadableClientDocument,
}));
vi.mock('@/services/storage/local-private-storage', () => ({
  LocalPrivateStorage: { create: mocks.storageCreate },
}));
vi.mock('@/modules/admin/audit', () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock('@/database/prisma/client', () => ({ prisma: { $transaction: mocks.transaction } }));

import { GET } from './route';

process.env.PRIVATE_STORAGE_ROOT = 'C:\\pilot-private-test';

const viewerAccess = {
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
const downloadable = {
  documentId: 'document-1',
  companyId: 'company-1',
  version: 2,
  storageKey: 'companies/company-1/clients/client-1/documents/document-1/2',
  originalName: "договор O'Brien.pdf",
  verifiedMime: 'application/pdf',
  sha256: 'a'.repeat(64),
};
const context = {
  params: Promise.resolve({ id: 'client-1', documentId: 'document-1' }),
};

describe('protected client document download route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientAccess.mockResolvedValue(viewerAccess);
    mocks.getDownloadableClientDocument.mockResolvedValue(downloadable);
    mocks.storageCreate.mockResolvedValue({ openPrivate: mocks.openPrivate });
    mocks.openPrivate.mockResolvedValue(Readable.from([Buffer.from('%PDF-safe')]));
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (operation: (transaction: object) => unknown) =>
      operation({ auditLog: { create: vi.fn() }, clientDocument: { findFirst: vi.fn() } }),
    );
  });

  it('denies an unauthenticated or DRIVER request before querying a document', async () => {
    mocks.getClientAccess.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/download'), context);

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe('Доступ к документам клиентов запрещён.');
    expect(mocks.getDownloadableClientDocument).not.toHaveBeenCalled();
  });

  it('denies a cross-company document without exposing whether it exists', async () => {
    mocks.getDownloadableClientDocument.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/download'), context);

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Документ недоступен.');
    expect(mocks.openPrivate).not.toHaveBeenCalled();
  });

  it.each(['PENDING', 'BLOCKED'])('does not stream a %s document', async () => {
    mocks.getDownloadableClientDocument.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/download'), context);

    expect(response.status).toBe(404);
    expect(mocks.openPrivate).not.toHaveBeenCalled();
  });

  it('streams a CLEAN document with safe headers and atomic VIEW/DOWNLOAD audit', async () => {
    const response = await GET(new Request('http://localhost/download'), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''");
    expect(response.headers.get('content-disposition')).toContain('O%27Brien.pdf');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    await expect(response.text()).resolves.toBe('%PDF-safe');
    expect(mocks.getDownloadableClientDocument).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(2);
    expect(mocks.writeAuditLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: 'VIEW', entityType: 'CLIENT_DOCUMENT' }),
      expect.any(Object),
    );
    expect(mocks.writeAuditLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: 'DOWNLOAD',
        entityType: 'CLIENT_DOCUMENT',
        changes: { sha256: 'a'.repeat(64), version: 2 },
      }),
      expect.any(Object),
    );
    const audit = JSON.stringify(mocks.writeAuditLog.mock.calls);
    expect(audit).not.toContain('storageKey');
    expect(audit).not.toContain('договор.pdf');
    expect(audit).not.toContain('bytes');
  });

  it('returns a safe Russian error when private storage fails', async () => {
    mocks.openPrivate.mockRejectedValue(new Error('C:\\private\\secret.pdf'));

    const response = await GET(new Request('http://localhost/download'), context);

    expect(response.status).toBe(404);
    const message = await response.text();
    expect(message).toBe('Документ недоступен.');
    expect(message).not.toContain('private');
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});

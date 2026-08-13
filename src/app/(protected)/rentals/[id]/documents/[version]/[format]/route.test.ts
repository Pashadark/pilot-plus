import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRentalAccess: vi.fn(),
  findFirst: vi.fn(),
  storageCreate: vi.fn(),
  openPrivate: vi.fn(),
  writeAuditLog: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/modules/rentals/server/access', () => ({ getRentalAccess: mocks.getRentalAccess }));
vi.mock('@/services/storage/local-private-storage', () => ({
  LocalPrivateStorage: { create: mocks.storageCreate },
}));
vi.mock('@/modules/admin/audit', () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    rentalDocumentVersion: { findFirst: mocks.findFirst },
    $transaction: mocks.transaction,
  },
}));

import { GET } from './route';

process.env.PRIVATE_STORAGE_ROOT = 'C:\\pilot-private-test';

const access = {
  user: { id: 'operator-1', email: 'operator@example.test' },
  scope: 'COMPANY' as const,
  companyIds: ['company-1'],
};
const documentVersion = {
  id: 'rental-document-1',
  companyId: 'company-1',
  rentalId: 'rental-1',
  version: 2,
  format: 'PDF' as const,
  clientDocumentId: 'document-1',
  clientDocumentVersionId: 'document-version-1',
  clientDocument: { status: 'CLEAN', currentVersion: 1 },
  clientDocumentVersion: {
    version: 1,
    scanVerdict: 'CLEAN',
    storageKey: 'companies/company-1/clients/client-1/documents/document-1/1.pdf',
    originalName: "Договор № 1 O'Brien.pdf",
    verifiedMime: 'application/pdf',
    sha256: 'a'.repeat(64),
  },
};
const context = { params: Promise.resolve({ id: 'rental-1', version: '2', format: 'PDF' }) };

describe('protected rental contract download route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRentalAccess.mockResolvedValue(access);
    mocks.findFirst.mockResolvedValue(documentVersion);
    mocks.storageCreate.mockResolvedValue({ openPrivate: mocks.openPrivate });
    mocks.openPrivate.mockResolvedValue(Readable.from([Buffer.from('%PDF-safe')]));
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (operation: (transaction: object) => unknown) =>
      operation({
        rentalDocumentVersion: { findFirst: mocks.findFirst },
        companyMember: { findFirst: vi.fn().mockResolvedValue({ id: 'membership-1' }) },
        user: { findFirst: vi.fn() },
        auditLog: { create: vi.fn() },
      }),
    );
  });

  it('streams the exact ready PDF for a company administrator or dispatcher with a safe filename', async () => {
    const response = await GET(
      new Request('http://localhost/rentals/rental-1/documents/2/PDF'),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''");
    expect(response.headers.get('content-disposition')).toContain('O%27Brien.pdf');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    await expect(response.text()).resolves.toBe('%PDF-safe');
    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
    expect(mocks.openPrivate).toHaveBeenCalledWith(
      documentVersion.clientDocumentVersion.storageKey,
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DOWNLOAD',
        entityType: 'RENTAL',
        entityId: 'rental-1',
        changes: { version: 2, format: 'PDF', documentVersionId: 'document-version-1' },
      }),
      expect.any(Object),
    );
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain('storageKey');
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain("O'Brien");
  });

  it('uses the same not-found response for a foreign rental and a nonexistent version', async () => {
    mocks.findFirst.mockResolvedValue(null);
    const foreign = await GET(
      new Request('http://localhost/rentals/foreign/documents/2/PDF'),
      context,
    );
    const absent = await GET(new Request('http://localhost/rentals/rental-1/documents/99/PDF'), {
      params: Promise.resolve({ id: 'rental-1', version: '99', format: 'PDF' }),
    });

    expect(foreign.status).toBe(404);
    expect(absent.status).toBe(404);
    await expect(foreign.text()).resolves.toBe('Документ недоступен.');
    await expect(absent.text()).resolves.toBe('Документ недоступен.');
    expect(mocks.openPrivate).not.toHaveBeenCalled();
  });

  it('audits an explicit preview as VIEW while retaining the exact version identity', async () => {
    const response = await GET(
      new Request('http://localhost/rentals/rental-1/documents/2/PDF?preview=1'),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('inline');
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'VIEW',
        changes: expect.objectContaining({ version: 2, format: 'PDF' }),
      }),
      expect.any(Object),
    );
  });

  it('does not stream a superseded client-document version even when the rental row exists', async () => {
    mocks.findFirst.mockResolvedValue({
      ...documentVersion,
      clientDocument: { ...documentVersion.clientDocument, currentVersion: 2 },
    });

    const response = await GET(
      new Request('http://localhost/rentals/rental-1/documents/2/PDF'),
      context,
    );

    expect(response.status).toBe(404);
    expect(mocks.openPrivate).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it('does not touch private storage when transaction-scoped membership was revoked', async () => {
    mocks.transaction.mockImplementationOnce(
      async (operation: (transaction: object) => Promise<unknown>) =>
        operation({
          rentalDocumentVersion: { findFirst: mocks.findFirst },
          companyMember: { findFirst: vi.fn().mockResolvedValue(null) },
          user: { findFirst: vi.fn() },
          auditLog: { create: vi.fn() },
        }),
    );

    const response = await GET(
      new Request('http://localhost/rentals/rental-1/documents/2/PDF'),
      context,
    );

    expect(response.status).toBe(404);
    expect(mocks.openPrivate).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it('rejects a driver before querying metadata and rejects path-shaped version or format', async () => {
    mocks.getRentalAccess.mockResolvedValue(null);
    const driver = await GET(
      new Request('http://localhost/rentals/rental-1/documents/2/PDF'),
      context,
    );
    expect(driver.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();

    mocks.getRentalAccess.mockResolvedValue(access);
    const invalid = await GET(new Request('http://localhost/rentals/rental-1/documents/x/PDF'), {
      params: Promise.resolve({ id: '../rental', version: '2/../../secret', format: 'exe' }),
    });
    expect(invalid.status).toBe(404);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.openPrivate).not.toHaveBeenCalled();
  });
});

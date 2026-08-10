import { describe, expect, it } from 'vitest';

import type { ClientAccess } from '@/modules/clients/access';

import { createClientDocumentQueries, getDownloadableClientPhoto } from './queries';

const viewerAccess: ClientAccess = {
  user: {
    id: 'viewer-1',
    email: 'viewer@example.test',
    name: 'Наблюдатель',
    role: 'MEMBER',
    canAccessAdmin: false,
  },
  scope: 'COMPANY',
  companyIds: ['company-1'],
  canManage: false,
};

const cleanDocument = {
  id: 'document-1',
  companyId: 'company-1',
  clientId: 'client-1',
  category: 'PASSPORT' as const,
  title: 'Паспорт',
  status: 'CLEAN' as const,
  currentVersion: 2,
  createdAt: new Date('2026-08-10T10:00:00.000Z'),
  updatedAt: new Date('2026-08-10T11:00:00.000Z'),
  versions: [
    {
      version: 2,
      storageKey: 'companies/company-1/clients/client-1/documents/document-1/2',
      originalName: 'passport.jpg',
      verifiedMime: 'image/jpeg',
      bytes: 6,
      sha256: 'a'.repeat(64),
      scanVerdict: 'CLEAN',
    },
  ],
};

function repositoryReturning(result: unknown) {
  const calls: unknown[] = [];
  const versionCalls: unknown[] = [];
  return {
    calls,
    versionCalls,
    repository: {
      async findMany(args: unknown) {
        calls.push(args);
        return result ? [result] : [];
      },
      async findFirst(args: unknown) {
        calls.push(args);
        return result;
      },
      async findVersionFirst(args: unknown) {
        versionCalls.push(args);
        const document = result as typeof cleanDocument | null;
        if (!document) return null;
        const where = (args as { where?: { version?: number; scanVerdict?: string } }).where;
        return (
          document.versions.find(
            (version) =>
              version.version === where?.version &&
              (where.scanVerdict === undefined || version.scanVerdict === where.scanVerdict),
          ) ?? null
        );
      },
    },
  };
}

describe('tenant-scoped client document queries', () => {
  it('lists only documents from permitted companies without exposing private storage metadata', async () => {
    const fake = repositoryReturning(cleanDocument);
    const queries = createClientDocumentQueries(fake.repository);

    const result = await queries.getClientDocuments(viewerAccess, 'client-1');

    expect(fake.calls[0]).toMatchObject({
      where: {
        clientId: 'client-1',
        companyId: { in: ['company-1'] },
        archivedAt: null,
        status: { not: 'ARCHIVED' },
      },
    });
    expect(result[0]).toMatchObject({
      id: 'document-1',
      title: 'Паспорт',
      status: 'CLEAN',
      currentVersion: 2,
      originalName: 'passport.jpg',
      bytes: 6,
    });
    expect(result[0]).not.toHaveProperty('storageKey');
    expect(result[0]).not.toHaveProperty('sha256');
    expect(fake.calls[0]).not.toHaveProperty('select.versions');
    expect(fake.versionCalls[0]).toMatchObject({
      where: { documentId: 'document-1', version: 2 },
    });
  });

  it('selects a CLEAN current version through client, company and document guards', async () => {
    const fake = repositoryReturning(cleanDocument);
    const queries = createClientDocumentQueries(fake.repository);

    await expect(
      queries.getDownloadableClientDocument(viewerAccess, 'client-1', 'document-1'),
    ).resolves.toEqual({
      documentId: 'document-1',
      companyId: 'company-1',
      version: 2,
      storageKey: 'companies/company-1/clients/client-1/documents/document-1/2',
      originalName: 'passport.jpg',
      verifiedMime: 'image/jpeg',
      sha256: 'a'.repeat(64),
    });
    expect(fake.calls[0]).toMatchObject({
      where: {
        id: 'document-1',
        clientId: 'client-1',
        companyId: { in: ['company-1'] },
        status: 'CLEAN',
        archivedAt: null,
      },
    });
    expect(fake.versionCalls[0]).toMatchObject({
      where: { documentId: 'document-1', version: 2, scanVerdict: 'CLEAN' },
    });
  });

  it('keeps the previous CLEAN current version downloadable while a replacement is scanning', async () => {
    const replacing = {
      ...cleanDocument,
      currentVersion: 1,
      versions: [
        {
          ...cleanDocument.versions[0],
          version: 2,
          storageKey: 'companies/company-1/clients/client-1/documents/document-1/2',
          scanVerdict: null,
        },
        {
          ...cleanDocument.versions[0],
          version: 1,
          storageKey: 'companies/company-1/clients/client-1/documents/document-1/1',
        },
      ],
    };
    const fake = repositoryReturning(replacing);
    const queries = createClientDocumentQueries(fake.repository);

    await expect(
      queries.getDownloadableClientDocument(viewerAccess, 'client-1', 'document-1', 1),
    ).resolves.toMatchObject({
      version: 1,
      storageKey: 'companies/company-1/clients/client-1/documents/document-1/1',
    });
    expect(fake.calls[0]).toMatchObject({ where: { currentVersion: 1 } });
  });

  it('rejects a stale preview revision after a replacement becomes current', async () => {
    const fake = repositoryReturning(cleanDocument);
    const queries = createClientDocumentQueries(fake.repository);

    await expect(
      queries.getDownloadableClientDocument(viewerAccess, 'client-1', 'document-1', 1),
    ).resolves.toBeNull();
    expect(fake.calls[0]).toMatchObject({ where: { currentVersion: 1 } });
  });

  it.each(['PENDING', 'BLOCKED'] as const)('denies a %s document download', async (status) => {
    const fake = repositoryReturning({ ...cleanDocument, status });
    const queries = createClientDocumentQueries(fake.repository);

    await expect(
      queries.getDownloadableClientDocument(viewerAccess, 'client-1', 'document-1'),
    ).resolves.toBeNull();
  });

  it('denies download when the current version itself has no CLEAN scan verdict', async () => {
    const fake = repositoryReturning({
      ...cleanDocument,
      versions: [{ ...cleanDocument.versions[0], scanVerdict: 'ERROR' }],
    });
    const queries = createClientDocumentQueries(fake.repository);

    await expect(
      queries.getDownloadableClientDocument(viewerAccess, 'client-1', 'document-1'),
    ).resolves.toBeNull();
  });

  it('returns null for a cross-company document', async () => {
    const fake = repositoryReturning(null);
    const queries = createClientDocumentQueries(fake.repository);

    await expect(
      queries.getDownloadableClientDocument(viewerAccess, 'foreign-client', 'foreign-document'),
    ).resolves.toBeNull();
  });
});

describe('revisioned client photo query', () => {
  const updatedAt = new Date('2026-08-10T11:00:00.000Z');
  const revision = updatedAt.getTime().toString(36);

  function photoDatabase() {
    const calls: unknown[] = [];
    return {
      calls,
      database: {
        client: {
          async findFirst(args: unknown) {
            calls.push(args);
            return {
              id: 'client-1',
              companyId: 'company-1',
              photoPath: 'companies/company-1/clients/client-1/photos/clean.webp',
              updatedAt,
            };
          },
        },
      },
    };
  }

  it('returns the private photo only for its current opaque revision', async () => {
    const fake = photoDatabase();

    await expect(
      getDownloadableClientPhoto(viewerAccess, 'client-1', revision, fake.database),
    ).resolves.toEqual({
      companyId: 'company-1',
      clientId: 'client-1',
      storageKey: 'companies/company-1/clients/client-1/photos/clean.webp',
      revision,
    });
    expect(fake.calls[0]).toMatchObject({
      where: { id: 'client-1', companyId: { in: ['company-1'] }, archivedAt: null },
    });
  });

  it('rejects a stale photo revision after a committed replacement', async () => {
    const fake = photoDatabase();

    await expect(
      getDownloadableClientPhoto(viewerAccess, 'client-1', 'stale', fake.database),
    ).resolves.toBeNull();
  });
});

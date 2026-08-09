import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import type {
  ClientDocumentListItem,
  DownloadableClientDocument,
} from '@/modules/client-documents/types';
import type { ClientAccess } from '@/modules/clients/access';

type ClientDocumentRepository = {
  findMany(args: unknown): Promise<unknown[]>;
  findFirst(args: unknown): Promise<unknown | null>;
};

type RawVersion = {
  version: number;
  storageKey: string;
  originalName: string;
  verifiedMime: string;
  bytes: number;
  sha256: string;
};

type RawDocument = {
  id: string;
  companyId: string;
  clientId: string;
  category: ClientDocumentListItem['category'];
  title: string;
  status: ClientDocumentListItem['status'];
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
  versions: RawVersion[];
};

const versionSelect = {
  version: true,
  storageKey: true,
  originalName: true,
  verifiedMime: true,
  bytes: true,
  sha256: true,
} satisfies Prisma.ClientDocumentVersionSelect;

function tenantCompanyWhere(access: ClientAccess) {
  return access.scope === 'SYSTEM' ? undefined : { in: [...access.companyIds] };
}

function currentVersion(document: RawDocument): RawVersion | null {
  return document.versions.find((version) => version.version === document.currentVersion) ?? null;
}

export function createClientDocumentQueries(repository: ClientDocumentRepository) {
  return {
    async getClientDocuments(
      access: ClientAccess,
      clientId: string,
    ): Promise<ClientDocumentListItem[]> {
      const documents = (await repository.findMany({
        where: {
          clientId,
          ...(tenantCompanyWhere(access) ? { companyId: tenantCompanyWhere(access) } : {}),
          client: { archivedAt: null },
          archivedAt: null,
          status: { not: 'ARCHIVED' },
        },
        select: {
          id: true,
          companyId: true,
          clientId: true,
          category: true,
          title: true,
          status: true,
          currentVersion: true,
          createdAt: true,
          updatedAt: true,
          versions: {
            orderBy: { version: 'desc' },
            select: versionSelect,
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      })) as RawDocument[];

      return documents.map((document) => {
        const version = currentVersion(document);
        return {
          id: document.id,
          category: document.category,
          title: document.title,
          status: document.status,
          currentVersion: document.currentVersion,
          originalName: version?.originalName ?? null,
          verifiedMime: version?.verifiedMime ?? null,
          bytes: version?.bytes ?? null,
          createdAt: document.createdAt.toISOString(),
          updatedAt: document.updatedAt.toISOString(),
        };
      });
    },

    async getDownloadableClientDocument(
      access: ClientAccess,
      clientId: string,
      documentId: string,
    ): Promise<DownloadableClientDocument | null> {
      const document = (await repository.findFirst({
        where: {
          id: documentId,
          clientId,
          ...(tenantCompanyWhere(access) ? { companyId: tenantCompanyWhere(access) } : {}),
          client: { archivedAt: null },
          status: 'CLEAN',
          archivedAt: null,
        },
        select: {
          id: true,
          companyId: true,
          clientId: true,
          category: true,
          title: true,
          status: true,
          currentVersion: true,
          createdAt: true,
          updatedAt: true,
          versions: {
            orderBy: { version: 'desc' },
            select: versionSelect,
          },
        },
      })) as RawDocument | null;

      if (!document || document.status !== 'CLEAN') return null;
      const version = currentVersion(document);
      if (!version) return null;

      return {
        documentId: document.id,
        companyId: document.companyId,
        version: version.version,
        storageKey: version.storageKey,
        originalName: version.originalName,
        verifiedMime: version.verifiedMime,
        sha256: version.sha256,
      };
    },
  };
}

type DocumentDatabase = Pick<Prisma.TransactionClient, 'clientDocument'>;

function queriesFor(database: DocumentDatabase) {
  return createClientDocumentQueries({
    findMany: (args) => database.clientDocument.findMany(args as Prisma.ClientDocumentFindManyArgs),
    findFirst: (args) =>
      database.clientDocument.findFirst(args as Prisma.ClientDocumentFindFirstArgs),
  });
}

export async function getClientDocuments(
  access: ClientAccess,
  clientId: string,
  database: DocumentDatabase = prisma,
) {
  return queriesFor(database).getClientDocuments(access, clientId);
}

export async function getDownloadableClientDocument(
  access: ClientAccess,
  clientId: string,
  documentId: string,
  database: DocumentDatabase = prisma,
) {
  return queriesFor(database).getDownloadableClientDocument(access, clientId, documentId);
}

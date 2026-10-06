import { Readable } from 'node:stream';

import type { Prisma, RentalDocumentFormat } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { writeAuditLog } from '@/modules/admin/audit';
import { getRentalAccess, type RentalAccess } from '@/modules/rentals/server/access';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

type DownloadContext = { params: Promise<{ id: string; version: string; format: string }> };
type DocumentDatabase = Pick<Prisma.TransactionClient, 'rentalDocumentVersion'>;
type DownloadTarget = { rentalId: string; version: number; format: RentalDocumentFormat };

const safeId = /^[A-Za-z0-9_-]{1,128}$/u;
const validVersion = /^[1-9]\d{0,8}$/u;
const validFormats = new Set<RentalDocumentFormat>(['DOCX', 'PDF']);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unavailable() {
  return new Response('Документ недоступен.', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

function encodedFilename(value: string) {
  const safe = value
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .replace(/[\\/]/gu, '-')
    .slice(0, 180)
    .toWellFormed();
  return encodeURIComponent(safe || 'rental-document').replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function parseTarget(params: {
  id: string;
  version: string;
  format: string;
}): DownloadTarget | null {
  if (
    !safeId.test(params.id) ||
    !validVersion.test(params.version) ||
    !validFormats.has(params.format as RentalDocumentFormat)
  ) {
    return null;
  }
  return {
    rentalId: params.id,
    version: Number(params.version),
    format: params.format as RentalDocumentFormat,
  };
}

async function findReadyDocument(
  database: DocumentDatabase,
  access: RentalAccess,
  target: DownloadTarget,
) {
  const record = await database.rentalDocumentVersion.findFirst({
    where: {
      rentalId: target.rentalId,
      version: target.version,
      format: target.format,
      companyId: access.scope === 'SYSTEM' ? undefined : { in: [...access.companyIds] },
      clientDocument: { is: { status: 'CLEAN' } },
      clientDocumentVersion: { is: { scanVerdict: 'CLEAN' } },
    },
    select: {
      companyId: true,
      rentalId: true,
      version: true,
      format: true,
      clientDocumentId: true,
      clientDocumentVersionId: true,
      clientDocument: { select: { status: true, currentVersion: true } },
      clientDocumentVersion: {
        select: {
          version: true,
          scanVerdict: true,
          storageKey: true,
          originalName: true,
          verifiedMime: true,
          sha256: true,
        },
      },
    },
  });
  if (!record || record.clientDocument.currentVersion !== record.clientDocumentVersion.version)
    return null;
  return record;
}

async function reauthorize(
  transaction: Prisma.TransactionClient,
  access: RentalAccess,
  companyId: string,
) {
  if (access.scope === 'SYSTEM') {
    return Boolean(
      await transaction.user.findFirst({
        where: { id: access.user.id, role: 'SUPER_ADMIN', isActive: true },
        select: { id: true },
      }),
    );
  }
  return Boolean(
    await transaction.companyMember.findFirst({
      where: { companyId, userId: access.user.id, role: { in: ['COMPANY_ADMIN', 'DISPATCHER'] } },
      select: { id: true },
    }),
  );
}

export async function GET(request: Request, context: DownloadContext) {
  const access = await getRentalAccess();
  if (!access) {
    return new Response('Доступ к документам договоров запрещён.', {
      status: 403,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const target = parseTarget(await context.params);
  if (!target) return unavailable();
  const preview = new URL(request.url).searchParams.get('preview') === '1';
  const initial = await prisma.$transaction(async (transaction) => {
    const candidate = await findReadyDocument(transaction, access, target);
    if (!candidate || !(await reauthorize(transaction, access, candidate.companyId))) return null;
    return candidate;
  });
  if (!initial) return unavailable();

  let stream: Readable;
  try {
    const storage = await LocalPrivateStorage.create(privateStorageRoot());
    stream = await storage.openPrivate(initial.clientDocumentVersion.storageKey);
  } catch {
    return unavailable();
  }

  try {
    const authorized = await prisma.$transaction(async (transaction) => {
      if (!(await reauthorize(transaction, access, initial.companyId))) return null;
      const current = await findReadyDocument(transaction, access, target);
      if (
        !current ||
        current.companyId !== initial.companyId ||
        current.clientDocumentVersionId !== initial.clientDocumentVersionId ||
        current.clientDocumentVersion.storageKey !== initial.clientDocumentVersion.storageKey ||
        current.clientDocumentVersion.sha256 !== initial.clientDocumentVersion.sha256
      ) {
        return null;
      }
      await writeAuditLog(
        {
          actor: { id: access.user.id, email: access.user.email },
          companyId: current.companyId,
          action: preview ? 'VIEW' : 'DOWNLOAD',
          entityType: 'RENTAL',
          entityId: current.rentalId,
          entityLabel: 'Документ договора аренды',
          changes: {
            version: current.version,
            format: current.format,
            documentVersionId: current.clientDocumentVersionId,
          },
        },
        transaction,
      );
      return current;
    });
    if (!authorized) {
      stream.destroy();
      return unavailable();
    }
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename*=UTF-8''${encodedFilename(authorized.clientDocumentVersion.originalName)}`,
        'Content-Type': authorized.clientDocumentVersion.verifiedMime,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    stream.destroy();
    return unavailable();
  }
}

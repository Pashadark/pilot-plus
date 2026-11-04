import { Readable } from 'node:stream';

import type { Prisma, RentalOperationMediaKind } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { writeAuditLog } from '@/modules/admin/audit';
import { getRentalAccess, type RentalAccess } from '@/modules/rentals/server/access';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

type MediaContext = {
  params: Promise<{ id: string; operationId: string; kind: string }>;
};
type MediaTarget = {
  rentalId: string;
  operationId: string;
  kind: RentalOperationMediaKind;
};

const safeId = /^[A-Za-z0-9_-]{1,128}$/u;
const mediaKinds = new Set<RentalOperationMediaKind>([
  'INSPECTION_VIDEO',
  'DASHBOARD_PHOTO',
  'BODY_PHOTO_FRONT',
  'BODY_PHOTO_REAR',
  'BODY_PHOTO_LEFT',
  'BODY_PHOTO_RIGHT',
]);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unavailable() {
  return new Response('Материал фиксации недоступен.', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

function parseTarget(params: {
  id: string;
  operationId: string;
  kind: string;
}): MediaTarget | null {
  if (
    !safeId.test(params.id) ||
    !safeId.test(params.operationId) ||
    !mediaKinds.has(params.kind as RentalOperationMediaKind)
  ) {
    return null;
  }
  return {
    rentalId: params.id,
    operationId: params.operationId,
    kind: params.kind as RentalOperationMediaKind,
  };
}

async function findReadyMedia(
  transaction: Prisma.TransactionClient,
  access: RentalAccess,
  target: MediaTarget,
) {
  return transaction.rentalOperationMedia.findFirst({
    where: {
      operationId: target.operationId,
      kind: target.kind,
      status: 'CLEAN',
      companyId: access.scope === 'SYSTEM' ? undefined : { in: [...access.companyIds] },
      operation: { is: { rentalId: target.rentalId, status: 'COMMITTED' } },
    },
    select: {
      id: true,
      companyId: true,
      operationId: true,
      kind: true,
      status: true,
      originalName: true,
      verifiedMime: true,
      storageKey: true,
      sha256: true,
      previewStorageKey: true,
      previewMime: true,
      previewSha256: true,
      operation: { select: { rentalId: true, status: true } },
    },
  });
}

function selectedAsset(media: {
  storageKey: string;
  verifiedMime: string | null;
  sha256: string | null;
  previewStorageKey: string | null;
  previewMime: string | null;
  previewSha256: string | null;
}) {
  if (
    media.previewStorageKey &&
    media.previewMime === 'image/webp' &&
    media.previewSha256
  ) {
    return {
      storageKey: media.previewStorageKey,
      mime: media.previewMime,
      sha256: media.previewSha256,
    };
  }
  return { storageKey: media.storageKey, mime: media.verifiedMime, sha256: media.sha256 };
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

export async function GET(_request: Request, context: MediaContext) {
  const access = await getRentalAccess();
  if (!access) {
    return new Response('Доступ к материалам договора запрещён.', {
      status: 403,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const target = parseTarget(await context.params);
  if (!target) return unavailable();

  const initial = await prisma.$transaction(async (transaction) => {
    const candidate = await findReadyMedia(transaction, access, target);
    if (!candidate || !(await reauthorize(transaction, access, candidate.companyId))) return null;
    return candidate;
  });
  if (!initial?.verifiedMime) return unavailable();
  const initialAsset = selectedAsset(initial);
  if (!initialAsset.mime) return unavailable();

  let stream: Readable;
  try {
    const storage = await LocalPrivateStorage.create(privateStorageRoot());
    stream = await storage.openPrivate(initialAsset.storageKey);
  } catch {
    return unavailable();
  }

  try {
    const current = await prisma.$transaction(async (transaction) => {
      if (!(await reauthorize(transaction, access, initial.companyId))) return null;
      const record = await findReadyMedia(transaction, access, target);
      const asset = record ? selectedAsset(record) : null;
      if (
        !record ||
        !asset?.mime ||
        record.id !== initial.id ||
        record.sha256 !== initial.sha256 ||
        asset.storageKey !== initialAsset.storageKey ||
        asset.mime !== initialAsset.mime ||
        asset.sha256 !== initialAsset.sha256
      ) {
        return null;
      }
      await writeAuditLog(
        {
          actor: { id: access.user.id, email: access.user.email },
          companyId: record.companyId,
          action: 'VIEW',
          entityType: 'RENTAL',
          entityId: record.operation.rentalId,
          entityLabel: 'Материал фиксации аренды',
          changes: { operationId: record.operationId, mediaKind: record.kind },
        },
        transaction,
      );
      return { record, asset };
    });
    if (!current?.asset.mime) {
      stream.destroy();
      return unavailable();
    }
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'Content-Type': current.asset.mime,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    stream.destroy();
    return unavailable();
  }
}

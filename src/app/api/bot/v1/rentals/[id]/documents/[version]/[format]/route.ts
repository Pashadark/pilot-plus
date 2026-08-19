import { Readable } from 'node:stream';

import { prisma } from '@/database/prisma/client';
import { BotApiError, botErrorResponse } from '@/modules/bot-api/auth';
import { verifyRentalDocumentGrant } from '@/modules/bot-api/document-grants';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

type Context = { params: Promise<{ id: string; version: string; format: string }> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { id, version: rawVersion, format: rawFormat } = await context.params;
    const version = Number(rawVersion);
    const format = rawFormat.toUpperCase();
    const url = new URL(request.url);
    const expiresAt = Number(url.searchParams.get('expires'));
    const grant = url.searchParams.get('grant') ?? '';
    if (
      !/^[A-Za-z0-9_-]{1,128}$/u.test(id) ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      !['DOCX', 'PDF'].includes(format)
    ) {
      throw new BotApiError('NOT_FOUND', 404);
    }

    const record = await prisma.rentalDocumentVersion.findFirst({
      where: {
        rentalId: id,
        version,
        format: format as 'DOCX' | 'PDF',
        clientDocument: { is: { status: 'CLEAN' } },
        clientDocumentVersion: { is: { scanVerdict: 'CLEAN' } },
        rental: { documentGenerations: { some: { version, status: 'COMMITTED' } } },
      },
      select: {
        companyId: true,
        clientId: true,
        rentalId: true,
        version: true,
        format: true,
        clientDocument: { select: { currentVersion: true } },
        clientDocumentVersion: {
          select: { version: true, storageKey: true, originalName: true, verifiedMime: true },
        },
      },
    });
    if (!record || record.clientDocument.currentVersion !== record.clientDocumentVersion.version)
      throw new BotApiError('NOT_FOUND', 404);
    verifyRentalDocumentGrant(
      {
        companyId: record.companyId,
        clientId: record.clientId,
        rentalId: record.rentalId,
        version: record.version,
        format: record.format,
        expiresAt,
      },
      grant,
    );

    const root = process.env.PRIVATE_STORAGE_ROOT;
    if (!root) throw new BotApiError('SERVICE_UNAVAILABLE', 503);
    const storage = await LocalPrivateStorage.create(root);
    const stream = await storage.openPrivate(record.clientDocumentVersion.storageKey);
    const filename = encodeURIComponent(
      record.clientDocumentVersion.originalName.replace(/[\\/\u0000-\u001f]/gu, '-').slice(0, 180),
    );
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
        'Content-Type': record.clientDocumentVersion.verifiedMime,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return botErrorResponse(
      error instanceof BotApiError ? error : new BotApiError('NOT_FOUND', 404),
    );
  }
}

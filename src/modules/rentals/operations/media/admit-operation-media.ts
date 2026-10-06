import type { PrivateStorage } from '@/services/storage/private-storage';

import type { RentalOperationMediaKind } from '../types';
import { validateOperationMediaFile } from './file-validation';

type Operation = {
  id: string;
  companyId: string;
  rentalId: string;
  actorUserId: string;
  status: string;
};
type Media = { id: string; status: string };
type CreatedMedia = { id: string; uploadId: string; companyId: string; storageKey: string };

export type OperationMediaRepository = {
  findOperation(input: {
    companyId: string;
    operationId: string;
    actorUserId: string;
    status: 'DRAFT';
  }): Promise<Operation | null>;
  findMedia(input: {
    companyId: string;
    operationId: string;
    kind: RentalOperationMediaKind;
  }): Promise<Media | null>;
  createMedia(input: {
    companyId: string;
    operationId: string;
    kind: RentalOperationMediaKind;
    uploadId: string;
    originalName: string;
    verifiedMime: string;
    bytes: number;
    quarantineKey: string;
    storageKey: string;
  }): Promise<CreatedMedia>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

export async function admitOperationMedia(input: {
  companyId: string;
  operationId: string;
  actorUserId: string;
  kind: RentalOperationMediaKind;
  file: { name: string; bytes: Uint8Array };
  repository: OperationMediaRepository;
  storage: PrivateStorage;
  scan(
    media: CreatedMedia,
  ): Promise<
    { ok: true; status: 'CLEAN' | 'BLOCKED' | 'ERROR' } | { ok: false; status: 'OWNERSHIP_LOST' }
  >;
  skipAntivirus?: boolean;
  randomId(): string;
}) {
  const operation = await input.repository.findOperation({
    companyId: input.companyId,
    operationId: input.operationId,
    actorUserId: input.actorUserId,
    status: 'DRAFT',
  });
  if (!operation) throw new Error('Операция аренды недоступна.');

  const existing = await input.repository.findMedia({
    companyId: input.companyId,
    operationId: input.operationId,
    kind: input.kind,
  });
  if (existing?.status === 'CLEAN') return { mediaId: existing.id, status: 'CLEAN' as const };
  if (existing) throw new Error('Файл уже загружается или требует очистки.');

  const validated = validateOperationMediaFile({ kind: input.kind, ...input.file });
  const uploadId = input.randomId();
  const directory = `companies/${input.companyId}/rental-operations/${input.operationId}`;
  const storageKey = `${directory}/${input.kind.toLocaleLowerCase('en-US')}.${validated.extension}`;
  const media = await input.repository.createMedia({
    companyId: input.companyId,
    operationId: input.operationId,
    kind: input.kind,
    uploadId,
    originalName: input.file.name,
    verifiedMime: validated.mime,
    bytes: validated.bytes,
    quarantineKey: uploadId,
    storageKey,
  });

  try {
    await input.storage.putQuarantine(uploadId, input.file.bytes);
  } catch (error) {
    await input.repository.updateMany({
      where: { id: media.id, companyId: input.companyId, status: 'PENDING' },
      data: { status: 'ERROR', lastErrorCode: 'QUARANTINE_WRITE_FAILED' },
    });
    throw error;
  }
  if (input.skipAntivirus) {
    try {
      await input.storage.promote(uploadId, storageKey);
      const now = new Date();
      const committed = await input.repository.updateMany({
        where: { id: media.id, companyId: input.companyId, status: 'PENDING' },
        data: {
          status: 'CLEAN',
          promotedAt: now,
          committedAt: now,
          lastErrorCode: null,
        },
      });
      if (committed.count !== 1) {
        await input.storage.removePrivate(storageKey).catch(() => undefined);
        throw new Error('Право на сохранение файла потеряно.');
      }
      return { mediaId: media.id, status: 'CLEAN' as const };
    } catch (error) {
      await input.repository.updateMany({
        where: { id: media.id, companyId: input.companyId, status: 'PENDING' },
        data: { status: 'ERROR', lastErrorCode: 'DIRECT_STORE_FAILED' },
      });
      throw error;
    }
  }
  const scanned = await input.scan(media);
  if (!scanned.ok) throw new Error('Право на обработку файла потеряно.');
  if (scanned.status !== 'CLEAN') throw new Error('Файл не прошёл антивирусную проверку.');
  return { mediaId: media.id, status: scanned.status };
}

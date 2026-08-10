'use server';

import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

import { revalidatePath } from 'next/cache';
import sharp from 'sharp';

import type { ClientDocumentCategory, Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { writeAuditLog } from '@/modules/admin/audit';
import { validateUploadedFile } from '@/modules/client-documents/file-validation';
import {
  scanPendingUpload,
  type ScanPendingUploadResult,
} from '@/modules/client-documents/scan-upload';
import type { ClientDocumentActionState } from '@/modules/client-documents/types';
import { newScanLeaseExpiresAt } from '@/modules/client-documents/server/recovery-policy';
import { getClientAccess, type ClientAccess } from '@/modules/clients/access';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';
import type { PrivateStorage } from '@/services/storage/private-storage';
import { encryptField } from '@/services/security/field-encryption';

const documentCategories = new Set<ClientDocumentCategory>([
  'PASSPORT',
  'DRIVER_LICENSE',
  'CONTRACT',
  'POWER_OF_ATTORNEY',
  'MEDICAL',
  'OTHER',
]);
const safeIdentifier = /^[a-zA-Z0-9_-]{1,128}$/u;
const uploadIdentifier = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const maxActiveDocuments = 20;
const serializableAttempts = 3;
const cleanupRetryMs = 5 * 60_000;
const safeFileErrors = new Set([
  'Выберите файл для загрузки.',
  'Размер файла не должен превышать 15 МБ.',
  'Тип файла не поддерживается.',
  'Расширение файла не соответствует его содержимому.',
]);

const accessError: ClientDocumentActionState = {
  status: 'error',
  message: 'Доступ к документам клиентов запрещён.',
};
const clientError: ClientDocumentActionState = {
  status: 'error',
  message: 'Клиент недоступен.',
};
const uploadError: ClientDocumentActionState = {
  status: 'error',
  message: 'Не удалось загрузить файл. Попробуйте позже.',
};

type AccessibleClient = { id: string; companyId: string; photoPath: string | null };

type DocumentMetadata = {
  category: ClientDocumentCategory;
  title: string;
  numberEncrypted: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
};

type UploadRecord = {
  documentId: string;
  companyId: string;
  clientId: string;
  versionId: string;
  version: number;
  previousVersion: number | null;
  uploadId: string;
  storageKey: string;
};

function hasPrismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

async function runSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 1; attempt <= serializableAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!hasPrismaCode(error, 'P2034') || attempt === serializableAttempts) throw error;
    }
  }
  throw new Error('Транзакция не завершена.');
}

function formString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function allowedCompanyWhere(access: ClientAccess) {
  return access.scope === 'SYSTEM' ? undefined : { in: [...access.companyIds] };
}

async function findAccessibleClient(
  access: ClientAccess,
  clientId: string,
): Promise<AccessibleClient | null> {
  if (!safeIdentifier.test(clientId)) return null;
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      ...(allowedCompanyWhere(access) ? { companyId: allowedCompanyWhere(access) } : {}),
      archivedAt: null,
    },
    select: { id: true, companyId: true, photoPath: true },
  });
  return client && safeIdentifier.test(client.id) && safeIdentifier.test(client.companyId)
    ? client
    : null;
}

function parseDate(value: string): Date | null | undefined {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

function parseMetadata(formData: FormData): DocumentMetadata | null {
  const category = formString(formData, 'category') as ClientDocumentCategory;
  const title = formString(formData, 'title');
  const number = formString(formData, 'number');
  const issuedAt = parseDate(formString(formData, 'issuedAt'));
  const expiresAt = parseDate(formString(formData, 'expiresAt'));
  if (
    !documentCategories.has(category) ||
    title.length === 0 ||
    title.length > 120 ||
    number.length > 120 ||
    issuedAt === undefined ||
    expiresAt === undefined ||
    (issuedAt && expiresAt && expiresAt < issuedAt)
  ) {
    return null;
  }

  const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (number && !encryptionKey) throw new Error('Не настроена защита данных клиентов.');

  return {
    category,
    title,
    numberEncrypted: number ? encryptField(number, encryptionKey as string) : null,
    issuedAt,
    expiresAt,
  };
}

function originalName(file: File) {
  const segments = file.name.replaceAll('\\', '/').split('/');
  const basename = segments
    .at(-1)
    ?.replace(/[\u0000-\u001f\u007f]/gu, '')
    .trim();
  return basename ? basename.slice(0, 180) : 'document';
}

async function fileBytes(formData: FormData) {
  const file = formData.get('file');
  if (!(file instanceof File)) throw new Error('Выберите файл для загрузки.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validated = validateUploadedFile({ name: file.name, bytes });
  return { file, bytes, validated };
}

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

function documentStorageKey(
  client: AccessibleClient,
  documentId: string,
  version: number,
  extension: string,
) {
  if (!safeIdentifier.test(documentId)) throw new Error('Недопустимый идентификатор документа.');
  return `companies/${client.companyId}/clients/${client.id}/documents/${documentId}/${version}.${extension}`;
}

function duplicateState(status: string, documentId: string): ClientDocumentActionState {
  if (status === 'CLEAN') {
    return { status: 'success', message: 'Файл уже загружен.', documentId };
  }
  if (status === 'UPLOADING' || status === 'PENDING') {
    return { status: 'pending', message: 'Файл уже проходит проверку.', documentId };
  }
  if (status === 'BLOCKED') {
    return { status: 'error', message: 'Файл заблокирован антивирусом.', documentId };
  }
  return {
    status: 'error',
    message: 'Проверка файла временно недоступна. Повторите попытку позже.',
    documentId,
  };
}

async function findDuplicate(
  access: ClientAccess,
  clientId: string,
  uploadId: string,
): Promise<ClientDocumentActionState | null> {
  const duplicate = await prisma.clientDocumentVersion.findFirst({
    where: {
      uploadId,
      document: {
        clientId,
        ...(allowedCompanyWhere(access) ? { companyId: allowedCompanyWhere(access) } : {}),
        archivedAt: null,
      },
    },
    select: {
      uploadId: true,
      version: true,
      scanVerdict: true,
      document: {
        select: {
          id: true,
          companyId: true,
          clientId: true,
          status: true,
          currentVersion: true,
        },
      },
    },
  });
  if (!duplicate) return null;
  const status =
    duplicate.scanVerdict ??
    (duplicate.version === duplicate.document.currentVersion
      ? duplicate.document.status
      : 'PENDING');
  return duplicateState(status, duplicate.document.id);
}

async function createNewUpload(
  client: AccessibleClient,
  access: ClientAccess,
  uploadId: string,
  metadata: DocumentMetadata,
  file: File,
  verified: { mime: string; extension: string; bytes: number },
  hash: string,
): Promise<UploadRecord | ClientDocumentActionState> {
  return runSerializableTransaction(async (transaction) => {
    const count = await transaction.clientDocument.count({
      where: {
        companyId: client.companyId,
        clientId: client.id,
        archivedAt: null,
        status: { not: 'ARCHIVED' },
      },
    });
    if (count >= maxActiveDocuments) {
      return {
        status: 'error',
        message: 'У клиента уже есть 20 активных документов.',
      } satisfies ClientDocumentActionState;
    }

    const document = await transaction.clientDocument.create({
      data: {
        companyId: client.companyId,
        clientId: client.id,
        category: metadata.category,
        title: metadata.title,
        numberEncrypted: metadata.numberEncrypted,
        issuedAt: metadata.issuedAt,
        expiresAt: metadata.expiresAt,
        status: 'UPLOADING',
        currentVersion: 1,
        createdByUserId: access.user.id,
      },
      select: { id: true, companyId: true, currentVersion: true },
    });
    const storageKey = documentStorageKey(client, document.id, 1, verified.extension);
    const version = await transaction.clientDocumentVersion.create({
      data: {
        documentId: document.id,
        uploadId,
        version: 1,
        storageKey,
        originalName: originalName(file),
        verifiedMime: verified.mime,
        bytes: verified.bytes,
        sha256: hash,
        scanLeaseExpiresAt: newScanLeaseExpiresAt(),
      },
      select: { id: true },
    });
    return {
      documentId: document.id,
      companyId: client.companyId,
      clientId: client.id,
      versionId: version.id,
      version: 1,
      previousVersion: null,
      uploadId,
      storageKey,
    } satisfies UploadRecord;
  });
}

async function createReplacementUpload(
  access: ClientAccess,
  client: AccessibleClient,
  documentId: string,
  uploadId: string,
  file: File,
  verified: { mime: string; extension: string; bytes: number },
  hash: string,
): Promise<UploadRecord | null> {
  if (!safeIdentifier.test(documentId)) return null;
  return runSerializableTransaction(async (transaction) => {
    const document = await transaction.clientDocument.findFirst({
      where: {
        id: documentId,
        ...(allowedCompanyWhere(access) ? { companyId: allowedCompanyWhere(access) } : {}),
        clientId: client.id,
        archivedAt: null,
        status: 'CLEAN',
      },
      select: {
        id: true,
        companyId: true,
        clientId: true,
        currentVersion: true,
        status: true,
        versions: {
          orderBy: { version: 'desc' },
          select: { version: true, scanVerdict: true },
        },
      },
    });
    if (!document || document.companyId !== client.companyId) return null;
    const current = document.versions.find(
      (version) => version.version === document.currentVersion,
    );
    if (
      current?.scanVerdict !== 'CLEAN' ||
      document.versions.some((version) => version.scanVerdict === null)
    ) {
      return null;
    }
    const nextVersion = (document.versions[0]?.version ?? document.currentVersion) + 1;
    const storageKey = documentStorageKey(client, document.id, nextVersion, verified.extension);
    const version = await transaction.clientDocumentVersion.create({
      data: {
        documentId: document.id,
        uploadId,
        version: nextVersion,
        storageKey,
        originalName: originalName(file),
        verifiedMime: verified.mime,
        bytes: verified.bytes,
        sha256: hash,
        scanLeaseExpiresAt: newScanLeaseExpiresAt(),
      },
      select: { id: true },
    });
    return {
      documentId: document.id,
      companyId: client.companyId,
      clientId: client.id,
      versionId: version.id,
      version: nextVersion,
      previousVersion: document.currentVersion,
      uploadId,
      storageKey,
    } satisfies UploadRecord;
  });
}

async function finalizeUpload(
  access: ClientAccess,
  upload: UploadRecord,
  result: ScanPendingUploadResult,
) {
  return prisma.$transaction(async (transaction) => {
    const version = await transaction.clientDocumentVersion.updateMany({
      where: {
        id: upload.versionId,
        documentId: upload.documentId,
        uploadId: upload.uploadId,
        scanVerdict: null,
      },
      data: {
        sha256: result.audit.sha256,
        scanEngine: result.audit.engine ?? 'ClamAV',
        signatureVersion: result.audit.signatureVersion ?? null,
        scanVerdict: result.status,
        scanLeaseExpiresAt: null,
        scannedAt: new Date(),
      },
    });
    let documentCount = 1;
    if (upload.previousVersion === null) {
      const document = await transaction.clientDocument.updateMany({
        where: {
          id: upload.documentId,
          companyId: upload.companyId,
          clientId: upload.clientId,
          currentVersion: upload.version,
          archivedAt: null,
        },
        data: { status: result.status },
      });
      documentCount = document.count;
    } else if (result.status === 'CLEAN') {
      const document = await transaction.clientDocument.updateMany({
        where: {
          id: upload.documentId,
          companyId: upload.companyId,
          clientId: upload.clientId,
          currentVersion: upload.previousVersion,
          status: 'CLEAN',
          archivedAt: null,
        },
        data: { currentVersion: upload.version, status: 'CLEAN' },
      });
      documentCount = document.count;
    }
    if (version.count !== 1 || documentCount !== 1) {
      throw new Error('Состояние документа изменилось во время проверки.');
    }
    await writeAuditLog(
      {
        actor: { id: access.user.id, email: access.user.email },
        companyId: upload.companyId,
        action: 'SCAN',
        entityType: 'CLIENT_DOCUMENT',
        entityId: upload.documentId,
        entityLabel: 'Документ клиента',
        changes: {
          sha256: result.audit.sha256,
          verdict: result.audit.verdict,
          ...(result.audit.signatureVersion
            ? { signatureVersion: result.audit.signatureVersion }
            : {}),
          ...(result.audit.signature ? { signature: result.audit.signature } : {}),
        },
      },
      transaction,
    );
  });
}

async function compensateFailedFinalization(
  storage: PrivateStorage,
  upload: UploadRecord,
  result: ScanPendingUploadResult,
): Promise<ScanPendingUploadResult['status'] | null> {
  const cleanupRetryAt = new Date(Date.now() + cleanupRetryMs);
  let claimed: boolean;
  try {
    claimed = await prisma.$transaction(async (transaction) => {
      const version = await transaction.clientDocumentVersion.updateMany({
        where: {
          id: upload.versionId,
          documentId: upload.documentId,
          uploadId: upload.uploadId,
          version: upload.version,
          scanVerdict: null,
          document: {
            companyId: upload.companyId,
            clientId: upload.clientId,
            archivedAt: null,
          },
        },
        data: {
          scanVerdict: 'ERROR',
          scannedAt: new Date(),
          scanLeaseExpiresAt: cleanupRetryAt,
        },
      });
      if (version.count !== 1) return false;

      if (upload.previousVersion === null) {
        const document = await transaction.clientDocument.updateMany({
          where: {
            id: upload.documentId,
            companyId: upload.companyId,
            clientId: upload.clientId,
            currentVersion: upload.version,
            status: { in: ['UPLOADING', 'PENDING'] },
            archivedAt: null,
          },
          data: { status: 'ERROR' },
        });
        if (document.count !== 1) throw new Error('Состояние документа изменилось.');
      }
      return true;
    });
  } catch {
    claimed = false;
  }

  if (!claimed) {
    const committed = await prisma.clientDocumentVersion
      .findFirst({
        where: {
          id: upload.versionId,
          documentId: upload.documentId,
          uploadId: upload.uploadId,
          version: upload.version,
          document: {
            companyId: upload.companyId,
            clientId: upload.clientId,
            archivedAt: null,
          },
        },
        select: {
          scanVerdict: true,
          document: { select: { currentVersion: true, status: true } },
        },
      })
      .catch(() => null);
    if (!committed) return null;
    if (
      committed.scanVerdict === 'CLEAN' &&
      committed.document.currentVersion === upload.version &&
      committed.document.status === 'CLEAN'
    ) {
      return 'CLEAN';
    }
    if (committed.scanVerdict === 'BLOCKED' || committed.scanVerdict === 'ERROR') {
      const documentMatches =
        upload.previousVersion === null
          ? committed.document.currentVersion === upload.version &&
            committed.document.status === committed.scanVerdict
          : committed.document.currentVersion === upload.previousVersion &&
            committed.document.status === 'CLEAN';
      if (!documentMatches) return null;
      if (committed.scanVerdict === 'ERROR' && result.status === 'CLEAN') {
        const cleaned = await storage
          .removePrivate(upload.storageKey)
          .then(() => true)
          .catch(() => false);
        await prisma.clientDocumentVersion
          .updateMany({
            where: {
              id: upload.versionId,
              documentId: upload.documentId,
              uploadId: upload.uploadId,
              version: upload.version,
              scanVerdict: 'ERROR',
              document: {
                companyId: upload.companyId,
                clientId: upload.clientId,
                archivedAt: null,
              },
            },
            data: { scanLeaseExpiresAt: cleaned ? null : cleanupRetryAt },
          })
          .catch(() => undefined);
      }
      return committed.scanVerdict;
    }
    return null;
  }

  let cleanupSucceeded = true;
  if (result.status === 'CLEAN') {
    cleanupSucceeded = await storage
      .removePrivate(upload.storageKey)
      .then(() => true)
      .catch(() => false);
  } else if (result.status === 'ERROR') {
    cleanupSucceeded = await storage
      .removeQuarantine(upload.uploadId)
      .then(() => true)
      .catch(() => false);
  }

  await prisma.clientDocumentVersion
    .updateMany({
      where: {
        id: upload.versionId,
        documentId: upload.documentId,
        uploadId: upload.uploadId,
        version: upload.version,
        scanVerdict: 'ERROR',
        document: {
          companyId: upload.companyId,
          clientId: upload.clientId,
          archivedAt: null,
        },
      },
      data: { scanLeaseExpiresAt: cleanupSucceeded ? null : cleanupRetryAt },
    })
    .catch(() => undefined);
  return null;
}

function resultState(
  result: ScanPendingUploadResult,
  documentId: string,
): ClientDocumentActionState {
  if (result.status === 'CLEAN') {
    return { status: 'success', message: 'Документ загружен.', documentId };
  }
  if (result.status === 'BLOCKED') {
    return { status: 'error', message: 'Файл заблокирован антивирусом.', documentId };
  }
  return {
    status: 'error',
    message: 'Проверка файла временно недоступна. Повторите попытку позже.',
    documentId,
  };
}

function isUniqueConflict(error: unknown) {
  return hasPrismaCode(error, 'P2002');
}

function safeFileErrorState(error: unknown): ClientDocumentActionState | null {
  if (!(error instanceof Error) || !safeFileErrors.has(error.message)) return null;
  return { status: 'error', message: error.message };
}

export async function uploadClientDocumentAction(
  _previousState: ClientDocumentActionState,
  formData: FormData,
): Promise<ClientDocumentActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return accessError;

  const clientId = formString(formData, 'clientId');
  const client = await findAccessibleClient(access, clientId);
  if (!client) return clientError;

  const uploadId = formString(formData, 'uploadId');
  if (!uploadIdentifier.test(uploadId)) {
    return { status: 'error', message: 'Идентификатор загрузки недействителен.' };
  }
  const duplicate = await findDuplicate(access, client.id, uploadId);
  if (duplicate) return duplicate;

  try {
    const metadata = parseMetadata(formData);
    if (!metadata) return { status: 'error', message: 'Проверьте данные документа.' };
    const { file, bytes, validated } = await fileBytes(formData);
    const hash = sha256(bytes);
    const storage = await LocalPrivateStorage.create(privateStorageRoot());
    const scanner = ClamAvClient.fromEnvironment();
    const requestedDocumentId = formString(formData, 'documentId');
    const upload = requestedDocumentId
      ? await createReplacementUpload(
          access,
          client,
          requestedDocumentId,
          uploadId,
          file,
          validated,
          hash,
        )
      : await createNewUpload(client, access, uploadId, metadata, file, validated, hash);

    if (!upload) return { status: 'error', message: 'Документ недоступен для замены.' };
    if ('status' in upload) return upload;

    try {
      await storage.putQuarantine(uploadId, bytes);
    } catch {
      const failed = { status: 'ERROR', audit: { sha256: hash, verdict: 'ERROR' } } as const;
      try {
        await finalizeUpload(access, upload, failed);
      } catch {
        const committed = await compensateFailedFinalization(storage, upload, failed);
        if (committed) return duplicateState(committed, upload.documentId);
      }
      return uploadError;
    }

    let scanResult: ScanPendingUploadResult;
    try {
      await prisma.$transaction(async (transaction) => {
        const leased = await transaction.clientDocumentVersion.updateMany({
          where: {
            id: upload.versionId,
            documentId: upload.documentId,
            uploadId: upload.uploadId,
            scanVerdict: null,
          },
          data: { scanLeaseExpiresAt: newScanLeaseExpiresAt() },
        });
        if (leased.count !== 1) throw new Error('Состояние версии документа изменилось.');

        if (upload.previousVersion === null) {
          const pending = await transaction.clientDocument.updateMany({
            where: {
              id: upload.documentId,
              companyId: upload.companyId,
              clientId: upload.clientId,
              currentVersion: upload.version,
              status: 'UPLOADING',
              archivedAt: null,
            },
            data: { status: 'PENDING' },
          });
          if (pending.count !== 1) throw new Error('Состояние документа изменилось.');
        }
      });
      scanResult = await scanPendingUpload({
        storage,
        scanner,
        uploadId,
        storageKey: upload.storageKey,
        renewPromotionLease: async () => {
          const renewed = await prisma.clientDocumentVersion.updateMany({
            where: {
              id: upload.versionId,
              documentId: upload.documentId,
              uploadId: upload.uploadId,
              version: upload.version,
              scanVerdict: null,
              document: {
                companyId: upload.companyId,
                clientId: upload.clientId,
                archivedAt: null,
              },
            },
            data: { scanLeaseExpiresAt: newScanLeaseExpiresAt() },
          });
          return renewed.count === 1;
        },
      });
    } catch {
      scanResult = { status: 'ERROR', audit: { sha256: hash, verdict: 'ERROR' } };
    }
    try {
      await finalizeUpload(access, upload, scanResult);
    } catch {
      const committed = await compensateFailedFinalization(storage, upload, scanResult);
      if (committed) {
        revalidatePath(`/clients/${client.id}`);
        return duplicateState(committed, upload.documentId);
      }
      return uploadError;
    }
    revalidatePath(`/clients/${client.id}`);
    return resultState(scanResult, upload.documentId);
  } catch (error) {
    if (isUniqueConflict(error)) {
      const state = await findDuplicate(access, client.id, uploadId);
      if (state) return state;
    }
    const fileError = safeFileErrorState(error);
    if (fileError) return fileError;
    return uploadError;
  }
}

export async function archiveClientDocumentAction(
  _previousState: ClientDocumentActionState,
  formData: FormData,
): Promise<ClientDocumentActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return accessError;

  const clientId = formString(formData, 'clientId');
  const documentId = formString(formData, 'documentId');
  if (!safeIdentifier.test(clientId) || !safeIdentifier.test(documentId)) {
    return { status: 'error', message: 'Документ недоступен для архивирования.' };
  }

  const client = await findAccessibleClient(access, clientId);
  if (!client) return clientError;

  try {
    const archived = await runSerializableTransaction(async (transaction) => {
      if (access.scope !== 'SYSTEM') {
        const membership = await transaction.companyMember.findFirst({
          where: {
            userId: access.user.id,
            companyId: client.companyId,
            role: 'COMPANY_ADMIN',
          },
          select: { companyId: true },
        });
        if (!membership) return 'forbidden' as const;
      }

      const updated = await transaction.clientDocument.updateMany({
        where: {
          id: documentId,
          clientId: client.id,
          companyId: client.companyId,
          archivedAt: null,
          status: { not: 'ARCHIVED' },
          versions: {
            none: {
              OR: [{ scanVerdict: null }, { scanLeaseExpiresAt: { not: null } }],
            },
          },
        },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      if (updated.count !== 1) return 'missing' as const;

      await writeAuditLog(
        {
          actor: { id: access.user.id, email: access.user.email },
          companyId: client.companyId,
          action: 'ARCHIVE',
          entityType: 'CLIENT_DOCUMENT',
          entityId: documentId,
          entityLabel: 'Документ клиента',
          changes: { archived: true, status: 'ARCHIVED' },
        },
        transaction,
      );
      return 'archived' as const;
    });

    if (archived === 'forbidden') {
      return {
        status: 'error',
        message: 'Архивировать документы может только администратор компании.',
      };
    }
    if (archived === 'missing') {
      return { status: 'error', message: 'Документ недоступен для архивирования.' };
    }

    revalidatePath(`/clients/${client.id}`);
    return { status: 'success', message: 'Документ архивирован.', documentId };
  } catch {
    return { status: 'error', message: 'Не удалось архивировать документ. Попробуйте позже.' };
  }
}

async function readStream(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

async function removePrivateQuietly(storage: PrivateStorage, storageKey: string | null) {
  if (!storageKey?.startsWith('companies/')) return;
  await storage.removePrivate(storageKey).catch(() => undefined);
}

async function removePrivateTracked(storage: PrivateStorage, storageKey: string | null) {
  if (!storageKey?.startsWith('companies/')) return true;
  return storage
    .removePrivate(storageKey)
    .then(() => true)
    .catch(
      (error: unknown) =>
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT',
    );
}

async function auditPhotoScan(
  access: ClientAccess,
  client: AccessibleClient,
  scanResult: ScanPendingUploadResult,
  photoUploadId: string,
  transaction: Prisma.TransactionClient,
) {
  const upload = await transaction.clientPhotoUpload.updateMany({
    where: {
      id: photoUploadId,
      companyId: client.companyId,
      clientId: client.id,
      status: 'PENDING',
    },
    data: {
      scanVerdict: scanResult.status,
      sha256: scanResult.audit.sha256,
      leaseExpiresAt: newScanLeaseExpiresAt(),
    },
  });
  if (upload.count !== 1) throw new Error('Состояние загрузки фото изменилось.');
  await writeAuditLog(
    {
      actor: { id: access.user.id, email: access.user.email },
      companyId: client.companyId,
      action: 'SCAN',
      entityType: 'CLIENT',
      entityId: client.id,
      entityLabel: 'Фотография клиента',
      changes: {
        sha256: scanResult.audit.sha256,
        verdict: scanResult.audit.verdict,
        ...(scanResult.audit.signatureVersion
          ? { signatureVersion: scanResult.audit.signatureVersion }
          : {}),
        ...(scanResult.audit.signature ? { signature: scanResult.audit.signature } : {}),
      },
    },
    transaction,
  );
}

export async function uploadClientPhotoAction(
  _previousState: ClientDocumentActionState,
  formData: FormData,
): Promise<ClientDocumentActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return accessError;
  const clientId = formString(formData, 'clientId');
  const client = await findAccessibleClient(access, clientId);
  if (!client) return clientError;
  const uploadId = formString(formData, 'uploadId');
  if (!uploadIdentifier.test(uploadId)) {
    return { status: 'error', message: 'Идентификатор загрузки недействителен.' };
  }

  const finalStorageKey = `companies/${client.companyId}/clients/${client.id}/photos/${uploadId}.webp`;
  if (client.photoPath === finalStorageKey) {
    return { status: 'success', message: 'Фотография уже загружена.', clientId: client.id };
  }

  const existingUpload = await prisma.clientPhotoUpload.findFirst({
    where: {
      uploadId,
      companyId: client.companyId,
      clientId: client.id,
      client: { archivedAt: null },
    },
    select: { status: true, finalStorageKey: true },
  });
  if (existingUpload) {
    if (
      existingUpload.status === 'COMMITTED' &&
      client.photoPath === existingUpload.finalStorageKey
    ) {
      revalidatePath('/clients');
      revalidatePath(`/clients/${client.id}`);
      return { status: 'success', message: 'Фотография уже загружена.', clientId: client.id };
    }
    return { status: 'error', message: 'Эта загрузка фотографии уже обрабатывается.' };
  }

  let storage: PrivateStorage | undefined;
  let sourceStorageKey: string | undefined;
  let finalStoragePromoted = false;
  let databaseCommitted = false;
  let photoUploadId: string | undefined;
  try {
    const { bytes, validated } = await fileBytes(formData);
    if (!validated.mime.startsWith('image/')) {
      return { status: 'error', message: 'Фотография должна быть в формате JPG, PNG или WebP.' };
    }
    storage = await LocalPrivateStorage.create(privateStorageRoot());
    const scanner = ClamAvClient.fromEnvironment();
    sourceStorageKey = `companies/${client.companyId}/clients/${client.id}/photos/source/${uploadId}.${validated.extension}`;
    const durableUpload = await prisma.clientPhotoUpload.create({
      data: {
        uploadId,
        companyId: client.companyId,
        clientId: client.id,
        sourceStorageKey,
        finalStorageKey,
        previousPhotoPath: client.photoPath,
        status: 'PENDING',
        leaseExpiresAt: newScanLeaseExpiresAt(),
      },
      select: { id: true },
    });
    photoUploadId = durableUpload.id;
    await storage.putQuarantine(uploadId, bytes);
    const scanResult = await scanPendingUpload({
      storage,
      scanner,
      uploadId,
      storageKey: sourceStorageKey,
      renewPromotionLease: async () => {
        if (!photoUploadId) return false;
        const renewed = await prisma.clientPhotoUpload.updateMany({
          where: {
            id: photoUploadId,
            uploadId,
            companyId: client.companyId,
            clientId: client.id,
            status: 'PENDING',
          },
          data: { leaseExpiresAt: newScanLeaseExpiresAt() },
        });
        return renewed.count === 1;
      },
    });
    await prisma.$transaction((transaction) =>
      auditPhotoScan(access, client, scanResult, photoUploadId!, transaction),
    );
    if (scanResult.status !== 'CLEAN') {
      await prisma.clientPhotoUpload.updateMany({
        where: { id: photoUploadId, companyId: client.companyId, clientId: client.id },
        data: { status: 'CLEANUP_PENDING', leaseExpiresAt: new Date() },
      });
      return resultState(scanResult, client.id);
    }

    const normalized = await sharp(await readStream(await storage.openPrivate(sourceStorageKey)))
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const normalizedUploadId = `normalized-${uploadId}`;
    const promotionLease = await prisma.clientPhotoUpload.updateMany({
      where: {
        id: photoUploadId,
        uploadId,
        companyId: client.companyId,
        clientId: client.id,
        status: 'PENDING',
      },
      data: { leaseExpiresAt: newScanLeaseExpiresAt() },
    });
    if (promotionLease.count !== 1) {
      throw new Error('Срок обработки загрузки фото истёк.');
    }
    await storage.putQuarantine(normalizedUploadId, normalized);
    await storage.promote(normalizedUploadId, finalStorageKey);
    finalStoragePromoted = true;

    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.client.updateMany({
        where: {
          id: client.id,
          companyId: client.companyId,
          photoPath: client.photoPath,
          archivedAt: null,
        },
        data: { photoPath: finalStorageKey },
      });
      if (result.count !== 1) return false;
      const upload = await transaction.clientPhotoUpload.updateMany({
        where: {
          id: photoUploadId,
          uploadId,
          companyId: client.companyId,
          clientId: client.id,
          status: 'PENDING',
        },
        data: {
          status: 'CLEANUP_PENDING',
          leaseExpiresAt: new Date(),
          committedAt: new Date(),
        },
      });
      if (upload.count !== 1) throw new Error('Состояние загрузки фото изменилось.');
      return true;
    });
    if (!updated) {
      return clientError;
    }
    databaseCommitted = true;

    const [sourceRemoved, previousRemoved] = await Promise.all([
      removePrivateTracked(storage, sourceStorageKey),
      removePrivateTracked(storage, client.photoPath),
    ]);
    await prisma.clientPhotoUpload.updateMany({
      where: {
        id: photoUploadId,
        companyId: client.companyId,
        clientId: client.id,
        status: 'CLEANUP_PENDING',
      },
      data: {
        status: sourceRemoved && previousRemoved ? 'COMMITTED' : 'CLEANUP_PENDING',
        leaseExpiresAt: sourceRemoved && previousRemoved ? null : newScanLeaseExpiresAt(),
        committedAt: new Date(),
      },
    });
    revalidatePath('/clients');
    revalidatePath(`/clients/${client.id}`);
    return {
      status: 'success',
      message: 'Фотография клиента обновлена.',
      clientId: client.id,
    };
  } catch (error) {
    if (storage && finalStoragePromoted && photoUploadId) {
      const reread = await prisma.client
        .findFirst({
          where: {
            id: client.id,
            companyId: client.companyId,
          },
          select: { photoPath: true },
        })
        .then((value) => ({ available: true as const, value }))
        .catch(() => ({ available: false as const, value: null }));

      if (reread.available && reread.value?.photoPath === finalStorageKey) {
        databaseCommitted = true;
        const [sourceRemoved, previousRemoved] = await Promise.all([
          removePrivateTracked(storage, sourceStorageKey ?? null),
          removePrivateTracked(storage, client.photoPath),
        ]);
        await prisma.clientPhotoUpload
          .updateMany({
            where: { id: photoUploadId, companyId: client.companyId, clientId: client.id },
            data: {
              status: sourceRemoved && previousRemoved ? 'COMMITTED' : 'CLEANUP_PENDING',
              leaseExpiresAt: sourceRemoved && previousRemoved ? null : newScanLeaseExpiresAt(),
              committedAt: new Date(),
            },
          })
          .catch(() => undefined);
        revalidatePath('/clients');
        revalidatePath(`/clients/${client.id}`);
        return {
          status: 'success',
          message: 'Фотография клиента обновлена.',
          clientId: client.id,
        };
      }

      if (reread.available) {
        const claimed = await prisma.clientPhotoUpload
          .updateMany({
            where: {
              id: photoUploadId,
              companyId: client.companyId,
              clientId: client.id,
              status: { in: ['PENDING', 'CLEANUP_PENDING'] },
            },
            data: { status: 'CLEANUP_PENDING', leaseExpiresAt: new Date() },
          })
          .catch(() => ({ count: 0 }));
        if (claimed.count === 1) {
          const finalRemoved = await removePrivateTracked(storage, finalStorageKey);
          await prisma.clientPhotoUpload
            .updateMany({
              where: { id: photoUploadId, companyId: client.companyId, clientId: client.id },
              data: {
                status: finalRemoved ? 'ERROR' : 'CLEANUP_PENDING',
                leaseExpiresAt: finalRemoved ? null : newScanLeaseExpiresAt(),
              },
            })
            .catch(() => undefined);
        }
      }
      // An unavailable tenant-scoped reread is ambiguous: the durable lease owns cleanup.
    }
    const fileError = safeFileErrorState(error);
    if (fileError) return fileError;
    return uploadError;
  } finally {
    if (storage && sourceStorageKey && databaseCommitted) {
      await removePrivateQuietly(storage, sourceStorageKey);
    }
  }
}

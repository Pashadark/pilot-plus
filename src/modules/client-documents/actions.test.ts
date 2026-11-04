import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const repository = {
    $transaction: vi.fn(),
    client: { findFirst: vi.fn(), updateMany: vi.fn() },
    companyMember: { findFirst: vi.fn() },
    clientPhotoUpload: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    clientUploadPermit: { findFirst: vi.fn(), updateMany: vi.fn() },
    clientStorageLedger: { updateMany: vi.fn() },
    clientDocument: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    clientDocumentVersion: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const storage = {
    putQuarantine: vi.fn(),
    openQuarantine: vi.fn(),
    removeQuarantine: vi.fn(),
    promote: vi.fn(),
    openPrivate: vi.fn(),
    removePrivate: vi.fn(),
    removeUploadArtifacts: vi.fn(),
    reserveQuarantine: vi.fn(),
    privateUsageBytes: vi.fn(),
  };
  const sharpPipeline = {
    rotate: vi.fn(),
    resize: vi.fn(),
    webp: vi.fn(),
    toBuffer: vi.fn(),
  };
  return {
    repository,
    storage,
    sharpPipeline,
    getClientAccess: vi.fn(),
    writeAuditLog: vi.fn(),
    revalidatePath: vi.fn(),
    storageCreate: vi.fn(),
    scannerFromEnvironment: vi.fn(),
    scanPendingUpload: vi.fn(),
    acquireClientUploadPermit: vi.fn(),
    renewClientUploadPermit: vi.fn(),
    releaseClientUploadPermit: vi.fn(),
    settleClientUploadPermitInTransaction: vi.fn(),
    clientUploadLimitsFromEnvironment: vi.fn(),
    sharp: vi.fn(),
    createStoredWebpPreview: vi.fn(),
    supportsWebpPreview: vi.fn(),
  };
});

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/database/prisma/client', () => ({ prisma: mocks.repository }));
vi.mock('@/modules/clients/access', () => ({ getClientAccess: mocks.getClientAccess }));
vi.mock('@/modules/admin/audit', () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock('@/services/storage/local-private-storage', () => ({
  LocalPrivateStorage: { create: mocks.storageCreate },
}));
vi.mock('@/services/malware-scanner/clamav-client', () => ({
  ClamAvClient: { fromEnvironment: mocks.scannerFromEnvironment },
}));
vi.mock('./scan-upload', () => ({ scanPendingUpload: mocks.scanPendingUpload }));
vi.mock('./server/upload-resource-controls', () => ({
  acquireClientUploadPermit: mocks.acquireClientUploadPermit,
  renewClientUploadPermit: mocks.renewClientUploadPermit,
  releaseClientUploadPermit: mocks.releaseClientUploadPermit,
  settleClientUploadPermitInTransaction: mocks.settleClientUploadPermitInTransaction,
  clientUploadLimitsFromEnvironment: mocks.clientUploadLimitsFromEnvironment,
}));
vi.mock('sharp', () => ({ default: mocks.sharp }));
vi.mock('@/services/media/webp-preview', () => ({
  createStoredWebpPreview: mocks.createStoredWebpPreview,
  supportsWebpPreview: mocks.supportsWebpPreview,
}));

import {
  archiveClientDocumentAction,
  uploadClientDocumentAction,
  uploadClientPhotoAction,
} from './actions';

process.env.PRIVATE_STORAGE_ROOT = 'C:\\pilot-private-test';

const initialState = { status: 'idle' as const };
const dispatcherAccess = {
  user: {
    id: 'dispatcher-1',
    email: 'dispatcher@example.test',
    name: 'Диспетчер',
    role: 'MEMBER' as const,
    canAccessAdmin: false,
  },
  scope: 'COMPANY' as const,
  companyIds: ['company-1'],
  canManage: true,
};

function jpegFile(name = 'passport.jpg') {
  return new File([Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43])], name, {
    type: 'image/jpeg',
  });
}

function uploadForm(
  options: {
    clientId?: string;
    uploadId?: string;
    documentId?: string;
    file?: File;
  } = {},
) {
  const form = new FormData();
  form.set('clientId', options.clientId ?? 'client-1');
  form.set('uploadId', options.uploadId ?? '123e4567-e89b-42d3-a456-426614174000');
  form.set('category', 'PASSPORT');
  form.set('title', 'Паспорт');
  if (options.documentId) form.set('documentId', options.documentId);
  form.set('file', options.file ?? jpegFile());
  return form;
}

describe('client document upload authorization and workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientAccess.mockResolvedValue(dispatcherAccess);
    mocks.repository.client.findFirst.mockResolvedValue({
      id: 'client-1',
      companyId: 'company-1',
      photoPath: null,
      photoBytes: 0,
    });
    mocks.repository.clientDocumentVersion.findFirst.mockResolvedValue(null);
    mocks.repository.clientDocumentVersion.findMany.mockResolvedValue([
      {
        id: 'version-1',
        uploadId: '123e4567-e89b-42d3-a456-426614174000',
        storageKey: 'companies/company-1/clients/client-1/documents/document-1/1.jpg',
        previewStorageKey:
          'companies/company-1/clients/client-1/documents/document-1/1.jpg.preview.webp',
        ledgerCommittedBytes: 10,
      },
      {
        id: 'version-2',
        uploadId: '223e4567-e89b-42d3-a456-426614174000',
        storageKey: 'companies/company-1/clients/client-1/documents/document-1/2.pdf',
        previewStorageKey: null,
        ledgerCommittedBytes: 20,
      },
    ]);
    mocks.repository.clientDocument.findFirst.mockResolvedValue({
      id: 'document-1',
      companyId: 'company-1',
      clientId: 'client-1',
      currentVersion: 1,
      status: 'CLEAN',
      versions: [{ version: 1, scanVerdict: 'CLEAN' }],
    });
    mocks.repository.clientDocument.count.mockResolvedValue(0);
    mocks.repository.clientDocument.create.mockResolvedValue({
      id: 'document-1',
      companyId: 'company-1',
      currentVersion: 1,
    });
    mocks.repository.clientDocument.updateMany.mockResolvedValue({ count: 1 });
    mocks.repository.clientDocument.deleteMany.mockResolvedValue({ count: 1 });
    mocks.repository.clientDocumentVersion.create.mockResolvedValue({ id: 'version-1' });
    mocks.repository.clientDocumentVersion.deleteMany.mockResolvedValue({ count: 1 });
    mocks.repository.clientDocumentVersion.updateMany.mockResolvedValue({ count: 1 });
    mocks.repository.client.updateMany.mockResolvedValue({ count: 1 });
    mocks.repository.companyMember.findFirst.mockResolvedValue(null);
    mocks.repository.clientPhotoUpload.create.mockResolvedValue({ id: 'photo-upload-1' });
    mocks.repository.clientPhotoUpload.findFirst.mockResolvedValue(null);
    mocks.repository.clientPhotoUpload.updateMany.mockResolvedValue({ count: 1 });
    mocks.repository.clientUploadPermit.updateMany.mockResolvedValue({ count: 1 });
    mocks.repository.clientUploadPermit.findFirst.mockResolvedValue({ reservedBytes: 15 });
    mocks.repository.clientStorageLedger.updateMany.mockResolvedValue({ count: 1 });
    mocks.repository.$transaction.mockImplementation(
      async (operation: (transaction: typeof mocks.repository) => unknown) =>
        operation(mocks.repository),
    );
    mocks.storageCreate.mockResolvedValue(mocks.storage);
    mocks.storage.putQuarantine.mockResolvedValue(undefined);
    mocks.storage.promote.mockResolvedValue(undefined);
    mocks.storage.removeQuarantine.mockResolvedValue(undefined);
    mocks.storage.removePrivate.mockResolvedValue(undefined);
    mocks.storage.removeUploadArtifacts.mockResolvedValue(0);
    mocks.storage.privateUsageBytes.mockResolvedValue(0);
    mocks.scannerFromEnvironment.mockReturnValue({ scanStream: vi.fn() });
    mocks.scanPendingUpload.mockResolvedValue({
      status: 'CLEAN',
      audit: {
        sha256: 'a'.repeat(64),
        verdict: 'CLEAN',
        engine: 'ClamAV',
        signatureVersion: '27692',
      },
    });
    mocks.supportsWebpPreview.mockImplementation((mime: string) => mime.startsWith('image/'));
    mocks.createStoredWebpPreview.mockResolvedValue({
      buffer: Buffer.from('preview'),
      mime: 'image/webp',
      bytes: 7,
      sha256: 'b'.repeat(64),
    });
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.acquireClientUploadPermit.mockResolvedValue({
      ok: true,
      permitId: 'permit-1',
      leaseExpiresAt: new Date('2026-08-10T12:15:00.000Z'),
    });
    mocks.renewClientUploadPermit.mockResolvedValue(true);
    mocks.releaseClientUploadPermit.mockResolvedValue(true);
    mocks.settleClientUploadPermitInTransaction.mockResolvedValue(true);
    mocks.clientUploadLimitsFromEnvironment.mockReturnValue({
      windowMs: 10 * 60_000,
      userRate: 20,
      companyRate: 100,
      userConcurrent: 2,
      companyConcurrent: 6,
      companyQuotaBytes: 1024 * 1024 * 1024,
      leaseMs: 15 * 60_000,
    });
    mocks.storage.openPrivate.mockResolvedValue(Readable.from([Buffer.from('clean-image')]));
    mocks.sharpPipeline.rotate.mockReturnValue(mocks.sharpPipeline);
    mocks.sharpPipeline.resize.mockReturnValue(mocks.sharpPipeline);
    mocks.sharpPipeline.webp.mockReturnValue(mocks.sharpPipeline);
    mocks.sharpPipeline.toBuffer.mockResolvedValue(Buffer.from('normalized-webp'));
    mocks.sharp.mockReturnValue(mocks.sharpPipeline);
  });

  it.each(['VIEWER', 'DRIVER'])('denies %s mutation before file or database writes', async () => {
    mocks.getClientAccess.mockResolvedValue(null);

    await expect(uploadClientDocumentAction(initialState, uploadForm())).resolves.toEqual({
      status: 'error',
      message: 'Доступ к документам клиентов запрещён.',
    });

    expect(mocks.repository.client.findFirst).not.toHaveBeenCalled();
    expect(mocks.storage.putQuarantine).not.toHaveBeenCalled();
  });

  it('acquires a durable permit before arrayBuffer and returns a Russian retry error on rate limit', async () => {
    const file = jpegFile();
    const arrayBuffer = vi.spyOn(file, 'arrayBuffer');
    mocks.acquireClientUploadPermit.mockResolvedValue({
      ok: false,
      reason: 'USER_RATE',
      message: 'Слишком много загрузок. Повторите через несколько минут.',
    });

    await expect(uploadClientDocumentAction(initialState, uploadForm({ file }))).resolves.toEqual({
      status: 'error',
      message: 'Слишком много загрузок. Повторите через несколько минут.',
    });

    expect(mocks.storage.privateUsageBytes).not.toHaveBeenCalled();
    expect(mocks.acquireClientUploadPermit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'DOCUMENT', requestedBytes: file.size }),
    );
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.storage.putQuarantine).not.toHaveBeenCalled();
  });

  it('applies the same durable capacity control to replacements and photo attempts', async () => {
    await uploadClientDocumentAction(
      initialState,
      uploadForm({ documentId: 'document-1', uploadId: '223e4567-e89b-42d3-a456-426614174000' }),
    );
    await uploadClientPhotoAction(
      initialState,
      uploadForm({ uploadId: '323e4567-e89b-42d3-a456-426614174000' }),
    );

    expect(mocks.acquireClientUploadPermit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'DOCUMENT' }),
    );
    expect(mocks.acquireClientUploadPermit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'PHOTO' }),
    );
  });

  it('denies document archive to a dispatcher before the document mutation', async () => {
    const form = new FormData();
    form.set('clientId', 'client-1');
    form.set('documentId', 'document-1');

    await expect(archiveClientDocumentAction(initialState, form)).resolves.toEqual({
      status: 'error',
      message: 'Архивировать документы может только администратор компании.',
    });
    expect(mocks.repository.clientDocument.updateMany).not.toHaveBeenCalled();
  });

  it('archives a tenant document for COMPANY_ADMIN and writes an ARCHIVE audit', async () => {
    mocks.repository.companyMember.findFirst.mockResolvedValue({ companyId: 'company-1' });
    const form = new FormData();
    form.set('clientId', 'client-1');
    form.set('documentId', 'document-1');

    await expect(archiveClientDocumentAction(initialState, form)).resolves.toEqual({
      status: 'success',
      message: 'Документ архивирован.',
      documentId: 'document-1',
    });
    expect(mocks.repository.clientDocument.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        clientId: 'client-1',
        companyId: 'company-1',
        archivedAt: null,
        status: { not: 'ARCHIVED' },
      },
      data: { status: 'ARCHIVED', archivedAt: expect.any(Date) },
    });
    expect(mocks.repository.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ARCHIVE',
        entityType: 'CLIENT_DOCUMENT',
        entityId: 'document-1',
      }),
      mocks.repository,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/clients/client-1');
    expect(mocks.storage.removePrivate).toHaveBeenCalledWith(
      'companies/company-1/clients/client-1/documents/document-1/1.jpg',
    );
    expect(mocks.storage.removePrivate).toHaveBeenCalledWith(
      'companies/company-1/clients/client-1/documents/document-1/1.jpg.preview.webp',
    );
    expect(mocks.storage.removePrivate).toHaveBeenCalledWith(
      'companies/company-1/clients/client-1/documents/document-1/2.pdf',
    );
    expect(mocks.storage.removeUploadArtifacts).toHaveBeenCalledTimes(2);
    expect(mocks.repository.clientDocumentVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'version-1', claimToken: expect.any(String) }),
        data: expect.objectContaining({
          cleanupPending: false,
          cleanupLeaseExpiresAt: null,
          claimToken: null,
        }),
      }),
    );
    expect(mocks.settleClientUploadPermitInTransaction).toHaveBeenCalledTimes(2);
  });

  it('bounds archive request cleanup and leaves the remaining revisions worker-driven', async () => {
    mocks.getClientAccess.mockResolvedValue({
      ...dispatcherAccess,
      user: { ...dispatcherAccess.user, id: 'company-admin-1' },
    });
    mocks.repository.companyMember.findFirst.mockResolvedValue({ companyId: 'company-1' });
    mocks.repository.clientDocumentVersion.findMany.mockImplementation(async (args?: unknown) => {
      const versions = Array.from({ length: 5 }, (_, index) => ({
        id: `version-${index + 1}`,
        uploadId: `${index + 1}23e4567-e89b-42d3-a456-426614174000`,
        storageKey: `companies/company-1/clients/client-1/documents/document-1/${index + 1}.jpg`,
        previewStorageKey: null,
        ledgerCommittedBytes: 10,
      }));
      const take =
        typeof args === 'object' && args !== null && 'take' in args && typeof args.take === 'number'
          ? args.take
          : versions.length;
      return versions.slice(0, take);
    });
    const form = new FormData();
    form.set('clientId', 'client-1');
    form.set('documentId', 'document-1');

    await expect(archiveClientDocumentAction(initialState, form)).resolves.toMatchObject({
      status: 'success',
    });

    expect(mocks.repository.clientDocumentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(mocks.storage.removePrivate).toHaveBeenCalledTimes(3);
    expect(mocks.repository.clientDocumentVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ documentId: 'document-1' }),
        data: expect.objectContaining({ cleanupPending: true }),
      }),
    );
  });

  it('denies a cross-company upload on the server', async () => {
    mocks.repository.client.findFirst.mockResolvedValue(null);

    await expect(
      uploadClientDocumentAction(initialState, uploadForm({ clientId: 'foreign-client' })),
    ).resolves.toEqual({
      status: 'error',
      message: 'Клиент недоступен.',
    });

    expect(mocks.repository.clientDocument.create).not.toHaveBeenCalled();
    expect(mocks.storage.putQuarantine).not.toHaveBeenCalled();
  });

  it('enforces the 20 active-document limit inside the authorized client scope', async () => {
    mocks.repository.clientDocument.count.mockResolvedValue(20);

    await expect(uploadClientDocumentAction(initialState, uploadForm())).resolves.toEqual({
      status: 'error',
      message: 'У клиента уже есть 20 активных документов.',
    });

    expect(mocks.repository.clientDocument.count).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        clientId: 'client-1',
        archivedAt: null,
        status: { not: 'ARCHIVED' },
      },
    });
    expect(mocks.repository.clientDocument.create).not.toHaveBeenCalled();
  });

  it('returns the existing result for a duplicate upload id without scanning twice', async () => {
    mocks.repository.clientDocumentVersion.findFirst.mockResolvedValue({
      uploadId: '123e4567-e89b-42d3-a456-426614174000',
      version: 1,
      scanVerdict: 'CLEAN',
      document: {
        id: 'document-existing',
        companyId: 'company-1',
        clientId: 'client-1',
        status: 'CLEAN',
        currentVersion: 1,
      },
    });

    await expect(uploadClientDocumentAction(initialState, uploadForm())).resolves.toEqual({
      status: 'success',
      message: 'Файл уже загружен.',
      documentId: 'document-existing',
    });

    expect(mocks.storage.putQuarantine).not.toHaveBeenCalled();
    expect(mocks.scanPendingUpload).not.toHaveBeenCalled();
    expect(mocks.repository.clientDocument.create).not.toHaveBeenCalled();
  });

  it('allows a dispatcher replacement as a new version guarded by tenant and current version', async () => {
    await expect(
      uploadClientDocumentAction(
        initialState,
        uploadForm({ documentId: 'document-1', uploadId: '223e4567-e89b-42d3-a456-426614174000' }),
      ),
    ).resolves.toMatchObject({ status: 'success', documentId: 'document-1' });

    expect(mocks.repository.clientDocument.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        companyId: { in: ['company-1'] },
        clientId: 'client-1',
        archivedAt: null,
        status: 'CLEAN',
      },
      select: expect.objectContaining({ currentVersion: true }),
    });
    expect(mocks.repository.clientDocument.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'document-1',
        companyId: 'company-1',
        clientId: 'client-1',
        currentVersion: 1,
        status: 'CLEAN',
        archivedAt: null,
      },
      data: { currentVersion: 2, status: 'CLEAN' },
    });
    expect(mocks.repository.clientDocumentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'document-1',
        version: 2,
        uploadId: '223e4567-e89b-42d3-a456-426614174000',
      }),
      select: { id: true },
    });
    expect(mocks.repository.clientDocumentVersion.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'version-1',
        documentId: 'document-1',
        uploadId: '223e4567-e89b-42d3-a456-426614174000',
        scanVerdict: null,
      },
      data: expect.objectContaining({ scanVerdict: 'CLEAN', scanLeaseExpiresAt: null }),
    });
  });

  it('stores WebP preview metadata and counts both files for a CLEAN image document', async () => {
    await expect(uploadClientDocumentAction(initialState, uploadForm())).resolves.toMatchObject({
      status: 'success',
      documentId: 'document-1',
    });

    expect(mocks.createStoredWebpPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        storage: mocks.storage,
        sourceStorageKey:
          'companies/company-1/clients/client-1/documents/document-1/1.jpg',
        previewStorageKey:
          'companies/company-1/clients/client-1/documents/document-1/1.jpg.preview.webp',
        verifiedMime: 'image/jpeg',
        profile: 'CLIENT_DOCUMENT',
      }),
    );
    expect(mocks.repository.clientDocumentVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previewStorageKey:
            'companies/company-1/clients/client-1/documents/document-1/1.jpg.preview.webp',
          previewMime: 'image/webp',
          previewBytes: 7,
          previewSha256: 'b'.repeat(64),
          previewGeneratedAt: expect.any(Date),
          ledgerCommittedBytes: 13,
        }),
      }),
    );
    expect(mocks.settleClientUploadPermitInTransaction).toHaveBeenCalledWith(
      mocks.repository,
      expect.objectContaining({ committedBytes: 13, maximumCommittedBytes: 1024 * 1024 * 1024 }),
    );
  });

  it('keeps a CLEAN original when derived preview generation fails', async () => {
    mocks.createStoredWebpPreview.mockRejectedValueOnce(new Error('sharp failed'));

    await expect(uploadClientDocumentAction(initialState, uploadForm())).resolves.toMatchObject({
      status: 'success',
      documentId: 'document-1',
    });

    expect(mocks.repository.clientDocumentVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scanVerdict: 'CLEAN',
          ledgerCommittedBytes: 6,
        }),
      }),
    );
  });

  it('denies a replacement racing an initial PENDING upload before creating version 2', async () => {
    mocks.repository.clientDocument.findFirst.mockResolvedValue({
      id: 'document-1',
      companyId: 'company-1',
      clientId: 'client-1',
      currentVersion: 1,
      status: 'PENDING',
      versions: [{ version: 1, scanVerdict: null }],
    });

    await expect(
      uploadClientDocumentAction(
        initialState,
        uploadForm({ documentId: 'document-1', uploadId: '223e4567-e89b-42d3-a456-426614174000' }),
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'Документ недоступен для замены.',
    });

    expect(mocks.repository.clientDocumentVersion.create).not.toHaveBeenCalled();
    expect(mocks.storage.putQuarantine).not.toHaveBeenCalled();
  });

  it('marks only its losing replacement ERROR while preserving current CLEAN and idempotency', async () => {
    mocks.repository.clientDocument.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      uploadClientDocumentAction(
        initialState,
        uploadForm({ documentId: 'document-1', uploadId: '223e4567-e89b-42d3-a456-426614174000' }),
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'Не удалось загрузить файл. Попробуйте позже.',
    });

    expect(mocks.storage.removePrivate).toHaveBeenCalledWith(
      'companies/company-1/clients/client-1/documents/document-1/2.jpg',
    );
    expect(mocks.repository.clientDocumentVersion.deleteMany).not.toHaveBeenCalled();
    expect(mocks.repository.clientDocumentVersion.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'version-1',
        documentId: 'document-1',
        uploadId: '223e4567-e89b-42d3-a456-426614174000',
        version: 2,
        scanVerdict: null,
        document: {
          companyId: 'company-1',
          clientId: 'client-1',
          archivedAt: null,
        },
      },
      data: expect.objectContaining({
        scanVerdict: 'ERROR',
        scanLeaseExpiresAt: expect.any(Date),
      }),
    });
  });

  it('preserves a committed CLEAN replacement when the transaction acknowledgement is lost', async () => {
    let transactionNumber = 0;
    mocks.repository.$transaction.mockImplementation(
      async (operation: (transaction: typeof mocks.repository) => unknown) => {
        transactionNumber += 1;
        const result = await operation(mocks.repository);
        if (transactionNumber === 3) throw new Error('commit acknowledgement lost');
        return result;
      },
    );
    mocks.repository.clientDocumentVersion.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    mocks.repository.clientDocumentVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        scanVerdict: 'CLEAN',
        document: { currentVersion: 2, status: 'CLEAN' },
      });

    await expect(
      uploadClientDocumentAction(
        initialState,
        uploadForm({ documentId: 'document-1', uploadId: '223e4567-e89b-42d3-a456-426614174000' }),
      ),
    ).resolves.toEqual({
      status: 'success',
      message: 'Файл уже загружен.',
      documentId: 'document-1',
    });

    expect(mocks.repository.clientDocumentVersion.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'version-1',
        documentId: 'document-1',
        uploadId: '223e4567-e89b-42d3-a456-426614174000',
        version: 2,
        scanVerdict: null,
        document: {
          companyId: 'company-1',
          clientId: 'client-1',
          archivedAt: null,
        },
      },
      data: expect.objectContaining({ scanVerdict: 'ERROR' }),
    });
    expect(mocks.storage.removePrivate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/clients/client-1');
  });

  it('returns a safe Russian error without exposing a storage path', async () => {
    mocks.storage.putQuarantine.mockRejectedValue(
      new Error('C:\\private\\companies\\company-1\\secret.jpg'),
    );

    const result = await uploadClientDocumentAction(initialState, uploadForm());

    expect(result).toEqual({
      status: 'error',
      message: 'Не удалось загрузить файл. Попробуйте позже.',
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('secret.jpg');
  });

  it('compensates its durable row when quarantine write and ERROR audit finalization both fail', async () => {
    mocks.storage.putQuarantine.mockRejectedValueOnce(new Error('disk unavailable'));
    mocks.writeAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(uploadClientDocumentAction(initialState, uploadForm())).resolves.toEqual({
      status: 'error',
      message: 'Не удалось загрузить файл. Попробуйте позже.',
    });

    expect(mocks.storage.removeQuarantine).toHaveBeenCalledWith(
      '123e4567-e89b-42d3-a456-426614174000',
    );
    expect(mocks.repository.clientDocument.deleteMany).not.toHaveBeenCalled();
    expect(mocks.repository.clientDocumentVersion.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'version-1',
        documentId: 'document-1',
        uploadId: '123e4567-e89b-42d3-a456-426614174000',
        version: 1,
        scanVerdict: null,
        document: {
          companyId: 'company-1',
          clientId: 'client-1',
          archivedAt: null,
        },
      },
      data: expect.objectContaining({
        scanVerdict: 'ERROR',
        scanLeaseExpiresAt: expect.any(Date),
      }),
    });
  });

  it('retries a bounded Serializable P2034 conflict before writing storage', async () => {
    mocks.repository.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('serialization conflict'), { code: 'P2034' }),
    );

    await expect(uploadClientDocumentAction(initialState, uploadForm())).resolves.toMatchObject({
      status: 'success',
      documentId: 'document-1',
    });

    expect(mocks.repository.clientDocument.create).toHaveBeenCalledOnce();
    expect(mocks.storage.putQuarantine).toHaveBeenCalledOnce();
  });

  it('stops after three Serializable P2034 conflicts without writing storage', async () => {
    mocks.repository.$transaction.mockRejectedValue(
      Object.assign(new Error('serialization conflict'), { code: 'P2034' }),
    );

    await expect(uploadClientDocumentAction(initialState, uploadForm())).resolves.toEqual({
      status: 'error',
      message: 'Не удалось загрузить файл. Попробуйте позже.',
    });

    expect(mocks.repository.$transaction).toHaveBeenCalledTimes(3);
    expect(mocks.storage.putQuarantine).not.toHaveBeenCalled();
  });

  it('returns the safe magic-byte validation reason to the user', async () => {
    const unsupported = new File([Buffer.from('<svg></svg>')], 'portrait.svg', {
      type: 'image/svg+xml',
    });

    await expect(
      uploadClientDocumentAction(initialState, uploadForm({ file: unsupported })),
    ).resolves.toEqual({
      status: 'error',
      message: 'Тип файла не поддерживается.',
    });

    expect(mocks.repository.clientDocument.create).not.toHaveBeenCalled();
    expect(mocks.storage.putQuarantine).not.toHaveBeenCalled();
  });

  it('rejects a calendar date that JavaScript would otherwise normalize', async () => {
    const form = uploadForm();
    form.set('issuedAt', '2026-02-31');

    await expect(uploadClientDocumentAction(initialState, form)).resolves.toEqual({
      status: 'error',
      message: 'Проверьте данные документа.',
    });
    expect(mocks.repository.clientDocument.create).not.toHaveBeenCalled();
  });

  it('audits scan metadata atomically without filename, path or bytes', async () => {
    await uploadClientDocumentAction(initialState, uploadForm());

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SCAN',
        entityType: 'CLIENT_DOCUMENT',
        entityId: 'document-1',
        changes: {
          sha256: 'a'.repeat(64),
          verdict: 'CLEAN',
          signatureVersion: '27692',
        },
      }),
      mocks.repository,
    );
    const audit = JSON.stringify(mocks.writeAuditLog.mock.calls.at(-1)?.[0]);
    expect(audit).not.toContain('passport.jpg');
    expect(audit).not.toContain('storageKey');
    expect(audit).not.toContain('bytes');
  });

  it('scans a client photo before Sharp normalization and atomically replaces photoPath', async () => {
    await expect(uploadClientPhotoAction(initialState, uploadForm())).resolves.toEqual({
      status: 'success',
      message: 'Фотография клиента обновлена.',
      clientId: 'client-1',
    });

    expect(mocks.scanPendingUpload).toHaveBeenCalledOnce();
    expect(mocks.sharp).toHaveBeenCalledAfter(mocks.scanPendingUpload);
    expect(mocks.storage.promote).toHaveBeenCalledWith(
      expect.stringContaining('normalized-'),
      expect.stringMatching(/^companies\/company-1\/clients\/client-1\/photos\/.+\.webp$/),
    );
    expect(mocks.repository.clientPhotoUpload.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'photo-upload-1',
        uploadId: '123e4567-e89b-42d3-a456-426614174000',
        companyId: 'company-1',
        clientId: 'client-1',
        status: 'PENDING',
      },
      data: { leaseExpiresAt: expect.any(Date) },
    });
    const normalizedPutOrder = mocks.storage.putQuarantine.mock.invocationCallOrder.at(-1);
    const heartbeatIndex = mocks.repository.clientPhotoUpload.updateMany.mock.calls.findLastIndex(
      ([args]) =>
        'uploadId' in args.where &&
        args.where.uploadId === '123e4567-e89b-42d3-a456-426614174000' &&
        Object.keys(args.data).length === 1 &&
        'leaseExpiresAt' in args.data,
    );
    expect(
      mocks.repository.clientPhotoUpload.updateMany.mock.invocationCallOrder[heartbeatIndex],
    ).toBeLessThan(normalizedPutOrder!);
    expect(mocks.repository.client.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'client-1',
        companyId: 'company-1',
        photoPath: null,
        archivedAt: null,
      },
      data: { photoPath: expect.stringMatching(/\.webp$/), photoBytes: 15 },
    });
    expect(mocks.repository.clientPhotoUpload.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        uploadId: '123e4567-e89b-42d3-a456-426614174000',
        companyId: 'company-1',
        clientId: 'client-1',
        status: 'PENDING',
        leaseExpiresAt: expect.any(Date),
      }),
      select: { id: true },
    });
    expect(mocks.repository.clientPhotoUpload.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'photo-upload-1',
        companyId: 'company-1',
        clientId: 'client-1',
        status: 'CLEANUP_PENDING',
      }),
      data: expect.objectContaining({
        status: 'COMMITTED',
        leaseExpiresAt: null,
        committedAt: expect.any(Date),
      }),
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCAN', entityType: 'CLIENT', entityId: 'client-1' }),
      mocks.repository,
    );
  });

  it('compensates a promoted document when atomic database finalization fails', async () => {
    mocks.writeAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(uploadClientDocumentAction(initialState, uploadForm())).resolves.toEqual({
      status: 'error',
      message: 'Не удалось загрузить файл. Попробуйте позже.',
    });

    expect(mocks.storage.removePrivate).toHaveBeenCalledWith(
      'companies/company-1/clients/client-1/documents/document-1/1.jpg',
    );
    expect(mocks.repository.clientDocument.deleteMany).not.toHaveBeenCalled();
    expect(mocks.repository.clientDocumentVersion.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'version-1',
        documentId: 'document-1',
        uploadId: '123e4567-e89b-42d3-a456-426614174000',
        version: 1,
        scanVerdict: null,
        document: {
          companyId: 'company-1',
          clientId: 'client-1',
          archivedAt: null,
        },
      },
      data: expect.objectContaining({
        scanVerdict: 'ERROR',
        scanLeaseExpiresAt: expect.any(Date),
      }),
    });
  });

  it('preserves a committed normalized photo when transaction acknowledgement is lost', async () => {
    let committedPhotoPath: string | null = null;
    mocks.repository.client.updateMany.mockImplementationOnce(async (args) => {
      committedPhotoPath = args.data.photoPath;
      return { count: 1 };
    });
    mocks.repository.$transaction.mockImplementation(
      async (operation: (transaction: typeof mocks.repository) => unknown) => {
        const result = await operation(mocks.repository);
        if (committedPhotoPath) throw new Error('commit acknowledgement lost');
        return result;
      },
    );
    mocks.repository.client.findFirst
      .mockResolvedValueOnce({ id: 'client-1', companyId: 'company-1', photoPath: null })
      .mockResolvedValueOnce({
        id: 'client-1',
        companyId: 'company-1',
        photoPath:
          'companies/company-1/clients/client-1/photos/123e4567-e89b-42d3-a456-426614174000.webp',
      });

    await expect(uploadClientPhotoAction(initialState, uploadForm())).resolves.toEqual({
      status: 'success',
      message: 'Фотография клиента обновлена.',
      clientId: 'client-1',
    });

    expect(mocks.storage.removePrivate).not.toHaveBeenCalledWith(
      expect.stringMatching(/photos\/123e4567.*\.webp$/),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/clients/client-1');
  });

  it('не удаляет final photo при недоступной DB reread и оставляет durable lease', async () => {
    mocks.repository.client.updateMany.mockRejectedValueOnce(new Error('database unavailable'));
    mocks.repository.client.findFirst
      .mockResolvedValueOnce({ id: 'client-1', companyId: 'company-1', photoPath: null })
      .mockRejectedValueOnce(new Error('database still unavailable'));

    await expect(uploadClientPhotoAction(initialState, uploadForm())).resolves.toEqual({
      status: 'error',
      message: 'Не удалось загрузить файл. Попробуйте позже.',
    });

    expect(mocks.repository.clientPhotoUpload.create).toHaveBeenCalledOnce();
    expect(mocks.storage.removePrivate).not.toHaveBeenCalledWith(
      expect.stringMatching(/photos\/123e4567.*\.webp$/),
    );
  });

  it('audits a CLEAN photo scan before Sharp normalization can fail', async () => {
    mocks.sharpPipeline.toBuffer.mockRejectedValueOnce(new Error('sharp failed'));

    await expect(uploadClientPhotoAction(initialState, uploadForm())).resolves.toEqual({
      status: 'error',
      message: 'Не удалось загрузить файл. Попробуйте позже.',
    });

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SCAN',
        entityType: 'CLIENT',
        changes: expect.objectContaining({ verdict: 'CLEAN', signatureVersion: '27692' }),
      }),
      mocks.repository,
    );
    expect(mocks.storage.promote).not.toHaveBeenCalledWith(
      expect.stringContaining('normalized-'),
      expect.any(String),
    );
  });

  it('blocks an infected client photo before Sharp and audits only safe scan metadata', async () => {
    mocks.scanPendingUpload.mockResolvedValue({
      status: 'BLOCKED',
      audit: {
        sha256: 'b'.repeat(64),
        verdict: 'BLOCKED',
        signature: 'Eicar-Signature',
        engine: 'ClamAV',
        signatureVersion: '27692',
      },
    });

    await expect(uploadClientPhotoAction(initialState, uploadForm())).resolves.toMatchObject({
      status: 'error',
      message: 'Файл заблокирован антивирусом.',
    });

    expect(mocks.sharp).not.toHaveBeenCalled();
    expect(mocks.repository.client.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SCAN',
        entityType: 'CLIENT',
        changes: {
          sha256: 'b'.repeat(64),
          verdict: 'BLOCKED',
          signature: 'Eicar-Signature',
          signatureVersion: '27692',
        },
      }),
      mocks.repository,
    );
    const audit = JSON.stringify(mocks.writeAuditLog.mock.calls.at(-1)?.[0]);
    expect(audit).not.toContain('passport.jpg');
    expect(audit).not.toContain('storageKey');
    expect(audit).not.toContain('bytes');
  });
});

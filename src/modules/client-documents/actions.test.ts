import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const repository = {
    $transaction: vi.fn(),
    client: { findFirst: vi.fn(), updateMany: vi.fn() },
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
    reserveQuarantine: vi.fn(),
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
    sharp: vi.fn(),
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
vi.mock('sharp', () => ({ default: mocks.sharp }));

import { uploadClientDocumentAction, uploadClientPhotoAction } from './actions';

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
    });
    mocks.repository.clientDocumentVersion.findFirst.mockResolvedValue(null);
    mocks.repository.clientDocument.findFirst.mockResolvedValue({
      id: 'document-1',
      companyId: 'company-1',
      clientId: 'client-1',
      currentVersion: 1,
      status: 'CLEAN',
      versions: [{ version: 1 }],
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
    mocks.repository.$transaction.mockImplementation(
      async (operation: (transaction: typeof mocks.repository) => unknown) =>
        operation(mocks.repository),
    );
    mocks.storageCreate.mockResolvedValue(mocks.storage);
    mocks.storage.putQuarantine.mockResolvedValue(undefined);
    mocks.storage.promote.mockResolvedValue(undefined);
    mocks.storage.removePrivate.mockResolvedValue(undefined);
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
    mocks.writeAuditLog.mockResolvedValue(undefined);
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
        status: { not: 'ARCHIVED' },
      },
      select: expect.objectContaining({ currentVersion: true }),
    });
    expect(mocks.repository.clientDocument.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'document-1',
        companyId: 'company-1',
        clientId: 'client-1',
        currentVersion: 1,
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
    expect(mocks.repository.client.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'client-1',
        companyId: 'company-1',
        photoPath: null,
        archivedAt: null,
      },
      data: { photoPath: expect.stringMatching(/\.webp$/) },
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
    expect(mocks.repository.clientDocument.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        companyId: 'company-1',
        clientId: 'client-1',
        currentVersion: 1,
      },
    });
  });

  it('removes a promoted normalized photo when the client/audit transaction throws', async () => {
    mocks.writeAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(uploadClientPhotoAction(initialState, uploadForm())).resolves.toEqual({
      status: 'error',
      message: 'Не удалось загрузить файл. Попробуйте позже.',
    });

    expect(mocks.storage.removePrivate).toHaveBeenCalledWith(
      'companies/company-1/clients/client-1/photos/123e4567-e89b-42d3-a456-426614174000.webp',
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

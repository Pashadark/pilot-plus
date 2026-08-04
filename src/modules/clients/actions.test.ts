import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePathMock = vi.hoisted(() => vi.fn());
const getClientAccessMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());
const repository = vi.hoisted(() => ({
  client: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  companyMember: { findMany: vi.fn() },
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/database/prisma/client', () => ({ prisma: repository }));
vi.mock('@/modules/clients/access', () => ({ getClientAccess: getClientAccessMock }));
vi.mock('@/modules/admin/audit', () => ({ writeAuditLog: writeAuditLogMock }));

import { archiveClientAction, createClientAction, updateClientAction } from './actions';

const encryptionKey = Buffer.alloc(32, 19).toString('base64');
process.env.CLIENT_DATA_ENCRYPTION_KEY = encryptionKey;
process.env.CLIENT_SEARCH_KEY = 'clients-search-test-key';

const initialState = { status: 'idle' as const };
const dispatcherAccess = {
  user: {
    id: 'dispatcher-1',
    email: 'dispatcher@example.com',
    name: 'Диспетчер',
    role: 'MEMBER' as const,
    canAccessAdmin: false,
  },
  scope: 'COMPANY' as const,
  companyIds: ['c1'],
  canManage: true,
};

function clientForm(companyId = 'c1') {
  const formData = new FormData();
  formData.set('companyId', companyId);
  formData.set('firstName', 'Анна');
  formData.set('middleName', 'Сергеевна');
  formData.set('lastName', 'Воронова');
  formData.set('birthDate', '1990-04-12');
  formData.set('phone', '+7 (999) 123-45-67');
  formData.set('email', 'anna@example.com');
  formData.set('passport', '4510 123456');
  formData.set('driverLicense', '9910 654321');
  formData.set('driverLicenseIssuedAt', '2020-01-01');
  formData.set('driverLicenseExpiresAt', '2030-01-01');
  formData.set('status', 'VERIFIED');
  return formData;
}

function updateForm() {
  const formData = clientForm();
  formData.set('clientId', 'client-1');
  formData.set('expectedUpdatedAt', '2026-08-04T12:00:00.000Z');
  return formData;
}

function archiveForm() {
  const formData = new FormData();
  formData.set('clientId', 'client-1');
  formData.set('expectedUpdatedAt', '2026-08-04T12:00:00.000Z');
  return formData;
}

describe('client mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClientAccessMock.mockResolvedValue(dispatcherAccess);
    repository.client.create.mockResolvedValue({ id: 'client-1' });
    repository.client.updateMany.mockResolvedValue({ count: 1 });
    repository.companyMember.findMany.mockResolvedValue([]);
    repository.client.findFirst.mockResolvedValue({ companyId: 'c1' });
    writeAuditLogMock.mockResolvedValue(undefined);
  });

  it('allows a dispatcher to create only inside an authorized company and records safe audit metadata', async () => {
    await expect(createClientAction(initialState, clientForm())).resolves.toEqual({
      status: 'success',
      message: 'Клиент создан.',
      clientId: 'client-1',
    });

    expect(repository.client.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'c1',
        createdByUserId: 'dispatcher-1',
        phoneEncrypted: expect.any(String),
        phoneIndex: expect.any(String),
        passportEncrypted: expect.any(String),
        driverLicenseEncrypted: expect.any(String),
      }),
      select: { id: true },
    });
    expect(JSON.stringify(repository.client.create.mock.calls[0]?.[0])).not.toContain(
      '4510 123456',
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'CLIENT', action: 'CREATE', entityId: 'client-1' }),
    );
    expect(JSON.stringify(writeAuditLogMock.mock.calls[0]?.[0])).not.toContain('4510 123456');
    expect(revalidatePathMock).toHaveBeenCalledWith('/clients');
    expect(revalidatePathMock).toHaveBeenCalledWith('/clients/client-1');
  });

  it('rejects a submitted company outside the dispatcher tenant scope before writing', async () => {
    await expect(createClientAction(initialState, clientForm('c2'))).resolves.toEqual({
      status: 'error',
      message: 'Доступ к выбранной компании запрещён.',
    });
    expect(repository.client.create).not.toHaveBeenCalled();
  });

  it.each(['VIEWER', 'DRIVER'])('rejects a %s before any mutation', async () => {
    getClientAccessMock.mockResolvedValue(null);

    await expect(createClientAction(initialState, clientForm())).resolves.toEqual({
      status: 'error',
      message: 'Доступ к клиентам запрещён.',
    });
    expect(repository.client.create).not.toHaveBeenCalled();
  });

  it('returns a Russian duplicate-phone error without exposing Prisma details', async () => {
    repository.client.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['companyId', 'phoneIndex'] },
    });

    await expect(createClientAction(initialState, clientForm())).resolves.toEqual({
      status: 'error',
      message: 'Клиент с таким номером телефона уже существует.',
      fieldErrors: { phone: 'Клиент с таким номером телефона уже существует.' },
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('uses company and updatedAt guards for an edit before auditing and revalidating', async () => {
    await expect(updateClientAction(initialState, updateForm())).resolves.toMatchObject({
      status: 'success',
      clientId: 'client-1',
    });
    expect(repository.client.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'client-1',
        companyId: { in: ['c1'] },
        AND: { companyId: 'c1' },
        updatedAt: new Date('2026-08-04T12:00:00.000Z'),
        archivedAt: null,
      },
      data: expect.objectContaining({ phoneEncrypted: expect.any(String) }),
    });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'CLIENT', action: 'UPDATE', entityId: 'client-1' }),
    );
  });

  it('does not allow a dispatcher to archive a client', async () => {
    await expect(archiveClientAction(initialState, archiveForm())).resolves.toEqual({
      status: 'error',
      message: 'Архивировать клиентов может только администратор компании.',
    });
    expect(repository.client.updateMany).not.toHaveBeenCalled();
  });

  it('archives with an optimistic tenant guard only after resolving the administrator tenant', async () => {
    repository.companyMember.findMany.mockResolvedValue([{ companyId: 'c1' }]);

    await expect(archiveClientAction(initialState, archiveForm())).resolves.toMatchObject({
      status: 'success',
      clientId: 'client-1',
    });
    expect(repository.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'client-1', companyId: { in: ['c1'] }, archivedAt: null },
      select: { companyId: true },
    });
    expect(repository.client.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'client-1',
        companyId: { in: ['c1'] },
        updatedAt: new Date('2026-08-04T12:00:00.000Z'),
        archivedAt: null,
      },
      data: { status: 'ARCHIVED', archivedAt: expect.any(Date) },
    });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'CLIENT', action: 'ARCHIVE', companyId: 'c1' }),
    );
  });
});

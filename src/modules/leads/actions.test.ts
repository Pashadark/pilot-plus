import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePathMock = vi.hoisted(() => vi.fn());
const getClientAccessMock = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => ({
  lead: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  telegramGroupBinding: { findUnique: vi.fn() },
  telegramIdentity: { findFirst: vi.fn() },
  botNotificationJob: { createMany: vi.fn() },
}));
const repository = vi.hoisted(() => ({ $transaction: vi.fn() }));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/database/prisma/client', () => ({ prisma: repository }));
vi.mock('@/modules/clients/access', () => ({ getClientAccess: getClientAccessMock }));

import { createLeadAction, updateLeadStatusAction } from './actions';

const access = {
  user: {
    id: 'dispatcher-1',
    email: 'dispatcher@example.com',
    name: 'Диспетчер',
    role: 'MEMBER' as const,
    canAccessAdmin: false,
  },
  scope: 'COMPANY' as const,
  companyIds: ['company-1'],
  canManage: true,
};

const encryptionKey = Buffer.alloc(32, 19).toString('base64');
process.env.CLIENT_DATA_ENCRYPTION_KEY = encryptionKey;
process.env.CLIENT_SEARCH_KEY = 'lead-search-test-key';

function leadForm(companyId = 'company-1') {
  const formData = new FormData();
  formData.set('companyId', companyId);
  formData.set('name', 'Анна');
  formData.set('lastName', 'Петрова');
  formData.set('phone', '+7 (999) 123-45-67');
  formData.set('source', 'Авито');
  formData.set('comment', 'Нужна машина завтра');
  formData.set('nextContactAt', '2026-09-07T15:30');
  return formData;
}

function statusForm(status = 'CONTACTED') {
  const formData = new FormData();
  formData.set('leadId', 'lead-1');
  formData.set('status', status);
  return formData;
}

describe('lead actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClientAccessMock.mockResolvedValue(access);
    repository.$transaction.mockImplementation(
      async (operation: (tx: typeof transaction) => unknown) => operation(transaction),
    );
    transaction.lead.create.mockResolvedValue({ id: 'lead-1', companyId: 'company-1' });
    transaction.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      companyId: 'company-1',
      status: 'NEW',
    });
    transaction.lead.updateMany.mockResolvedValue({ count: 1 });
    transaction.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    transaction.telegramGroupBinding.findUnique.mockResolvedValue({
      telegramChatId: '-100777',
      boundByUserId: 'owner-1',
    });
    transaction.telegramIdentity.findFirst.mockResolvedValue({ id: 'identity-owner' });
    transaction.botNotificationJob.createMany.mockResolvedValue({ count: 2 });
  });

  it('creates the lead, audit and both notification jobs in one transaction', async () => {
    await expect(createLeadAction({ status: 'idle' }, leadForm())).resolves.toEqual({
      status: 'success',
      message: 'Заявка добавлена.',
    });

    expect(repository.$transaction).toHaveBeenCalledOnce();
    expect(transaction.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        name: 'Анна',
        lastName: 'Петрова',
        nextContactAt: new Date('2026-09-07T15:30:00'),
        assignedToUserId: 'dispatcher-1',
      }),
      select: { id: true, companyId: true },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        actorUserId: 'dispatcher-1',
        action: 'CREATE',
        entityType: 'SYSTEM',
        entityId: 'lead-1',
        entityLabel: 'LEAD',
      }),
      select: { id: true },
    });
    expect(transaction.botNotificationJob.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ template: 'LEAD_CREATED', chatId: '-100777' }),
        expect.objectContaining({ template: 'LEAD_CREATED', identityId: 'identity-owner' }),
      ],
      skipDuplicates: true,
    });
    expect(JSON.stringify(transaction.botNotificationJob.createMany.mock.calls)).not.toMatch(
      /Нужна машина|79991234567|Петрова/u,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/leads');
  });

  it('does not mutate, audit, notify or revalidate when the selected status is unchanged', async () => {
    transaction.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      companyId: 'company-1',
      status: 'CONTACTED',
    });

    await updateLeadStatusAction(statusForm('CONTACTED'));

    expect(transaction.lead.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
    expect(transaction.botNotificationJob.createMany).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('updates with tenant and previous-status guards before auditing and notifying', async () => {
    await updateLeadStatusAction(statusForm('QUALIFIED'));

    expect(transaction.lead.findFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', companyId: { in: ['company-1'] } },
      select: { id: true, companyId: true, status: true },
    });
    expect(transaction.lead.updateMany).toHaveBeenCalledWith({
      where: { id: 'lead-1', companyId: 'company-1', status: 'NEW' },
      data: { status: 'QUALIFIED' },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'UPDATE',
        changes: { status: { from: 'NEW', to: 'QUALIFIED' } },
      }),
      select: { id: true },
    });
    expect(transaction.botNotificationJob.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ template: 'LEAD_STATUS_CHANGED', chatId: '-100777' }),
        expect.objectContaining({
          template: 'LEAD_STATUS_CHANGED',
          identityId: 'identity-owner',
        }),
      ],
      skipDuplicates: true,
    });
  });
});

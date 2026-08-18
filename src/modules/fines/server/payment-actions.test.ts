import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireFineViewAccess = vi.hoisted(() => vi.fn());
const fineFindMany = vi.hoisted(() => vi.fn());
const integrationFindUnique = vi.hoisted(() => vi.fn());
const invoiceFindUnique = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const checkInvoice = vi.hoisted(() => vi.fn());
const createSandboxInvoice = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../access', () => ({
  requireFineViewAccess,
  FineAccessDeniedError: class FineAccessDeniedError extends Error {},
}));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    fine: { findMany: fineFindMany },
    fineIntegration: { findUnique: integrationFindUnique },
    fineInvoice: { findUnique: invoiceFindUnique },
    $transaction: transaction,
  },
}));
vi.mock('@/services/security/field-encryption', () => ({ decryptField: () => 'token' }));
vi.mock('../integrations/driver-helper/client', () => ({
  DriverHelperClient: class DriverHelperClient {
    checkInvoice = checkInvoice;
    createSandboxInvoice = createSandboxInvoice;
  },
}));

import { checkFinePaymentAction, createSandboxFineInvoiceAction } from './payment-actions';

function paymentForm(ids = ['fine-2', 'fine-1']) {
  const form = new FormData();
  form.set('companyId', 'company-1');
  for (const id of ids) form.append('fineIds', id);
  return form;
}

const access = {
  user: { id: 'admin-1', email: 'admin@example.test', role: 'MEMBER' as const },
  scope: 'COMPANY' as const,
  companyIds: ['company-1'],
  rolesByCompany: { 'company-1': 'COMPANY_ADMIN' as const },
};

const fines = [
  { id: 'fine-1', companyId: 'company-1', externalId: '17', status: 'UNPAID' },
  { id: 'fine-2', companyId: 'company-1', externalId: '29', status: 'NEW' },
];

describe('fine payment actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockReset();
    invoiceFindUnique.mockReset();
    createSandboxInvoice.mockReset();
    process.env.CLIENT_DATA_ENCRYPTION_KEY = 'test-key';
    process.env.FINE_PAYMENT_CALLBACK_BASE_URL = 'https://pilot.example.test';
    process.env.FINE_PAYMENT_STATE_SECRET = 'test-only-state-secret-with-at-least-thirty-two-bytes';
    requireFineViewAccess.mockResolvedValue(access);
    fineFindMany.mockResolvedValue(fines);
    integrationFindUnique.mockResolvedValue({ tokenEncrypted: 'encrypted', enabled: true });
    checkInvoice.mockResolvedValue({
      fineAmountMinor: '10000',
      commissionAmountMinor: '800',
      totalAmountMinor: '10800',
    });
  });

  it('checks canonical external IDs and returns exact minor-unit strings', async () => {
    await expect(checkFinePaymentAction(null, paymentForm())).resolves.toEqual({
      ok: true,
      fineIds: ['fine-1', 'fine-2'],
      fineAmountMinor: '10000',
      commissionAmountMinor: '800',
      totalAmountMinor: '10800',
      sandbox: true,
    });

    expect(requireFineViewAccess).toHaveBeenCalledWith('company-1');
    expect(checkInvoice).toHaveBeenCalledWith(['17', '29']);
  });

  it('denies a dispatcher before loading fines or calling Driver Helper', async () => {
    requireFineViewAccess.mockResolvedValue({
      ...access,
      rolesByCompany: { 'company-1': 'DISPATCHER' },
    });

    await expect(checkFinePaymentAction(null, paymentForm())).resolves.toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    expect(fineFindMany).not.toHaveBeenCalled();
    expect(checkInvoice).not.toHaveBeenCalled();
  });

  it.each([
    [[], 'VALIDATION'],
    [['fine-1', 'fine-1'], 'VALIDATION'],
    [Array.from({ length: 51 }, (_, index) => `fine-${index}`), 'VALIDATION'],
  ])('rejects invalid selected IDs before authorization', async (ids, code) => {
    await expect(checkFinePaymentAction(null, paymentForm(ids))).resolves.toMatchObject({
      ok: false,
      code,
    });
    expect(requireFineViewAccess).not.toHaveBeenCalled();
  });

  it.each([
    [[fines[0]], 'missing tenant fine'],
    [[fines[0], { ...fines[1], status: 'PAID' }], 'paid fine'],
    [[fines[0], { ...fines[1], status: 'CANCELLED' }], 'cancelled fine'],
  ])('rejects %s before the external API', async (loaded) => {
    fineFindMany.mockResolvedValue(loaded);
    await expect(checkFinePaymentAction(null, paymentForm())).resolves.toMatchObject({
      ok: false,
      code: 'NOT_PAYABLE',
    });
    expect(checkInvoice).not.toHaveBeenCalled();
  });

  it('persists PENDING serializably before the external create and settles CREATED atomically', async () => {
    const events: string[] = [];
    const database = {
      fineInvoice: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(async () => {
          events.push('pending');
          return { id: 'invoice-1', status: 'PENDING' };
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    transaction.mockImplementation(
      async (operation: (client: typeof database) => Promise<unknown>) => operation(database),
    );
    createSandboxInvoice.mockImplementation(async () => {
      events.push('external');
      return {
        providerInvoiceId: 'provider-1',
        paymentUrl: 'https://pay.driver-helper.ru/invoices/provider-1',
        paymentHost: 'pay.driver-helper.ru',
        fineAmountMinor: '10000',
        commissionAmountMinor: '800',
        totalAmountMinor: '10800',
      };
    });

    await expect(createSandboxFineInvoiceAction(null, paymentForm())).resolves.toMatchObject({
      ok: true,
      invoiceId: 'invoice-1',
      paymentUrl: 'https://pay.driver-helper.ru/invoices/provider-1',
      reused: false,
    });

    expect(events).toEqual(['pending', 'external']);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(database.fineInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-1',
          status: 'PENDING',
          sandbox: true,
          fineAmountMinor: BigInt(10000),
          items: {
            create: [
              { companyId: 'company-1', fineId: 'fine-1' },
              { companyId: 'company-1', fineId: 'fine-2' },
            ],
          },
        }),
      }),
    );
    expect(database.fineInvoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'invoice-1', companyId: 'company-1', status: 'PENDING' },
      data: expect.objectContaining({
        status: 'CREATED',
        providerInvoiceId: 'provider-1',
        paymentHost: 'pay.driver-helper.ru',
      }),
    });
    expect(JSON.stringify(database.auditLog.create.mock.calls)).not.toContain('paymentUrl');
    expect(JSON.stringify(database.auditLog.create.mock.calls)).not.toContain('state');
  });

  it('converges on the active invoice after a P2002 race without a second external call', async () => {
    transaction.mockRejectedValueOnce({ code: 'P2002' });
    invoiceFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'invoice-existing', status: 'CREATED' });

    await expect(createSandboxFineInvoiceAction(null, paymentForm())).resolves.toEqual({
      ok: true,
      invoiceId: 'invoice-existing',
      paymentUrl: null,
      reused: true,
    });
    expect(createSandboxInvoice).not.toHaveBeenCalled();
  });

  it('reuses an active canonical invoice before making any Driver Helper call', async () => {
    invoiceFindUnique.mockResolvedValue({ id: 'invoice-existing', status: 'CREATED' });
    checkInvoice.mockRejectedValue(new Error('provider unavailable'));

    await expect(createSandboxFineInvoiceAction(null, paymentForm())).resolves.toEqual({
      ok: true,
      invoiceId: 'invoice-existing',
      paymentUrl: null,
      reused: true,
    });
    expect(checkInvoice).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('settles a persisted PENDING invoice to ERROR atomically when external create fails', async () => {
    const database = {
      fineInvoice: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'invoice-1', status: 'PENDING' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    transaction.mockImplementation(
      async (operation: (client: typeof database) => Promise<unknown>) => operation(database),
    );
    createSandboxInvoice.mockRejectedValue(new Error('must not leak'));

    await expect(createSandboxFineInvoiceAction(null, paymentForm())).resolves.toMatchObject({
      ok: false,
      code: 'PAYMENT_UNAVAILABLE',
    });

    expect(database.fineInvoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'invoice-1', companyId: 'company-1', status: 'PENDING' },
      data: { status: 'ERROR' },
    });
    expect(database.auditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        changes: expect.objectContaining({ status: 'ERROR', sandbox: true }),
      }),
      select: { id: true },
    });
  });
});

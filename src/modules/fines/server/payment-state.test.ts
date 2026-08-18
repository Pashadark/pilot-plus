import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/database/prisma/client', () => ({ prisma: { $transaction: transaction } }));

import {
  consumeFinePaymentCallback,
  createFinePaymentState,
  verifyFinePaymentState,
} from './payment-state';

const secret = 'test-only-state-secret-with-at-least-thirty-two-bytes';
const issuedAt = new Date('2026-08-18T10:00:00.000Z');

describe('fine payment callback state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('round-trips a canonical signed state without PII or payment data', () => {
    const state = createFinePaymentState(
      {
        companyId: 'company-1',
        invoiceId: 'invoice-1',
        userId: 'user-1',
        outcome: 'success',
        nonce: 'nonce-1',
        expiresAt: new Date('2026-08-18T10:10:00.000Z'),
      },
      secret,
    );

    expect(state).not.toContain('company-1');
    expect(state).not.toContain('@');
    expect(
      verifyFinePaymentState(state, {
        secret,
        expectedOutcome: 'success',
        now: issuedAt,
      }),
    ).toEqual({
      companyId: 'company-1',
      invoiceId: 'invoice-1',
      userId: 'user-1',
      outcome: 'success',
      nonce: 'nonce-1',
      expiresAt: new Date('2026-08-18T10:10:00.000Z'),
    });
  });

  it('consumes CREATED exactly once and audits invoice data without changing fines', async () => {
    const database = {
      fineInvoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'invoice-1',
          fineAmountMinor: BigInt(10000),
          commissionAmountMinor: BigInt(800),
          totalAmountMinor: BigInt(10800),
          sandbox: true,
          items: [{ fineId: 'fine-1' }],
        }),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    transaction.mockImplementation(
      async (operation: (client: typeof database) => Promise<unknown>) => operation(database),
    );
    const state = {
      companyId: 'company-1',
      invoiceId: 'invoice-1',
      userId: 'user-1',
      outcome: 'success' as const,
      nonce: 'nonce-1',
      expiresAt: new Date('2026-08-18T10:10:00.000Z'),
    };
    const options = {
      actor: { id: 'user-1', email: 'admin@example.test' },
      status: 'SUCCEEDED' as const,
    };

    await expect(consumeFinePaymentCallback(state, options)).resolves.toBe(true);
    await expect(consumeFinePaymentCallback(state, options)).resolves.toBe(false);

    expect(database.fineInvoice.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'invoice-1',
        companyId: 'company-1',
        initiatedByUserId: 'user-1',
        status: 'CREATED',
        sandbox: true,
      },
      data: { status: 'SUCCEEDED' },
    });
    expect(database.auditLog.create).toHaveBeenCalledTimes(1);
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changes: {
          status: 'SUCCEEDED',
          fineIds: ['fine-1'],
          fineCount: 1,
          fineAmountMinor: '10000',
          commissionAmountMinor: '800',
          totalAmountMinor: '10800',
          sandbox: true,
        },
      }),
      select: { id: true },
    });
    expect(database).not.toHaveProperty('fine');
  });

  it('rejects tampering, expiry, an outcome swap and malformed input', () => {
    const state = createFinePaymentState(
      {
        companyId: 'company-1',
        invoiceId: 'invoice-1',
        userId: 'user-1',
        outcome: 'success',
        nonce: 'nonce-1',
        expiresAt: new Date('2026-08-18T10:10:00.000Z'),
      },
      secret,
    );

    expect(
      verifyFinePaymentState(`${state.slice(0, -1)}x`, {
        secret,
        expectedOutcome: 'success',
        now: issuedAt,
      }),
    ).toBeNull();
    expect(
      verifyFinePaymentState(state, {
        secret,
        expectedOutcome: 'fail',
        now: issuedAt,
      }),
    ).toBeNull();
    expect(
      verifyFinePaymentState(state, {
        secret,
        expectedOutcome: 'success',
        now: new Date('2026-08-18T10:10:00.001Z'),
      }),
    ).toBeNull();
    expect(
      verifyFinePaymentState('not-a-state', {
        secret,
        expectedOutcome: 'success',
        now: issuedAt,
      }),
    ).toBeNull();
  });
});

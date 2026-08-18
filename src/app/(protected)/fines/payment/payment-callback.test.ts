import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireFinePaymentAccess = vi.hoisted(() => vi.fn());
const consumeFinePaymentCallback = vi.hoisted(() => vi.fn());
const verifyFinePaymentState = vi.hoisted(() => vi.fn());

vi.mock('@/modules/fines/server/payment-actions', () => ({ requireFinePaymentAccess }));
vi.mock('@/modules/fines/server/payment-state', () => ({
  consumeFinePaymentCallback,
  verifyFinePaymentState,
}));

import { GET as failCallback } from './fail/route';
import { GET as successCallback } from './success/route';

const verified = {
  companyId: 'company-1',
  invoiceId: 'invoice-1',
  userId: 'admin-1',
  outcome: 'success' as const,
  nonce: 'nonce-1',
  expiresAt: new Date('2026-08-18T10:10:00.000Z'),
};

describe('fine payment callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FINE_PAYMENT_STATE_SECRET = 'test-only-state-secret-with-at-least-thirty-two-bytes';
    process.env.FINE_PAYMENT_CALLBACK_BASE_URL = 'https://pilot.example.test';
    verifyFinePaymentState.mockReturnValue(verified);
    requireFinePaymentAccess.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.test' },
    });
    consumeFinePaymentCallback.mockResolvedValue(true);
  });

  it('freshly authorizes and consumes a success state before a safe redirect', async () => {
    const response = await successCallback(
      new Request('https://pilot.example.test/fines/payment/success?state=signed'),
    );

    expect(verifyFinePaymentState).toHaveBeenCalledWith('signed', {
      secret: process.env.FINE_PAYMENT_STATE_SECRET,
      expectedOutcome: 'success',
    });
    expect(requireFinePaymentAccess).toHaveBeenCalledWith('company-1');
    expect(consumeFinePaymentCallback).toHaveBeenCalledWith(verified, {
      actor: { id: 'admin-1' },
      status: 'RETURNED_PENDING_CHECK',
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://pilot.example.test/fines?companyId=company-1&payment=returned',
    );
  });

  it('rejects tampered, expired or reused state with a safe redirect', async () => {
    verifyFinePaymentState.mockReturnValue(null);
    const invalid = await successCallback(
      new Request('https://pilot.example.test/fines/payment/success?state=tampered'),
    );
    expect(invalid.headers.get('location')).toBe(
      'https://pilot.example.test/fines?payment=invalid',
    );
    expect(requireFinePaymentAccess).not.toHaveBeenCalled();

    verifyFinePaymentState.mockReturnValue(verified);
    consumeFinePaymentCallback.mockResolvedValue(false);
    const reused = await successCallback(
      new Request('https://pilot.example.test/fines/payment/success?state=signed'),
    );
    expect(reused.headers.get('location')).toBe('https://pilot.example.test/fines?payment=invalid');
  });

  it('uses an outcome-bound fail state and marks only the invoice failed', async () => {
    const failedState = { ...verified, outcome: 'fail' as const };
    verifyFinePaymentState.mockReturnValue(failedState);

    const response = await failCallback(
      new Request('https://pilot.example.test/fines/payment/fail?state=signed-fail'),
    );

    expect(verifyFinePaymentState).toHaveBeenCalledWith('signed-fail', {
      secret: process.env.FINE_PAYMENT_STATE_SECRET,
      expectedOutcome: 'fail',
    });
    expect(consumeFinePaymentCallback).toHaveBeenCalledWith(failedState, {
      actor: { id: 'admin-1' },
      status: 'FAILED',
    });
    expect(response.headers.get('location')).toBe(
      'https://pilot.example.test/fines?companyId=company-1&payment=failed',
    );
  });

  it('redirects only to the configured trusted origin even with a hostile request Host', async () => {
    process.env.FINE_PAYMENT_CALLBACK_BASE_URL = 'https://pilot.example.test';

    const response = await successCallback(
      new Request('https://attacker.example.test/fines/payment/success?state=signed'),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://pilot.example.test/fines?companyId=company-1&payment=returned',
    );
  });

  it('returns 503 without redirect when the trusted callback base is missing', async () => {
    delete process.env.FINE_PAYMENT_CALLBACK_BASE_URL;

    const response = await successCallback(
      new Request('https://attacker.example.test/fines/payment/success?state=signed'),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
    expect(requireFinePaymentAccess).not.toHaveBeenCalled();
    expect(consumeFinePaymentCallback).not.toHaveBeenCalled();
  });

  it('returns 400 without redirect when the trusted callback base is invalid', async () => {
    process.env.FINE_PAYMENT_CALLBACK_BASE_URL = 'https://user:password@pilot.example.test/path';

    const response = await failCallback(
      new Request('https://attacker.example.test/fines/payment/fail?state=signed-fail'),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
    expect(requireFinePaymentAccess).not.toHaveBeenCalled();
    expect(consumeFinePaymentCallback).not.toHaveBeenCalled();
  });
});

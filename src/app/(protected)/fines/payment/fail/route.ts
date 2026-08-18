import { requireFinePaymentAccess } from '@/modules/fines/server/payment-actions';
import {
  consumeFinePaymentCallback,
  verifyFinePaymentState,
} from '@/modules/fines/server/payment-state';

import { paymentResultRedirect, trustedPaymentBase } from '../payment-redirect';

export async function GET(request: Request) {
  const configuredBase = trustedPaymentBase();
  if (!configuredBase.ok) return configuredBase.response;

  const state = verifyFinePaymentState(new URL(request.url).searchParams.get('state'), {
    secret: process.env.FINE_PAYMENT_STATE_SECRET,
    expectedOutcome: 'fail',
  });
  if (!state) return paymentResultRedirect(configuredBase.base, 'invalid');

  try {
    const access = await requireFinePaymentAccess(state.companyId);
    if (access.user.id !== state.userId) {
      return paymentResultRedirect(configuredBase.base, 'invalid');
    }
    const consumed = await consumeFinePaymentCallback(state, {
      actor: { id: access.user.id },
      status: 'FAILED',
    });
    return consumed
      ? paymentResultRedirect(configuredBase.base, 'failed', state.companyId)
      : paymentResultRedirect(configuredBase.base, 'invalid');
  } catch {
    return paymentResultRedirect(configuredBase.base, 'invalid');
  }
}

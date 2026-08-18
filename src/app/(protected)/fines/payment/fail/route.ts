import { NextResponse } from 'next/server';

import { requireFinePaymentAccess } from '@/modules/fines/server/payment-actions';
import {
  consumeFinePaymentCallback,
  verifyFinePaymentState,
} from '@/modules/fines/server/payment-state';

function redirect(request: Request, result: 'failed' | 'invalid', companyId?: string) {
  const base = process.env.FINE_PAYMENT_CALLBACK_BASE_URL ?? new URL(request.url).origin;
  const destination = new URL('/fines', base);
  if (companyId) destination.searchParams.set('companyId', companyId);
  destination.searchParams.set('payment', result);
  return NextResponse.redirect(destination, 303);
}

export async function GET(request: Request) {
  const state = verifyFinePaymentState(new URL(request.url).searchParams.get('state'), {
    secret: process.env.FINE_PAYMENT_STATE_SECRET,
    expectedOutcome: 'fail',
  });
  if (!state) return redirect(request, 'invalid');

  try {
    const access = await requireFinePaymentAccess(state.companyId);
    if (access.user.id !== state.userId) return redirect(request, 'invalid');
    const consumed = await consumeFinePaymentCallback(state, {
      actor: { id: access.user.id, email: access.user.email },
      status: 'FAILED',
    });
    return consumed ? redirect(request, 'failed', state.companyId) : redirect(request, 'invalid');
  } catch {
    return redirect(request, 'invalid');
  }
}

import 'server-only';

import { NextResponse } from 'next/server';

type PaymentResult = 'success' | 'failed' | 'invalid';

export type TrustedPaymentBaseResult = { ok: true; base: URL } | { ok: false; response: Response };

function configurationResponse(status: 400 | 503): Response {
  return new Response(null, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export function trustedPaymentBase(): TrustedPaymentBaseResult {
  const configured = process.env.FINE_PAYMENT_CALLBACK_BASE_URL?.trim();
  if (!configured) return { ok: false, response: configurationResponse(503) };

  try {
    const base = new URL(configured);
    const localDevelopmentOrigin =
      process.env.NODE_ENV !== 'production' &&
      base.protocol === 'http:' &&
      (base.hostname === '127.0.0.1' || base.hostname === 'localhost');
    const trustedHttpsOrigin = base.protocol === 'https:' && !base.port;
    if (
      (!trustedHttpsOrigin && !localDevelopmentOrigin) ||
      base.username ||
      base.password ||
      base.pathname !== '/' ||
      base.search ||
      base.hash
    ) {
      return { ok: false, response: configurationResponse(400) };
    }
    return { ok: true, base };
  } catch {
    return { ok: false, response: configurationResponse(400) };
  }
}

export function paymentResultRedirect(
  base: URL,
  result: PaymentResult,
  companyId?: string,
): Response {
  const destination = new URL('/fines', base);
  if (companyId) destination.searchParams.set('companyId', companyId);
  destination.searchParams.set('payment', result);
  return NextResponse.redirect(destination, 303);
}

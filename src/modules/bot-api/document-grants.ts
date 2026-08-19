import { createHmac, timingSafeEqual } from 'node:crypto';

import { BotApiError } from './auth';

export interface RentalDocumentGrantClaims {
  companyId: string;
  clientId: string;
  rentalId: string;
  version: number;
  format: 'DOCX' | 'PDF';
  expiresAt: number;
}

function secret(): string {
  const value = process.env.PILOT_BOT_INVITE_SECRET;
  if (!value || value.length < 24) throw new BotApiError('SERVICE_UNAVAILABLE', 503);
  return value;
}

function payload(claims: RentalDocumentGrantClaims): string {
  return `${claims.companyId}:${claims.clientId}:${claims.rentalId}:${claims.version}:${claims.format}:${claims.expiresAt}`;
}

export function signRentalDocumentGrant(claims: RentalDocumentGrantClaims): string {
  return createHmac('sha256', secret()).update(payload(claims)).digest('base64url');
}

export function verifyRentalDocumentGrant(
  claims: RentalDocumentGrantClaims,
  provided: string,
  now = Date.now(),
): void {
  if (
    !Number.isSafeInteger(claims.expiresAt) ||
    claims.expiresAt <= now ||
    claims.expiresAt > now + 5 * 60 * 1000
  ) {
    throw new BotApiError('NOT_FOUND', 404);
  }
  const expected = Buffer.from(signRentalDocumentGrant(claims), 'utf8');
  const candidate = Buffer.from(provided, 'utf8');
  if (expected.length !== candidate.length || !timingSafeEqual(expected, candidate)) {
    throw new BotApiError('NOT_FOUND', 404);
  }
}

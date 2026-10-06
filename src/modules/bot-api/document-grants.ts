import { createHmac, timingSafeEqual } from 'node:crypto';

import { BotApiError } from './auth';
import { prisma } from '@/database/prisma/client';

export interface RentalDocumentGrantClaims {
  identityId: string;
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
  return `${claims.identityId}:${claims.companyId}:${claims.clientId}:${claims.rentalId}:${claims.version}:${claims.format}:${claims.expiresAt}`;
}

export async function authorizeRentalDocumentGrant(
  claims: RentalDocumentGrantClaims,
  provided: string,
  database: Pick<typeof prisma, 'telegramIdentity'> = prisma,
) {
  verifyRentalDocumentGrant(claims, provided);
  const identity = await database.telegramIdentity.findFirst({
    where: {
      id: claims.identityId,
      companyId: claims.companyId,
      clientId: claims.clientId,
      kind: 'CLIENT',
      isActive: true,
      client: {
        is: {
          archivedAt: null,
          status: { notIn: ['BLOCKED', 'ARCHIVED'] },
          rentals: { some: { id: claims.rentalId, companyId: claims.companyId } },
        },
      },
    },
    select: { id: true },
  });
  if (!identity) throw new BotApiError('NOT_FOUND', 404);
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

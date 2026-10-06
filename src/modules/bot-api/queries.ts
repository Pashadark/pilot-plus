import { prisma } from '@/database/prisma/client';

import { BotApiError } from './auth';
import { signRentalDocumentGrant } from './document-grants';

export interface BotIdentityContext {
  identityId: string;
  telegramUserId: string;
  kind: 'CLIENT' | 'STAFF';
  companyId: string;
  clientId: string | null;
  userId: string | null;
  displayName: string;
}

export interface BotRentalSummary {
  id: string;
  contractNumber: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  vehicle: { make: string; model: string; registrationNumber: string };
  totalPriceMinor: string;
  depositMinor: string | null;
  documentsReady: boolean;
}

type IdentityDb = Pick<typeof prisma, 'telegramIdentity' | 'companyMember'>;
type RentalDb = Pick<typeof prisma, 'rental'>;

export async function resolveBotIdentity(
  telegramUserId: string,
  database: IdentityDb = prisma,
): Promise<BotIdentityContext> {
  if (!/^[1-9]\d{0,19}$/u.test(telegramUserId)) throw new BotApiError('IDENTITY_REQUIRED', 401);
  const identities = await database.telegramIdentity.findMany({
    take: 2,
    where: {
      telegramUserId,
      isActive: true,
      OR: [
        {
          kind: 'CLIENT',
          client: { is: { archivedAt: null, status: { notIn: ['BLOCKED', 'ARCHIVED'] } } },
        },
        { kind: 'STAFF', user: { is: { isActive: true } } },
      ],
    },
    select: {
      id: true,
      companyId: true,
      telegramUserId: true,
      kind: true,
      clientId: true,
      userId: true,
      client: { select: { firstName: true, lastName: true } },
      user: { select: { name: true, role: true } },
    },
  });
  if (identities.length !== 1) throw new BotApiError('IDENTITY_REQUIRED', 401);
  const identity = identities[0];
  if (identity.kind === 'STAFF' && identity.user?.role !== 'SUPER_ADMIN') {
    if (!identity.userId) throw new BotApiError('FORBIDDEN', 403);
    const membership = await database.companyMember.findFirst({
      where: { companyId: identity.companyId, userId: identity.userId },
      select: { role: true },
    });
    if (!membership || !['COMPANY_ADMIN', 'DISPATCHER'].includes(membership.role))
      throw new BotApiError('FORBIDDEN', 403);
  }
  return {
    identityId: identity.id,
    telegramUserId: identity.telegramUserId,
    kind: identity.kind,
    companyId: identity.companyId,
    clientId: identity.clientId,
    userId: identity.userId,
    displayName:
      identity.kind === 'CLIENT'
        ? `${identity.client?.firstName ?? ''} ${identity.client?.lastName ?? ''}`.trim()
        : (identity.user?.name ?? ''),
  };
}

function requireClient(identity: BotIdentityContext): string {
  if (identity.kind !== 'CLIENT' || !identity.clientId) throw new BotApiError('FORBIDDEN', 403);
  return identity.clientId;
}

export async function listClientRentals(
  identity: BotIdentityContext,
  database: RentalDb = prisma,
): Promise<BotRentalSummary[]> {
  const clientId = requireClient(identity);
  const rentals = await database.rental.findMany({
    where: { companyId: identity.companyId, clientId },
    orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    take: 50,
    select: {
      id: true,
      contractNumber: true,
      status: true,
      startsAt: true,
      endsAt: true,
      totalPriceMinor: true,
      depositMinor: true,
      vehicle: { select: { make: true, modelName: true, model: true, registrationNumber: true } },
      documentGenerations: { where: { status: 'COMMITTED' }, select: { status: true }, take: 1 },
    },
  });
  return rentals.map((rental) => ({
    id: rental.id,
    contractNumber: rental.contractNumber,
    status: rental.status,
    startsAt: rental.startsAt.toISOString(),
    endsAt: rental.endsAt.toISOString(),
    vehicle: {
      make: rental.vehicle.make ?? '',
      model: rental.vehicle.modelName ?? rental.vehicle.model,
      registrationNumber: rental.vehicle.registrationNumber ?? '',
    },
    totalPriceMinor: rental.totalPriceMinor.toString(),
    depositMinor: rental.depositMinor?.toString() ?? null,
    documentsReady: rental.documentGenerations.length > 0,
  }));
}

export async function createRentalDocumentGrant(
  identity: BotIdentityContext,
  rentalId: string,
  database: RentalDb = prisma,
): Promise<{ url: string; expiresAt: string }[]> {
  const clientId = requireClient(identity);
  const rental = await database.rental.findFirst({
    where: { id: rentalId, companyId: identity.companyId, clientId },
    select: {
      id: true,
      documentGenerations: {
        where: { status: 'COMMITTED' },
        orderBy: { version: 'desc' },
        take: 1,
        select: { version: true },
      },
    },
  });
  if (!rental?.documentGenerations[0]) throw new BotApiError('NOT_FOUND', 404);
  const secret = process.env.PILOT_BOT_INVITE_SECRET;
  const base = process.env.PILOT_BOT_API_BASE_URL;
  if (!secret || secret.length < 24 || !base) throw new BotApiError('SERVICE_UNAVAILABLE', 503);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  return ['DOCX', 'PDF'].map((format) => {
    const grant = signRentalDocumentGrant({
      identityId: identity.identityId,
      companyId: identity.companyId,
      clientId,
      rentalId: rental.id,
      version: rental.documentGenerations[0]!.version,
      format: format as 'DOCX' | 'PDF',
      expiresAt: expiresAt.getTime(),
    });
    const path = `/api/bot/v1/rentals/${rental.id}/documents/${rental.documentGenerations[0]!.version}/${format.toLowerCase()}`;
    const url = new URL(path, base);
    url.searchParams.set('expires', String(expiresAt.getTime()));
    url.searchParams.set('grant', grant);
    url.searchParams.set('identity', identity.identityId);
    return { url: url.toString(), expiresAt: expiresAt.toISOString() };
  });
}

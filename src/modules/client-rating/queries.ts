import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { ClientAccess } from '@/modules/clients/access';

import { calculateClientRating } from './domain/rating';
import type { ClientRatingSummary } from './types';

type RatingEventRecord = {
  id: string;
  delta: number;
  type: string;
  reason: string;
  createdAt: Date;
};

type RatingClientRecord = {
  id: string;
  _count: { rentals: number };
  ratingEvents: RatingEventRecord[];
  comments?: Array<{ severity: string }>;
};

type ClientRatingReadRepository = {
  findFirst(args: unknown): Promise<RatingClientRecord | null>;
};

type ClientRatingsListRepository = {
  findMany(args: unknown): Promise<RatingClientRecord[]>;
};

export type ClientRatingEventDto = Readonly<{
  id: string;
  delta: number;
  type: string;
  reason: string;
  createdAt: string;
}>;

export type ClientRatingDto = Readonly<
  ClientRatingSummary & {
    openProblemCount: number;
    events: readonly ClientRatingEventDto[];
  }
>;

export function scopedClientWhere(access: ClientAccess, clientId?: string) {
  return {
    ...(clientId ? { id: clientId } : {}),
    ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
  };
}

function summaryFor(client: RatingClientRecord): ClientRatingSummary {
  return calculateClientRating(client.ratingEvents, client._count.rentals);
}

function mapClientRating(client: RatingClientRecord): ClientRatingDto {
  return {
    ...summaryFor(client),
    openProblemCount: client.comments?.length ?? 0,
    events: client.ratingEvents.map((event) => ({
      id: event.id,
      delta: event.delta,
      type: event.type,
      reason: event.reason,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

const ratingEventsSelect = {
  id: true,
  delta: true,
  type: true,
  reason: true,
  createdAt: true,
};

export async function getClientRating(
  access: ClientAccess,
  clientId: string,
  repository: ClientRatingReadRepository = prisma.client as unknown as ClientRatingReadRepository,
): Promise<ClientRatingDto | null> {
  const client = await repository.findFirst({
    where: scopedClientWhere(access, clientId),
    select: {
      id: true,
      _count: { select: { rentals: { where: { status: 'COMPLETED' } } } },
      ratingEvents: { select: ratingEventsSelect, orderBy: { createdAt: 'desc' } },
      comments: { where: { hiddenAt: null, problemStatus: 'OPEN' }, select: { severity: true } },
    },
  });
  return client ? mapClientRating(client) : null;
}

export async function listClientRatings(
  access: ClientAccess,
  clientIds: readonly string[],
  repository: ClientRatingsListRepository = prisma.client as unknown as ClientRatingsListRepository,
): Promise<Map<string, ClientRatingSummary>> {
  const requestedIds = [...new Set(clientIds)];
  if (requestedIds.length === 0) return new Map();

  const clients = await repository.findMany({
    where: { ...scopedClientWhere(access), id: { in: requestedIds } },
    select: {
      id: true,
      _count: { select: { rentals: { where: { status: 'COMPLETED' } } } },
      ratingEvents: { select: { delta: true } },
    },
  });
  return new Map(clients.map((client) => [client.id, summaryFor(client)]));
}

import { z } from 'zod';

import { prisma } from '@/database/prisma/client';
import { encryptField } from '@/services/security/field-encryption';

import { BotApiError } from './auth';
import type { BotIdentityContext } from './queries';

export const botRentalRequestSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    preferredVehicleId: z.string().min(1).max(128).nullable(),
    fulfillmentMode: z.enum(['OFFICE', 'DELIVERY']),
    deliveryAddress: z.string().trim().min(5).max(500).nullable(),
    comment: z.string().trim().max(1000).nullable(),
    rentalId: z.string().min(1).max(128).nullable(),
  })
  .superRefine((value, context) => {
    if (new Date(value.startsAt) >= new Date(value.endsAt)) {
      context.addIssue({ code: 'custom', path: ['endsAt'], message: 'INVALID_INTERVAL' });
    }
    if ((value.fulfillmentMode === 'DELIVERY') !== Boolean(value.deliveryAddress)) {
      context.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'INVALID_DELIVERY' });
    }
  });

export type BotRentalRequestInput = z.infer<typeof botRentalRequestSchema>;
type RequestDb = Pick<typeof prisma, '$transaction'>;
type AvailabilityDb = Pick<typeof prisma, 'vehicle'>;

export async function listBotAvailability(
  identity: BotIdentityContext,
  startsAt: Date,
  endsAt: Date,
  database: AvailabilityDb = prisma,
) {
  if (identity.kind !== 'CLIENT' || !identity.clientId || startsAt >= endsAt) {
    throw new BotApiError('INVALID_REQUEST', 400);
  }
  const vehicles = await database.vehicle.findMany({
    where: {
      companyId: identity.companyId,
      archivedAt: null,
      isRentalReady: true,
      status: { not: 'MAINTENANCE' },
      rentals: {
        none: {
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      },
      maintenanceRecords: {
        none: {
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          scheduledAt: { lt: endsAt },
          scheduledEndsAt: { gt: startsAt },
        },
      },
    },
    orderBy: [{ make: 'asc' }, { modelName: 'asc' }, { registrationNumber: 'asc' }],
    take: 100,
    select: {
      id: true,
      make: true,
      modelName: true,
      model: true,
      registrationNumber: true,
      dailyPriceMinor: true,
      depositMinor: true,
    },
  });
  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    make: vehicle.make ?? '',
    model: vehicle.modelName ?? vehicle.model,
    registrationNumber: vehicle.registrationNumber ?? '',
    dailyPriceMinor: String(vehicle.dailyPriceMinor),
    depositMinor: vehicle.depositMinor?.toString() ?? null,
  }));
}

function dto(request: {
  id: string;
  companyId: string;
  clientId: string;
  rentalId: string | null;
  preferredVehicleId: string | null;
  startsAt: Date;
  endsAt: Date;
  fulfillmentMode: 'OFFICE' | 'DELIVERY';
  status: string;
  createdAt: Date;
}) {
  return {
    id: request.id,
    companyId: request.companyId,
    clientId: request.clientId,
    rentalId: request.rentalId,
    preferredVehicleId: request.preferredVehicleId,
    startsAt: request.startsAt.toISOString(),
    endsAt: request.endsAt.toISOString(),
    fulfillmentMode: request.fulfillmentMode,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
  };
}

export async function createBotRentalRequest(
  identity: BotIdentityContext,
  rawInput: BotRentalRequestInput,
  idempotencyKey: string,
  database: RequestDb = prisma,
) {
  const parsed = botRentalRequestSchema.safeParse(rawInput);
  if (
    !parsed.success ||
    identity.kind !== 'CLIENT' ||
    !identity.clientId ||
    !/^[A-Za-z0-9_-]{8,128}$/u.test(idempotencyKey)
  ) {
    throw new BotApiError('INVALID_REQUEST', 400);
  }
  const input = parsed.data;
  const clientId = identity.clientId;
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if ((input.deliveryAddress || input.comment) && !encryptionKey) {
    throw new BotApiError('SERVICE_UNAVAILABLE', 503);
  }

  const result = await database.$transaction(
    async (tx) => {
      const existing = await tx.botRentalRequest.findUnique({
        where: {
          companyId_idempotencyKey: { companyId: identity.companyId, idempotencyKey },
        },
      });
      if (existing) {
        if (existing.clientId !== clientId) throw new BotApiError('NOT_FOUND', 404);
        return existing;
      }

      const currentIdentity = await tx.telegramIdentity.findFirst({
        where: {
          id: identity.identityId,
          companyId: identity.companyId,
          clientId,
          telegramUserId: identity.telegramUserId,
          kind: 'CLIENT',
          isActive: true,
          client: { is: { archivedAt: null, status: { notIn: ['BLOCKED', 'ARCHIVED'] } } },
        },
        select: { id: true },
      });
      if (!currentIdentity) throw new BotApiError('IDENTITY_REQUIRED', 401);

      let effectiveVehicleId = input.preferredVehicleId;
      if (input.rentalId) {
        const rental = await tx.rental.findFirst({
          where: {
            id: input.rentalId,
            companyId: identity.companyId,
            clientId,
            status: { in: ['CONFIRMED', 'ACTIVE'] },
          },
          select: { id: true, vehicleId: true, endsAt: true },
        });
        if (!rental) throw new BotApiError('NOT_FOUND', 404);
        if (startsAt.getTime() !== rental.endsAt.getTime()) {
          throw new BotApiError('AVAILABILITY_CHANGED', 409);
        }
        if (effectiveVehicleId && effectiveVehicleId !== rental.vehicleId) {
          throw new BotApiError('NOT_FOUND', 404);
        }
        effectiveVehicleId = rental.vehicleId;
      }

      if (effectiveVehicleId) {
        const vehicle = await tx.vehicle.findFirst({
          where: {
            id: effectiveVehicleId,
            companyId: identity.companyId,
            archivedAt: null,
            isRentalReady: true,
            status: { not: 'MAINTENANCE' },
            rentals: {
              none: {
                id: input.rentalId ? { not: input.rentalId } : undefined,
                status: { in: ['CONFIRMED', 'ACTIVE'] },
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
              },
            },
            maintenanceRecords: {
              none: {
                status: { in: ['PLANNED', 'IN_PROGRESS'] },
                scheduledAt: { lt: endsAt },
                scheduledEndsAt: { gt: startsAt },
              },
            },
          },
          select: { id: true },
        });
        if (!vehicle) throw new BotApiError('AVAILABILITY_CHANGED', 409);
      }

      const created = await tx.botRentalRequest.create({
        data: {
          companyId: identity.companyId,
          clientId,
          rentalId: input.rentalId ?? undefined,
          preferredVehicleId: effectiveVehicleId ?? undefined,
          startsAt,
          endsAt,
          fulfillmentMode: input.fulfillmentMode,
          deliveryAddressEncrypted: input.deliveryAddress
            ? encryptField(input.deliveryAddress, encryptionKey as string)
            : null,
          commentEncrypted: input.comment
            ? encryptField(input.comment, encryptionKey as string)
            : null,
          idempotencyKey,
        },
      });
      await tx.botNotificationJob.create({
        data: {
          companyId: identity.companyId,
          chatId: `staff:${identity.companyId}`,
          eventKey: `bot-rental-request:${created.id}`,
          template: 'BOT_RENTAL_REQUEST_CREATED',
          payload: { requestId: created.id },
          availableAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: identity.companyId,
          actorUserId: null,
          actorEmailSnapshot: 'redacted@audit.invalid',
          action: 'CREATE',
          entityType: 'RENTAL',
          entityId: created.id,
          entityLabel: 'BOT_RENTAL_REQUEST',
          changes: { fulfillmentMode: input.fulfillmentMode, extension: Boolean(input.rentalId) },
        },
      });
      return created;
    },
    { isolationLevel: 'Serializable' },
  );
  return dto(result);
}

import 'server-only';

import { createHash } from 'node:crypto';

import { prisma } from '@/database/prisma/client';
import {
  FUEL_RECOVERY_PERCENT,
  isLowFuelLevel,
  selectFreshFuelReading,
} from '@/modules/vehicles/fuel-level';
import { getAuthenticatedSession } from '@/services/auth/session';

import type { PilotNotification } from '../types';

async function getFuelContext() {
  const session = await getAuthenticatedSession();
  if (!session) return null;
  const membership = await prisma.companyMember.findFirst({
    where: { userId: session.user.id },
    select: { companyId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return membership ? { companyId: membership.companyId, userId: session.user.id } : null;
}

type FuelContext = NonNullable<Awaited<ReturnType<typeof getFuelContext>>>;

async function getLowFuelEpisodes(context: FuelContext, now: Date): Promise<PilotNotification[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { companyId: context.companyId, archivedAt: null, isDemoImport: false },
    select: {
      id: true,
      companyId: true,
      make: true,
      model: true,
      registrationNumber: true,
      positions: {
        where: {
          provider: 'GLONASSSOFT',
          recordedAt: { lte: now },
          fuelLevelPercent: { not: null },
        },
        select: { id: true, recordedAt: true, fuelLevelPercent: true },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        take: 1,
      },
      rentalOperations: {
        where: { status: 'COMMITTED', occurredAt: { lte: now }, fuelLevelPercent: { not: null } },
        select: { id: true, occurredAt: true, fuelLevelPercent: true },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 1,
      },
    },
  });
  const episodes = await Promise.all(
    vehicles.map(async (vehicle) => {
      const readings = [
        ...vehicle.positions.map((position) => ({
          fuelLevelPercent:
            position.fuelLevelPercent === null ? null : Number(position.fuelLevelPercent),
          observedAt: position.recordedAt,
        })),
        ...vehicle.rentalOperations.map((operation) => ({
          fuelLevelPercent: operation.fuelLevelPercent,
          observedAt: operation.occurredAt,
        })),
      ];
      const reading = selectFreshFuelReading(readings, now);
      if (!reading || !isLowFuelLevel(reading.fuelLevelPercent)) return null;
      const [position, operation] = await Promise.all([
        prisma.vehiclePosition.findFirst({
          where: {
            vehicleId: vehicle.id,
            provider: 'GLONASSSOFT',
            recordedAt: { lt: reading.observedAt },
            fuelLevelPercent: { gte: FUEL_RECOVERY_PERCENT, lte: 100 },
          },
          select: { id: true, recordedAt: true },
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        }),
        prisma.rentalOperation.findFirst({
          where: {
            companyId: context.companyId,
            vehicleId: vehicle.id,
            status: 'COMMITTED',
            occurredAt: { lt: reading.observedAt },
            fuelLevelPercent: { gte: FUEL_RECOVERY_PERCENT, lte: 100 },
          },
          select: { id: true, occurredAt: true },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        }),
      ]);
      const recovery =
        operation && (!position || operation.occurredAt > position.recordedAt)
          ? `operation:${operation.id}`
          : position
            ? `position:${position.id}`
            : 'initial';
      const hash = createHash('sha256').update(`${vehicle.id}:${recovery}`).digest('hex');
      const label = [vehicle.make, vehicle.model, vehicle.registrationNumber]
        .filter(Boolean)
        .join(' ');
      return {
        id: `low-fuel:${hash}`,
        category: 'FLEET',
        title: 'Мало топлива',
        description: `${label}: остаток топлива ${Math.round(reading.fuelLevelPercent as number)}%`,
        createdAt: new Intl.DateTimeFormat('ru-RU', {
          timeZone: 'Europe/Moscow',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(reading.observedAt),
        occurredAt: reading.observedAt.toISOString(),
        tone: 'danger',
        href: `/vehicles/${vehicle.id}`,
      } satisfies PilotNotification;
    }),
  );
  return episodes.filter((episode): episode is NonNullable<typeof episode> => episode !== null);
}

export async function listLowFuelNotifications(now = new Date()): Promise<PilotNotification[]> {
  const context = await getFuelContext();
  if (!context) return [];
  const episodes = await getLowFuelEpisodes(context, now);
  if (!episodes.length) return [];
  const receipts = await prisma.eventReadReceipt.findMany({
    where: {
      companyId: context.companyId,
      userId: context.userId,
      eventKey: { in: episodes.map((episode) => episode.id) },
    },
    select: { eventKey: true },
  });
  const readKeys = new Set(receipts.map((receipt) => receipt.eventKey));
  return episodes.map((episode) => ({ ...episode, isRead: readKeys.has(episode.id) }));
}

export async function markLowFuelNotificationsRead(keys: readonly string[], now = new Date()) {
  const context = await getFuelContext();
  if (!context) return false;
  const uniqueKeys = [...new Set(keys)];
  if (!uniqueKeys.length || uniqueKeys.length > 50) return false;
  const episodes = await getLowFuelEpisodes(context, now);
  const allowed = new Set(episodes.map((episode) => episode.id));
  if (uniqueKeys.some((key) => !allowed.has(key))) return false;
  await Promise.all(
    uniqueKeys.map((eventKey) =>
      prisma.eventReadReceipt.upsert({
        where: { userId_eventKey: { userId: context.userId, eventKey } },
        create: { companyId: context.companyId, userId: context.userId, eventKey },
        update: { readAt: now },
      }),
    ),
  );
  return true;
}

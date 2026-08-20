import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { SafeUser } from '@/modules/auth/types';

import type { OnlineMapStatus, OnlineMapVehicle } from '../types';

const OFFLINE_AFTER_MS = 15 * 60 * 1000;

interface OnlineMapRepository {
  vehicle: {
    findMany(args: unknown): Promise<unknown[]>;
  };
}

interface OnlineMapRow {
  id: string;
  model: string;
  registrationNumber: string | null;
  positions: Array<{
    latitude: unknown;
    longitude: unknown;
    speedKph: number | null;
    fuelLevelPercent: unknown | null;
    recordedAt: Date;
  }>;
  rentals?: Array<{
    id: string;
    contractNumber: string | null;
    client: { fullName: string };
  }>;
}

function lastSeenLabel(recordedAt: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - recordedAt.getTime()) / 60_000));
  if (minutes < 1) return 'только что';
  if (minutes < 60)
    return `${minutes} ${minutes === 1 ? 'минуту' : minutes < 5 ? 'минуты' : 'минут'} назад`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} назад`;
}

function positionStatus(speedKph: number, recordedAt: Date, now: Date): OnlineMapStatus {
  if (now.getTime() - recordedAt.getTime() > OFFLINE_AFTER_MS) return 'offline';
  return speedKph > 0 ? 'moving' : 'idle';
}

export async function listOnlineMapVehicles(
  user: SafeUser,
  repository: OnlineMapRepository = prisma,
  now = new Date(),
): Promise<OnlineMapVehicle[]> {
  const rows = (await repository.vehicle.findMany({
    where: {
      archivedAt: null,
      isDemoImport: false,
      ...(user.role === 'SUPER_ADMIN'
        ? {}
        : { company: { memberships: { some: { userId: user.id } } } }),
    },
    select: {
      id: true,
      model: true,
      registrationNumber: true,
      positions: {
        where: { provider: 'GLONASSSOFT' },
        select: {
          latitude: true,
          longitude: true,
          speedKph: true,
          fuelLevelPercent: true,
          recordedAt: true,
        },
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
      rentals: {
        where: {
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        select: {
          id: true,
          contractNumber: true,
          client: { select: { fullName: true } },
        },
        orderBy: { startsAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ model: 'asc' }, { registrationNumberNormalized: 'asc' }],
  })) as OnlineMapRow[];

  return rows.map((vehicle): OnlineMapVehicle => {
    const position = vehicle.positions[0];
    const currentRental = vehicle.rentals?.[0]
      ? {
          id: vehicle.rentals[0].id,
          contractNumber: vehicle.rentals[0].contractNumber,
          clientName: vehicle.rentals[0].client.fullName,
        }
      : null;
    if (!position) {
      return {
        id: vehicle.id,
        name: vehicle.model,
        plate: vehicle.registrationNumber ?? 'Без госномера',
        status: 'no-data' as const,
        longitude: null,
        latitude: null,
        speedKph: 0,
        fuelPercent: null,
        lastSeenLabel: 'координаты ещё не получены',
        address: 'Нет данных GLONASSSoft',
        currentRental,
      };
    }
    const speedKph = position.speedKph ?? 0;
    return {
      id: vehicle.id,
      name: vehicle.model,
      plate: vehicle.registrationNumber ?? 'Без госномера',
      status: positionStatus(speedKph, position.recordedAt, now),
      longitude: Number(position.longitude),
      latitude: Number(position.latitude),
      speedKph,
      fuelPercent: position.fuelLevelPercent == null ? null : Number(position.fuelLevelPercent),
      lastSeenLabel: lastSeenLabel(position.recordedAt, now),
      address: 'Адрес уточняется по координатам',
      currentRental,
    };
  });
}

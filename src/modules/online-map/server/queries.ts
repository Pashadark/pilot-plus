import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { SafeUser } from '@/modules/auth/types';
import { deriveVehicleGpsStatus } from '@/modules/vehicles/gps-status';

import type { OnlineMapVehicle } from '../types';

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
    address: string | null;
    recordedAt: Date;
  }>;
  rentals?: Array<{
    id: string;
    contractNumber: string | null;
    client: { firstName: string; middleName: string | null; lastName: string };
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

function coordinate(value: unknown, minimum: number, maximum: number): number | null {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
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
        : { company: { members: { some: { userId: user.id } } } }),
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
          address: true,
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
          client: { select: { lastName: true, firstName: true, middleName: true } },
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
          clientName: [
            vehicle.rentals[0].client.lastName,
            vehicle.rentals[0].client.firstName,
            vehicle.rentals[0].client.middleName,
          ]
            .filter(Boolean)
            .join(' '),
        }
      : null;
    if (!position) {
      return {
        id: vehicle.id,
        name: vehicle.model,
        plate: vehicle.registrationNumber ?? 'Без госномера',
        gpsStatus: deriveVehicleGpsStatus(
          { recordedAt: null, speedKph: null, address: null, hasCoordinates: false },
          now,
        ),
        longitude: null,
        latitude: null,
        speedKph: 0,
        fuelPercent: null,
        recordedAt: null,
        lastSeenLabel: 'сигнал ещё не получен',
        address: 'Нет данных GLONASSSoft',
        currentRental,
      };
    }
    const speedKph = position.speedKph ?? 0;
    const latitude = coordinate(position.latitude, -90, 90);
    const longitude = coordinate(position.longitude, -180, 180);
    const hasCoordinates = latitude !== null && longitude !== null;
    return {
      id: vehicle.id,
      name: vehicle.model,
      plate: vehicle.registrationNumber ?? 'Без госномера',
      gpsStatus: deriveVehicleGpsStatus(
        {
          recordedAt: position.recordedAt,
          speedKph,
          address: position.address,
          hasCoordinates,
        },
        now,
      ),
      longitude: hasCoordinates ? longitude : null,
      latitude: hasCoordinates ? latitude : null,
      speedKph,
      fuelPercent: position.fuelLevelPercent == null ? null : Number(position.fuelLevelPercent),
      recordedAt: position.recordedAt.toISOString(),
      lastSeenLabel: lastSeenLabel(position.recordedAt, now),
      address: position.address ?? 'Адрес уточняется по координатам',
      currentRental,
    };
  });
}

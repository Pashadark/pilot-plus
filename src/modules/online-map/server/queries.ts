import 'server-only';

import type { CompanyRole } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import type { SafeUser } from '@/modules/auth/types';
import { resolveRentalDepositState } from '@/modules/rentals/deposit-state';
import { canManageRentals } from '@/modules/rentals/server/access';
import { deriveVehicleGpsStatus } from '@/modules/vehicles/gps-status';
import { getPilotBusinessDateParts, parsePilotDateTimeLocal } from '@/shared/business-time';

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
  odometerKm?: unknown | null;
  includedMileageKm?: number | null;
  company?: { members: Array<{ role: CompanyRole }> };
  images?: Array<{ localPath: string; alt: string }>;
  positions: Array<{
    latitude: unknown;
    longitude: unknown;
    speedKph: number | null;
    heading: number | null;
    odometerKm?: unknown | null;
    fuelLevelPercent: unknown | null;
    address: string | null;
    recordedAt: Date;
  }>;
  trips?: Array<{ distanceKm: unknown | null }>;
  maintenanceRecords?: Array<{
    odometerKm: unknown | null;
    targetOdometerKm: unknown | null;
    status: 'PLANNED' | 'IN_PROGRESS' | 'OVERDUE';
  }>;
  rentals?: Array<{
    id: string;
    contractNumber: string | null;
    endsAt?: Date;
    dailyRateMinor?: bigint;
    currency?: string;
    depositMinor?: bigint | null;
    includedMileageKm?: number | null;
    client: { id?: string; firstName: string; middleName: string | null; lastName: string };
    payments?: Array<{ kind: string; status: string; amountMinor: bigint }>;
    operations?: Array<{
      id: string;
      status: 'DRAFT' | 'COMMITTED' | 'ERROR';
      occurredAt: Date;
      depositStatus:
        'NOT_COLLECTED' | 'COLLECTED' | 'RETURNED' | 'PARTIALLY_WITHHELD' | 'WITHHELD' | null;
    }>;
  }>;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(
    typeof value === 'object' && 'toString' in value ? value.toString() : value,
  );
  return Number.isFinite(parsed) ? parsed : null;
}

function moneyMinor(value: bigint | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function moscowDayRange(now: Date) {
  const { year, month, day } = getPilotBusinessDateParts(now);
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  const from = parsePilotDateTimeLocal(`${date}T00:00`);
  const to = parsePilotDateTimeLocal(`${nextDate}T00:00`);
  if (!from || !to) throw new Error('Не удалось определить текущий московский день.');
  return { from, to };
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
  const dayRange = moscowDayRange(now);
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
      odometerKm: true,
      includedMileageKm: true,
      company: {
        select: {
          members: {
            where: { userId: user.id },
            select: { role: true },
          },
        },
      },
      images: {
        select: { localPath: true, alt: true },
        orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
        take: 1,
      },
      positions: {
        where: { provider: 'GLONASSSOFT' },
        select: {
          latitude: true,
          longitude: true,
          speedKph: true,
          heading: true,
          odometerKm: true,
          fuelLevelPercent: true,
          address: true,
          recordedAt: true,
        },
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
      trips: {
        where: { startedAt: { gte: dayRange.from, lt: dayRange.to } },
        select: { distanceKm: true },
      },
      maintenanceRecords: {
        where: {
          recordType: 'MAINTENANCE',
          status: { in: ['PLANNED', 'IN_PROGRESS', 'OVERDUE'] },
          targetOdometerKm: { not: null },
        },
        select: { odometerKm: true, targetOdometerKm: true, status: true },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
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
          endsAt: true,
          dailyRateMinor: true,
          currency: true,
          depositMinor: true,
          includedMileageKm: true,
          client: { select: { id: true, lastName: true, firstName: true, middleName: true } },
          payments: { select: { kind: true, status: true, amountMinor: true } },
          operations: {
            where: { status: 'COMMITTED', depositStatus: { not: null } },
            select: { id: true, status: true, occurredAt: true, depositStatus: true },
          },
        },
        orderBy: { startsAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ model: 'asc' }, { registrationNumberNormalized: 'asc' }],
  })) as OnlineMapRow[];

  return rows.map((vehicle): OnlineMapVehicle => {
    const position = vehicle.positions[0];
    const image = vehicle.images?.[0]
      ? { src: vehicle.images[0].localPath, alt: vehicle.images[0].alt }
      : null;
    const positionOdometerKm = numberValue(position?.odometerKm);
    const odometerKm = positionOdometerKm ?? numberValue(vehicle.odometerKm);
    const dailyDistanceValues = (vehicle.trips ?? [])
      .map((trip) => numberValue(trip.distanceKm))
      .filter((value): value is number => value !== null);
    const dailyDistanceKm =
      dailyDistanceValues.length > 0
        ? Math.round(dailyDistanceValues.reduce((sum, value) => sum + value, 0) * 10) / 10
        : null;
    const maintenanceRecord = vehicle.maintenanceRecords?.[0];
    const maintenanceTargetKm = numberValue(maintenanceRecord?.targetOdometerKm);
    const maintenance =
      maintenanceTargetKm === null
        ? null
        : {
            startOdometerKm: numberValue(maintenanceRecord?.odometerKm),
            targetOdometerKm: maintenanceTargetKm,
            remainingKm: odometerKm === null ? null : Math.max(0, maintenanceTargetKm - odometerKm),
            status: maintenanceRecord?.status,
          };
    const canAccessRentalDetails =
      user.role === 'SUPER_ADMIN' ||
      Boolean(vehicle.company?.members.some((member) => canManageRentals(member.role)));
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
          canAccessDetails: canAccessRentalDetails,
          ...(canAccessRentalDetails
            ? {
                clientId: vehicle.rentals[0].client.id,
                endsAt: vehicle.rentals[0].endsAt?.toISOString(),
                dailyRateMinor: moneyMinor(vehicle.rentals[0].dailyRateMinor),
                currency: vehicle.rentals[0].currency,
                includedMileageKm:
                  vehicle.rentals[0].includedMileageKm ?? vehicle.includedMileageKm ?? null,
                depositState: resolveRentalDepositState({
                  expectedMinor: vehicle.rentals[0].depositMinor ?? null,
                  operations: vehicle.rentals[0].operations ?? [],
                  payments: vehicle.rentals[0].payments ?? [],
                }),
              }
            : {}),
        }
      : null;
    if (!position) {
      return {
        id: vehicle.id,
        name: vehicle.model,
        plate: vehicle.registrationNumber ?? 'Без госномера',
        image,
        gpsStatus: deriveVehicleGpsStatus(
          { recordedAt: null, speedKph: null, address: null, hasCoordinates: false },
          now,
        ),
        longitude: null,
        latitude: null,
        speedKph: 0,
        heading: null,
        fuelPercent: null,
        odometerKm,
        dailyDistanceKm,
        includedMileageKm: vehicle.includedMileageKm ?? null,
        maintenance,
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
      image,
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
      heading: position.heading,
      fuelPercent: position.fuelLevelPercent == null ? null : Number(position.fuelLevelPercent),
      odometerKm,
      dailyDistanceKm,
      includedMileageKm: vehicle.includedMileageKm ?? null,
      maintenance,
      recordedAt: position.recordedAt.toISOString(),
      lastSeenLabel: lastSeenLabel(position.recordedAt, now),
      address: position.address ?? 'Адрес уточняется по координатам',
      currentRental,
    };
  });
}

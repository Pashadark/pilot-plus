import 'server-only';

import { prisma } from '@/database/prisma/client';
import { getRentalAccess } from '@/modules/rentals/server/access';
import { evaluateClientReadiness } from '@/modules/rentals/readiness/evaluate-client-readiness';
import { listRentalDraftVehicleOptions } from '@/modules/rentals/server/draft-vehicle-options';
import { decryptField } from '@/services/security/field-encryption';

import type { BookingWorkspaceData } from '../types';

function decrypt(value: string | null) {
  const key = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!value || !key) return null;
  try {
    return decryptField(value, key);
  } catch {
    return null;
  }
}

export async function getBookingWorkspace(): Promise<BookingWorkspaceData | null> {
  const access = await getRentalAccess();
  if (!access) return null;
  const company = await prisma.company.findFirst({
    where: access.scope === 'SYSTEM' ? {} : { id: { in: [...access.companyIds] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!company) return null;

  const [clients, vehicles, template] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: company.id, archivedAt: null, status: { not: 'BLOCKED' } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 100,
      select: {
        id: true,
        companyId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phoneEncrypted: true,
        passportEncrypted: true,
        driverLicenseEncrypted: true,
        driverLicenseExpiresAt: true,
        documents: {
          where: { archivedAt: null, category: { in: ['PASSPORT', 'DRIVER_LICENSE'] } },
          select: {
            category: true,
            archivedAt: true,
            currentVersion: true,
            versions: {
              where: { scanVerdict: 'CLEAN' },
              select: { version: true, scanVerdict: true },
            },
          },
        },
      },
    }),
    listRentalDraftVehicleOptions(company.id),
    prisma.contractTemplateVersion.findFirst({
      where: { companyId: company.id, isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: { id: true },
    }),
  ]);

  return {
    companyId: company.id,
    templateVersionId: template?.id ?? null,
    clients: clients.map((client) => {
      const phone = decrypt(client.phoneEncrypted);
      const readiness = evaluateClientReadiness({
        id: client.id,
        status: '',
        phone,
        passport: decrypt(client.passportEncrypted),
        driverLicense: decrypt(client.driverLicenseEncrypted),
        driverLicenseExpiresAt: client.driverLicenseExpiresAt,
        documents: client.documents,
      });
      return {
        id: client.id,
        companyId: client.companyId,
        fullName: [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' '),
        phone,
        documentsReady: readiness.ready,
      };
    }),
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      label: vehicle.label,
      registrationNumber: vehicle.registrationNumber ?? null,
      imageUrl: vehicle.imageUrl ?? null,
      dailyMinor: Number(vehicle.dailyMinor),
      depositMinor: Number(vehicle.depositMinor ?? 0),
      legalReady: vehicle.legalReady !== false,
      available: vehicle.available,
      reasons: [...vehicle.reasons],
      rentalIntervals: (vehicle.rentalIntervals ?? [])
        .filter((interval) => interval.status === 'CONFIRMED' || interval.status === 'ACTIVE')
        .map((interval) => ({
          startsAt: interval.startsAt,
          endsAt: interval.endsAt,
          status: interval.status as 'CONFIRMED' | 'ACTIVE',
        })),
    })),
  };
}

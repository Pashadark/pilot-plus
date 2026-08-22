import 'server-only';

import type { FineStatus } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import {
  createFineRatingInput,
  recordAutomaticRatingEvent,
} from '@/modules/client-rating/automatic-events';
import { normalizeRegistrationNumber } from '@/modules/vehicles/manage/validation';
import { blindIndex, decryptField } from '@/services/security/field-encryption';

import { DriverHelperClient } from '../integrations/driver-helper/client';
import {
  normalizeDriverHelperCar,
  normalizeDriverHelperFine,
} from '../integrations/driver-helper/normalizers';
import { selectFineAttribution } from './attribute-fine';
import { syncCompanyFinesWithDependencies } from './sync-company-fines';

const normalizedDocument = (value: string) => value.toUpperCase().replace(/[^0-9А-ЯA-Z]/gu, '');

function requiredKey(name: 'CLIENT_DATA_ENCRYPTION_KEY' | 'CLIENT_DATA_SEARCH_KEY') {
  const value = process.env[name];
  if (!value) throw new Error('Защищённая интеграция штрафов не настроена.');
  return value;
}

export async function syncCompanyFines(companyId: string) {
  const integration = await prisma.fineIntegration.findUnique({
    where: { companyId },
    select: { tokenEncrypted: true, enabled: true },
  });
  if (!integration?.enabled) throw new Error('Интеграция Driver Helper не настроена.');

  const token = decryptField(integration.tokenEncrypted, requiredKey('CLIENT_DATA_ENCRYPTION_KEY'));
  const searchKey = requiredKey('CLIENT_DATA_SEARCH_KEY');
  const client = new DriverHelperClient({ token });
  const now = new Date();

  await prisma.fineIntegration.update({
    where: { companyId },
    data: { lastAttemptAt: now, lastErrorCode: null },
    select: { id: true },
  });

  try {
    const result = await syncCompanyFinesWithDependencies(companyId, {
      listCars: (page) => client.listCars(page),
      listFines: (page) => client.listUnpaidFines(page),
      listPaidFines: (page) => client.listPaidFines(page),
      normalizeCar: normalizeDriverHelperCar,
      normalizeFine: normalizeDriverHelperFine,
      upsertLink: async (tenantId, car) => {
        const registrationCertificateIndex = car.registrationCertificate
          ? blindIndex(car.registrationCertificate, searchKey, normalizedDocument)
          : null;
        const candidates = await prisma.vehicle.findMany({
          where: {
            companyId: tenantId,
            archivedAt: null,
            OR: [
              ...(car.registrationCertificate
                ? [{ registrationCertificateNumber: car.registrationCertificate }]
                : []),
              ...(car.registrationNumberNormalized
                ? [{ registrationNumberNormalized: car.registrationNumberNormalized }]
                : []),
            ],
          },
          select: {
            id: true,
            registrationCertificateNumber: true,
            registrationNumberNormalized: true,
          },
          take: 3,
        });
        const stsMatches = car.registrationCertificate
          ? candidates.filter(
              ({ registrationCertificateNumber }) =>
                normalizedDocument(registrationCertificateNumber ?? '') ===
                normalizedDocument(car.registrationCertificate ?? ''),
            )
          : [];
        const plateMatches = car.registrationNumberNormalized
          ? candidates.filter(
              ({ registrationNumberNormalized }) =>
                registrationNumberNormalized === car.registrationNumberNormalized,
            )
          : [];
        const matches = stsMatches.length ? stsMatches : plateMatches;
        const vehicleId = matches.length === 1 ? (matches[0]?.id ?? null) : null;

        return prisma.externalVehicleLink.upsert({
          where: {
            companyId_provider_externalId: {
              companyId: tenantId,
              provider: 'DRIVER_HELPER',
              externalId: car.externalId,
            },
          },
          create: {
            companyId: tenantId,
            provider: 'DRIVER_HELPER',
            externalId: car.externalId,
            vehicleId,
            registrationNumberNormalized: car.registrationNumberNormalized,
            registrationCertificateIndex,
          },
          update: {
            vehicleId,
            registrationNumberNormalized: car.registrationNumberNormalized,
            registrationCertificateIndex,
          },
          select: { vehicleId: true },
        });
      },
      upsertFine: async (tenantId, fine, vehicleId) => {
        return prisma.$transaction(
          async (transaction) => {
            const uniqueFine = {
              companyId: tenantId,
              provider: 'DRIVER_HELPER',
              externalId: fine.externalId,
            } as const;
            const existing = await transaction.fine.findUnique({
              where: { companyId_provider_externalId: uniqueFine },
              select: {
                id: true,
                vehicleId: true,
                rentalId: true,
                clientId: true,
                assignmentSource: true,
                assignmentConfirmedAt: true,
                assignmentConfirmedByUserId: true,
                status: true,
              },
            });
            const rentals = vehicleId
              ? await transaction.rental.findMany({
                  where: {
                    companyId: tenantId,
                    vehicleId,
                    startsAt: { lte: fine.offenseAt },
                    endsAt: { gt: fine.offenseAt },
                  },
                  select: { id: true, clientId: true, startsAt: true, endsAt: true },
                  take: 2,
                })
              : [];
            const attribution = selectFineAttribution(fine.offenseAt, rentals);
            const exactChanged = Boolean(
              attribution.kind === 'MATCHED' &&
              existing?.assignmentSource !== 'MANUAL' &&
              (existing?.vehicleId !== vehicleId ||
                existing?.rentalId !== attribution.rentalId ||
                existing?.clientId !== attribution.clientId),
            );
            const hasPreservedRentalAssignment = Boolean(existing?.rentalId || existing?.clientId);
            const preservedAssignment = {
              vehicleId: hasPreservedRentalAssignment ? (existing?.vehicleId ?? null) : vehicleId,
              rentalId: existing?.rentalId ?? null,
              clientId: existing?.clientId ?? null,
              assignmentSource: existing?.assignmentSource ?? null,
              assignmentConfirmedAt: existing?.assignmentConfirmedAt ?? null,
              assignmentConfirmedByUserId: existing?.assignmentConfirmedByUserId ?? null,
            };
            const assignment =
              attribution.kind === 'MATCHED' && (!existing || exactChanged)
                ? {
                    vehicleId,
                    rentalId: attribution.rentalId,
                    clientId: attribution.clientId,
                    assignmentSource: 'AUTO_EXACT' as const,
                    assignmentConfirmedAt: null,
                    assignmentConfirmedByUserId: null,
                  }
                : preservedAssignment;
            const persistedStatus: FineStatus =
              fine.status === 'UNPAID' && fine.toBailiff ? 'OVERDUE' : fine.status;
            const confirmedBinding =
              existing &&
              existing.status !== 'OVERDUE' &&
              persistedStatus === 'OVERDUE' &&
              existing.assignmentSource === 'MANUAL' &&
              existing.assignmentConfirmedAt &&
              existing.vehicleId &&
              existing.rentalId &&
              existing.clientId
                ? {
                    vehicleId: existing.vehicleId,
                    rentalId: existing.rentalId,
                    clientId: existing.clientId,
                  }
                : null;
            const confirmedRental = confirmedBinding
              ? await transaction.rental.findFirst({
                  where: {
                    id: confirmedBinding.rentalId,
                    companyId: tenantId,
                    clientId: confirmedBinding.clientId,
                    vehicleId: confirmedBinding.vehicleId,
                  },
                  select: { id: true },
                })
              : null;
            const data = {
              providerVehicleId: fine.providerVehicleId,
              ...assignment,
              decreeNumber: fine.decreeNumber,
              decreeAt: fine.decreeAt,
              offenseAt: fine.offenseAt,
              discountExpiresAt: fine.discountExpiresAt,
              originalAmountMinor: fine.originalAmountMinor,
              currentAmountMinor: fine.currentAmountMinor,
              discountPercent: fine.discountPercent,
              articleCode: fine.articleCode,
              description: fine.description,
              address: fine.address,
              status: persistedStatus,
              toBailiff: fine.toBailiff,
              photoState: fine.photoState,
              lastSyncedAt: now,
            };
            const saved = await transaction.fine.upsert({
              where: { companyId_provider_externalId: uniqueFine },
              create: {
                companyId: tenantId,
                provider: 'DRIVER_HELPER',
                externalId: fine.externalId,
                ...data,
              },
              update: data,
              select: { id: true },
            });
            const ratingEvent = createFineRatingInput({
              assignment: confirmedRental ? 'CONFIRMED' : 'CANDIDATE',
              overdue: Boolean(confirmedBinding),
            });
            if (ratingEvent && confirmedBinding) {
              await recordAutomaticRatingEvent(transaction, {
                companyId: tenantId,
                clientId: confirmedBinding.clientId,
                rentalId: confirmedBinding.rentalId,
                fineId: saved.id,
                ...ratingEvent,
                idempotencyKey: `fine:${saved.id}:confirmed-overdue`,
              });
            }
            if (attribution.kind === 'MATCHED' && (!existing || exactChanged)) {
              await transaction.fineAssignmentHistory.create({
                data: {
                  companyId: tenantId,
                  fineId: saved.id,
                  vehicleId,
                  rentalId: attribution.rentalId,
                  clientId: attribution.clientId,
                  source: 'AUTO_EXACT',
                  reason: 'Единственное точное совпадение интервала аренды.',
                  actorUserId: null,
                },
                select: { id: true },
              });
            }
            return { created: !existing };
          },
          { isolationLevel: 'Serializable' },
        );
      },
    });
    await prisma.fineIntegration.update({
      where: { companyId },
      data: { lastSuccessAt: new Date(), lastErrorCode: null },
      select: { id: true },
    });
    return result;
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error ? String(error.code) : 'UNAVAILABLE';
    await prisma.fineIntegration.update({
      where: { companyId },
      data: { lastErrorCode: code.slice(0, 64) },
      select: { id: true },
    });
    throw error;
  }
}

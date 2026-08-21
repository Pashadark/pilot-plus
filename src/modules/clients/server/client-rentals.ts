import type { ClientRentalWorkspaceDto } from '../types';
import { prisma } from '@/database/prisma/client';

type RentalAccessScope = { scope: 'SYSTEM' | 'COMPANY'; companyIds: readonly string[] };
type RentalRepository = { findMany(args: unknown): Promise<unknown[]> };

type RawRental = {
  id: string;
  contractNumber: string | null;
  status: ClientRentalWorkspaceDto['rentals'][number]['status'];
  startsAt: Date;
  endsAt: Date;
  billableDays: number;
  totalPriceMinor: bigint;
  depositMinor: bigint | null;
  currency: string;
  vehicle: { make: string; modelName: string; registrationNumber: string | null };
  documentVersions: Array<{
    version: number;
    format: 'DOCX' | 'PDF';
    clientDocumentVersion: { scanVerdict: string | null };
  }>;
  operations: Array<{
    id: string;
    type: 'HANDOVER' | 'EXTENSION' | 'RETURN';
    occurredAt: Date;
    mileageKm: number | null;
    fuelLevelPercent: number | null;
    evidenceStatus: 'COMPLETE' | 'VIDEO_MISSING' | 'DASHBOARD_PHOTO_MISSING' | 'MISSING';
    evidenceMissingReason: string | null;
    actor: { name: string };
  }>;
};

export async function getClientRentalWorkspace(
  access: RentalAccessScope,
  clientId: string,
  repository: RentalRepository = prisma.rental,
): Promise<ClientRentalWorkspaceDto> {
  const records = (await repository.findMany({
    where: {
      clientId,
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
    },
    select: {
      id: true,
      contractNumber: true,
      status: true,
      startsAt: true,
      endsAt: true,
      billableDays: true,
      totalPriceMinor: true,
      depositMinor: true,
      currency: true,
      vehicle: { select: { make: true, modelName: true, registrationNumber: true } },
      documentVersions: {
        select: {
          version: true,
          format: true,
          clientDocumentVersion: { select: { scanVerdict: true } },
        },
        orderBy: [{ version: 'desc' }, { format: 'asc' }],
      },
      operations: {
        where: { status: 'COMMITTED' },
        select: {
          id: true,
          type: true,
          occurredAt: true,
          mileageKm: true,
          fuelLevelPercent: true,
          evidenceStatus: true,
          evidenceMissingReason: true,
          actor: { select: { name: true } },
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 50,
      },
    },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  })) as RawRental[];

  const rentals = records.map((rental) => ({
    id: rental.id,
    contractNumber: rental.contractNumber,
    status: rental.status,
    startsAt: rental.startsAt.toISOString(),
    endsAt: rental.endsAt.toISOString(),
    billableDays: rental.billableDays,
    totalPriceMinor: rental.totalPriceMinor.toString(),
    depositMinor: (rental.depositMinor ?? BigInt(0)).toString(),
    currency: rental.currency,
    vehicle: {
      label: `${rental.vehicle.make} ${rental.vehicle.modelName}`.trim(),
      registrationNumber: rental.vehicle.registrationNumber,
    },
    documents: rental.documentVersions
      .filter(({ clientDocumentVersion }) => clientDocumentVersion.scanVerdict === 'CLEAN')
      .map(({ version, format }) => ({ version, format })),
    operations: rental.operations.map((operation) => ({
      id: operation.id,
      type: operation.type,
      occurredAt: operation.occurredAt.toISOString(),
      mileageKm: operation.mileageKm,
      fuelLevelPercent: operation.fuelLevelPercent,
      evidenceStatus: operation.evidenceStatus,
      evidenceMissingReason: operation.evidenceMissingReason,
      actorName: operation.actor.name,
    })),
  }));

  return {
    summary: {
      total: rentals.length,
      active: rentals.filter(({ status }) => status === 'ACTIVE' || status === 'CONFIRMED').length,
      completed: rentals.filter(({ status }) => status === 'COMPLETED').length,
      totalMinor: records
        .filter(({ status }) => status !== 'CANCELLED')
        .reduce((sum, rental) => sum + rental.totalPriceMinor, BigInt(0))
        .toString(),
    },
    rentals,
  };
}

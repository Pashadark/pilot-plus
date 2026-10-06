import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { ClientFineWorkspaceDto } from '../types';

type FineAccessScope = { scope: 'SYSTEM' | 'COMPANY'; companyIds: readonly string[] };
type FineRepository = { findMany(args: unknown): Promise<unknown[]> };
type RawFine = {
  id: string;
  decreeNumber: string;
  decreeAt: Date | null;
  offenseAt: Date;
  currentAmountMinor: bigint;
  originalAmountMinor: bigint;
  status: ClientFineWorkspaceDto['fines'][number]['status'];
  description: string | null;
  articleCode: string | null;
  address: string | null;
  assignmentConfirmedAt: Date;
  assignmentSource: ClientFineWorkspaceDto['fines'][number]['assignmentSource'];
  vehicle: {
    id: string;
    make: string;
    modelName: string | null;
    model: string;
    registrationNumber: string | null;
  } | null;
  rental: {
    id: string;
    contractNumber: string | null;
    startsAt: Date;
    endsAt: Date;
  } | null;
};

export async function getClientFineWorkspace(
  access: FineAccessScope,
  companyId: string,
  clientId: string,
  repository: FineRepository = prisma.fine,
): Promise<ClientFineWorkspaceDto> {
  if (access.scope !== 'SYSTEM' && !access.companyIds.includes(companyId)) {
    throw new Error('Доступ к штрафам клиента запрещён.');
  }

  const records = (await repository.findMany({
    where: {
      companyId,
      clientId,
      assignmentConfirmedAt: { not: null },
      status: { not: 'CANCELLED' },
    },
    select: {
      id: true,
      decreeNumber: true,
      decreeAt: true,
      offenseAt: true,
      currentAmountMinor: true,
      originalAmountMinor: true,
      status: true,
      description: true,
      articleCode: true,
      address: true,
      assignmentConfirmedAt: true,
      assignmentSource: true,
      vehicle: {
        select: {
          id: true,
          make: true,
          modelName: true,
          model: true,
          registrationNumber: true,
        },
      },
      rental: {
        select: { id: true, contractNumber: true, startsAt: true, endsAt: true },
      },
    },
    orderBy: [{ offenseAt: 'desc' }, { id: 'desc' }],
    take: 200,
  })) as RawFine[];

  const fines = records.map((fine) => ({
    id: fine.id,
    decreeNumber: fine.decreeNumber,
    decreeAt: fine.decreeAt?.toISOString() ?? null,
    offenseAt: fine.offenseAt.toISOString(),
    currentAmountMinor: fine.currentAmountMinor.toString(),
    originalAmountMinor: fine.originalAmountMinor.toString(),
    status: fine.status,
    description: fine.description,
    articleCode: fine.articleCode,
    address: fine.address,
    assignmentConfirmedAt: fine.assignmentConfirmedAt.toISOString(),
    assignmentSource: fine.assignmentSource,
    vehicle: fine.vehicle
      ? {
          id: fine.vehicle.id,
          label: `${fine.vehicle.make} ${fine.vehicle.modelName ?? fine.vehicle.model}`.trim(),
          registrationNumber: fine.vehicle.registrationNumber,
        }
      : null,
    rental: fine.rental
      ? {
          id: fine.rental.id,
          contractNumber: fine.rental.contractNumber,
          startsAt: fine.rental.startsAt.toISOString(),
          endsAt: fine.rental.endsAt.toISOString(),
        }
      : null,
  }));
  const unpaid = fines.filter(({ status }) => status !== 'PAID');

  return {
    summary: {
      total: fines.length,
      unpaid: unpaid.length,
      unpaidAmountMinor: unpaid
        .reduce((sum, fine) => sum + BigInt(fine.currentAmountMinor), BigInt(0))
        .toString(),
    },
    fines,
  };
}

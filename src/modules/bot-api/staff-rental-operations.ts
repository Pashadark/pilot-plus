import { prisma } from '@/database/prisma/client';
import {
  executeHandoverOperation,
  executeReturnOperation,
} from '@/modules/rentals/operations/server/execute-operation';
import { createRentalExtension } from '@/modules/rentals/operations/server/extend-rental';
import {
  validateExtensionCommand,
  validateHandoverCommand,
  validateReturnCommand,
} from '@/modules/rentals/operations/validation';

import { BotApiError } from './auth';
import type { BotIdentityContext } from './queries';

const extensionUseCase = createRentalExtension(prisma as never);

export function requireStaffActor(identity: BotIdentityContext) {
  if (identity.kind !== 'STAFF' || !identity.userId) throw new BotApiError('FORBIDDEN', 403);
  return { id: identity.userId, scope: 'COMPANY' as const };
}

export async function listStaffOperationalRentals(
  identity: BotIdentityContext,
  database: Pick<typeof prisma, 'rental'> = prisma,
) {
  requireStaffActor(identity);
  const rentals = await database.rental.findMany({
    where: { companyId: identity.companyId, status: { in: ['CONFIRMED', 'ACTIVE'] } },
    orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
    take: 100,
    select: {
      id: true,
      contractNumber: true,
      status: true,
      startsAt: true,
      endsAt: true,
      client: { select: { firstName: true, middleName: true, lastName: true } },
      vehicle: { select: { make: true, model: true, registrationNumber: true } },
    },
  });
  return {
    items: rentals.map((rental) => ({
      id: rental.id,
      contractNumber: rental.contractNumber,
      status: rental.status,
      startsAt: rental.startsAt.toISOString(),
      endsAt: rental.endsAt.toISOString(),
      clientName: [rental.client.lastName, rental.client.firstName, rental.client.middleName]
        .filter(Boolean)
        .join(' '),
      vehicle: {
        make: rental.vehicle.make ?? '',
        model: rental.vehicle.model,
        registrationNumber: rental.vehicle.registrationNumber ?? '',
      },
      action: rental.status === 'CONFIRMED' ? ('HANDOVER' as const) : ('RETURN' as const),
    })),
  };
}

function optionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? '').trim();
  return raw ? Number(raw) : undefined;
}

async function evidenceFile(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) return undefined;
  return { name: value.name, bytes: new Uint8Array(await value.arrayBuffer()) };
}

async function evidence(formData: FormData) {
  const [video, dashboardPhoto] = await Promise.all([
    evidenceFile(formData, 'inspectionVideo'),
    evidenceFile(formData, 'dashboardPhoto'),
  ]);
  const evidenceStatus =
    video && dashboardPhoto
      ? 'COMPLETE'
      : video
        ? 'DASHBOARD_PHOTO_MISSING'
        : dashboardPhoto
          ? 'VIDEO_MISSING'
          : 'MISSING';
  return { video, dashboardPhoto, evidenceStatus } as const;
}

export async function executeStaffHandover(
  identity: BotIdentityContext,
  rentalId: string,
  formData: FormData,
) {
  const actor = requireStaffActor(identity);
  const files = await evidence(formData);
  const command = validateHandoverCommand({
    rentalId,
    idempotencyKey: String(formData.get('idempotencyKey') ?? ''),
    occurredAt: String(formData.get('occurredAt') ?? ''),
    mileageKm: Number(formData.get('mileageKm')),
    fuelLevelPercent: Number(formData.get('fuelLevelPercent')),
    evidenceStatus: files.evidenceStatus,
    evidenceMissingReason: String(formData.get('evidenceMissingReason') ?? ''),
    fulfillmentMethod: String(formData.get('fulfillmentMethod')) as never,
    fulfillmentAddress: String(formData.get('fulfillmentAddress') ?? ''),
    depositStatus: String(formData.get('depositStatus')) as never,
    depositAmountMinor: optionalNumber(formData, 'depositAmountMinor'),
    depositPaymentMethod: String(formData.get('depositPaymentMethod') ?? '') as never,
  });
  return executeHandoverOperation({
    companyId: identity.companyId,
    actor,
    command,
    video: files.video,
    dashboardPhoto: files.dashboardPhoto,
  });
}

export async function executeStaffReturn(
  identity: BotIdentityContext,
  rentalId: string,
  formData: FormData,
) {
  const actor = requireStaffActor(identity);
  const files = await evidence(formData);
  const command = validateReturnCommand({
    rentalId,
    idempotencyKey: String(formData.get('idempotencyKey') ?? ''),
    occurredAt: String(formData.get('occurredAt') ?? ''),
    mileageKm: Number(formData.get('mileageKm')),
    fuelLevelPercent: Number(formData.get('fuelLevelPercent')),
    evidenceStatus: files.evidenceStatus,
    evidenceMissingReason: String(formData.get('evidenceMissingReason') ?? ''),
    vehicleCondition: String(formData.get('vehicleCondition')) as never,
    damageDescription: String(formData.get('damageDescription') ?? ''),
  });
  return executeReturnOperation({
    companyId: identity.companyId,
    actor,
    command,
    video: files.video,
    dashboardPhoto: files.dashboardPhoto,
  });
}

export async function executeStaffExtension(
  identity: BotIdentityContext,
  rentalId: string,
  value: { idempotencyKey: string; occurredAt: string; nextEndsAt: string; notes?: string },
) {
  const actor = requireStaffActor(identity);
  const command = validateExtensionCommand({ rentalId, ...value });
  return extensionUseCase({ companyId: identity.companyId, actor, command });
}

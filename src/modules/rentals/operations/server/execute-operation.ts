import { randomUUID } from 'node:crypto';

import { prisma } from '@/database/prisma/client';
import { admitOperationMedia } from '@/modules/rentals/operations/media/admit-operation-media';
import { scanOperationMedia } from '@/modules/rentals/operations/media/scan-operation-media';
import {
  validateHandoverCommand,
  validateReturnCommand,
} from '@/modules/rentals/operations/validation';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

import { executeOperationWithEvidence } from './execute-with-evidence';
import { deriveReturnEvidenceStatus } from '../evidence-status';
import type { RentalOperationMediaKind } from '../types';
import { createRentalHandover } from './handover-rental';
import { createOperationDraftPreparer } from './prepare-operation';
import { createRentalReturn } from './return-rental';

export type OperationActor = { id: string; scope: 'SYSTEM' | 'COMPANY' };
export type OperationEvidenceFile = { name: string; bytes: Uint8Array };
type HandoverCommand = ReturnType<typeof validateHandoverCommand>;
type ReturnCommand = ReturnType<typeof validateReturnCommand>;

type OperationMediaDatabase = Pick<typeof prisma, 'rentalOperation' | 'rentalOperationMedia'>;

const handoverUseCase = createRentalHandover(prisma as never);
const returnUseCase = createRentalReturn(prisma as never);
const prepareOperation = createOperationDraftPreparer(prisma as never);

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

async function admitEvidence(input: {
  companyId: string;
  actorUserId: string;
  operationId: string;
  kind: RentalOperationMediaKind;
  file: OperationEvidenceFile;
  skipAntivirus?: boolean;
}) {
  const storage = await LocalPrivateStorage.create(privateStorageRoot());
  const repository = createOperationMediaRepository(prisma);
  return admitOperationMedia({
    ...input,
    repository: repository as never,
    storage,
    randomId: randomUUID,
    skipAntivirus: input.skipAntivirus,
    scan: (media) =>
      scanOperationMedia({
        media,
        now: new Date(),
        leaseMs: 120_000,
        claimToken: randomUUID(),
        repository: prisma.rentalOperationMedia,
        storage,
        scanner: ClamAvClient.fromEnvironment(),
      }),
  });
}

export function createOperationMediaRepository(database: OperationMediaDatabase) {
  return {
    findOperation: (value: {
      companyId: string;
      operationId: string;
      actorUserId: string;
      status: 'DRAFT';
    }) =>
      database.rentalOperation.findFirst({
        where: {
          companyId: value.companyId,
          id: value.operationId,
          actorUserId: value.actorUserId,
          status: value.status,
        },
      }) as never,
    findMedia: (value: {
      companyId: string;
      operationId: string;
      kind: RentalOperationMediaKind;
    }) =>
      database.rentalOperationMedia.findFirst({
        where: {
          companyId: value.companyId,
          operationId: value.operationId,
          kind: value.kind,
        },
      }) as never,
    createMedia: (value: Record<string, unknown>) =>
      database.rentalOperationMedia.create({
        data: value,
        select: {
          id: true,
          uploadId: true,
          companyId: true,
          storageKey: true,
          verifiedMime: true,
        },
      } as never) as never,
    updateMany: (value: Parameters<typeof prisma.rentalOperationMedia.updateMany>[0]) =>
      database.rentalOperationMedia.updateMany(value as never),
  };
}

export async function executeHandoverOperation(input: {
  companyId: string;
  actor: OperationActor;
  command: HandoverCommand;
  video?: OperationEvidenceFile;
  dashboardPhoto?: OperationEvidenceFile;
}) {
  return executeOperationWithEvidence({
    command: input.command,
    video: input.video,
    dashboardPhoto: input.dashboardPhoto,
    prepare: (command) =>
      prepareOperation({
        companyId: input.companyId,
        actor: input.actor,
        rentalId: command.rentalId,
        type: 'HANDOVER',
        idempotencyKey: command.idempotencyKey,
        occurredAt: command.occurredAt,
      }),
    admit: ({ operationId, kind, file }) =>
      admitEvidence({
        companyId: input.companyId,
        actorUserId: input.actor.id,
        operationId,
        kind,
        file,
      }),
    commit: (command) =>
      handoverUseCase({ companyId: input.companyId, actor: input.actor, command }),
  });
}

export async function executeReturnOperation(input: {
  companyId: string;
  actor: OperationActor;
  command: ReturnCommand;
  video?: OperationEvidenceFile;
  dashboardPhoto?: OperationEvidenceFile;
  additionalFiles?: {
    kind: 'BODY_PHOTO_FRONT' | 'BODY_PHOTO_REAR' | 'BODY_PHOTO_LEFT' | 'BODY_PHOTO_RIGHT';
    file: OperationEvidenceFile;
  }[];
}) {
  return executeOperationWithEvidence({
    command: input.command,
    video: input.video,
    dashboardPhoto: input.dashboardPhoto,
    additionalFiles: input.additionalFiles,
    deriveStatus: deriveReturnEvidenceStatus,
    prepare: (command) =>
      prepareOperation({
        companyId: input.companyId,
        actor: input.actor,
        rentalId: command.rentalId,
        type: 'RETURN',
        idempotencyKey: command.idempotencyKey,
        occurredAt: command.occurredAt,
      }),
    admit: ({ operationId, kind, file }) =>
      admitEvidence({
        companyId: input.companyId,
        actorUserId: input.actor.id,
        operationId,
        kind,
        file,
        skipAntivirus: true,
      }),
    commit: (command) => returnUseCase({ companyId: input.companyId, actor: input.actor, command }),
  });
}

export async function executeWeeklyInspectionOperation(input: {
  companyId: string;
  actor: OperationActor;
  command: {
    rentalId: string;
    idempotencyKey: string;
    occurredAt: Date;
    mileageKm?: number;
    fuelLevelPercent?: number;
  };
  files: { kind: RentalOperationMediaKind; file: OperationEvidenceFile }[];
}) {
  const rental = await prisma.rental.findFirst({
    where: {
      id: input.command.rentalId,
      companyId: input.companyId,
      status: 'ACTIVE',
      agreementType: 'LEASE_TO_OWN',
    },
    select: { id: true },
  });
  if (!rental) throw new Error('Еженедельный осмотр доступен только для действующей аренды с правом выкупа.');
  const prepared = await prepareOperation({
    companyId: input.companyId,
    actor: input.actor,
    rentalId: input.command.rentalId,
    type: 'WEEKLY_INSPECTION',
    idempotencyKey: input.command.idempotencyKey,
    occurredAt: input.command.occurredAt,
  });
  for (const item of input.files) {
    await admitEvidence({
      companyId: input.companyId,
      actorUserId: input.actor.id,
      operationId: prepared.operationId,
      ...item,
      skipAntivirus: true,
    });
  }
  const requiredKinds: RentalOperationMediaKind[] = [
    'DASHBOARD_PHOTO',
    'BODY_PHOTO_FRONT',
    'BODY_PHOTO_REAR',
    'BODY_PHOTO_LEFT',
    'BODY_PHOTO_RIGHT',
    'INSPECTION_VIDEO',
  ];
  const media = await prisma.rentalOperationMedia.findMany({
    where: { companyId: input.companyId, operationId: prepared.operationId, status: 'CLEAN' },
    select: { kind: true },
  });
  if (!requiredKinds.every((kind) => media.some((item) => item.kind === kind))) {
    throw new Error('Для завершения нужны фото приборки, кузов с четырёх сторон и видео.');
  }
  const committed = await prisma.rentalOperation.updateMany({
    where: {
      id: prepared.operationId,
      companyId: input.companyId,
      actorUserId: input.actor.id,
      status: 'DRAFT',
      type: 'WEEKLY_INSPECTION',
    },
    data: {
      status: 'COMMITTED',
      committedAt: new Date(),
      evidenceStatus: 'COMPLETE',
      evidenceMissingReason: null,
      mileageKm: input.command.mileageKm,
      fuelLevelPercent: input.command.fuelLevelPercent,
    },
  });
  if (committed.count !== 1) throw new Error('Не удалось завершить еженедельный осмотр.');
  return {
    rentalId: input.command.rentalId,
    operationId: prepared.operationId,
    mileageKm: input.command.mileageKm,
    savedMediaCount: media.length,
  };
}

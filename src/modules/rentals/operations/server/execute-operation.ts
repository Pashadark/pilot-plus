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
import { createRentalHandover } from './handover-rental';
import { createOperationDraftPreparer } from './prepare-operation';
import { createRentalReturn } from './return-rental';

export type OperationActor = { id: string; scope: 'SYSTEM' | 'COMPANY' };
export type OperationEvidenceFile = { name: string; bytes: Uint8Array };
type HandoverCommand = ReturnType<typeof validateHandoverCommand>;
type ReturnCommand = ReturnType<typeof validateReturnCommand>;

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
  kind: 'INSPECTION_VIDEO' | 'DASHBOARD_PHOTO';
  file: OperationEvidenceFile;
}) {
  const storage = await LocalPrivateStorage.create(privateStorageRoot());
  const repository = {
    findOperation: (value: Parameters<typeof prisma.rentalOperation.findFirst>[0]) =>
      prisma.rentalOperation.findFirst(value as never) as never,
    findMedia: (value: Parameters<typeof prisma.rentalOperationMedia.findFirst>[0]) =>
      prisma.rentalOperationMedia.findFirst(value as never) as never,
    createMedia: (value: Record<string, unknown>) =>
      prisma.rentalOperationMedia.create({
        data: value,
        select: { id: true, uploadId: true, companyId: true, storageKey: true },
      } as never) as never,
    updateMany: (value: Parameters<typeof prisma.rentalOperationMedia.updateMany>[0]) =>
      prisma.rentalOperationMedia.updateMany(value as never),
  };
  return admitOperationMedia({
    ...input,
    repository: repository as never,
    storage,
    randomId: randomUUID,
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
      }),
    commit: (command) => returnUseCase({ companyId: input.companyId, actor: input.actor, command }),
  });
}

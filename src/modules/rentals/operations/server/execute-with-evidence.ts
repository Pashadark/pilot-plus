import { deriveEvidenceStatus } from '../evidence-status';
import type { RentalEvidenceStatus, RentalOperationMediaKind } from '../types';

type FileInput = { name: string; bytes: Uint8Array };
type EvidenceCommand = {
  rentalId: string;
  idempotencyKey: string;
  occurredAt: Date;
  evidenceStatus: RentalEvidenceStatus;
  evidenceMissingReason?: string;
};

export async function executeOperationWithEvidence<
  Command extends EvidenceCommand,
  Result extends { operationId: string; rentalId: string },
>(input: {
  command: Command;
  video?: FileInput;
  dashboardPhoto?: FileInput;
  prepare(command: Command): Promise<{ operationId: string }>;
  admit(input: {
    operationId: string;
    kind: RentalOperationMediaKind;
    file: FileInput;
  }): Promise<{ status: string }>;
  commit(command: Command): Promise<Result>;
}) {
  const evidenceStatus = deriveEvidenceStatus({
    hasVideo: Boolean(input.video),
    hasDashboardPhoto: Boolean(input.dashboardPhoto),
  });
  const command = { ...input.command, evidenceStatus };
  if (evidenceStatus !== 'COMPLETE' && !command.evidenceMissingReason?.trim())
    throw new Error('Причина отсутствия фиксации обязательна.');
  if (input.video || input.dashboardPhoto) {
    const prepared = await input.prepare(command);
    if (input.video)
      await input.admit({
        operationId: prepared.operationId,
        kind: 'INSPECTION_VIDEO',
        file: input.video,
      });
    if (input.dashboardPhoto)
      await input.admit({
        operationId: prepared.operationId,
        kind: 'DASHBOARD_PHOTO',
        file: input.dashboardPhoto,
      });
  }
  return input.commit(command);
}

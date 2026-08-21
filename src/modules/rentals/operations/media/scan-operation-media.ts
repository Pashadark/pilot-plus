import type { MalwareScanner } from '@/services/malware-scanner/types';
import type { PrivateStorage } from '@/services/storage/private-storage';
import { scanPendingUpload } from '@/modules/client-documents/scan-upload';

type Count = { count: number };
type MediaRepository = { updateMany(args: unknown): Promise<Count> };

export async function scanOperationMedia(input: {
  media: {
    id: string;
    uploadId: string;
    companyId: string;
    storageKey: string;
  };
  now: Date;
  leaseMs: number;
  claimToken: string;
  repository: MediaRepository;
  storage: PrivateStorage;
  scanner: MalwareScanner;
}): Promise<
  { ok: true; status: 'CLEAN' | 'BLOCKED' | 'ERROR' } | { ok: false; status: 'OWNERSHIP_LOST' }
> {
  const leaseExpiresAt = new Date(input.now.getTime() + input.leaseMs);
  const claimed = await input.repository.updateMany({
    where: {
      id: input.media.id,
      companyId: input.media.companyId,
      status: { in: ['PENDING', 'ERROR'] },
      claimToken: null,
    },
    data: { status: 'SCANNING', claimToken: input.claimToken, leaseExpiresAt },
  });
  if (claimed.count !== 1) return { ok: false, status: 'OWNERSHIP_LOST' };

  const renewMutationLease = async () => {
    const renewed = await input.repository.updateMany({
      where: {
        id: input.media.id,
        companyId: input.media.companyId,
        status: 'SCANNING',
        claimToken: input.claimToken,
      },
      data: { leaseExpiresAt: new Date(Date.now() + input.leaseMs) },
    });
    return renewed.count === 1;
  };
  const result = await scanPendingUpload({
    storage: input.storage,
    scanner: input.scanner,
    uploadId: input.media.uploadId,
    storageKey: input.media.storageKey,
    renewMutationLease,
  });
  const terminal = await input.repository.updateMany({
    where: {
      id: input.media.id,
      companyId: input.media.companyId,
      status: 'SCANNING',
      claimToken: input.claimToken,
    },
    data: {
      status: result.status,
      sha256: result.audit.sha256,
      scanEngine: result.audit.engine,
      signatureVersion: result.audit.signatureVersion,
      claimToken: null,
      leaseExpiresAt: null,
      promotedAt: result.status === 'CLEAN' ? input.now : undefined,
      committedAt: result.status === 'CLEAN' ? input.now : undefined,
      lastErrorCode: result.status === 'ERROR' ? 'SCAN_ERROR' : null,
    },
  });
  if (terminal.count !== 1) {
    if (result.status === 'CLEAN')
      await input.storage.removePrivate(input.media.storageKey).catch(() => undefined);
    return { ok: false, status: 'OWNERSHIP_LOST' };
  }
  return { ok: true, status: result.status };
}

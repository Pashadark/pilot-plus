type Candidate = {
  id: string;
  uploadId: string;
  storageKey: string;
  status: string;
  claimToken: string | null;
  leaseExpiresAt: Date | null;
};
type Repository = {
  findExpired(input: { now: Date; limit: number }): Promise<Candidate[]>;
  updateMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args: unknown): Promise<{ count: number }>;
};
type CleanupStorage = {
  removeUploadArtifacts(uploadId: string): Promise<number>;
  removePrivate(storageKey: string): Promise<void>;
};

export async function reconcileOperationMedia(input: {
  repository: Repository;
  storage: CleanupStorage;
  now: Date;
  claimToken(): string;
  limit: number;
}) {
  const limit = Math.max(1, Math.min(100, Math.trunc(input.limit)));
  const candidates = await input.repository.findExpired({ now: input.now, limit });
  let cleaned = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    const claimToken = input.claimToken();
    const claimed = await input.repository.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        claimToken: candidate.claimToken,
        leaseExpiresAt: candidate.leaseExpiresAt,
      },
      data: {
        status: 'CLEANING',
        claimToken,
        leaseExpiresAt: new Date(input.now.getTime() + 120_000),
      },
    });
    if (claimed.count !== 1) {
      skipped += 1;
      continue;
    }
    await input.storage.removeUploadArtifacts(candidate.uploadId);
    await input.storage.removePrivate(candidate.storageKey);
    const removed = await input.repository.deleteMany({
      where: { id: candidate.id, status: 'CLEANING', claimToken },
    });
    if (removed.count === 1) cleaned += 1;
    else skipped += 1;
  }
  return { cleaned, skipped };
}

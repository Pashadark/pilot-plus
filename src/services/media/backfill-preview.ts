import type { WebpPreviewProfile } from './webp-preview';
import { createStoredWebpPreview } from './webp-preview';

export type MissingPreviewCandidate = {
  id: string;
  companyId: string;
  storageKey: string;
  verifiedMime: string;
};

export type PreviewMetadata = {
  storageKey: string;
  mime: 'image/webp';
  bytes: number;
  sha256: string;
  generatedAt: Date;
};

type BackfillStorage = {
  removePrivate(storageKey: string): Promise<void>;
};

type PreviewCreator = (input: {
  storage: BackfillStorage;
  sourceStorageKey: string;
  previewStorageKey: string;
  verifiedMime: string;
  profile: WebpPreviewProfile;
  temporaryUploadId: string;
}) => Promise<{ mime: 'image/webp'; bytes: number; sha256: string }>;

export async function backfillPreviewSource(input: {
  source: 'CLIENT_DOCUMENT' | 'RENTAL_OPERATION';
  profile: WebpPreviewProfile;
  apply: boolean;
  batchSize: number;
  storage: BackfillStorage;
  findBatch(options: { afterId: string | null; limit: number }): Promise<MissingPreviewCandidate[]>;
  commit(candidate: MissingPreviewCandidate, preview: PreviewMetadata): Promise<boolean>;
  createPreview?: PreviewCreator;
  randomId(): string;
}) {
  const limit = Math.max(1, Math.min(500, Math.trunc(input.batchSize)));
  const createPreview =
    input.createPreview ?? (createStoredWebpPreview as unknown as PreviewCreator);
  const result = { eligible: 0, generated: 0, skipped: 0, failed: 0 };
  let afterId: string | null = null;

  for (;;) {
    const batch = await input.findBatch({ afterId, limit });
    if (batch.length === 0) break;
    result.eligible += batch.length;

    if (input.apply) {
      for (const candidate of batch) {
        const previewStorageKey = `${candidate.storageKey}.preview.webp`;
        try {
          const generated = await createPreview({
            storage: input.storage,
            sourceStorageKey: candidate.storageKey,
            previewStorageKey,
            verifiedMime: candidate.verifiedMime,
            profile: input.profile,
            temporaryUploadId: input.randomId(),
          });
          const committed = await input.commit(candidate, {
            storageKey: previewStorageKey,
            mime: generated.mime,
            bytes: generated.bytes,
            sha256: generated.sha256,
            generatedAt: new Date(),
          });
          if (committed) {
            result.generated += 1;
          } else {
            result.skipped += 1;
            await input.storage.removePrivate(previewStorageKey).catch(() => undefined);
          }
        } catch {
          result.failed += 1;
        }
      }
    }

    afterId = batch.at(-1)?.id ?? afterId;
    if (batch.length < limit) break;
  }

  return result;
}

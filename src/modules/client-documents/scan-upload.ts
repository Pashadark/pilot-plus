import 'server-only';

import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

import type {
  MalwareScanner,
  MalwareScannerMetadata,
  ScanVerdict,
} from '@/services/malware-scanner/types';
import type { PrivateStorage } from '@/services/storage/private-storage';

type ScanPendingUploadInput = {
  storage: PrivateStorage;
  scanner: MalwareScanner;
  uploadId: string;
  storageKey: string;
};

type ScanAudit = {
  sha256: string;
  verdict: 'CLEAN' | 'BLOCKED' | 'ERROR';
  engine?: 'ClamAV';
  signatureVersion?: string;
  signature?: string;
};

export type ScanPendingUploadResult = {
  status: 'CLEAN' | 'BLOCKED' | 'ERROR';
  audit: ScanAudit;
};

async function calculateSha256(stream: Readable) {
  const hash = createHash('sha256');
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

function metadataAudit(metadata: MalwareScannerMetadata | null) {
  return metadata ? { engine: metadata.engine, signatureVersion: metadata.signatureVersion } : {};
}

function errorResult(
  sha256: string,
  metadata: MalwareScannerMetadata | null = null,
): ScanPendingUploadResult {
  return { status: 'ERROR', audit: { sha256, verdict: 'ERROR', ...metadataAudit(metadata) } };
}

export async function scanPendingUpload({
  storage,
  scanner,
  uploadId,
  storageKey,
}: ScanPendingUploadInput): Promise<ScanPendingUploadResult> {
  const snapshot = await storage.reserveQuarantine(uploadId);
  let settled = false;
  try {
    const sha256 = await calculateSha256(await snapshot.open());
    let metadata: MalwareScannerMetadata | null;
    try {
      metadata = await scanner.getMetadata();
    } catch {
      return errorResult(sha256);
    }
    if (!metadata) return errorResult(sha256);
    let verdict: ScanVerdict;

    try {
      verdict = await scanner.scanStream(await snapshot.open());
    } catch {
      return errorResult(sha256, metadata);
    }

    if (verdict.kind === 'clean') {
      try {
        await snapshot.promote(storageKey);
        settled = true;
        return {
          status: 'CLEAN',
          audit: { sha256, verdict: 'CLEAN', ...metadataAudit(metadata) },
        };
      } catch {
        return errorResult(sha256, metadata);
      }
    }

    if (verdict.kind === 'infected') {
      try {
        await snapshot.remove();
        settled = true;
        return {
          status: 'BLOCKED',
          audit: {
            sha256,
            verdict: 'BLOCKED',
            signature: verdict.threat,
            ...metadataAudit(metadata),
          },
        };
      } catch {
        return errorResult(sha256, metadata);
      }
    }

    return errorResult(sha256, metadata);
  } finally {
    if (!settled) await snapshot.release();
  }
}

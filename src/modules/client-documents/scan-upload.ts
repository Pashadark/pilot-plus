import 'server-only';

import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

import type { MalwareScanner, ScanVerdict } from '@/services/malware-scanner/types';
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

function errorResult(sha256: string): ScanPendingUploadResult {
  return { status: 'ERROR', audit: { sha256, verdict: 'ERROR' } };
}

export async function scanPendingUpload({
  storage,
  scanner,
  uploadId,
  storageKey,
}: ScanPendingUploadInput): Promise<ScanPendingUploadResult> {
  const sha256 = await calculateSha256(await storage.openQuarantine(uploadId));
  let verdict: ScanVerdict;

  try {
    verdict = await scanner.scanStream(await storage.openQuarantine(uploadId));
  } catch {
    return errorResult(sha256);
  }

  if (verdict.kind === 'clean') {
    try {
      await storage.promote(uploadId, storageKey);
      return { status: 'CLEAN', audit: { sha256, verdict: 'CLEAN' } };
    } catch {
      return errorResult(sha256);
    }
  }

  if (verdict.kind === 'infected') {
    try {
      await storage.removeQuarantine(uploadId);
      return {
        status: 'BLOCKED',
        audit: { sha256, verdict: 'BLOCKED', signature: verdict.threat },
      };
    } catch {
      return errorResult(sha256);
    }
  }

  return errorResult(sha256);
}

import type { MalwareScanner } from '@/services/malware-scanner/types';
import type { PrivateStorage } from '@/services/storage/private-storage';
import {
  scanPendingUpload,
  type ScanPendingUploadResult,
} from '@/modules/client-documents/scan-upload';

const maxReceiptBytes = 10 * 1024 * 1024;

type ReceiptFile = { name: string; bytes: Uint8Array };
type DetectedReceipt = {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
};

function hasPrefix(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function detectReceipt(bytes: Uint8Array): DetectedReceipt | null {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', extension: 'jpg' };
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: 'image/png', extension: 'png' };
  if (hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) && hasPrefix(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return { mime: 'image/webp', extension: 'webp' };
  return null;
}

function fileExtension(name: string) {
  const normalized = name.trim().toLocaleLowerCase('en-US');
  const separator = normalized.lastIndexOf('.');
  if (separator <= 0 || separator === normalized.length - 1) return null;
  const value = normalized.slice(separator + 1);
  return value === 'jpeg' ? 'jpg' : value;
}

function validateReceipt(file: ReceiptFile) {
  if (file.bytes.byteLength <= 0 || file.bytes.byteLength > maxReceiptBytes)
    throw new Error('Размер фотографии чека не должен превышать 10 МБ.');
  const detected = detectReceipt(file.bytes);
  if (!detected) throw new Error('Фотография чека должна быть изображением JPEG, PNG или WebP.');
  if (fileExtension(file.name) !== detected.extension)
    throw new Error('Расширение фотографии чека не соответствует её содержимому.');
  return detected;
}

export type AdmittedBookingReceipt = {
  uploadId: string;
  storageKey: string;
  originalName: string;
  verifiedMime: DetectedReceipt['mime'];
  bytes: number;
  sha256: string;
  scanEngine: string;
  signatureVersion: string;
  scannedAt: Date;
};

export async function admitBookingReceipt(input: {
  companyId: string;
  rentalId: string;
  file: ReceiptFile;
  storage: PrivateStorage;
  scanner: MalwareScanner;
  scan?: typeof scanPendingUpload;
  randomId(): string;
  now(): Date;
}): Promise<AdmittedBookingReceipt> {
  const detected = validateReceipt(input.file);
  const uploadId = input.randomId();
  const storageKey = `companies/${input.companyId}/rentals/${input.rentalId}/rental-payment-receipts/${uploadId}.${detected.extension}`;
  const scan = input.scan ?? scanPendingUpload;

  try {
    await input.storage.putQuarantine(uploadId, input.file.bytes);
    const result: ScanPendingUploadResult = await scan({
      storage: input.storage,
      scanner: input.scanner,
      uploadId,
      storageKey,
    });
    if (result.status !== 'CLEAN' || !result.audit.engine || !result.audit.signatureVersion) {
      await input.storage.removeUploadArtifacts(uploadId).catch(() => undefined);
      if (result.status === 'CLEAN') {
        await input.storage.removePrivate(storageKey).catch(() => undefined);
      }
      throw new Error('Фотография чека не прошла антивирусную проверку.');
    }
    return {
      uploadId,
      storageKey,
      originalName: input.file.name,
      verifiedMime: detected.mime,
      bytes: input.file.bytes.byteLength,
      sha256: result.audit.sha256,
      scanEngine: result.audit.engine,
      signatureVersion: result.audit.signatureVersion,
      scannedAt: input.now(),
    };
  } catch (error) {
    await input.storage.removeUploadArtifacts(uploadId).catch(() => undefined);
    throw error;
  }
}

import { createHash } from 'node:crypto';

export const maxMaintenanceAttachmentBytes = 15 * 1024 * 1024;

type Input = { name: string; bytes: Uint8Array };

function hasPrefix(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function normalizedExtension(name: string) {
  const normalized = name.trim().toLocaleLowerCase('en-US');
  const separator = normalized.lastIndexOf('.');
  if (separator <= 0 || separator === normalized.length - 1) return '';
  const extension = normalized.slice(separator + 1);
  return extension === 'jpeg' ? 'jpg' : extension;
}

function detect(bytes: Uint8Array, fileExtension: string) {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff]))
    return { mime: 'image/jpeg' as const, extension: 'jpg' as const };
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: 'image/png' as const, extension: 'png' as const };
  if (hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) && hasPrefix(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return { mime: 'image/webp' as const, extension: 'webp' as const };
  if (hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46]))
    return { mime: 'application/pdf' as const, extension: 'pdf' as const };
  if (fileExtension === 'docx' && hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const,
      extension: 'docx' as const,
    };
  }
  throw new Error('Тип файла не поддерживается. Используйте JPG, PNG, WebP, PDF или DOCX.');
}

export function validateMaintenanceAttachment(file: Input) {
  if (file.bytes.byteLength <= 0 || file.bytes.byteLength > maxMaintenanceAttachmentBytes)
    throw new Error('Размер файла не должен превышать 15 МБ.');
  const fileExtension = normalizedExtension(file.name);
  const detected = detect(file.bytes, fileExtension);
  if (fileExtension !== detected.extension)
    throw new Error('Расширение файла не соответствует его содержимому.');
  return {
    ...detected,
    bytes: file.bytes.byteLength,
    sha256: createHash('sha256').update(file.bytes).digest('hex'),
  };
}

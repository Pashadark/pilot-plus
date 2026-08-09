export const maxUploadedFileBytes = 15 * 1024 * 1024;

type AllowedFile = {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  extension: 'jpg' | 'png' | 'webp' | 'pdf';
};

type UploadedFile = {
  name: string;
  bytes: Uint8Array;
};

const allowedExtensions = new Set<AllowedFile['extension']>(['jpg', 'png', 'webp', 'pdf']);

function hasPrefix(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

export function detectAllowedFile(bytes: Uint8Array): AllowedFile {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', extension: 'jpg' };
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    hasPrefix(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }
  if (hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mime: 'application/pdf', extension: 'pdf' };
  }

  throw new Error('Тип файла не поддерживается.');
}

function getExtension(name: string) {
  const extension = name.trim().toLocaleLowerCase('en-US').split('.').pop();
  return extension === 'jpeg' ? 'jpg' : extension;
}

export function validateUploadedFile(file: UploadedFile): AllowedFile & { bytes: number } {
  if (file.bytes.byteLength > maxUploadedFileBytes) {
    throw new Error('Размер файла не должен превышать 15 МБ.');
  }

  const detected = detectAllowedFile(file.bytes);
  const extension = getExtension(file.name);
  if (
    !extension ||
    !allowedExtensions.has(extension as AllowedFile['extension']) ||
    extension !== detected.extension
  ) {
    throw new Error('Расширение файла не соответствует его содержимому.');
  }

  return { ...detected, bytes: file.bytes.byteLength };
}

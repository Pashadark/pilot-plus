import type { RentalOperationMediaKind } from '../types';

export const maxDashboardPhotoBytes = 15 * 1024 * 1024;
export const maxInspectionVideoBytes = 150 * 1024 * 1024;

type OperationMediaFile = {
  kind: RentalOperationMediaKind;
  name: string;
  bytes: Uint8Array;
};

type DetectedMedia = {
  media: 'photo' | 'video';
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'video/webm';
  extension: 'jpg' | 'png' | 'webp' | 'mp4' | 'webm';
};

function hasPrefix(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function detect(bytes: Uint8Array): DetectedMedia {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff]))
    return { media: 'photo', mime: 'image/jpeg', extension: 'jpg' };
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { media: 'photo', mime: 'image/png', extension: 'png' };
  if (hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) && hasPrefix(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return { media: 'photo', mime: 'image/webp', extension: 'webp' };
  if (hasPrefix(bytes, [0x66, 0x74, 0x79, 0x70], 4))
    return { media: 'video', mime: 'video/mp4', extension: 'mp4' };
  if (hasPrefix(bytes, [0x1a, 0x45, 0xdf, 0xa3]))
    return { media: 'video', mime: 'video/webm', extension: 'webm' };
  throw new Error('Тип файла фиксации не поддерживается.');
}

function extension(name: string) {
  const normalized = name.trim().toLocaleLowerCase('en-US');
  const separator = normalized.lastIndexOf('.');
  if (separator <= 0 || separator === normalized.length - 1) return undefined;
  const value = normalized.slice(separator + 1);
  return value === 'jpeg' ? 'jpg' : value;
}

export function validateOperationMediaFile(file: OperationMediaFile) {
  const maximum =
    file.kind === 'DASHBOARD_PHOTO' ? maxDashboardPhotoBytes : maxInspectionVideoBytes;
  const maximumMb = maximum / 1024 / 1024;
  if (file.bytes.byteLength <= 0 || file.bytes.byteLength > maximum)
    throw new Error(`Размер файла не должен превышать ${maximumMb} МБ.`);
  const detected = detect(file.bytes);
  if (file.kind === 'DASHBOARD_PHOTO' && detected.media !== 'photo')
    throw new Error('Фото приборной панели должно быть изображением.');
  if (file.kind === 'INSPECTION_VIDEO' && detected.media !== 'video')
    throw new Error('Видео осмотра должно быть видеофайлом.');
  if (extension(file.name) !== detected.extension)
    throw new Error('Расширение файла не соответствует его содержимому.');
  return { mime: detected.mime, extension: detected.extension, bytes: file.bytes.byteLength };
}

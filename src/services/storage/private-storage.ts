import type { Readable } from 'node:stream';

/** Закрытое хранилище файлов, недоступное браузеру напрямую. */
export interface PrivateStorage {
  putQuarantine(uploadId: string, bytes: Uint8Array): Promise<void>;
  openQuarantine(uploadId: string): Promise<Readable>;
  removeQuarantine(uploadId: string): Promise<void>;
  promote(uploadId: string, storageKey: string): Promise<void>;
  openPrivate(storageKey: string): Promise<Readable>;
}

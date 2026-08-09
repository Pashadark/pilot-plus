import type { Readable } from 'node:stream';

/**
 * Закрытое хранилище файлов, недоступное браузеру напрямую.
 *
 * Корень хранилища принадлежит серверу и не доступен на запись внешним процессам. Адаптер
 * защищает ключи, символьные ссылки и конкуренцию внутри процесса, но Node.js на Windows не
 * даёт переносимый эквивалент openat/O_NOFOLLOW для защиты от внешнего write-доступа к root.
 */
export interface PrivateStorage {
  putQuarantine(uploadId: string, bytes: Uint8Array): Promise<void>;
  openQuarantine(uploadId: string): Promise<Readable>;
  removeQuarantine(uploadId: string): Promise<void>;
  promote(uploadId: string, storageKey: string): Promise<void>;
  openPrivate(storageKey: string): Promise<Readable>;
}

import type { Readable } from 'node:stream';

/** Неизменяемый snapshot карантинного файла на время проверки. */
export interface QuarantineSnapshot {
  open(): Promise<Readable>;
  promote(storageKey: string): Promise<void>;
  remove(): Promise<void>;
  release(): Promise<void>;
}

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
  reserveQuarantine(uploadId: string): Promise<QuarantineSnapshot>;
}

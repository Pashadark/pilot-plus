import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, lstat, mkdir, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { PrivateStorage, QuarantineSnapshot } from './private-storage';

const unsafeStorageKeyMessage = 'Ключ приватного хранилища недопустим.';
const outsideStorageRootMessage = 'Путь приватного хранилища выходит за пределы root.';
const untrustedStorageRootMessage =
  'Корень приватного хранилища должен быть доверенной директорией.';

/** Локальное хранилище с инициализацией доверенного server-owned root. */
export class LocalPrivateStorage implements PrivateStorage {
  private operations: Promise<void> = Promise.resolve();
  private readonly reservations = new Map<string, string>();

  private constructor(
    private readonly root: string,
    private readonly quarantineRoot: string,
    private readonly privateRoot: string,
  ) {}

  static async create(root: string) {
    const configuredRoot = resolve(root);
    await mkdir(configuredRoot, { recursive: true, mode: 0o700 });
    const info = await lstat(configuredRoot);

    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(untrustedStorageRootMessage);
    }

    if (process.platform !== 'win32') {
      await chmod(configuredRoot, 0o700);
    }

    const trustedRoot = await realpath(configuredRoot);

    return new LocalPrivateStorage(
      trustedRoot,
      resolve(trustedRoot, 'quarantine'),
      resolve(trustedRoot, 'private'),
    );
  }

  async putQuarantine(uploadId: string, bytes: Uint8Array) {
    return this.runExclusive(async () => {
      this.assertNotReserved(uploadId);
      const path = await this.resolveQuarantinePath(uploadId);
      await this.writeAtomically(path, bytes);
    });
  }

  async openQuarantine(uploadId: string) {
    return this.runExclusive(async () => {
      this.assertNotReserved(uploadId);
      const path = await this.resolveQuarantinePath(uploadId);
      await this.assertRegularFile(path);
      await this.assertCriticalFile(path);
      return createReadStream(path);
    });
  }

  async removeQuarantine(uploadId: string) {
    return this.runExclusive(async () => {
      this.assertNotReserved(uploadId);
      const path = await this.resolveQuarantinePath(uploadId);
      await this.assertNoSymlinkInPath(path);
      await rm(path, { force: true });
    });
  }

  async promote(uploadId: string, storageKey: string) {
    return this.runExclusive(async () => {
      this.assertNotReserved(uploadId);
      const sourcePath = await this.resolveQuarantinePath(uploadId);
      const destinationPath = await this.resolvePrivatePath(storageKey);

      await this.assertRegularFile(sourcePath);
      await this.ensureDirectory(resolve(destinationPath, '..'));
      await this.assertMissing(destinationPath);
      await this.assertCriticalFile(sourcePath);
      await this.assertCriticalParent(destinationPath);

      // Оба пути находятся в одном trusted storage root, поэтому rename остаётся атомарным.
      await rename(sourcePath, destinationPath);
    });
  }

  async openPrivate(storageKey: string) {
    return this.runExclusive(async () => {
      const path = await this.resolvePrivatePath(storageKey);
      await this.assertRegularFile(path);
      await this.assertCriticalFile(path);
      return createReadStream(path);
    });
  }

  async removePrivate(storageKey: string) {
    return this.runExclusive(async () => {
      const path = await this.resolvePrivatePath(storageKey);
      await this.assertRegularFile(path);
      await this.assertCriticalFile(path);
      await rm(path);
    });
  }

  async removeStaleQuarantine(before: Date) {
    return this.runExclusive(async () => {
      await this.ensureDirectory(this.quarantineRoot);
      const entries = await readdir(this.quarantineRoot, { withFileTypes: true });
      let removed = 0;

      for (const entry of entries) {
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          (!entry.name.startsWith('scan-') && !entry.name.startsWith('normalized-'))
        ) {
          continue;
        }
        const path = resolve(this.quarantineRoot, entry.name);
        this.assertInsideTrustedRoot(path);
        await this.assertNoSymlinkInPath(path);
        const info = await lstat(path);
        if (!info.isFile() || info.isSymbolicLink() || info.mtime > before) continue;
        await this.assertCriticalFile(path);
        await rm(path, { force: true });
        removed += 1;
      }

      return removed;
    });
  }

  async reserveQuarantine(uploadId: string): Promise<QuarantineSnapshot> {
    return this.runExclusive(async () => {
      this.assertNotReserved(uploadId);
      const sourcePath = await this.resolveQuarantinePath(uploadId);
      const reservedPath = await this.resolveQuarantinePath(`scan-${randomUUID()}`);

      await this.assertRegularFile(sourcePath);
      await this.assertMissing(reservedPath);
      await this.assertCriticalFile(sourcePath);
      await this.assertCriticalParent(reservedPath);
      await rename(sourcePath, reservedPath);
      this.reservations.set(uploadId, reservedPath);

      return {
        open: () => this.openReserved(uploadId, reservedPath),
        promote: (storageKey) => this.promoteReserved(uploadId, reservedPath, storageKey),
        remove: () => this.removeReserved(uploadId, reservedPath),
        release: () => this.releaseReserved(uploadId, reservedPath),
      };
    });
  }

  private async runExclusive<T>(operation: () => Promise<T>) {
    let release: (() => void) | undefined;
    const next = new Promise<void>((resolveNext) => {
      release = resolveNext;
    });
    const previous = this.operations;
    this.operations = next;

    await previous;
    try {
      await this.assertTrustedRoot();
      return await operation();
    } finally {
      release?.();
    }
  }

  private async resolveQuarantinePath(uploadId: string) {
    return this.resolveStoragePath(this.quarantineRoot, uploadId);
  }

  private async openReserved(uploadId: string, reservedPath: string) {
    return this.runExclusive(async () => {
      this.assertReserved(uploadId, reservedPath);
      await this.assertRegularFile(reservedPath);
      await this.assertCriticalFile(reservedPath);
      return createReadStream(reservedPath);
    });
  }

  private async promoteReserved(uploadId: string, reservedPath: string, storageKey: string) {
    return this.runExclusive(async () => {
      this.assertReserved(uploadId, reservedPath);
      const destinationPath = await this.resolvePrivatePath(storageKey);
      await this.assertRegularFile(reservedPath);
      await this.ensureDirectory(resolve(destinationPath, '..'));
      await this.assertMissing(destinationPath);
      await this.assertCriticalFile(reservedPath);
      await this.assertCriticalParent(destinationPath);
      await rename(reservedPath, destinationPath);
      this.reservations.delete(uploadId);
    });
  }

  private async removeReserved(uploadId: string, reservedPath: string) {
    return this.runExclusive(async () => {
      this.assertReserved(uploadId, reservedPath);
      await this.assertRegularFile(reservedPath);
      await rm(reservedPath, { force: true });
      this.reservations.delete(uploadId);
    });
  }

  private async releaseReserved(uploadId: string, reservedPath: string) {
    return this.runExclusive(async () => {
      this.assertReserved(uploadId, reservedPath);
      const quarantinePath = await this.resolveQuarantinePath(uploadId);
      await this.assertRegularFile(reservedPath);
      await this.assertMissing(quarantinePath);
      await this.assertCriticalFile(reservedPath);
      await this.assertCriticalParent(quarantinePath);
      await rename(reservedPath, quarantinePath);
      this.reservations.delete(uploadId);
    });
  }

  private async resolvePrivatePath(storageKey: string) {
    return this.resolveStoragePath(this.privateRoot, storageKey);
  }

  private async resolveStoragePath(basePath: string, storageKey: string) {
    const segments = this.parseStorageKey(storageKey);
    await this.ensureDirectory(basePath);
    const path = resolve(basePath, ...segments);

    this.assertInsideTrustedRoot(path);
    await this.assertNoSymlinkInPath(path);
    return path;
  }

  private parseStorageKey(storageKey: string) {
    if (
      storageKey.length === 0 ||
      isAbsolute(storageKey) ||
      storageKey.startsWith('/') ||
      storageKey.startsWith('\\') ||
      /^[a-zA-Z]:[\\/]/.test(storageKey) ||
      storageKey.includes('\\')
    ) {
      throw new Error(unsafeStorageKeyMessage);
    }

    const segments = storageKey.split('/');
    if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
      throw new Error(unsafeStorageKeyMessage);
    }
    return segments;
  }

  private assertNotReserved(uploadId: string) {
    if (this.reservations.has(uploadId)) throw new Error('Карантинный файл уже проверяется.');
  }

  private assertReserved(uploadId: string, reservedPath: string) {
    if (this.reservations.get(uploadId) !== reservedPath) {
      throw new Error('Карантинный файл недоступен для проверки.');
    }
  }

  private async assertTrustedRoot() {
    const info = await lstat(this.root);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(untrustedStorageRootMessage);
    }

    const resolvedRoot = await realpath(this.root);
    if (!LocalPrivateStorage.pathsMatch(this.root, resolvedRoot)) {
      throw new Error(untrustedStorageRootMessage);
    }
  }

  private async ensureDirectory(path: string) {
    this.assertInsideTrustedRoot(path);
    await mkdir(path, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') {
      await chmod(path, 0o700);
    }
    await this.assertDirectory(path);
  }

  private async assertDirectory(path: string) {
    await this.assertNoSymlinkInPath(path);
    const info = await lstat(path);
    if (!info.isDirectory()) throw new Error(outsideStorageRootMessage);
    await this.assertResolvedInsideTrustedRoot(path);
  }

  private async assertRegularFile(path: string) {
    await this.assertNoSymlinkInPath(path);
    const info = await lstat(path);
    if (!info.isFile()) throw new Error('Файл приватного хранилища недоступен.');
    await this.assertResolvedInsideTrustedRoot(path);
  }

  private async assertCriticalFile(path: string) {
    await this.assertTrustedRoot();
    await this.assertRegularFile(path);
  }

  private async assertCriticalParent(path: string) {
    await this.assertTrustedRoot();
    await this.assertDirectory(resolve(path, '..'));
  }

  private async assertMissing(path: string) {
    await this.assertNoSymlinkInPath(path);
    try {
      await lstat(path);
    } catch (error) {
      if (this.isMissingPath(error)) return;
      throw error;
    }
    throw new Error('Файл с таким ключом уже существует.');
  }

  private async assertNoSymlinkInPath(path: string) {
    this.assertInsideTrustedRoot(path);
    let currentPath = this.root;
    const rootInfo = await lstat(currentPath);
    if (rootInfo.isSymbolicLink()) throw new Error(outsideStorageRootMessage);

    for (const segment of relative(this.root, path).split(sep).filter(Boolean)) {
      currentPath = resolve(currentPath, segment);
      try {
        const info = await lstat(currentPath);
        if (info.isSymbolicLink()) throw new Error(outsideStorageRootMessage);
      } catch (error) {
        if (this.isMissingPath(error)) return;
        throw error;
      }
    }
  }

  private async assertResolvedInsideTrustedRoot(path: string) {
    const resolvedPath = await realpath(path);
    this.assertInsideTrustedRoot(resolvedPath);
  }

  private assertInsideTrustedRoot(path: string) {
    const pathFromRoot = relative(this.root, path);
    if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new Error(outsideStorageRootMessage);
    }
  }

  private async writeAtomically(path: string, bytes: Uint8Array) {
    await this.ensureDirectory(resolve(path, '..'));
    await this.assertMissing(path);
    const temporaryPath = `${path}.part-${randomUUID()}`;

    try {
      await this.assertCriticalParent(temporaryPath);
      await writeFile(temporaryPath, bytes, { flag: 'wx', mode: 0o600 });
      await this.assertCriticalFile(temporaryPath);
      await this.assertMissing(path);
      await this.assertCriticalParent(path);
      await rename(temporaryPath, path);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  private isMissingPath(error: unknown) {
    return (
      typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
    );
  }

  private static pathsMatch(first: string, second: string) {
    return relative(first, second) === '' && relative(second, first) === '';
  }
}

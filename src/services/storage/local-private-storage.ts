import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, lstat, mkdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import type { PrivateStorage } from './private-storage';

const unsafeStorageKeyMessage = 'Ключ приватного хранилища недопустим.';
const outsideStorageRootMessage = 'Путь приватного хранилища выходит за пределы root.';
const untrustedStorageRootMessage =
  'Корень приватного хранилища должен быть доверенной директорией.';

/** Локальное хранилище с инициализацией доверенного server-owned root. */
export class LocalPrivateStorage implements PrivateStorage {
  private operations: Promise<void> = Promise.resolve();

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
      const path = await this.resolveQuarantinePath(uploadId);
      await this.writeAtomically(path, bytes);
    });
  }

  async openQuarantine(uploadId: string) {
    return this.runExclusive(async () => {
      const path = await this.resolveQuarantinePath(uploadId);
      await this.assertRegularFile(path);
      await this.assertCriticalFile(path);
      return createReadStream(path);
    });
  }

  async removeQuarantine(uploadId: string) {
    return this.runExclusive(async () => {
      const path = await this.resolveQuarantinePath(uploadId);
      await this.assertNoSymlinkInPath(path);
      await rm(path, { force: true });
    });
  }

  async promote(uploadId: string, storageKey: string) {
    return this.runExclusive(async () => {
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

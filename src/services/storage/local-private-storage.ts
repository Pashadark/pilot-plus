import { randomUUID } from 'node:crypto';
import { lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';

import type { PrivateStorage } from './private-storage';

const unsafeStorageKeyMessage = 'Ключ приватного хранилища недопустим.';
const outsideStorageRootMessage = 'Путь приватного хранилища выходит за пределы root.';

/** Локальное хранилище для карантина и проверенных приватных файлов. */
export class LocalPrivateStorage implements PrivateStorage {
  private readonly root: string;
  private readonly quarantineRoot: string;
  private readonly privateRoot: string;

  constructor(root: string) {
    this.root = resolve(root);
    this.quarantineRoot = resolve(this.root, 'quarantine');
    this.privateRoot = resolve(this.root, 'private');
  }

  async putQuarantine(uploadId: string, bytes: Uint8Array) {
    const path = await this.resolveQuarantinePath(uploadId);

    await this.writeAtomically(path, bytes);
  }

  async openQuarantine(uploadId: string) {
    const path = await this.resolveQuarantinePath(uploadId);

    await this.assertRegularFile(path);
    return createReadStream(path);
  }

  async removeQuarantine(uploadId: string) {
    const path = await this.resolveQuarantinePath(uploadId);

    await rm(path, { force: true });
  }

  async promote(uploadId: string, storageKey: string) {
    const sourcePath = await this.resolveQuarantinePath(uploadId);
    const destinationPath = await this.resolvePrivatePath(storageKey);

    await this.assertRegularFile(sourcePath);
    await this.assertMissingOrRegularFile(destinationPath);
    await this.ensureDirectory(resolve(destinationPath, '..'));
    await this.assertMissing(destinationPath);

    // Оба пути находятся в одном storage root, поэтому rename остаётся атомарным.
    await rename(sourcePath, destinationPath);
  }

  async openPrivate(storageKey: string) {
    const path = await this.resolvePrivatePath(storageKey);

    await this.assertRegularFile(path);
    return createReadStream(path);
  }

  private async resolveQuarantinePath(uploadId: string) {
    return this.resolveStoragePath(this.quarantineRoot, uploadId);
  }

  private async resolvePrivatePath(storageKey: string) {
    return this.resolveStoragePath(this.privateRoot, storageKey);
  }

  private async resolveStoragePath(basePath: string, storageKey: string) {
    const segments = this.parseStorageKey(storageKey);
    await this.ensureDirectory(this.root);
    await this.ensureDirectory(basePath);

    const path = resolve(basePath, ...segments);
    this.assertInsideRoot(path);
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

  private assertInsideRoot(path: string) {
    const pathFromRoot = relative(this.root, path);

    if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new Error(outsideStorageRootMessage);
    }
  }

  private async ensureDirectory(path: string) {
    this.assertInsideRoot(path);
    await mkdir(path, { recursive: true });
    await this.assertDirectory(path);
  }

  private async assertNoSymlinkInPath(path: string) {
    const pathFromRoot = relative(this.root, path);
    const segments = pathFromRoot.split(sep);
    let currentPath = this.root;

    for (const segment of segments) {
      currentPath = resolve(currentPath, segment);

      try {
        const info = await lstat(currentPath);

        if (info.isSymbolicLink()) {
          throw new Error(outsideStorageRootMessage);
        }
      } catch (error) {
        if (this.isMissingPath(error)) return;
        throw error;
      }
    }
  }

  private async assertDirectory(path: string) {
    await this.assertNoSymlinkInPath(path);
    const info = await lstat(path);

    if (!info.isDirectory()) {
      throw new Error(outsideStorageRootMessage);
    }
  }

  private async assertRegularFile(path: string) {
    await this.assertNoSymlinkInPath(path);
    const info = await lstat(path);

    if (!info.isFile()) {
      throw new Error('Файл приватного хранилища недоступен.');
    }
  }

  private async assertMissingOrRegularFile(path: string) {
    await this.assertNoSymlinkInPath(path);

    try {
      const info = await lstat(path);

      if (!info.isFile()) {
        throw new Error(outsideStorageRootMessage);
      }
    } catch (error) {
      if (this.isMissingPath(error)) return;
      throw error;
    }
  }

  private async assertMissing(path: string) {
    try {
      await lstat(path);
    } catch (error) {
      if (this.isMissingPath(error)) return;
      throw error;
    }

    throw new Error('Файл с таким ключом уже существует.');
  }

  private async writeAtomically(path: string, bytes: Uint8Array) {
    await this.ensureDirectory(resolve(path, '..'));
    await this.assertMissingOrRegularFile(path);

    const temporaryPath = `${path}.part-${randomUUID()}`;

    try {
      await writeFile(temporaryPath, bytes, { flag: 'wx' });
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
}

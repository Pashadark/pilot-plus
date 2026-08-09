import { mkdtemp, mkdir, readFile, rm, symlink, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { afterEach, describe, expect, it } from 'vitest';

type PrivateStorageForTest = {
  putQuarantine(uploadId: string, bytes: Uint8Array): Promise<void>;
  openQuarantine(uploadId: string): Promise<Readable>;
  removeQuarantine(uploadId: string): Promise<void>;
  promote(uploadId: string, storageKey: string): Promise<void>;
  openPrivate(storageKey: string): Promise<Readable>;
  removePrivate(storageKey: string): Promise<void>;
  removeStaleQuarantine(before: Date): Promise<number>;
  reserveQuarantine(uploadId: string): Promise<{
    open(): Promise<Readable>;
    promote(storageKey: string): Promise<void>;
    remove(): Promise<void>;
    release(): Promise<void>;
  }>;
};

type LocalPrivateStorageFactory = {
  create(root: string): Promise<PrivateStorageForTest>;
};

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

async function createStorage() {
  const root = await mkdtemp(join(tmpdir(), 'pilot-private-storage-'));
  temporaryRoots.push(root);

  const modulePath = './local-private-storage';
  const imported = await import(modulePath).catch(() => undefined);

  expect(imported).toBeDefined();
  if (!imported) {
    throw new Error('Адаптер приватного хранилища не найден.');
  }

  const LocalPrivateStorage = (imported as { LocalPrivateStorage: LocalPrivateStorageFactory })
    .LocalPrivateStorage;

  expect(LocalPrivateStorage).toBeTypeOf('function');
  const factory = LocalPrivateStorage as unknown as LocalPrivateStorageFactory;

  expect(factory.create).toBeTypeOf('function');
  return { root, storage: await factory.create(root) };
}

async function readAll(stream: Readable) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

describe('LocalPrivateStorage', () => {
  it('перемещает карантинный файл в закрытое хранилище без использования исходного имени', async () => {
    const { root, storage } = await createStorage();
    const bytes = Buffer.from('содержимое документа');
    const finalKey = 'companies/c1/clients/u1/documents/d1/v1';

    await storage.putQuarantine('upload-1', bytes);
    await expect(storage.openPrivate('upload-1')).rejects.toThrow();
    expect(await readAll(await storage.openQuarantine('upload-1'))).toEqual(bytes);

    await storage.promote('upload-1', finalKey);

    expect(await readAll(await storage.openPrivate(finalKey))).toEqual(bytes);
    await expect(storage.openQuarantine('upload-1')).rejects.toThrow();
    await expect(readFile(join(root, 'private', finalKey))).resolves.toEqual(bytes);
  });

  it('удаляет только приватный файл внутри trusted root', async () => {
    const { storage } = await createStorage();
    const finalKey = 'companies/c1/clients/u1/photos/source/upload-1';
    await storage.putQuarantine('upload-1', Buffer.from('clean-photo'));
    await storage.promote('upload-1', finalKey);

    await storage.removePrivate(finalKey);

    await expect(storage.openPrivate(finalKey)).rejects.toThrow();
    await expect(storage.removePrivate('../outside')).rejects.toThrow(
      'Ключ приватного хранилища недопустим.',
    );
  });

  it('удаляет только age-expired regular quarantine files for crash recovery', async () => {
    const { root, storage } = await createStorage();
    await storage.putQuarantine('scan-old-upload', Buffer.from('old'));
    await storage.putQuarantine('scan-fresh-upload', Buffer.from('fresh'));
    await storage.putQuarantine('retained-error-upload', Buffer.from('retained'));
    const old = new Date('2026-08-10T10:00:00.000Z');
    const fresh = new Date('2026-08-10T10:30:00.000Z');
    await utimes(join(root, 'quarantine', 'scan-old-upload'), old, old);
    await utimes(join(root, 'quarantine', 'scan-fresh-upload'), fresh, fresh);
    await utimes(join(root, 'quarantine', 'retained-error-upload'), old, old);

    await expect(storage.removeStaleQuarantine(new Date('2026-08-10T10:15:00.000Z'))).resolves.toBe(
      1,
    );

    await expect(storage.openQuarantine('scan-old-upload')).rejects.toThrow();
    await expect(readAll(await storage.openQuarantine('scan-fresh-upload'))).resolves.toEqual(
      Buffer.from('fresh'),
    );
    await expect(readAll(await storage.openQuarantine('retained-error-upload'))).resolves.toEqual(
      Buffer.from('retained'),
    );
  });

  it.each([
    '../outside',
    'companies/../../outside',
    '/absolute/path',
    'C:\\absolute\\path',
    'companies\\c1\\clients\\u1',
  ])('отклоняет ключ с выходом за пределы root: %s', async (unsafeKey) => {
    const { storage } = await createStorage();

    await expect(storage.putQuarantine(unsafeKey, Buffer.from('данные'))).rejects.toThrow(
      'Ключ приватного хранилища недопустим.',
    );
    await expect(storage.openPrivate(unsafeKey)).rejects.toThrow(
      'Ключ приватного хранилища недопустим.',
    );
  });

  it('не следует по символьной ссылке за пределы хранилища', async () => {
    const { root, storage } = await createStorage();
    const outside = await mkdtemp(join(tmpdir(), 'pilot-private-outside-'));
    temporaryRoots.push(outside);
    await mkdir(join(root, 'private'), { recursive: true });
    await symlink(outside, join(root, 'private', 'companies'), 'junction');

    await storage.putQuarantine('upload-1', Buffer.from('данные'));

    await expect(
      storage.promote('upload-1', 'companies/c1/clients/u1/documents/d1/v1'),
    ).rejects.toThrow('Путь приватного хранилища выходит за пределы root.');
  });

  it('резервирует неизменяемый snapshot и запрещает подмену uploadId до release', async () => {
    const { storage } = await createStorage();
    await storage.putQuarantine('upload-1', Buffer.from('оригинал'));

    const snapshot = await storage.reserveQuarantine('upload-1');

    await expect(storage.putQuarantine('upload-1', Buffer.from('подмена'))).rejects.toThrow(
      'Карантинный файл уже проверяется.',
    );
    expect(await readAll(await snapshot.open())).toEqual(Buffer.from('оригинал'));

    await snapshot.release();

    expect(await readAll(await storage.openQuarantine('upload-1'))).toEqual(
      Buffer.from('оригинал'),
    );
  });

  it('отклоняет trusted root, который является junction или символьной ссылкой', async () => {
    const actualRoot = await mkdtemp(join(tmpdir(), 'pilot-private-storage-actual-'));
    const linkedRoot = join(tmpdir(), `pilot-private-storage-link-${Date.now()}`);
    temporaryRoots.push(actualRoot, linkedRoot);
    await symlink(actualRoot, linkedRoot, 'junction');

    const modulePath = './local-private-storage';
    const imported = await import(modulePath);
    const factory = (imported as { LocalPrivateStorage: LocalPrivateStorageFactory })
      .LocalPrivateStorage;

    await expect(factory.create(linkedRoot)).rejects.toThrow(
      'Корень приватного хранилища должен быть доверенной директорией.',
    );
  });
});

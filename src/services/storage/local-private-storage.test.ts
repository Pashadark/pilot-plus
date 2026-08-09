import { mkdtemp, mkdir, readFile, rm, symlink } from 'node:fs/promises';
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
};

type LocalPrivateStorageConstructor = new (root: string) => PrivateStorageForTest;

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

  const LocalPrivateStorage = (imported as { LocalPrivateStorage: LocalPrivateStorageConstructor })
    .LocalPrivateStorage;

  expect(LocalPrivateStorage).toBeTypeOf('function');
  return { root, storage: new LocalPrivateStorage(root) };
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
});

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
  removePrivate(storageKey: string): Promise<void>;
  removeUploadArtifacts(uploadId: string): Promise<number>;
  reserveQuarantine(uploadId: string): Promise<{
    open(): Promise<Readable>;
    promote(storageKey: string): Promise<void>;
    remove(): Promise<void>;
    release(): Promise<void>;
  }>;
};

type LocalPrivateStorageFactory = {
  create(
    root: string,
    options?: { projectRoot?: string; production?: boolean; allowRepoRoot?: boolean },
  ): Promise<PrivateStorageForTest>;
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

  it('удаляет artifacts только claimed durable uploadId', async () => {
    const { storage } = await createStorage();
    await storage.putQuarantine('upload-1', Buffer.from('stale'));
    await storage.putQuarantine('upload-2', Buffer.from('active'));
    const stale = await storage.reserveQuarantine('upload-1');
    const active = await storage.reserveQuarantine('upload-2');

    await expect(storage.removeUploadArtifacts('upload-1')).resolves.toBe(1);
    await expect(stale.open()).rejects.toThrow();
    await active.release();
    await expect(readAll(await storage.openQuarantine('upload-2'))).resolves.toEqual(
      Buffer.from('active'),
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

  it.each(['public/client-files', 'PUBLIC/client-files', '.next/private', '.git/documents', '.'])(
    'отклоняет storage root внутри публикуемой или служебной директории: %s',
    async (relativeRoot) => {
      const projectRoot = await mkdtemp(join(tmpdir(), 'pilot-project-'));
      temporaryRoots.push(projectRoot);
      const modulePath = './local-private-storage';
      const imported = await import(modulePath);
      const factory = (imported as { LocalPrivateStorage: LocalPrivateStorageFactory })
        .LocalPrivateStorage;

      await expect(
        factory.create(join(projectRoot, relativeRoot), { projectRoot, production: false }),
      ).rejects.toThrow('Корень приватного хранилища выбран небезопасно.');
    },
  );

  it('в production требует явного override для repo-local root, но не ломает approved dev root', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'pilot-project-'));
    temporaryRoots.push(projectRoot);
    const root = join(projectRoot, '.pilot-private-storage');
    const modulePath = './local-private-storage';
    const imported = await import(modulePath);
    const factory = (imported as { LocalPrivateStorage: LocalPrivateStorageFactory })
      .LocalPrivateStorage;

    await expect(factory.create(root, { projectRoot, production: true })).rejects.toThrow(
      'Production-хранилище должно находиться вне каталога исходного кода.',
    );
    await expect(factory.create(root, { projectRoot, production: false })).resolves.toBeDefined();
    await expect(
      factory.create(root, { projectRoot, production: true, allowRepoRoot: true }),
    ).resolves.toBeDefined();
  });

  it('считает tenant private bytes для quota без чтения содержимого в память', async () => {
    const { storage } = await createStorage();
    const quotaStorage = storage as PrivateStorageForTest & {
      privateUsageBytes(prefix: string): Promise<number>;
    };
    await storage.putQuarantine('upload-1', Buffer.alloc(7));
    await storage.promote('upload-1', 'companies/company-1/clients/client-1/documents/d1/1.pdf');
    await storage.putQuarantine('upload-2', Buffer.alloc(11));
    await storage.promote('upload-2', 'companies/company-2/clients/client-2/documents/d2/1.pdf');

    await expect(quotaStorage.privateUsageBytes('companies/company-1')).resolves.toBe(7);
  });

  it('два adapter instance не могут одновременно зарезервировать один quarantine-файл', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pilot-private-storage-'));
    temporaryRoots.push(root);
    const modulePath = './local-private-storage';
    const imported = await import(modulePath);
    const factory = (imported as { LocalPrivateStorage: LocalPrivateStorageFactory })
      .LocalPrivateStorage;
    const first = await factory.create(root);
    const second = await factory.create(root);
    await first.putQuarantine('upload-1', Buffer.from('immutable'));

    const results = await Promise.allSettled([
      first.reserveQuarantine('upload-1'),
      second.reserveQuarantine('upload-1'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});

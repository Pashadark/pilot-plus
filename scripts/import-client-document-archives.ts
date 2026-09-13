import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import type { ClientDocumentCategory } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { validateUploadedFile } from '@/modules/client-documents/file-validation';
import {
  planArchiveImport,
  type ArchiveImportEntry,
} from '@/modules/client-documents/server/archive-import';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

type ManifestEntry = Omit<ArchiveImportEntry, 'sha256'>;

const manifestArgument = process.argv.find((argument) => argument.startsWith('--manifest='));
const manifestPath = resolve(manifestArgument?.slice('--manifest='.length) ?? 'manifest.json');
const apply = process.argv.includes('--apply');
const allowedCategories = new Set<ClientDocumentCategory>(['PASSPORT', 'DRIVER_LICENSE']);

function fullName(client: { firstName: string; middleName: string | null; lastName: string }) {
  return [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
}

function storageKey(companyId: string, clientId: string, documentId: string, extension: string) {
  return `companies/${companyId}/clients/${clientId}/documents/${documentId}/1.${extension}`;
}

async function loadEntries() {
  const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  if (!Array.isArray(raw)) throw new Error('Манифест должен быть массивом.');

  const entries: ArchiveImportEntry[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') throw new Error('Строка манифеста повреждена.');
    const entry = value as Partial<ManifestEntry>;
    if (
      typeof entry.clientName !== 'string' ||
      !allowedCategories.has(entry.category as ClientDocumentCategory) ||
      typeof entry.title !== 'string' ||
      typeof entry.sourcePath !== 'string'
    ) {
      throw new Error('Строка манифеста содержит недопустимые поля.');
    }
    const sourcePath = resolve(dirname(manifestPath), entry.sourcePath);
    const bytes = new Uint8Array(await readFile(sourcePath));
    validateUploadedFile({ name: sourcePath, bytes });
    entries.push({
      clientName: entry.clientName,
      category: entry.category as ClientDocumentCategory,
      title: entry.title,
      sourcePath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return entries;
}

async function main() {
  const entries = await loadEntries();
  const clients = await prisma.client.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      companyId: true,
      firstName: true,
      middleName: true,
      lastName: true,
      documents: {
        where: { archivedAt: null },
        select: { versions: { select: { sha256: true } } },
      },
    },
  });
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const existingHashesByClientId = new Map(
    clients.map((client) => [
      client.id,
      new Set(client.documents.flatMap((document) => document.versions.map((item) => item.sha256))),
    ]),
  );
  const plan = planArchiveImport({
    entries,
    clients: clients.map((client) => ({ id: client.id, name: fullName(client) })),
    existingHashesByClientId,
  });

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          toImport: plan.toImport.map(({ clientName, category, title }) => ({
            clientName,
            category,
            title,
          })),
          duplicates: plan.duplicates.length,
          unmatched: plan.unmatched.map(({ clientName, title }) => ({ clientName, title })),
          ambiguous: plan.ambiguous.map(({ clientName, title }) => ({ clientName, title })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('PRIVATE_STORAGE_ROOT не настроен.');
  const storage = await LocalPrivateStorage.create(root);
  const scanner = ClamAvClient.fromEnvironment();
  let imported = 0;

  for (const entry of plan.toImport) {
    const client = clientById.get(entry.clientId);
    if (!client) throw new Error('Клиент исчез во время импорта.');
    const actor = await prisma.companyMember.findFirst({
      where: { companyId: client.companyId },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    if (!actor) throw new Error(`Для компании клиента ${entry.clientName} нет пользователя.`);

    const metadata = await scanner.getMetadata();
    if (!metadata) throw new Error('Антивирусная проверка недоступна.');
    const verdict = await scanner.scanStream(createReadStream(entry.sourcePath));
    if (verdict.kind !== 'clean') {
      throw new Error(`Файл клиента ${entry.clientName} не прошёл антивирусную проверку.`);
    }

    const bytes = new Uint8Array(await readFile(entry.sourcePath));
    const verified = validateUploadedFile({ name: entry.sourcePath, bytes });
    const uploadId = randomUUID();
    const created = await prisma.$transaction(async (transaction) => {
      const document = await transaction.clientDocument.create({
        data: {
          companyId: client.companyId,
          clientId: client.id,
          category: entry.category,
          title: entry.title,
          status: 'UPLOADING',
          currentVersion: 1,
          createdByUserId: actor.userId,
        },
        select: { id: true },
      });
      const key = storageKey(client.companyId, client.id, document.id, verified.extension);
      const version = await transaction.clientDocumentVersion.create({
        data: {
          documentId: document.id,
          uploadId,
          version: 1,
          storageKey: key,
          originalName: basename(entry.sourcePath).slice(0, 180),
          verifiedMime: verified.mime,
          bytes: verified.bytes,
          sha256: entry.sha256,
          scanVerdict: 'PENDING',
        },
        select: { id: true },
      });
      return { documentId: document.id, versionId: version.id, key };
    });

    await storage.putQuarantine(uploadId, bytes);
    await storage.promote(uploadId, created.key);
    await prisma.$transaction([
      prisma.clientDocument.update({
        where: { id: created.documentId },
        data: { status: 'CLEAN' },
      }),
      prisma.clientDocumentVersion.update({
        where: { id: created.versionId },
        data: {
          scanVerdict: 'CLEAN',
          scanEngine: metadata.engine,
          signatureVersion: metadata.signatureVersion,
          scannedAt: new Date(),
          ledgerCommittedBytes: verified.bytes,
        },
      }),
      prisma.clientStorageLedger.upsert({
        where: { companyId: client.companyId },
        create: { companyId: client.companyId, committedBytes: BigInt(verified.bytes) },
        update: { committedBytes: { increment: BigInt(verified.bytes) } },
      }),
    ]);
    imported += 1;
    console.log(`Импортирован документ: ${entry.clientName} — ${entry.title}`);
  }

  console.log(
    JSON.stringify(
      {
        mode: 'apply',
        imported,
        duplicates: plan.duplicates.length,
        unmatched: plan.unmatched.length,
        ambiguous: plan.ambiguous.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Импорт не завершён.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

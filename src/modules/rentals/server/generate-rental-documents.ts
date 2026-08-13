import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import { Prisma, type RentalDocumentFormat } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { generateRentalDocx } from '@/modules/rentals/documents/docx/generate-docx';
import {
  convertDocxToPdf,
  PdfConversionError,
  type PdfConverter,
} from '@/modules/rentals/documents/pdf/convert-docx-to-pdf';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';
import type { PrivateStorage } from '@/services/storage/private-storage';
import { scanPendingUpload } from '@/modules/client-documents/scan-upload';

import { requireRentalAccess } from './access';
import { retrySerializable } from './confirm-rental';

type Snapshot = Parameters<typeof generateRentalDocx>[0];
type Actor = { id: string; email: string };
type Authorization = { scope: 'SYSTEM' | 'COMPANY'; actor: Actor };

export type ConfirmedRentalSource = {
  rentalId: string;
  companyId: string;
  clientId: string;
  contractNumber: string;
  snapshot: Snapshot;
};

export type DocumentArtifact = {
  format: RentalDocumentFormat;
  uploadId: string;
  documentId: string;
  documentVersionId: string;
  storageKey: string;
  originalName: string;
  verifiedMime: string;
  bytes: Uint8Array;
  sha256: string;
};

export type PairArtifactStorage = {
  stageAndPromote(artifact: DocumentArtifact): Promise<{
    sha256: string;
    scanEngine: string;
    signatureVersion?: string;
  }>;
  cleanup(artifacts: readonly DocumentArtifact[]): Promise<void>;
};

export type DocumentPairRepository = {
  loadConfirmedRental(input: {
    companyId: string;
    rentalId: string;
  }): Promise<ConfirmedRentalSource | null>;
  findExistingPair(input: { companyId: string; rentalId: string }): Promise<number | null>;
  commit(input: {
    source: ConfirmedRentalSource;
    artifacts: readonly DocumentArtifact[];
    scans: ReadonlyMap<RentalDocumentFormat, { scanEngine: string; signatureVersion?: string }>;
    actor: Actor;
    authorization?: Authorization;
  }): Promise<{ version: number; created: boolean }>;
};

export type GenerateRentalDocumentPairInput = {
  companyId: string;
  rentalId: string;
  actor: Actor;
  authorization?: Authorization;
};

type PairGeneratorDependencies = {
  repository: DocumentPairRepository;
  storage: PairArtifactStorage;
  generateDocx: (snapshot: Snapshot, options: { contractNumber: string }) => Promise<Uint8Array>;
  convertPdf: PdfConverter;
};

const safeIdentifier = /^[A-Za-z0-9_-]{1,128}$/u;
const contractNumberPattern = /^ME-\d{4}-\d{4,}-BK$/u;

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

function documentStorageKey(source: ConfirmedRentalSource, documentId: string, extension: string) {
  if (
    !safeIdentifier.test(source.companyId) ||
    !safeIdentifier.test(source.clientId) ||
    !safeIdentifier.test(documentId)
  ) {
    throw new Error('Недопустимый идентификатор документа договора.');
  }
  return `companies/${source.companyId}/clients/${source.clientId}/documents/${documentId}/1.${extension}`;
}

function requireConfirmedSnapshot(source: ConfirmedRentalSource): Snapshot {
  const snapshot = source.snapshot as unknown;
  if (
    !contractNumberPattern.test(source.contractNumber) ||
    typeof snapshot !== 'object' ||
    snapshot === null ||
    (snapshot as { schemaVersion?: unknown }).schemaVersion !== 1 ||
    (snapshot as { completeness?: { confirmedReady?: unknown } }).completeness?.confirmedReady !==
      true
  ) {
    throw new Error('Подтверждённый снимок договора недоступен.');
  }
  return source.snapshot;
}

function artifact(
  source: ConfirmedRentalSource,
  format: RentalDocumentFormat,
  bytes: Uint8Array,
): DocumentArtifact {
  const extension = format.toLowerCase();
  const documentId = randomUUID();
  return {
    format,
    uploadId: randomUUID(),
    documentId,
    documentVersionId: randomUUID(),
    storageKey: documentStorageKey(source, documentId, extension),
    originalName: `rental-${source.contractNumber}.${extension}`,
    verifiedMime:
      format === 'DOCX'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf',
    bytes,
    sha256: sha256(bytes),
  };
}

function publicError(error: unknown) {
  if (error instanceof PdfConversionError) return error;
  return new Error('Не удалось сохранить документы договора.');
}

/** Generates and promotes the DOCX/PDF pair before one serializable metadata commit. */
export function createRentalDocumentPairGenerator(dependencies: PairGeneratorDependencies) {
  return async function generate(
    input: GenerateRentalDocumentPairInput,
  ): Promise<{ version: number }> {
    const source = await dependencies.repository.loadConfirmedRental({
      companyId: input.companyId,
      rentalId: input.rentalId,
    });
    if (!source) throw new Error('Подтверждённая аренда недоступна.');
    const existingVersion = await dependencies.repository.findExistingPair({
      companyId: source.companyId,
      rentalId: source.rentalId,
    });
    if (existingVersion !== null) return { version: existingVersion };

    const snapshot = requireConfirmedSnapshot(source);
    let artifacts: DocumentArtifact[] = [];
    let committed = false;
    try {
      const docx = await dependencies.generateDocx(snapshot, {
        contractNumber: source.contractNumber,
      });
      let pdf: Uint8Array;
      try {
        pdf = await dependencies.convertPdf(docx);
      } catch {
        throw new PdfConversionError();
      }
      artifacts = [artifact(source, 'DOCX', docx), artifact(source, 'PDF', pdf)];
      const scans = new Map<
        RentalDocumentFormat,
        { scanEngine: string; signatureVersion?: string }
      >();
      for (const current of artifacts) {
        const scan = await dependencies.storage.stageAndPromote(current);
        if (scan.sha256 !== current.sha256)
          throw new Error('Контрольная сумма документа не совпала.');
        scans.set(current.format, {
          scanEngine: scan.scanEngine,
          signatureVersion: scan.signatureVersion,
        });
      }
      const result = await dependencies.repository.commit({
        source,
        artifacts,
        scans,
        actor: input.actor,
        authorization: input.authorization,
      });
      committed = result.created;
      if (!result.created) await dependencies.storage.cleanup(artifacts);
      return { version: result.version };
    } catch (error) {
      if (artifacts.length > 0 && !committed) {
        await dependencies.storage.cleanup(artifacts).catch(() => undefined);
      }
      throw publicError(error);
    }
  };
}

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('Приватное хранилище не настроено.');
  return root;
}

function privatePairArtifactStorage(storage: PrivateStorage): PairArtifactStorage {
  const scanner = ClamAvClient.fromEnvironment();
  return {
    async stageAndPromote(current) {
      await storage.putQuarantine(current.uploadId, current.bytes);
      const result = await scanPendingUpload({
        storage,
        scanner,
        uploadId: current.uploadId,
        storageKey: current.storageKey,
      });
      if (result.status !== 'CLEAN') throw new Error('Проверка документа договора не завершена.');
      return {
        sha256: result.audit.sha256,
        scanEngine: result.audit.engine ?? 'ClamAV',
        signatureVersion: result.audit.signatureVersion,
      };
    },
    async cleanup(artifacts) {
      await Promise.all(
        artifacts.map(async (current) => {
          await storage.removeUploadArtifacts(current.uploadId).catch(() => 0);
          await storage.removePrivate(current.storageKey).catch(() => undefined);
        }),
      );
    },
  };
}

function isPrismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function createPrismaDocumentPairRepository(): DocumentPairRepository {
  return {
    async loadConfirmedRental({ companyId, rentalId }) {
      const rental = await prisma.rental.findFirst({
        where: { id: rentalId, companyId, status: 'CONFIRMED', contractNumber: { not: null } },
        select: { id: true, companyId: true, clientId: true, contractNumber: true, snapshot: true },
      });
      if (!rental?.contractNumber) return null;
      return {
        rentalId: rental.id,
        companyId: rental.companyId,
        clientId: rental.clientId,
        contractNumber: rental.contractNumber,
        snapshot: rental.snapshot as Snapshot,
      };
    },
    async findExistingPair({ companyId, rentalId }) {
      const records = await prisma.rentalDocumentVersion.findMany({
        where: { companyId, rentalId },
        select: { version: true, format: true },
      });
      return completePairVersion(records);
    },
    async commit(input) {
      return retrySerializable(async () =>
        prisma.$transaction(
          async (transaction) => {
            await verifyAuthorization(transaction, input.source.companyId, input.authorization);
            const rental = await transaction.rental.findFirst({
              where: {
                id: input.source.rentalId,
                companyId: input.source.companyId,
                clientId: input.source.clientId,
                status: 'CONFIRMED',
                contractNumber: input.source.contractNumber,
              },
              select: { id: true },
            });
            if (!rental) throw new Error('Подтверждённая аренда недоступна.');
            const existing = await transaction.rentalDocumentVersion.findMany({
              where: { companyId: input.source.companyId, rentalId: input.source.rentalId },
              select: { version: true, format: true },
            });
            const existingVersion = completePairVersion(existing);
            if (existingVersion !== null) return { version: existingVersion, created: false };
            if (existing.length > 0)
              throw new Error('Найдена неполная версия документов договора.');

            const latest = await transaction.rentalDocumentVersion.findFirst({
              where: { companyId: input.source.companyId, rentalId: input.source.rentalId },
              orderBy: { version: 'desc' },
              select: { version: true },
            });
            const version = (latest?.version ?? 0) + 1;
            const current = new Date();
            for (const document of input.artifacts) {
              const scan = input.scans.get(document.format);
              if (!scan) throw new Error('Отсутствует результат проверки документа договора.');
              await transaction.clientDocument.create({
                data: {
                  id: document.documentId,
                  companyId: input.source.companyId,
                  clientId: input.source.clientId,
                  category: 'CONTRACT',
                  title: `Договор ${input.source.contractNumber} (${document.format})`,
                  status: 'CLEAN',
                  currentVersion: 1,
                  createdByUserId: input.actor.id,
                  versions: {
                    create: {
                      id: document.documentVersionId,
                      uploadId: document.uploadId,
                      version: 1,
                      storageKey: document.storageKey,
                      originalName: document.originalName,
                      verifiedMime: document.verifiedMime,
                      bytes: document.bytes.byteLength,
                      sha256: document.sha256,
                      scanEngine: scan.scanEngine,
                      signatureVersion: scan.signatureVersion,
                      scanVerdict: 'CLEAN',
                      scannedAt: current,
                    },
                  },
                },
              });
              await transaction.rentalDocumentVersion.create({
                data: {
                  companyId: input.source.companyId,
                  clientId: input.source.clientId,
                  rentalId: input.source.rentalId,
                  clientDocumentId: document.documentId,
                  clientDocumentVersionId: document.documentVersionId,
                  version,
                  format: document.format,
                },
              });
            }
            await transaction.auditLog.create({
              data: {
                companyId: input.source.companyId,
                actorUserId: input.actor.id,
                actorEmailSnapshot: input.actor.email,
                action: 'CREATE',
                entityType: 'RENTAL',
                entityId: input.source.rentalId,
                entityLabel: 'Документы договора аренды',
                changes: { version, formats: ['DOCX', 'PDF'] },
              },
            });
            return { version, created: true };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      ).catch((error: unknown) => {
        if (isPrismaCode(error, 'P2002'))
          throw new Error('Версия документов договора уже существует.');
        throw error;
      });
    },
  };
}

function completePairVersion(
  records: readonly { version: number; format: RentalDocumentFormat }[],
) {
  const formatsByVersion = new Map<number, Set<RentalDocumentFormat>>();
  for (const record of records) {
    const formats = formatsByVersion.get(record.version) ?? new Set<RentalDocumentFormat>();
    formats.add(record.format);
    formatsByVersion.set(record.version, formats);
  }
  const complete = [...formatsByVersion]
    .filter(([, formats]) => formats.has('DOCX') && formats.has('PDF'))
    .map(([version]) => version)
    .sort((first, second) => second - first);
  return complete[0] ?? null;
}

async function verifyAuthorization(
  transaction: Prisma.TransactionClient,
  companyId: string,
  authorization: Authorization | undefined,
) {
  if (!authorization) throw new Error('Доступ к договорам аренды запрещён.');
  if (authorization.scope === 'SYSTEM') {
    const user = await transaction.user.findFirst({
      where: { id: authorization.actor.id, role: 'SUPER_ADMIN', isActive: true },
      select: { id: true },
    });
    if (user) return;
  } else {
    const member = await transaction.companyMember.findFirst({
      where: {
        companyId,
        userId: authorization.actor.id,
        role: { in: ['COMPANY_ADMIN', 'DISPATCHER'] },
      },
      select: { id: true },
    });
    if (member) return;
  }
  throw new Error('Доступ к договорам аренды запрещён.');
}

/** Server entry point. Company scope is explicit so authorization happens before file access. */
export async function generateRentalDocumentPair(input: {
  companyId: string;
  rentalId: string;
}): Promise<{ version: number }> {
  const access = await requireRentalAccess(input.companyId);
  const storage = await LocalPrivateStorage.create(privateStorageRoot());
  const generate = createRentalDocumentPairGenerator({
    repository: createPrismaDocumentPairRepository(),
    storage: privatePairArtifactStorage(storage),
    generateDocx: generateRentalDocx,
    convertPdf: convertDocxToPdf,
  });
  return generate({
    ...input,
    actor: { id: access.user.id, email: access.user.email },
    authorization: { scope: access.scope, actor: { id: access.user.id, email: access.user.email } },
  });
}

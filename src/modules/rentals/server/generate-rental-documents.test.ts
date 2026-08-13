import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { buildRentalSnapshot } from '../domain/build-snapshot';
import {
  createRentalDocumentPairGenerator,
  type DocumentPairRepository,
  type PairArtifactStorage,
} from './generate-rental-documents';

const snapshot = buildRentalSnapshot({
  confirmedReady: true,
  company: {
    id: 'company-1',
    legalName: 'ООО Пилот',
    inn: '7700000000',
    address: 'Москва, ул. Пример, 1',
    signatoryName: 'Иван Петров',
    signatoryAuthority: 'Устав',
    contractCity: 'Москва',
    defaultPickupAddress: 'Москва, Тверская, 1',
    defaultReturnAddress: 'Москва, Тверская, 2',
  },
  client: {
    id: 'client-1',
    fullName: 'Иван Иванов',
    phone: '+79990000000',
    passport: '45 01 123456',
    birthDate: '2000-01-01',
    registrationAddress: 'Москва',
    licenseNumber: '77 01 123456',
  },
  vehicle: {
    id: 'vehicle-1',
    make: 'Volkswagen',
    model: 'Polo',
    registrationNumber: 'А156АХ997',
    vin: 'VIN',
    dailyMinor: 470000,
    depositMinor: 1000000,
  },
  rental: {
    id: 'rental-1',
    startsAt: new Date('2026-08-12T09:00:00.000Z'),
    endsAt: new Date('2026-08-13T09:00:00.000Z'),
    calculatedTotalMinor: 470000,
    agreedTotalMinor: 470000,
    currency: 'RUB',
  },
});

function hash(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

function source() {
  return {
    rentalId: 'rental-1',
    companyId: 'company-1',
    clientId: 'client-1',
    contractNumber: 'ME-2026-0001-BK',
    legalContentVersion: 'legal-content-v1',
    snapshot,
  };
}

function storage(): PairArtifactStorage & {
  quarantine: Map<string, Uint8Array>;
  privateFiles: Map<string, Uint8Array>;
} {
  const quarantine = new Map<string, Uint8Array>();
  const privateFiles = new Map<string, Uint8Array>();
  return {
    quarantine,
    privateFiles,
    async stageAndPromote(artifact) {
      quarantine.set(artifact.uploadId, artifact.bytes);
      const staged = quarantine.get(artifact.uploadId);
      if (!staged) throw new Error('missing quarantine artifact');
      quarantine.delete(artifact.uploadId);
      privateFiles.set(artifact.storageKey, staged);
      return { sha256: hash(staged), scanEngine: 'ClamAV', signatureVersion: 'test' };
    },
    async cleanup(artifacts) {
      for (const artifact of artifacts) {
        quarantine.delete(artifact.uploadId);
        privateFiles.delete(artifact.storageKey);
      }
    },
  };
}

function repository(commit: DocumentPairRepository['commit']): DocumentPairRepository {
  return {
    loadConfirmedRental: vi.fn().mockResolvedValue(source()),
    findExistingPair: vi.fn().mockResolvedValue(null),
    reserveGeneration: vi
      .fn()
      .mockResolvedValue({ generationId: 'generation-default', version: 1 }),
    markPromoted: vi.fn(),
    markError: vi.fn(),
    commit,
  };
}

describe('generateRentalDocumentPair', () => {
  it('does not leave a half-pair when PDF conversion fails', async () => {
    const artifacts = storage();
    const commit = vi.fn();
    const generate = createRentalDocumentPairGenerator({
      repository: repository(commit),
      storage: artifacts,
      generateDocx: vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 3, 4])),
      convertPdf: vi.fn().mockRejectedValue(new Error('converter failure')),
    });

    await expect(generate({ companyId: 'company-1', rentalId: 'rental-1', actor })).rejects.toThrow(
      'PDF',
    );
    expect(commit).not.toHaveBeenCalled();
    expect(artifacts.privateFiles).toHaveLength(0);
    expect(artifacts.quarantine).toHaveLength(0);
  });

  it('creates durable PENDING lifecycle metadata before the first private storage promotion', async () => {
    const artifacts = storage();
    const events: string[] = [];
    const repo = repository(vi.fn().mockResolvedValue({ version: 1, created: true }));
    repo.reserveGeneration = vi.fn().mockImplementation(async () => {
      events.push('reserved');
      return { generationId: 'generation-1', version: 1 };
    });
    repo.markPromoted = vi.fn().mockImplementation(async () => events.push('promoted'));
    const originalStage = artifacts.stageAndPromote;
    artifacts.stageAndPromote = async (current) => {
      events.push(`storage:${current.format}`);
      return originalStage(current);
    };
    const generate = createRentalDocumentPairGenerator({
      repository: repo,
      storage: artifacts,
      generateDocx: vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 3, 4])),
      convertPdf: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1])),
    });

    await expect(
      generate({ companyId: 'company-1', rentalId: 'rental-1', actor }),
    ).resolves.toEqual({
      version: 1,
    });
    expect(events).toEqual(['reserved', 'storage:DOCX', 'storage:PDF', 'promoted']);
    expect(repo.commit).toHaveBeenCalledWith(
      expect.objectContaining({ generationId: 'generation-1', version: 1 }),
    );
  });

  it('uses the rental template legal-content version and rejects an unsupported version', async () => {
    const artifacts = storage();
    const generateDocx = vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 3, 4]));
    const repo = repository(vi.fn().mockResolvedValue({ version: 1, created: true }));
    repo.reserveGeneration = vi
      .fn()
      .mockResolvedValue({ generationId: 'generation-1', version: 1 });
    repo.markPromoted = vi.fn();
    const generate = createRentalDocumentPairGenerator({
      repository: repo,
      storage: artifacts,
      generateDocx,
      convertPdf: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1])),
    });

    await generate({ companyId: 'company-1', rentalId: 'rental-1', actor });
    expect(generateDocx).toHaveBeenCalledWith(snapshot, {
      contractNumber: 'ME-2026-0001-BK',
      templateVersion: 'legal-content-v1',
    });

    repo.loadConfirmedRental = vi
      .fn()
      .mockResolvedValue({ ...source(), legalContentVersion: 'unknown' });
    await expect(generate({ companyId: 'company-1', rentalId: 'rental-1', actor })).rejects.toThrow(
      'юридического текста',
    );
  });

  it('cleans both promoted files if atomic database finalization fails', async () => {
    const artifacts = storage();
    const generate = createRentalDocumentPairGenerator({
      repository: repository(vi.fn().mockRejectedValue(new Error('database unavailable'))),
      storage: artifacts,
      generateDocx: vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 3, 4])),
      convertPdf: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1])),
    });

    await expect(generate({ companyId: 'company-1', rentalId: 'rental-1', actor })).rejects.toThrow(
      'документы договора',
    );
    expect(artifacts.privateFiles).toHaveLength(0);
    expect(artifacts.quarantine).toHaveLength(0);
  });

  it('is idempotent and removes newly promoted duplicate artifacts', async () => {
    const artifacts = storage();
    const commit = vi.fn().mockResolvedValue({ version: 3, created: false });
    const docx = new Uint8Array([0x50, 0x4b, 3, 4]);
    const generateDocx = vi.fn().mockResolvedValue(docx);
    const convertPdf = vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1]));
    const generate = createRentalDocumentPairGenerator({
      repository: repository(commit),
      storage: artifacts,
      generateDocx,
      convertPdf,
    });

    await expect(
      generate({ companyId: 'company-1', rentalId: 'rental-1', actor }),
    ).resolves.toEqual({
      version: 3,
    });
    expect(generateDocx).toHaveBeenCalledTimes(1);
    expect(convertPdf.mock.calls[0]?.[0]).toBe(docx);
    expect(artifacts.privateFiles).toHaveLength(0);
  });

  it('returns an existing complete pair before generating or promoting another copy', async () => {
    const artifacts = storage();
    const repo = repository(vi.fn());
    repo.findExistingPair = vi.fn().mockResolvedValue(2);
    const generateDocx = vi.fn();
    const generate = createRentalDocumentPairGenerator({
      repository: repo,
      storage: artifacts,
      generateDocx,
      convertPdf: vi.fn(),
    });

    await expect(
      generate({ companyId: 'company-1', rentalId: 'rental-1', actor }),
    ).resolves.toEqual({
      version: 2,
    });
    expect(generateDocx).not.toHaveBeenCalled();
    expect(artifacts.privateFiles).toHaveLength(0);
    expect(artifacts.quarantine).toHaveLength(0);
  });

  it('cleans only its generation-scoped keys when a concurrent commit reports an exact pair', async () => {
    const artifacts = storage();
    const repo = repository(vi.fn().mockResolvedValue({ version: 4, created: false }));
    repo.reserveGeneration = vi
      .fn()
      .mockResolvedValue({ generationId: 'loser-generation', version: 4 });
    repo.markPromoted = vi.fn();
    const generate = createRentalDocumentPairGenerator({
      repository: repo,
      storage: artifacts,
      generateDocx: vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 3, 4])),
      convertPdf: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1])),
    });

    await expect(
      generate({ companyId: 'company-1', rentalId: 'rental-1', actor }),
    ).resolves.toEqual({
      version: 4,
    });
    expect(artifacts.privateFiles).toHaveLength(0);
    expect(repo.markError).toHaveBeenCalledWith({
      generationId: 'loser-generation',
      source: expect.objectContaining({ rentalId: 'rental-1' }),
    });
  });

  it('concurrent generation converges on one durable version without duplicate files', async () => {
    const artifacts = storage();
    let committed = false;
    const commit = vi.fn(async () => {
      if (committed) return { version: 1, created: false };
      committed = true;
      return { version: 1, created: true };
    });
    const generate = createRentalDocumentPairGenerator({
      repository: repository(commit),
      storage: artifacts,
      generateDocx: vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 3, 4])),
      convertPdf: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1])),
    });

    await expect(
      Promise.all([
        generate({ companyId: 'company-1', rentalId: 'rental-1', actor }),
        generate({ companyId: 'company-1', rentalId: 'rental-1', actor }),
      ]),
    ).resolves.toEqual([{ version: 1 }, { version: 1 }]);
    expect(artifacts.privateFiles).toHaveLength(2);
    expect(new Set([...artifacts.privateFiles.keys()].map((key) => key.split('.').at(-1)))).toEqual(
      new Set(['docx', 'pdf']),
    );
  });

  it('does not generate documents outside the authorized confirmed rental source', async () => {
    const artifacts = storage();
    const repo = repository(vi.fn());
    repo.loadConfirmedRental = vi.fn().mockResolvedValue(null);
    const generateDocx = vi.fn();
    const generate = createRentalDocumentPairGenerator({
      repository: repo,
      storage: artifacts,
      generateDocx,
      convertPdf: vi.fn(),
    });

    await expect(
      generate({ companyId: 'foreign-company', rentalId: 'rental-1', actor }),
    ).rejects.toThrow('недоступна');
    expect(generateDocx).not.toHaveBeenCalled();
    expect(artifacts.privateFiles).toHaveLength(0);
  });
});

const actor = { id: 'user-1', email: 'dispatcher@example.test' };

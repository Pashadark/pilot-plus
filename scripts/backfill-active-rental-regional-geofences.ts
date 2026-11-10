import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Prisma, PrismaClient } from '../src/database/generated/prisma';

type InputEntry = {
  contractNumber: string;
  sourceText: string;
  regionCodes?: string[];
  allRegionsExcept?: string[];
};

type ResolvedEntry = InputEntry & {
  rentalId: string;
  companyId: string;
  vehiclePlate: string;
  regionCodes: string[];
};

function argumentValue(name: string): string | null {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function validateInput(value: unknown): InputEntry[] {
  if (!Array.isArray(value)) throw new Error('Файл должен содержать массив правил геозон.');
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error(`Строка ${index + 1}: ожидается объект.`);
    const entry = raw as Partial<InputEntry>;
    if (!entry.contractNumber?.trim() || !entry.sourceText?.trim()) {
      throw new Error(`Строка ${index + 1}: contractNumber и sourceText обязательны.`);
    }
    const hasCodes = Array.isArray(entry.regionCodes) && entry.regionCodes.length > 0;
    const hasAllExcept = Array.isArray(entry.allRegionsExcept);
    if (hasCodes === hasAllExcept) {
      throw new Error(`Строка ${index + 1}: укажите regionCodes или allRegionsExcept.`);
    }
    return {
      contractNumber: entry.contractNumber.trim(),
      sourceText: entry.sourceText.trim(),
      ...(hasCodes ? { regionCodes: entry.regionCodes } : {}),
      ...(hasAllExcept ? { allRegionsExcept: entry.allRegionsExcept } : {}),
    };
  });
}

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const overwrite = process.argv.includes('--overwrite');
const inputPath = argumentValue('--input');
const actorEmail = argumentValue('--actor-email');

async function main() {
  if (!inputPath) throw new Error('Укажите --input=<путь к JSON>.');
  const entries = validateInput(JSON.parse(await readFile(resolve(inputPath), 'utf8')));
  const duplicateContracts = entries
    .map((entry) => entry.contractNumber)
    .filter((contract, index, contracts) => contracts.indexOf(contract) !== index);
  if (duplicateContracts.length > 0) {
    throw new Error(`Повторяются договоры: ${[...new Set(duplicateContracts)].join(', ')}.`);
  }

  const now = new Date();
  const [rentals, regions, existing] = await Promise.all([
    prisma.rental.findMany({
      where: {
        contractNumber: { in: entries.map((entry) => entry.contractNumber) },
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      select: {
        id: true,
        companyId: true,
        contractNumber: true,
        vehicle: { select: { registrationNumber: true } },
      },
    }),
    prisma.russianRegion.findMany({
      select: { code: true, nameRu: true, automaticEnforcementAllowed: true },
      orderBy: { code: 'asc' },
    }),
    prisma.rentalRegionalGeofence.findMany({
      where: { rental: { contractNumber: { in: entries.map((entry) => entry.contractNumber) } } },
      select: { rentalId: true },
    }),
  ]);
  const rentalByContract = new Map(rentals.map((rental) => [rental.contractNumber, rental]));
  const regionByCode = new Map(regions.map((region) => [region.code, region]));
  const existingRentalIds = new Set(existing.map((geofence) => geofence.rentalId));
  const missingContracts = entries
    .map((entry) => entry.contractNumber)
    .filter((contract) => !rentalByContract.has(contract));
  if (missingContracts.length > 0) {
    throw new Error(`Не найдены среди текущих активных аренд: ${missingContracts.join(', ')}.`);
  }

  const resolved: ResolvedEntry[] = entries.map((entry) => {
    const rental = rentalByContract.get(entry.contractNumber)!;
    const requestedCodes = entry.regionCodes
      ? entry.regionCodes
      : regions
          .filter(
            (region) =>
              region.automaticEnforcementAllowed && !entry.allRegionsExcept?.includes(region.code),
          )
          .map((region) => region.code);
    const regionCodes = [...new Set(requestedCodes)].sort();
    const missingCodes = regionCodes.filter((code) => !regionByCode.has(code));
    if (missingCodes.length > 0) {
      throw new Error(
        `${entry.contractNumber}: регионы отсутствуют в справочнике: ${missingCodes.join(', ')}.`,
      );
    }
    if (regionCodes.length === 0) throw new Error(`${entry.contractNumber}: пустая геозона.`);
    return {
      ...entry,
      rentalId: rental.id,
      companyId: rental.companyId,
      vehiclePlate: rental.vehicle.registrationNumber ?? 'без госномера',
      regionCodes,
    };
  });

  const skippedExisting = resolved.filter((entry) => existingRentalIds.has(entry.rentalId));
  if (skippedExisting.length > 0 && !overwrite) {
    throw new Error(
      `Геозона уже существует; повторный запуск запрещён без --overwrite: ${skippedExisting
        .map((entry) => entry.contractNumber)
        .join(', ')}.`,
    );
  }

  const preview = resolved.map((entry) => ({
    contractNumber: entry.contractNumber,
    vehiclePlate: entry.vehiclePlate,
    regions: entry.regionCodes.map((code) => regionByCode.get(code)?.nameRu ?? code),
    sourceText: entry.sourceText,
  }));
  console.log(
    JSON.stringify({ mode: apply ? 'apply' : 'dry-run', count: preview.length, preview }, null, 2),
  );
  if (!apply) process.exitCode = 0;
  else {
    const actor = actorEmail
      ? await prisma.user.findFirst({ where: { email: actorEmail, isActive: true } })
      : await prisma.user.findFirst({
          where: { role: 'SUPER_ADMIN', isActive: true },
          orderBy: { createdAt: 'asc' },
        });
    if (!actor) throw new Error('Активный супер-администратор для аудита не найден.');

    for (const entry of resolved) {
      await prisma.$transaction(async (tx) => {
        const previous = await tx.rentalRegionalGeofence.findUnique({
          where: { rentalId: entry.rentalId },
          select: { id: true, version: true, enabled: true, regionCodes: true },
        });
        const version = (previous?.version ?? 0) + 1;
        const geofence = await tx.rentalRegionalGeofence.upsert({
          where: { rentalId: entry.rentalId },
          create: {
            companyId: entry.companyId,
            rentalId: entry.rentalId,
            enabled: true,
            version,
            regionCodes: entry.regionCodes,
            updatedByUserId: actor.id,
          },
          update: {
            enabled: true,
            version,
            regionCodes: entry.regionCodes,
            state: 'INSIDE',
            pendingTransition: null,
            pendingCount: 0,
            pendingSince: null,
            outsideSince: null,
            lastEvaluatedAt: null,
            lastDistanceKm: null,
            lastApproachThresholdKm: null,
            updatedByUserId: actor.id,
          },
          select: { id: true },
        });
        const codes = Prisma.join(entry.regionCodes.map((code) => Prisma.sql`${code}`));
        await tx.$executeRaw(Prisma.sql`
          UPDATE "RentalRegionalGeofence"
          SET "regionUnion" = (
            SELECT ST_Multi(ST_CollectionExtract(ST_UnaryUnion(ST_Collect("boundary")), 3))
            FROM "RussianRegion"
            WHERE "code" IN (${codes}) AND "boundary" IS NOT NULL
          ), "updatedAt" = NOW()
          WHERE "id" = ${geofence.id}
        `);
        const geometry = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
          SELECT COALESCE(ST_IsValid("regionUnion"), false) AS "valid"
          FROM "RentalRegionalGeofence" WHERE "id" = ${geofence.id}
        `);
        if (!geometry[0]?.valid)
          throw new Error(`${entry.contractNumber}: геометрия геозоны невалидна.`);
        await tx.auditLog.create({
          data: {
            companyId: entry.companyId,
            actorUserId: actor.id,
            actorEmailSnapshot: actor.email,
            action: previous ? 'UPDATE' : 'CREATE',
            entityType: 'RENTAL',
            entityId: entry.rentalId,
            entityLabel: entry.contractNumber,
            changes: {
              regionalGeofenceBackfill: {
                version,
                old: previous
                  ? { enabled: previous.enabled, regionCodes: previous.regionCodes }
                  : null,
                next: { enabled: true, regionCodes: entry.regionCodes },
                sourceText: entry.sourceText,
              },
            },
          },
        });
      });
      console.log(`Applied ${entry.contractNumber} (${entry.vehiclePlate}).`);
    }
  }
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

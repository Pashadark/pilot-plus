import { createFleetImportPreview, type ExistingFleetVehicle } from './preview';
import type { FleetImportRow } from './types';

type Database = {
  vehicle: {
    findMany(args: unknown): Promise<ExistingFleetVehicle[]>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<{ id: string }>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  auditLog: { create(args: unknown): Promise<unknown> };
  rental?: { findFirst(args: unknown): Promise<{ id: string } | null> };
};

export type FleetImportApplyResult =
  | { ok: true; created: number; updated: number; unchanged: number; archived: number }
  | { ok: false; code: string; message: string };

export interface ApplyFleetImportInput {
  transaction<T>(callback: (database: Database) => Promise<T>): Promise<T>;
  companyId: string;
  actor: { id: string; email: string };
  rows: readonly FleetImportRow[];
  archiveIds: readonly string[];
}

function safeVehicleData(companyId: string, row: FleetImportRow) {
  return {
    companyId,
    sourceKey: `example-fleet:${companyId}:${row.registrationNumberNormalized}`,
    internalNumber: `IMPORT-${row.registrationNumberNormalized}`,
    model: `${row.make} ${row.model}`,
    city: 'Не указано',
    registrationNumber: row.registrationNumberNormalized,
    registrationNumberNormalized: row.registrationNumberNormalized,
    vin: row.vinNormalized,
    vinNormalized: row.vinNormalized,
    make: row.make,
    modelName: row.model,
    manufacturedYear: row.year,
    transmission: 'Не указано',
    fuelType: 'OTHER',
    seats: 5,
    dailyPriceMinor: 0,
    currency: 'RUB',
    originalPrice: '0 ₽',
    features: [],
    isRentalReady: false,
    status: 'UNKNOWN',
    isDemoImport: false,
  };
}

async function audit(
  database: Database,
  input: ApplyFleetImportInput,
  vehicleId: string,
  action: 'CREATE' | 'UPDATE' | 'ARCHIVE',
) {
  await database.auditLog.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actor.id,
      actorEmailSnapshot: input.actor.email,
      action,
      entityType: 'VEHICLE',
      entityId: vehicleId,
      entityLabel: 'Импортированный автомобиль',
      changes: { import: 'example-fleet', action: action.toLocaleLowerCase('en-US') },
    },
  });
}

export async function applyFleetImport(
  input: ApplyFleetImportInput,
): Promise<FleetImportApplyResult> {
  return input.transaction(async (database) => {
    const existing = await database.vehicle.findMany({
      where: { companyId: input.companyId, archivedAt: null },
      select: {
        id: true,
        internalNumber: true,
        registrationNumberNormalized: true,
        vinNormalized: true,
        make: true,
        modelName: true,
        manufacturedYear: true,
      },
    });
    const preview = createFleetImportPreview(input.rows, existing);
    if (preview.rows.some((row) => row.operation === 'ERROR')) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'В предпросмотре есть конфликтующие автомобили.',
      };
    }
    const permittedArchives = new Set(preview.optionalArchives.map((vehicle) => vehicle.id));
    if (input.archiveIds.some((id) => !permittedArchives.has(id))) {
      return {
        ok: false,
        code: 'ARCHIVE_SELECTION',
        message: 'Можно архивировать только машины из предпросмотра.',
      };
    }
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let archived = 0;
    for (const item of preview.rows) {
      if (item.operation === 'UNCHANGED') {
        unchanged += 1;
        continue;
      }
      const data = safeVehicleData(input.companyId, item.row);
      if (item.operation === 'ADD') {
        const vehicle = await database.vehicle.create({ data });
        await audit(database, input, vehicle.id, 'CREATE');
        created += 1;
      } else if (item.operation === 'UPDATE' && item.vehicleId) {
        const vehicle = await database.vehicle.update({
          where: { id: item.vehicleId },
          data: { ...data, sourceKey: undefined },
        });
        await audit(database, input, vehicle.id, 'UPDATE');
        updated += 1;
      }
    }
    for (const id of input.archiveIds) {
      const blocked = database.rental
        ? await database.rental.findFirst({
            where: {
              companyId: input.companyId,
              vehicleId: id,
              status: { in: ['CONFIRMED', 'ACTIVE'] },
            },
            select: { id: true },
          })
        : null;
      if (blocked) {
        return {
          ok: false,
          code: 'ACTIVE_RENTAL',
          message: 'Нельзя архивировать автомобиль с активной арендой.',
        };
      }
      const result = await database.vehicle.updateMany({
        where: { id, companyId: input.companyId, archivedAt: null },
        data: { archivedAt: new Date(), archivedByUserId: input.actor.id },
      });
      if (result.count === 1) {
        await audit(database, input, id, 'ARCHIVE');
        archived += 1;
      }
    }
    return { ok: true, created, updated, unchanged, archived };
  });
}

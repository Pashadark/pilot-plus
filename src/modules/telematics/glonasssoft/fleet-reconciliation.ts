import { normalizeGlonassSoftPlate } from './normalizers';
import { APPROVED_REAL_FLEET, APPROVED_REAL_PLATES } from './approved-fleet';

export interface ExistingFleetRow {
  id: string;
  plate: string | null;
  make: string | null;
  model: string | null;
  references: number;
  isDemoImport: boolean;
}

export interface ProviderFleetRow {
  externalId: string;
  name: string;
}

export interface FleetPreviewItem {
  vehicleId?: string;
  externalId?: string;
  make: string;
  model: string;
  plate: string;
  references?: number;
}

export interface FleetPreviewBlock {
  code: 'DUPLICATE_PLATE' | 'AMBIGUOUS_PROVIDER_OBJECT';
  plate?: string;
  externalId?: string;
}

export interface RealFleetPreview {
  create: FleetPreviewItem[];
  update: FleetPreviewItem[];
  link: FleetPreviewItem[];
  archive: FleetPreviewItem[];
  delete: FleetPreviewItem[];
  ignoredProvider: ProviderFleetRow[];
  blocked: FleetPreviewBlock[];
}

const PLATE_CANDIDATE = /[ABCEHKMOPTXYАВЕКМНОРСТУХ]\d{3}[ABCEHKMOPTXYАВЕКМНОРСТУХ]{2}\d{2,3}/gu;

function providerPlates(name: string): string[] {
  const compact = name.toUpperCase().replace(/[\s-]/gu, '');
  const candidates = compact.match(PLATE_CANDIDATE) ?? [];
  return Array.from(
    new Set(
      candidates.flatMap((candidate) => {
        try {
          return [normalizeGlonassSoftPlate(candidate)];
        } catch {
          return [];
        }
      }),
    ),
  );
}

function item(
  vehicle: (typeof APPROVED_REAL_FLEET)[number],
  extra: Partial<FleetPreviewItem> = {},
): FleetPreviewItem {
  return { make: vehicle.make, model: vehicle.model, plate: vehicle.plate, ...extra };
}

export function buildRealFleetPreview(input: {
  existing: readonly ExistingFleetRow[];
  provider: readonly ProviderFleetRow[];
}): RealFleetPreview {
  const preview: RealFleetPreview = {
    create: [],
    update: [],
    link: [],
    archive: [],
    delete: [],
    ignoredProvider: [],
    blocked: [],
  };
  const existingByApprovedPlate = new Map<string, ExistingFleetRow[]>();
  for (const row of input.existing) {
    if (row.plate && APPROVED_REAL_PLATES.has(row.plate)) {
      const rows = existingByApprovedPlate.get(row.plate) ?? [];
      rows.push(row);
      existingByApprovedPlate.set(row.plate, rows);
    }
  }
  for (const [plate, rows] of existingByApprovedPlate) {
    if (rows.length > 1) preview.blocked.push({ code: 'DUPLICATE_PLATE', plate });
  }

  const legacyToyota = input.existing.filter(
    (row) =>
      row.plate === 'Н26АХ550' &&
      row.make?.toLocaleLowerCase('ru-RU') === 'toyota' &&
      row.model?.toLocaleLowerCase('ru-RU').includes('camry'),
  );

  const resolved = new Map<string, ExistingFleetRow>();
  for (const approved of APPROVED_REAL_FLEET) {
    const exact = existingByApprovedPlate.get(approved.plate) ?? [];
    const match =
      exact.length === 1 ? exact[0] : approved.plate === 'Н726АХ550' ? legacyToyota[0] : undefined;
    if (!match) {
      preview.create.push(item(approved));
      continue;
    }
    resolved.set(approved.plate, match);
    if (
      match.plate !== approved.plate ||
      match.make !== approved.make ||
      match.model !== approved.model
    ) {
      preview.update.push(item(approved, { vehicleId: match.id }));
    }
  }

  const resolvedIds = new Set(Array.from(resolved.values(), (row) => row.id));
  for (const row of input.existing) {
    if (resolvedIds.has(row.id) || (row.plate && APPROVED_REAL_PLATES.has(row.plate))) continue;
    const target = row.references === 0 && row.isDemoImport ? preview.delete : preview.archive;
    target.push({
      vehicleId: row.id,
      make: row.make ?? 'Не указано',
      model: row.model ?? 'Не указано',
      plate: row.plate ?? 'БЕЗ НОМЕРА',
      references: row.references,
    });
  }

  for (const provider of input.provider) {
    const plates = providerPlates(provider.name).filter((plate) => APPROVED_REAL_PLATES.has(plate));
    if (plates.length > 1) {
      preview.blocked.push({ code: 'AMBIGUOUS_PROVIDER_OBJECT', externalId: provider.externalId });
      continue;
    }
    const plate = plates[0];
    if (!plate) {
      preview.ignoredProvider.push(provider);
      continue;
    }
    const approved = APPROVED_REAL_FLEET.find((vehicle) => vehicle.plate === plate)!;
    const existing = resolved.get(plate);
    preview.link.push(item(approved, { vehicleId: existing?.id, externalId: provider.externalId }));
  }
  return preview;
}

const MAX_PAGES = 200;

interface ProviderPage<T> {
  current: number;
  last: number;
  items: readonly T[];
}

interface SyncDependencies<Car, NormalizedCar, Fine, NormalizedFine> {
  listCars(page: number): Promise<ProviderPage<Car>>;
  listFines(page: number): Promise<ProviderPage<Fine>>;
  listPaidFines(page: number): Promise<ProviderPage<Fine>>;
  normalizeCar(car: Car): NormalizedCar & { externalId: string };
  normalizeFine(fine: Fine): NormalizedFine & {
    externalId: string;
    providerVehicleId: string | null;
    offenseAt: Date;
  };
  upsertLink(
    companyId: string,
    car: NormalizedCar & { externalId: string },
  ): Promise<{ vehicleId: string | null }>;
  upsertFine(
    companyId: string,
    fine: NormalizedFine & {
      externalId: string;
      providerVehicleId: string | null;
      offenseAt: Date;
    },
    vehicleId: string | null,
  ): Promise<{ created: boolean }>;
}

async function allPages<T>(load: (page: number) => Promise<ProviderPage<T>>): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await load(page);
    items.push(...result.items);
    if (result.items.length === 0 || page >= result.last) return items;
  }
  throw new Error('Driver Helper превысил безопасный лимит страниц.');
}

export async function syncCompanyFinesWithDependencies<Car, NormalizedCar, Fine, NormalizedFine>(
  companyId: string,
  dependencies: SyncDependencies<Car, NormalizedCar, Fine, NormalizedFine>,
) {
  const vehicleByExternalId = new Map<string, string | null>();
  for (const providerCar of await allPages(dependencies.listCars)) {
    const car = dependencies.normalizeCar(providerCar);
    const link = await dependencies.upsertLink(companyId, car);
    vehicleByExternalId.set(car.externalId, link.vehicleId);
  }

  let created = 0;
  let updated = 0;
  let unmatched = 0;
  let skipped = 0;
  const providerFines = [
    ...(await allPages(dependencies.listFines)),
    ...(await allPages(dependencies.listPaidFines)),
  ];
  const normalizedFines = new Map<string, ReturnType<typeof dependencies.normalizeFine>>();
  for (const providerFine of providerFines) {
    const fine = dependencies.normalizeFine(providerFine);
    normalizedFines.set(fine.externalId, fine);
  }
  for (const fine of normalizedFines.values()) {
    if (!(fine.offenseAt instanceof Date) || !Number.isFinite(fine.offenseAt.getTime())) {
      skipped += 1;
      continue;
    }
    const vehicleId = fine.providerVehicleId
      ? (vehicleByExternalId.get(fine.providerVehicleId) ?? null)
      : null;
    if (!vehicleId) unmatched += 1;
    const result = await dependencies.upsertFine(companyId, fine, vehicleId);
    if (result.created) created += 1;
    else updated += 1;
  }

  return { ok: true as const, received: normalizedFines.size, created, updated, unmatched, ...(skipped ? { skipped } : {}) };
}

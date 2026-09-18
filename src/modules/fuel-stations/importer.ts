export interface FuelStationInput {
  osmType: 'node' | 'way' | 'relation';
  osmId: string;
  name: string | null;
  brand: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  source: 'OPENSTREETMAP';
}

export function parseFuelStationFeatures(input: unknown): FuelStationInput[] {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { features?: unknown }).features)) return [];
  const output: FuelStationInput[] = [];
  for (const feature of (input as { features: unknown[] }).features) {
    if (!feature || typeof feature !== 'object') continue;
    const item = feature as { id?: unknown; geometry?: { type?: unknown; coordinates?: unknown }; properties?: Record<string, unknown> };
    const properties = item.properties ?? {};
    if (properties.amenity !== 'fuel') continue;
    const coordinates = item.geometry?.coordinates;
    if (item.geometry?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length < 2) continue;
    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
    const rawId = String(item.id ?? '');
    const match = /^(node|way|relation)[/:](\d+)$/u.exec(rawId);
    if (!match) continue;
    const value = (key: string) => typeof properties[key] === 'string' && properties[key] ? String(properties[key]) : null;
    output.push({ osmType: match[1] as FuelStationInput['osmType'], osmId: match[2], name: value('name'), brand: value('brand'), address: value('addr:full') ?? value('addr:street'), latitude, longitude, source: 'OPENSTREETMAP' });
  }
  return output;
}

export async function upsertFuelStations(
  database: {
    fuelStation: { upsert(args: unknown): Promise<unknown> };
  },
  features: readonly FuelStationInput[],
  sourceUpdatedAt = new Date(),
) {
  let count = 0;
  for (const feature of features) {
    await database.fuelStation.upsert({
      where: { osmType_osmId: { osmType: feature.osmType, osmId: feature.osmId } },
      create: { ...feature, sourceUpdatedAt, attribution: '© OpenStreetMap contributors' },
      update: { ...feature, sourceUpdatedAt, attribution: '© OpenStreetMap contributors' },
    });
    count += 1;
  }
  return count;
}

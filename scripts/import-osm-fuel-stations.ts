import { readFile } from 'node:fs/promises';
import { parseFuelStationFeatures, upsertFuelStations } from '../src/modules/fuel-stations/importer';
import { prisma } from '../src/database/prisma/client';

const file = process.argv.find((value) => value.startsWith('--file='))?.slice('--file='.length);
const dryRun = process.argv.includes('--dry-run');
if (!file) throw new Error('Usage: npm run fuel-stations:import -- --file=stations.geojson [--dry-run]');
const parsed = parseFuelStationFeatures(JSON.parse(await readFile(file, 'utf8')));
console.log(`OSM fuel stations: ${parsed.length}`);
if (!dryRun) {
  const count = await upsertFuelStations(prisma, parsed);
  console.log(`Upserted: ${count}`);
}
await prisma.$disconnect();

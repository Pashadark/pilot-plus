import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Prisma, PrismaClient } from '../src/database/generated/prisma';

type RegionFeature = {
  type: 'Feature';
  properties: {
    code: string;
    nameRu: string;
    nameEn: string | null;
    source: string;
    sourceVersion: string;
    automaticEnforcementAllowed: boolean;
  };
  geometry: { type: 'MultiPolygon'; coordinates: unknown[] };
};

type RegionCollection = {
  type: 'FeatureCollection';
  metadata: { generatedAt?: string };
  features: RegionFeature[];
};

const prisma = new PrismaClient();

async function main() {
  const path = resolve('data/regions/russia-admin1.geojson');
  const collection = JSON.parse(await readFile(path, 'utf8')) as RegionCollection;
  if (collection.type !== 'FeatureCollection' || collection.features.length < 70) {
    throw new Error('Набор административных границ неполон.');
  }
  const sourceUpdatedAt = collection.metadata.generatedAt
    ? new Date(collection.metadata.generatedAt)
    : new Date();

  for (const feature of collection.features) {
    const { properties, geometry } = feature;
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "RussianRegion" (
        "code", "nameRu", "nameEn", "source", "sourceVersion", "sourceUpdatedAt",
        "automaticEnforcementAllowed", "boundary", "createdAt", "updatedAt"
      ) VALUES (
        ${properties.code}, ${properties.nameRu}, ${properties.nameEn}, ${properties.source},
        ${properties.sourceVersion}, ${sourceUpdatedAt}, ${properties.automaticEnforcementAllowed},
        ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326)),
        NOW(), NOW()
      )
      ON CONFLICT ("code") DO UPDATE SET
        "nameRu" = EXCLUDED."nameRu",
        "nameEn" = EXCLUDED."nameEn",
        "source" = EXCLUDED."source",
        "sourceVersion" = EXCLUDED."sourceVersion",
        "sourceUpdatedAt" = EXCLUDED."sourceUpdatedAt",
        "automaticEnforcementAllowed" = EXCLUDED."automaticEnforcementAllowed",
        "boundary" = EXCLUDED."boundary",
        "updatedAt" = NOW()
    `);
  }
  console.log(`Imported ${collection.features.length} Russian regions.`);
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

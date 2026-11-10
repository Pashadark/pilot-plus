import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SOURCE_VERSION = 'Natural Earth 5.1.2';
const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson';
const OUTPUT = resolve('data/regions/russia-admin1.geojson');
const DISPUTED_CODES = new Set(['RU-82', 'RU-90', 'RU-92', 'RU-93', 'RU-94', 'RU-95']);

function asMultiPolygon(geometry) {
  if (geometry?.type === 'MultiPolygon') return geometry;
  if (geometry?.type === 'Polygon') {
    return { type: 'MultiPolygon', coordinates: [geometry.coordinates] };
  }
  throw new Error(`Unsupported geometry type: ${geometry?.type ?? 'missing'}`);
}

const localInput = process.argv[2];
const source = localInput
  ? JSON.parse(await readFile(resolve(localInput), 'utf8'))
  : await (async () => {
      const response = await fetch(SOURCE_URL);
      if (!response.ok) throw new Error(`Natural Earth download failed: HTTP ${response.status}`);
      return response.json();
    })();
if (source?.type !== 'FeatureCollection' || !Array.isArray(source.features)) {
  throw new Error('Natural Earth response is not a FeatureCollection.');
}

const features = source.features
  .filter(
    (feature) =>
      feature?.properties?.adm0_a3 === 'RUS' &&
      /^RU-[A-Z0-9]{2,3}$/u.test(String(feature?.properties?.iso_3166_2 ?? '').trim()),
  )
  .map((feature) => {
    const properties = feature.properties ?? {};
    const code = String(properties.iso_3166_2 ?? '').trim();
    if (!/^RU-[A-Z0-9]{2,3}$/u.test(code)) throw new Error(`Invalid Russian region code: ${code}`);
    const sourceFlags = [properties.featurecla, properties.note, properties.brk_name]
      .filter(Boolean)
      .join(' ');
    return {
      type: 'Feature',
      properties: {
        code,
        nameRu: String(properties.name_ru || properties.name || code).trim(),
        nameEn: String(properties.name_en || properties.name || '').trim() || null,
        source: 'Natural Earth Admin 1',
        sourceVersion: SOURCE_VERSION,
        sourceUrl: SOURCE_URL,
        automaticEnforcementAllowed:
          !DISPUTED_CODES.has(code) && !/disput|breakaway|claim/iu.test(sourceFlags),
      },
      geometry: asMultiPolygon(feature.geometry),
    };
  })
  .sort((left, right) => left.properties.nameRu.localeCompare(right.properties.nameRu, 'ru'));

if (features.length < 70) throw new Error(`Only ${features.length} Russian regions were found.`);
const codes = new Set(features.map((feature) => feature.properties.code));
if (codes.size !== features.length)
  throw new Error('Natural Earth returned duplicate region codes.');

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(
  OUTPUT,
  `${JSON.stringify({
    type: 'FeatureCollection',
    metadata: {
      source: 'Natural Earth Admin 1',
      sourceVersion: SOURCE_VERSION,
      sourceUrl: SOURCE_URL,
      generatedAt: new Date().toISOString(),
      disclaimer:
        'Картографические границы для навигационного контроля; не являются юридической картой.',
    },
    features,
  })}\n`,
  'utf8',
);

console.log(`Prepared ${features.length} Russian regions at ${OUTPUT}`);

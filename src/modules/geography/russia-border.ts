import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Position = [number, number];
type Ring = Position[];
type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

type CountryFeature = {
  type: 'Feature';
  geometry: Geometry;
};

type Segment = {
  a: Position;
  b: Position;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
};

type BorderCountry = {
  name: string;
  code: string;
  segments: Segment[];
};

export type RussiaBorderProximity = {
  country: string;
  countryCode: string;
  distanceKm: number;
};

const DATA_ROOT = join(process.cwd(), 'data', 'borders');
const GRID_DEGREES = 2;
const SEARCH_CELLS = 2;
const METERS_PER_DEGREE = 111_320;

const COUNTRIES = [
  ['norway.geojson', 'Норвегия', 'NO'],
  ['FI.geojson', 'Финляндия', 'FI'],
  ['EE.geojson', 'Эстония', 'EE'],
  ['LV.geojson', 'Латвия', 'LV'],
  ['LT.geojson', 'Литва', 'LT'],
  ['PL.geojson', 'Польша', 'PL'],
  ['BY.geojson', 'Беларусь', 'BY'],
  ['UA.geojson', 'Украина', 'UA'],
  ['GE.geojson', 'Грузия', 'GE'],
  ['AZ.geojson', 'Азербайджан', 'AZ'],
  ['KZ.geojson', 'Казахстан', 'KZ'],
  ['CN.geojson', 'Китай', 'CN'],
  ['MN.geojson', 'Монголия', 'MN'],
  ['KP.geojson', 'КНДР', 'KP'],
] as const;

let cachedCountries: BorderCountry[] | null = null;
let cachedGrid: Map<string, Array<{ countryIndex: number; segmentIndex: number }>> | null = null;

function loadFeature(file: string): CountryFeature {
  return JSON.parse(readFileSync(join(DATA_ROOT, file), 'utf8')) as CountryFeature;
}

function geometryRings(geometry: Geometry): Ring[] {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
}

function segmentsForFeature(feature: CountryFeature): Segment[] {
  const segments: Segment[] = [];
  for (const ring of geometryRings(feature.geometry)) {
    for (let index = 1; index < ring.length; index += 1) {
      const a = ring[index - 1];
      const b = ring[index];
      if (!a || !b) continue;
      segments.push({
        a,
        b,
        minLon: Math.min(a[0], b[0]),
        maxLon: Math.max(a[0], b[0]),
        minLat: Math.min(a[1], b[1]),
        maxLat: Math.max(a[1], b[1]),
      });
    }
  }
  return segments;
}

function cellKey(lon: number, lat: number) {
  return `${Math.floor(lon / GRID_DEGREES)}:${Math.floor(lat / GRID_DEGREES)}`;
}

function ensureIndex() {
  if (cachedCountries && cachedGrid) return { countries: cachedCountries, grid: cachedGrid };
  const countries = COUNTRIES.map(([file, name, code]) => ({
    name,
    code,
    segments: segmentsForFeature(loadFeature(file)),
  }));
  const grid = new Map<string, Array<{ countryIndex: number; segmentIndex: number }>>();
  countries.forEach((country, countryIndex) => {
    country.segments.forEach((segment, segmentIndex) => {
      const minCellLon = Math.floor(segment.minLon / GRID_DEGREES);
      const maxCellLon = Math.floor(segment.maxLon / GRID_DEGREES);
      const minCellLat = Math.floor(segment.minLat / GRID_DEGREES);
      const maxCellLat = Math.floor(segment.maxLat / GRID_DEGREES);
      for (let cellLon = minCellLon; cellLon <= maxCellLon; cellLon += 1) {
        for (let cellLat = minCellLat; cellLat <= maxCellLat; cellLat += 1) {
          const key = `${cellLon}:${cellLat}`;
          const entries = grid.get(key) ?? [];
          entries.push({ countryIndex, segmentIndex });
          grid.set(key, entries);
        }
      }
    });
  });
  cachedCountries = countries;
  cachedGrid = grid;
  return { countries, grid };
}

function distanceToSegmentKm(lon: number, lat: number, segment: Segment) {
  const cosine = Math.max(0.25, Math.cos((lat * Math.PI) / 180));
  const ax = (segment.a[0] - lon) * cosine;
  const ay = segment.a[1] - lat;
  const bx = (segment.b[0] - lon) * cosine;
  const by = segment.b[1] - lat;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const ratio = denominator === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator));
  const nearestX = ax + ratio * dx;
  const nearestY = ay + ratio * dy;
  return (Math.hypot(nearestX, nearestY) * METERS_PER_DEGREE) / 1000;
}

/** Finds the closest Russian land-border neighbour within a practical alert radius. */
export function findRussiaBorderProximity(
  latitude: number,
  longitude: number,
  maxDistanceKm = 100,
): RussiaBorderProximity | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const { countries, grid } = ensureIndex();
  const centerLon = Math.floor(longitude / GRID_DEGREES);
  const centerLat = Math.floor(latitude / GRID_DEGREES);
  let closest: RussiaBorderProximity | null = null;
  const seen = new Set<string>();
  for (let deltaLon = -SEARCH_CELLS; deltaLon <= SEARCH_CELLS; deltaLon += 1) {
    for (let deltaLat = -SEARCH_CELLS; deltaLat <= SEARCH_CELLS; deltaLat += 1) {
      const entries = grid.get(`${centerLon + deltaLon}:${centerLat + deltaLat}`) ?? [];
      for (const entry of entries) {
        const key = `${entry.countryIndex}:${entry.segmentIndex}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const country = countries[entry.countryIndex];
        const segment = country?.segments[entry.segmentIndex];
        if (!country || !segment) continue;
        const distanceKm = distanceToSegmentKm(longitude, latitude, segment);
        if (distanceKm > maxDistanceKm || (closest && distanceKm >= closest.distanceKm)) continue;
        closest = { country: country.name, countryCode: country.code, distanceKm };
      }
    }
  }
  return closest ? { ...closest, distanceKm: Math.round(closest.distanceKm * 10) / 10 } : null;
}

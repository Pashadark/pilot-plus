import type { FleetImportRow } from './fleet-import';

const sourceOrigin = 'https://autopilotrent.ru';

const citySlugs: Record<string, string> = {
  Алтай: 'altai',
  Владивосток: 'vladivostok',
  Геленджик: 'gelendzhik',
  Екатеринбург: 'ekaterinburg',
  Казань: 'kazan',
  Калининград: 'kaliningrad',
  Красноярск: 'krasnoyarsk',
  Крым: 'crimea',
  Москва: 'moscow',
  Пхукет: 'phuket',
  'Санкт-Петербург': 'spb',
  Сочи: 'sochi',
  Челябинск: 'chelyabinsk',
};

const cityStations: Record<string, string> = {
  Алтай: 'alt',
  Владивосток: 'vldk',
  Геленджик: 'gdz',
  Екатеринбург: 'ekb',
  Казань: 'kzn',
  Калининград: 'kgd',
  Красноярск: 'krsk',
  Крым: 'crimea',
  Москва: 'msk',
  Пхукет: 'thai',
  'Санкт-Петербург': 'spb',
  Сочи: 'sochi',
  Челябинск: 'chlb',
};

export interface VehicleImageCandidate {
  city: string;
  model: string;
  sourceUrl: string;
}

export interface VehicleImageManifestRow extends VehicleImageCandidate {
  sourceKey: string;
  localPath: string;
  alt: string;
  position: number;
  isPrimary: boolean;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru-RU');
}

function normalizeModel(value: string) {
  return normalize(value).replace(/^gwm\s+(?=wey(?:\s|$))/, '');
}

function attributes(tag: string) {
  const result = new Map<string, string>();
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  for (const match of tag.matchAll(pattern)) {
    result.set(match[1].toLowerCase(), decodeHtmlAttribute(match[2] ?? match[3] ?? ''));
  }

  return result;
}

function absoluteSourceUrl(value: string) {
  return new URL(value, sourceOrigin).href;
}

function citySlug(city: string) {
  const slug = citySlugs[city];
  if (!slug) throw new Error(`Неизвестный адрес страницы для города «${city}».`);
  return slug;
}

export function parseVehicleImageCandidates(
  html: string,
  city: string,
): VehicleImageCandidate[] {
  const candidates: VehicleImageCandidate[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const values = attributes(match[0]);
    const model = values.get('alt')?.trim();
    const source = values.get('src') ?? values.get('data-src');

    if (!model || !source || !/\.webp(?:\?|$)/i.test(source)) continue;

    const sourceUrl = absoluteSourceUrl(source);
    const key = `${normalize(model)}\u0000${sourceUrl}`;
    if (seen.has(key)) continue;

    seen.add(key);
    candidates.push({ city, model, sourceUrl });
  }

  return candidates;
}

export function parseVehicleFleetPayload(payload: string, city: string): VehicleImageCandidate[] {
  const parsed: unknown = JSON.parse(payload);
  const value: unknown = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
  if (!value || typeof value !== 'object' || !('cars' in value) || !Array.isArray(value.cars)) {
    throw new Error(`Источник автопарка для города «${city}» вернул неверный формат.`);
  }

  const candidates: VehicleImageCandidate[] = [];

  for (const car of value.cars) {
    if (!car || typeof car !== 'object') continue;
    const model = 'name' in car && typeof car.name === 'string' ? car.name.trim() : '';
    const photos: unknown[] = 'photos' in car && Array.isArray(car.photos) ? car.photos : [];
    const source = photos.find(
      (photo: unknown): photo is string => typeof photo === 'string' && photo.length > 0,
    );
    if (!model || !source) continue;

    candidates.push({ city, model, sourceUrl: absoluteSourceUrl(source) });
  }

  return candidates;
}

export function matchVehicleImages(
  fleetRows: readonly FleetImportRow[],
  candidates: readonly VehicleImageCandidate[],
): VehicleImageManifestRow[] {
  const queues = new Map<string, VehicleImageCandidate[]>();
  const modelFallbacks = new Map<string, VehicleImageCandidate>();

  for (const candidate of candidates) {
    const key = `${normalize(candidate.city)}\u0000${normalizeModel(candidate.model)}`;
    const modelKey = normalizeModel(candidate.model);
    const queue = queues.get(key) ?? [];
    queue.push(candidate);
    queues.set(key, queue);
    if (!modelFallbacks.has(modelKey)) modelFallbacks.set(modelKey, candidate);
  }

  return fleetRows.flatMap((row) => {
    const key = `${normalize(row.city)}\u0000${normalizeModel(row.model)}`;
    const candidate =
      queues.get(key)?.shift() ?? modelFallbacks.get(normalizeModel(row.model));
    if (!candidate) return [];

    if (!/^fleet-\d{3}$/.test(row.sourceKey)) {
      throw new Error(`Небезопасный ключ источника «${row.sourceKey}».`);
    }

    return [
      {
        city: row.city,
        model: row.model,
        sourceUrl: candidate.sourceUrl,
        sourceKey: row.sourceKey,
        localPath: `/vehicles/${citySlug(row.city)}/${row.sourceKey}/primary.webp`,
        alt: `${row.model} — ${row.city}`,
        position: 0,
        isPrimary: true,
      },
    ];
  });
}

export function getVehicleSourcePage(city: string) {
  const slug = citySlug(city);
  return slug === 'sochi' ? `${sourceOrigin}/` : `${sourceOrigin}/${slug}`;
}

export function getVehicleFleetEndpoint(city: string) {
  const station = cityStations[city];
  if (!station) throw new Error(`Неизвестная станция автопарка для города «${city}».`);
  return `${sourceOrigin}/api/v1/fleet/${station}?source=autopilot`;
}

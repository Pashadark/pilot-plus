import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import sharp from 'sharp';

import { parseFleetSource } from '../src/database/prisma/fleet-import';
import {
  getVehicleFleetEndpoint,
  matchVehicleImages,
  parseVehicleFleetPayload,
  type VehicleImageCandidate,
  type VehicleImageManifestRow,
} from '../src/database/prisma/vehicle-images';

const projectRoot = join(import.meta.dirname, '..');
const sourcePath = join(projectRoot, 'src/database/prisma/data/fleet-source.txt');
const manifestPath = join(projectRoot, 'src/database/prisma/data/vehicle-images.json');
const publicRoot = join(projectRoot, 'public');

async function fetchOrThrow(url: string) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'PilotPlusVehicleImageSync/1.0' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Источник ${url} ответил кодом ${response.status}.`);
  }

  return response;
}

async function loadCandidates(cities: readonly string[]) {
  const candidates: VehicleImageCandidate[] = [];

  for (const city of cities) {
    const endpoint = getVehicleFleetEndpoint(city);
    const payload = await (await fetchOrThrow(endpoint)).text();
    const cityCandidates = parseVehicleFleetPayload(payload, city);
    console.info(`${city}: найдено карточек с фотографиями — ${cityCandidates.length}.`);
    candidates.push(...cityCandidates);
  }

  return candidates;
}

function destinationPath(row: VehicleImageManifestRow) {
  const segments = row.localPath.replace(/^\/+/, '').split('/');
  const destination = join(publicRoot, ...segments);

  if (!destination.startsWith(`${publicRoot}\\`) && !destination.startsWith(`${publicRoot}/`)) {
    throw new Error(`Небезопасный локальный путь «${row.localPath}».`);
  }

  return destination;
}

async function downloadImage(row: VehicleImageManifestRow) {
  const destination = destinationPath(row);
  if (existsSync(destination) && statSync(destination).size > 0) return 'reused' as const;

  const response = await fetchOrThrow(row.sourceUrl);
  const contentType = response.headers.get('content-type')?.split(';')[0].trim();
  if (!contentType?.startsWith('image/')) {
    throw new Error(`Файл ${row.sourceUrl} имеет неподдерживаемый тип ${contentType ?? 'неизвестно'}.`);
  }

  const sourceBody = Buffer.from(await response.arrayBuffer());
  const body = contentType === 'image/webp' ? sourceBody : await sharp(sourceBody).webp().toBuffer();
  if (body.length === 0) throw new Error(`Источник вернул пустой файл ${row.sourceUrl}.`);

  mkdirSync(dirname(destination), { recursive: true });
  const temporaryPath = `${destination}.tmp-${process.pid}`;
  writeFileSync(temporaryPath, body);
  renameSync(temporaryPath, destination);
  return 'downloaded' as const;
}

async function main() {
  const fleet = parseFleetSource(readFileSync(sourcePath, 'utf8'));
  const cities = [...new Set(fleet.map((row) => row.city))];
  const candidates = await loadCandidates(cities);
  const manifest = matchVehicleImages(fleet, candidates);
  const matchedKeys = new Set(manifest.map((row) => row.sourceKey));
  const unmatched = fleet.filter((row) => !matchedKeys.has(row.sourceKey));

  if (unmatched.length > 0) {
    const report = unmatched.map((row) => `${row.sourceKey}: ${row.model} — ${row.city}`).join('\n');
    throw new Error(`Не удалось сопоставить ${unmatched.length} автомобилей:\n${report}`);
  }

  let downloaded = 0;
  let reused = 0;
  for (let index = 0; index < manifest.length; index += 6) {
    const results = await Promise.all(manifest.slice(index, index + 6).map(downloadImage));
    downloaded += results.filter((result) => result === 'downloaded').length;
    reused += results.filter((result) => result === 'reused').length;
  }

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.info(
    `Синхронизация завершена. Сопоставлено: ${manifest.length}; скачано: ${downloaded}; использовано повторно: ${reused}.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Неизвестная ошибка синхронизации.';
  console.error(`Не удалось синхронизировать фотографии: ${message}`);
  process.exitCode = 1;
});

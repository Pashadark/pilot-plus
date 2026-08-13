import { inflateRawSync } from 'node:zlib';

import { normalizeRegistrationNumber, normalizeVin } from '../validation';

import type { FleetImportParseResult, FleetImportRow, FleetImportSourceRow } from './types';

const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024;
const MAX_SHEETS = 5;
const MAX_ROWS = 2_000;
const MAX_CELLS = 32_000;
const MAX_TEXT_LENGTH = 16_384;
const decoder = new TextDecoder('utf-8', { fatal: true });

export interface FleetImportWorkbook {
  filename: string;
  bytes: Uint8Array;
}

export function parseExampleFleetWorkbook(workbook: FleetImportWorkbook): FleetImportParseResult {
  if (!workbook.filename.toLocaleLowerCase('en-US').endsWith('.xlsx')) {
    throw new Error('Только файлы .xlsx можно импортировать в автопарк.');
  }
  if (workbook.bytes.byteLength > MAX_WORKBOOK_BYTES) {
    throw new Error('Размер файла Excel не должен превышать 10 MiB.');
  }
  const files = readZip(workbook.bytes);
  const names = [...files.keys()];
  if (names.some((name) => /(?:^|\/)vbaProject\.bin$/i.test(name))) {
    throw new Error('Файлы Excel с макросами не поддерживаются.');
  }
  if (names.some((name) => /(?:^|\/)externalLinks\//i.test(name))) {
    throw new Error('Файлы Excel с внешними ссылками не поддерживаются.');
  }
  const workbookXml = requiredText(files, 'xl/workbook.xml');
  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g)].map((match) =>
    attributes(match[1] ?? ''),
  );
  if (sheets.length === 0 || sheets.length > MAX_SHEETS) {
    throw new Error('Книга должна содержать от 1 до 5 листов.');
  }
  const canonicalSheet = sheets.find((sheet) => sheet.name === 'Автомобили');
  if (!canonicalSheet?.['r:id']) throw new Error('Не найден лист «Автомобили».');
  const relationships = requiredText(files, 'xl/_rels/workbook.xml.rels');
  const relation = [...relationships.matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g)]
    .map((match) => attributes(match[1] ?? ''))
    .find((item) => item.Id === canonicalSheet['r:id']);
  if (!relation?.Target || relation.TargetMode === 'External') {
    throw new Error('Не удалось безопасно определить лист «Автомобили».');
  }
  const sheetPath = relation.Target.startsWith('/')
    ? relation.Target.slice(1)
    : `xl/${relation.Target.replace(/^\.\//, '')}`;
  const sharedStrings = files.has('xl/sharedStrings.xml')
    ? readSharedStrings(requiredText(files, 'xl/sharedStrings.xml'))
    : [];
  const parsed = normalizeFleetImportRows(readSheet(requiredText(files, sheetPath), sharedStrings));
  const approved = new Set([
    "Kia:Cee'd:А429АУ97:2020",
    'Skoda:Octavia:Е435АН997:2019',
    'Mercedes-Benz:E 220 d 4MATIC:М283АМ997:2019',
    'Volkswagen:Polo:А156АХ997:2020',
  ]);
  if (
    parsed.errors.length > 0 ||
    parsed.rows.length !== 4 ||
    parsed.rows.some(
      (row) =>
        !approved.has(`${row.make}:${row.model}:${row.registrationNumberNormalized}:${row.year}`),
    )
  ) {
    throw new Error('Файл должен содержать ровно утверждённые четыре автомобиля примера.');
  }
  return parsed;
}

export function validateApprovedExampleFleet(parsed: FleetImportParseResult): void {
  const approved = new Set([
    "Kia:Cee'd:А429АУ97:2020",
    'Skoda:Octavia:Е435АН997:2019',
    'Mercedes-Benz:E 220 d 4MATIC:М283АМ997:2019',
    'Volkswagen:Polo:А156АХ997:2020',
  ]);
  if (
    parsed.errors.length > 0 ||
    parsed.rows.length !== 4 ||
    parsed.rows.some(
      (row) =>
        !approved.has(`${row.make}:${row.model}:${row.registrationNumberNormalized}:${row.year}`),
    )
  ) {
    throw new Error('Файл должен содержать ровно утверждённые четыре автомобиля примера.');
  }
}

function requiredText(files: ReadonlyMap<string, Uint8Array>, name: string): string {
  const bytes = files.get(name);
  if (!bytes) throw new Error('Книга Excel повреждена или имеет неполную структуру.');
  const value = decoder.decode(bytes);
  if (value.length > MAX_TEXT_LENGTH * 64)
    throw new Error('Содержимое книги Excel превышает лимит.');
  return value;
}

function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error('Файл не является корректной книгой .xlsx.');
  const entries = view.getUint16(end + 10, true);
  if (entries > 128) throw new Error('Книга Excel содержит слишком много файлов.');
  let cursor = view.getUint32(end + 16, true);
  const centralSize = view.getUint32(end + 12, true);
  if (cursor + centralSize > end) throw new Error('Структура .xlsx повреждена.');
  const files = new Map<string, Uint8Array>();
  let totalCompressed = 0;
  let totalUncompressed = 0;
  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Структура .xlsx повреждена.');
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;
    if (
      totalCompressed > MAX_WORKBOOK_BYTES ||
      totalUncompressed > MAX_WORKBOOK_BYTES ||
      uncompressedSize > MAX_WORKBOOK_BYTES ||
      (compressedSize > 0 && uncompressedSize / compressedSize > 100)
    )
      throw new Error('Книга Excel превышает безопасный лимит распаковки.');
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (!name || name.includes('..') || name.startsWith('/'))
      throw new Error('Недопустимый путь в .xlsx.');
    if (view.getUint32(localOffset, true) !== 0x04034b50)
      throw new Error('Структура .xlsx повреждена.');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const payload = bytes.slice(
      localOffset + 30 + localNameLength + localExtraLength,
      localOffset + 30 + localNameLength + localExtraLength + compressedSize,
    );
    let content: Uint8Array | null = null;
    try {
      content =
        method === 0
          ? payload
          : method === 8
            ? inflateRawSync(payload, { maxOutputLength: MAX_WORKBOOK_BYTES })
            : null;
    } catch {
      throw new Error('Книга Excel превышает безопасный лимит распаковки.');
    }
    if (
      !content ||
      content.byteLength !== uncompressedSize ||
      content.byteLength > MAX_WORKBOOK_BYTES
    ) {
      throw new Error('Книга Excel содержит неподдерживаемое или слишком большое содержимое.');
    }
    files.set(name, content);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function attributes(value: string): Record<string, string> {
  return Object.fromEntries(
    [...value.matchAll(/([:\w-]+)="([^"]*)"/g)].map((match) => [
      match[1] ?? '',
      decodeXml(match[2] ?? ''),
    ]),
  );
}

function decodeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function readSharedStrings(xml: string): string[] {
  const values = [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((item) =>
    decodeXml([...item[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((text) => text[1]).join('')),
  );
  if (values.some((value) => value.length > MAX_TEXT_LENGTH)) {
    throw new Error('Значение ячейки превышает лимит.');
  }
  return values;
}

function readSheet(xml: string, sharedStrings: readonly string[]): FleetImportSourceRow[] {
  const rows = [...xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)];
  if (rows.length < 2 || rows.length - 1 > MAX_ROWS)
    throw new Error('Лист содержит недопустимое число строк.');
  let cellCount = 0;
  const parsedRows = rows.map((match) => {
    const cells: Record<string, string> = {};
    for (const cell of match[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      cellCount += 1;
      if (cellCount > MAX_CELLS) throw new Error('Лист содержит слишком много ячеек.');
      const cellAttributes = attributes(cell[1] ?? '');
      const address = cellAttributes.r;
      if (!address) continue;
      if (/<f(?:\s|>)/.test(cell[2] ?? ''))
        throw new Error('Формулы в значениях автомобилей не поддерживаются.');
      const textMatch = (cell[2] ?? '').match(/<(?:v|t)>([\s\S]*?)<\/(?:v|t)>/);
      const rawValue = decodeXml(textMatch?.[1] ?? '');
      const value = cellAttributes.t === 's' ? (sharedStrings[Number(rawValue)] ?? '') : rawValue;
      if (value.length > MAX_TEXT_LENGTH) throw new Error('Значение ячейки превышает лимит.');
      cells[address.replace(/\d+$/, '')] = value;
    }
    return cells;
  });
  const headers = parsedRows[0] ?? {};
  const columnFor = (names: readonly string[]) =>
    Object.entries(headers).find(([, value]) =>
      names.includes(value.trim().toLocaleLowerCase('ru-RU')),
    )?.[0];
  const make = columnFor(['марка']);
  const model = columnFor(['модель']);
  const registrationNumber = columnFor(['госномер', 'гос. номер', 'государственный номер']);
  const year = columnFor(['год', 'год выпуска']);
  const vin = columnFor(['vin', 'вин']);
  if (!make || !model || !registrationNumber || !year) {
    throw new Error('На листе «Автомобили» требуются колонки марки, модели, госномера и года.');
  }
  return parsedRows.slice(1).map((cells) => ({
    make: cells[make] ?? '',
    model: cells[model] ?? '',
    registrationNumber: cells[registrationNumber] ?? '',
    year: cells[year] ?? '',
    ...(vin ? { vin: cells[vin] ?? '' } : {}),
  }));
}

function trimRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Укажите ${label}.`);
  return normalized;
}

export function normalizeFleetImportRows(
  sourceRows: readonly FleetImportSourceRow[],
): FleetImportParseResult {
  const rows: FleetImportRow[] = [];
  const errors: FleetImportParseResult['errors'] = [];
  const plates = new Set<string>();
  const vins = new Set<string>();

  sourceRows.forEach((source, index) => {
    const rowNumber = index + 2;
    try {
      const year = Number(source.year);
      if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
        throw new Error('Укажите корректный год выпуска.');
      }
      const row = {
        rowNumber,
        make: trimRequired(source.make, 'марку'),
        model: trimRequired(source.model, 'модель'),
        registrationNumberNormalized: normalizeRegistrationNumber(source.registrationNumber),
        vinNormalized: normalizeVin(source.vin),
        year,
      };
      if (plates.has(row.registrationNumberNormalized)) {
        errors.push({
          rowNumber,
          code: 'DUPLICATE_REGISTRATION_NUMBER',
          message: 'Государственный номер повторяется в файле.',
        });
        return;
      }
      if (row.vinNormalized && vins.has(row.vinNormalized)) {
        errors.push({ rowNumber, code: 'DUPLICATE_VIN', message: 'VIN повторяется в файле.' });
        return;
      }
      plates.add(row.registrationNumberNormalized);
      if (row.vinNormalized) vins.add(row.vinNormalized);
      rows.push(row);
    } catch (error) {
      errors.push({
        rowNumber,
        code: 'INVALID_ROW',
        message: error instanceof Error ? error.message : 'Некорректная строка автомобиля.',
      });
    }
  });
  return { rows, errors };
}

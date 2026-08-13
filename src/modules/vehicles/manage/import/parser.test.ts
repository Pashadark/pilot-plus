import { describe, expect, it } from 'vitest';

import { normalizeFleetImportRows, parseExampleFleetWorkbook } from './parser';

const encoder = new TextEncoder();

function storedZip(files: Record<string, string>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  const write16 = (value: number) => Uint8Array.of(value & 255, (value >>> 8) & 255);
  const write32 = (value: number) =>
    Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
  for (const [name, text] of Object.entries(files)) {
    const path = encoder.encode(name);
    const body = encoder.encode(text);
    const local = new Uint8Array(30 + path.length + body.length);
    local.set([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0);
    local.set(write32(body.length), 18);
    local.set(write32(body.length), 22);
    local.set(write16(path.length), 26);
    local.set(path, 30);
    local.set(body, 30 + path.length);
    chunks.push(local);
    const central = new Uint8Array(46 + path.length);
    central.set([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0);
    central.set(write32(body.length), 20);
    central.set(write32(body.length), 24);
    central.set(write16(path.length), 28);
    central.set(write32(offset), 42);
    central.set(path, 46);
    directory.push(central);
    offset += local.length;
  }
  const directoryBytes = Uint8Array.from(directory.flatMap((chunk) => [...chunk]));
  const tail = new Uint8Array(22);
  tail.set([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0], 0);
  tail.set(write16(directory.length), 8);
  tail.set(write16(directory.length), 10);
  tail.set(write32(directoryBytes.length), 12);
  tail.set(write32(offset), 16);
  return Uint8Array.from([...chunks.flatMap((chunk) => [...chunk]), ...directoryBytes, ...tail]);
}

function canonicalWorkbook(extraFiles: Record<string, string> = {}) {
  return storedZip({
    '[Content_Types].xml': '<Types/>',
    'xl/workbook.xml':
      '<workbook><sheets><sheet name="Автомобили" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':
      '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Марка</t></is></c><c r="B1" t="inlineStr"><is><t>Модель</t></is></c><c r="C1" t="inlineStr"><is><t>Госномер</t></is></c><c r="D1" t="inlineStr"><is><t>Год</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Kia</t></is></c><c r="B2" t="inlineStr"><is><t>Cee&apos;d</t></is></c><c r="C2" t="inlineStr"><is><t>А429АУ97</t></is></c><c r="D2"><v>2020</v></c></row></sheetData></worksheet>',
    ...extraFiles,
  });
}

describe('example fleet import parser', () => {
  it('normalizes the four approved canonical vehicles without database writes', () => {
    const result = normalizeFleetImportRows([
      { make: 'Kia', model: "Cee'd", registrationNumber: 'A 429 AY 97', year: '2020' },
      { make: 'Skoda', model: 'Octavia', registrationNumber: 'E435AH997', year: '2019' },
      {
        make: 'Mercedes-Benz',
        model: 'E 220 d 4MATIC',
        registrationNumber: 'M283AM997',
        year: '2019',
      },
      { make: 'Volkswagen', model: 'Polo', registrationNumber: 'A156AX997', year: '2020' },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.rows.map((row) => row.registrationNumberNormalized)).toEqual([
      'А429АУ97',
      'Е435АН997',
      'М283АМ997',
      'А156АХ997',
    ]);
  });

  it('reports duplicate normalized plates and VINs instead of producing ambiguous rows', () => {
    const result = normalizeFleetImportRows([
      { make: 'Kia', model: "Cee'd", registrationNumber: 'А429АУ97', year: '2020', vin: 'abc' },
      { make: 'Kia', model: "Cee'd", registrationNumber: 'A429AY97', year: '2020', vin: 'ABC' },
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowNumber: 3, code: 'DUPLICATE_REGISTRATION_NUMBER' }),
      ]),
    );
  });

  it('rejects non-xlsx uploads before inspecting workbook content', () => {
    expect(() =>
      parseExampleFleetWorkbook({ filename: 'fleet.xls', bytes: new Uint8Array() }),
    ).toThrow('Только файлы .xlsx');
  });

  it('reads the canonical Автомобили sheet and rejects macro and external-link containers', () => {
    expect(() =>
      parseExampleFleetWorkbook({ filename: 'fleet.xlsx', bytes: canonicalWorkbook() }),
    ).toThrow('утверждённые четыре');
    expect(() =>
      parseExampleFleetWorkbook({
        filename: 'fleet.xlsx',
        bytes: canonicalWorkbook({ 'xl/vbaProject.bin': 'macro' }),
      }),
    ).toThrow(/макрос/i);
    expect(() =>
      parseExampleFleetWorkbook({
        filename: 'fleet.xlsx',
        bytes: canonicalWorkbook({ 'xl/externalLinks/externalLink1.xml': '<externalLink />' }),
      }),
    ).toThrow(/внешн.*ссылк/i);
  });

  it('rejects an example workbook that is not exactly the approved four-car fleet', () => {
    expect(() =>
      parseExampleFleetWorkbook({ filename: 'fleet.xlsx', bytes: canonicalWorkbook() }),
    ).toThrow('утверждённые четыре');
  });
});

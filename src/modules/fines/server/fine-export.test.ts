import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildFineWorkbook } from './fine-export';

describe('fine Excel export', () => {
  it('creates a real formatted xlsx workbook with the filtered rows', async () => {
    const buffer = await buildFineWorkbook([
      {
        offenseAt: '2026-10-08T09:00:00.000Z',
        kind: 'FINE',
        source: 'ГИБДД',
        decreeNumber: '188101772610080001',
        description: 'Превышение скорости',
        address: 'Москва',
        currentAmountMinor: '75000',
        originalAmountMinor: '150000',
        status: 'UNPAID',
        vehicleLabel: 'Kia K5 · М022АН997',
        clientLabel: 'Мамаев Саид',
        rentalLabel: 'ME-2026-0076',
        assigned: true,
        discountExpiresAt: '2026-10-12T20:59:59.000Z',
        toBailiff: false,
      },
    ]);

    expect(Buffer.from(buffer).subarray(0, 2).toString()).toBe('PK');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Штрафы');
    expect(sheet?.getCell('A1').value).toBe('Штрафы и платные дороги');
    expect(sheet?.getCell('A4').value).toBe('Дата нарушения');
    expect(sheet?.getCell('D5').value).toBe('188101772610080001');
    expect(sheet?.getCell('G5').value).toBe(750);
    expect(sheet?.getCell('J5').value).toBe('Kia K5 · М022АН997');
    expect(sheet?.getCell('I5').value).toBe('Не оплачен');
    expect(sheet?.autoFilter).toBe('A4:O5');
  });

  it('labels archived fines explicitly', async () => {
    const buffer = await buildFineWorkbook([
      {
        offenseAt: '2026-10-08T09:00:00.000Z',
        kind: 'FINE',
        source: 'Driver Helper',
        decreeNumber: '188101772610080002',
        description: 'Штраф',
        address: null,
        currentAmountMinor: '75000',
        originalAmountMinor: '75000',
        status: 'ARCHIVED',
        vehicleLabel: 'Kia K5',
        clientLabel: null,
        rentalLabel: null,
        assigned: false,
        discountExpiresAt: null,
        toBailiff: false,
      },
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.getWorksheet('Штрафы')?.getCell('I5').value).toBe('Архив');
  });
});

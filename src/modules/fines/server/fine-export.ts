import ExcelJS from 'exceljs';

export interface FineExportRow {
  offenseAt: string;
  kind: 'FINE' | 'TOLL';
  source: string;
  decreeNumber: string;
  description: string | null;
  address: string | null;
  currentAmountMinor: string;
  originalAmountMinor: string;
  status: string;
  vehicleLabel: string;
  clientLabel: string | null;
  rentalLabel: string | null;
  assigned: boolean;
  discountExpiresAt: string | null;
  toBailiff: boolean;
}

const headers = [
  'Дата нарушения',
  'Тип',
  'Источник / дорога',
  'Постановление / УИН',
  'Нарушение',
  'Адрес',
  'К оплате, ₽',
  'Без скидки, ₽',
  'Статус',
  'Автомобиль',
  'Клиент',
  'Договор',
  'Привязка',
  'Скидка до',
  'Приставы',
] as const;

function rubles(minor: string) {
  return Number(BigInt(minor)) / 100;
}

const statusLabels: Record<string, string> = {
  NEW: 'Новый',
  UNPAID: 'Не оплачен',
  PAID: 'Оплачен',
  CANCELLED: 'Отменён',
  OVERDUE: 'Просрочен',
  ARCHIVED: 'Архив',
};

export async function buildFineWorkbook(rows: readonly FineExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'СУПА ПРО';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Штрафы', {
    views: [{ state: 'frozen', ySplit: 4 }],
    properties: { defaultRowHeight: 22 },
  });

  sheet.mergeCells('A1:O1');
  sheet.getCell('A1').value = 'Штрафы и платные дороги';
  sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF101014' } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 36;

  sheet.mergeCells('A2:O2');
  sheet.getCell('A2').value = `Выгружено: ${new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Moscow',
  }).format(new Date())} · Записей: ${rows.length}`;
  sheet.getCell('A2').font = { color: { argb: 'FF777780' }, italic: true };

  const headerRow = sheet.getRow(4);
  headerRow.values = [...headers];
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0067FF' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  for (const item of rows) {
    const row = sheet.addRow([
      new Date(item.offenseAt),
      item.kind === 'TOLL' ? 'Платная дорога' : 'Штраф',
      item.source,
      item.decreeNumber,
      item.description ?? '',
      item.address ?? '',
      rubles(item.currentAmountMinor),
      rubles(item.originalAmountMinor),
      statusLabels[item.status] ?? item.status,
      item.vehicleLabel,
      item.clientLabel ?? '',
      item.rentalLabel ?? '',
      item.assigned ? 'Привязан' : 'Нужно привязать',
      item.discountExpiresAt ? new Date(item.discountExpiresAt) : '',
      item.toBailiff ? 'Да' : 'Нет',
    ]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD7D7DC' } } };
    });
  }

  sheet.getColumn(1).numFmt = 'dd.mm.yyyy hh:mm';
  sheet.getColumn(7).numFmt = '#,##0.00 [$₽-ru-RU]';
  sheet.getColumn(8).numFmt = '#,##0.00 [$₽-ru-RU]';
  sheet.getColumn(14).numFmt = 'dd.mm.yyyy hh:mm';
  [20, 17, 19, 25, 34, 28, 15, 15, 15, 27, 27, 20, 18, 19, 12].forEach(
    (width, index) => {
      sheet.getColumn(index + 1).width = width;
    },
  );
  sheet.autoFilter = { from: 'A4', to: `O${Math.max(5, rows.length + 4)}` };

  return workbook.xlsx.writeBuffer();
}

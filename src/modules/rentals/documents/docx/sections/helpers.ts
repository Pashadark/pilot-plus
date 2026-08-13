import { Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';

export function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function displayList(values: readonly unknown[], separator = ' / '): string {
  return values.map(display).join(separator);
}

export function money(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${(value / 100).toLocaleString('ru-RU')} ₽`
    : '—';
}

export function withUnit(value: unknown, unit: string): string {
  return value === null || value === undefined || value === '' ? '—' : `${display(value)} ${unit}`;
}

export const table = (rows: readonly (readonly [unknown, unknown])[]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: display(label), bold: true })] }),
              ],
            }),
            new TableCell({ children: [new Paragraph(display(value))] }),
          ],
        }),
    ),
  });

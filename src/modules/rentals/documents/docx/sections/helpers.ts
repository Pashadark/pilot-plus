import { Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
export const value = (v: unknown) => String(v ?? '—');
export const money = (v: unknown) => `${(Number(v ?? 0) / 100).toLocaleString('ru-RU')} ₽`;
export const table = (rows: readonly (readonly [unknown, unknown])[]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([a, b]) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: value(a), bold: true })] }),
              ],
            }),
            new TableCell({ children: [new Paragraph(value(b))] }),
          ],
        }),
    ),
  });

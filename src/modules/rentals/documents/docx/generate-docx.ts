import {
  AlignmentType,
  Document,
  HeadingLevel,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { legalContentV1 } from '../legal-content-v1';
import type { buildRentalSnapshot } from '../../domain/build-snapshot';

type Snapshot = ReturnType<typeof buildRentalSnapshot>;
const text = (v: unknown) => String(v ?? '—');
const money = (v: unknown) => `${(Number(v ?? 0) / 100).toLocaleString('ru-RU')} ₽`;
const row = (a: unknown, b: unknown) =>
  new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: text(a), bold: true })] })],
      }),
      new TableCell({ children: [new Paragraph(text(b))] }),
    ],
  });
const table = (items: readonly (readonly [unknown, unknown])[]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: items.map(([a, b]) => row(a, b)),
  });
export function generateRentalDocx(snapshot: Snapshot, contractNumber: string) {
  const c = snapshot.company,
    cl = snapshot.client,
    v = snapshot.vehicle,
    r = snapshot.rental as unknown as {
      startsAt: string;
      endsAt: string;
      agreedTotalMinor: number;
      depositMinor: number;
      days: number;
    };
  const children: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `ДОГОВОР ПРОКАТА №${contractNumber}`, bold: true, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      text: `${text(c.contractCity)}, ${new Date(String(r.startsAt)).toLocaleDateString('ru-RU')}`,
    }),
    new Paragraph({
      text: `${text(c.legalName)}, именуемый далее «Арендодатель», и ${text(cl.fullName)}, именуемый далее «Арендатор», заключили настоящий договор.`,
    }),
    new Paragraph({ text: '1. ПРЕДМЕТ ДОГОВОРА', heading: HeadingLevel.HEADING_1 }),
    table([
      ['Марка, модель', `${text(v.make)} ${text(v.model)}`],
      ['Регистрационный знак', v.registrationNumber],
      ['VIN', v.vin],
      ['Срок аренды', `${r.startsAt} — ${r.endsAt}`],
    ]),
    new Paragraph({ text: '2. СТОИМОСТЬ И УСЛОВИЯ', heading: HeadingLevel.HEADING_1 }),
    table([
      ['Суточный тариф', money(v.dailyMinor)],
      ['Стоимость аренды', money(r.agreedTotalMinor)],
      ['Залог', money(r.depositMinor)],
      ['Количество суток', r.days],
    ]),
    new Paragraph({ text: '3. ДОКУМЕНТЫ И СТРАХОВАНИЕ', heading: HeadingLevel.HEADING_1 }),
    table([
      ['СТС', v.registrationCertificateNumber],
      ['ПТС', v.vehiclePassportNumber],
      ['ОСАГО', v.osagoPolicyNumber],
      ['Страховщик', v.osagoInsurer],
    ]),
    new Paragraph({ text: '4. ДАННЫЕ АРЕНДАТОРА', heading: HeadingLevel.HEADING_1 }),
    table([
      ['ФИО', cl.fullName],
      ['Паспорт', cl.passport],
      ['Водительское удостоверение', cl.licenseNumber],
      ['Адрес', cl.registrationAddress],
    ]),
    ...legalContentV1.clauses
      .map(([h, p]) => [
        new Paragraph({ text: h, heading: HeadingLevel.HEADING_1 }),
        new Paragraph(p),
      ])
      .flat(),
    new Paragraph({ text: '5. РЕКВИЗИТЫ И ПОДПИСИ', heading: HeadingLevel.HEADING_1 }),
    table([
      ['Арендодатель', `${c.legalName}, ИНН ${c.inn}, ${c.address}`],
      ['Арендатор', `${cl.fullName}, ${cl.phone}`],
      ['Подпись Арендодателя', '________________'],
      ['Подпись Арендатора', '________________'],
    ]),
    new Paragraph({ text: 'Приложение № 1. Штрафы', heading: HeadingLevel.HEADING_1 }),
    table(legalContentV1.penalties),
  ];
  return new Document({ sections: [{ children }] });
}

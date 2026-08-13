import { Paragraph, TextRun } from 'docx';
import type { RentalSnapshot } from '../../../domain/build-snapshot';
import { display, table } from './helpers';

export function closing(
  s: RentalSnapshot,
  clauses: readonly (readonly [string, string])[],
  penalties: readonly (readonly [string, string])[],
) {
  return [
    ...clauses.flatMap(([heading, provision], index) => [
      new Paragraph({ children: [new TextRun({ text: `${index + 4}. ${heading}`, bold: true })] }),
      new Paragraph(provision),
    ]),
    new Paragraph({
      children: [new TextRun({ text: '12. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН', bold: true })],
    }),
    table([
      [
        'Арендодатель',
        ` ${display(s.company.legalName)}, ИНН ${display(s.company.inn)}, КПП ${display(s.company.kpp)}, ОГРН ${display(s.company.ogrn)}, адрес: ${display(s.company.address)}`,
      ],
      [
        'Банковские реквизиты',
        `${display(s.company.bankName)}, р/с ${display(s.company.settlementAccount)}, к/с ${display(s.company.correspondentAccount)}, БИК ${display(s.company.bik)}`,
      ],
      [
        'Подписант Арендодателя',
        `${display(s.company.signatoryName)}, основание: ${display(s.company.signatoryAuthority)}`,
      ],
      ['Арендатор', `${display(s.client.fullName)}, телефон ${display(s.client.phone)}`],
      ['Подпись Арендодателя', '____________________'],
      ['Подпись Арендатора', '____________________'],
    ]),
    new Paragraph({
      children: [new TextRun({ text: 'Приложение № 1. Штрафы и удержания', bold: true })],
    }),
    table(penalties),
  ];
}

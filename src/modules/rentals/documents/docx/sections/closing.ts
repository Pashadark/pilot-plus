import { Paragraph, TextRun } from 'docx';
import { table } from './helpers';

export function closing(
  s: any,
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
        `${s.company.legalName}, ИНН ${s.company.inn}, КПП ${s.company.kpp}, ОГРН ${s.company.ogrn}, адрес: ${s.company.address}`,
      ],
      [
        'Банковские реквизиты',
        `${s.company.bankName}, р/с ${s.company.settlementAccount}, к/с ${s.company.correspondentAccount}, БИК ${s.company.bik}`,
      ],
      [
        'Подписант Арендодателя',
        `${s.company.signatoryName}, основание: ${s.company.signatoryAuthority}`,
      ],
      ['Арендатор', `${s.client.fullName}, телефон ${s.client.phone}`],
      ['Подпись Арендодателя', '____________________'],
      ['Подпись Арендатора', '____________________'],
    ]),
    new Paragraph({
      children: [new TextRun({ text: 'Приложение № 1. Штрафы и удержания', bold: true })],
    }),
    table(penalties),
  ];
}

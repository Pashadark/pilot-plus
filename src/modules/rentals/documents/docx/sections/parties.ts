import { Paragraph, TextRun } from 'docx';
import { table } from './helpers';

export function parties(s: any) {
  return [
    new Paragraph({ children: [new TextRun({ text: '1. СТОРОНЫ ДОГОВОРА', bold: true })] }),
    new Paragraph(
      `Арендодатель: ${s.company.legalName}, ИНН ${s.company.inn}, адрес: ${s.company.address}; в лице ${s.company.signatoryName}, действующего на основании ${s.company.signatoryAuthority}.`,
    ),
    new Paragraph(
      `Арендатор: ${s.client.fullName}, дата рождения ${s.client.birthDate}, паспорт ${s.client.passport}, адрес регистрации ${s.client.registrationAddress}, водительское удостоверение ${s.client.licenseNumber}.`,
    ),
    table([
      ['Телефон / e-mail Арендатора', `${s.client.phone} / ${s.client.email}`],
      ['Адрес фактического проживания', s.client.residentialAddress],
      [
        'ВУ выдано / действительно до',
        `${s.client.licenseIssuedAt} / ${s.client.licenseExpiresAt}`,
      ],
      ['Адрес Арендодателя', s.company.actualAddress],
    ]),
  ];
}

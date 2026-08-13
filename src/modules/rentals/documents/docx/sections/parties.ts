import { Paragraph, TextRun } from 'docx';
import { display, displayList, table } from './helpers';

export function parties(s: any) {
  return [
    new Paragraph({ children: [new TextRun({ text: '1. СТОРОНЫ ДОГОВОРА', bold: true })] }),
    new Paragraph(
      `Арендодатель: ${display(s.company.legalName)}, ИНН ${display(s.company.inn)}, адрес: ${display(s.company.address)}; в лице ${display(s.company.signatoryName)}, действующего на основании ${display(s.company.signatoryAuthority)}.`,
    ),
    new Paragraph(
      `Арендатор: ${display(s.client.fullName)}, дата рождения ${display(s.client.birthDate)}, паспорт ${display(s.client.passport)}, адрес регистрации ${display(s.client.registrationAddress)}, водительское удостоверение ${display(s.client.licenseNumber)}.`,
    ),
    table([
      ['Телефон / e-mail Арендатора', displayList([s.client.phone, s.client.email])],
      ['Адрес фактического проживания', s.client.residentialAddress],
      [
        'ВУ выдано / действительно до',
        displayList([s.client.licenseIssuedAt, s.client.licenseExpiresAt]),
      ],
      ['Адрес Арендодателя', s.company.actualAddress],
    ]),
  ];
}

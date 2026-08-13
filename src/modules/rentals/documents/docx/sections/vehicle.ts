import { Paragraph, TextRun } from 'docx';
import { table } from './helpers';

export function vehicle(s: any) {
  return [
    new Paragraph({
      children: [new TextRun({ text: '2. ПРЕДМЕТ ДОГОВОРА И ТРАНСПОРТНОЕ СРЕДСТВО', bold: true })],
    }),
    table([
      ['Марка, модель', `${s.vehicle.make} ${s.vehicle.model}`],
      ['Регистрационный знак', s.vehicle.registrationNumber],
      ['VIN', s.vehicle.vin],
      ['Год / цвет / кузов', `${s.vehicle.year} / ${s.vehicle.color} / ${s.vehicle.bodyType}`],
      [
        'Трансмиссия / топливо / мест',
        `${s.vehicle.transmission} / ${s.vehicle.fuelType} / ${s.vehicle.seats}`,
      ],
    ]),
    new Paragraph({ children: [new TextRun({ text: 'Документы и страхование', bold: true })] }),
    table([
      [
        'СТС / ПТС',
        `${s.vehicle.registrationCertificateNumber} / ${s.vehicle.vehiclePassportNumber}`,
      ],
      ['ОСАГО', `${s.vehicle.osagoInsurer} ${s.vehicle.osagoPolicyNumber}`],
      ['Срок ОСАГО', `${s.vehicle.osagoStartsAt} — ${s.vehicle.osagoEndsAt}`],
      ['КАСКО', `${s.vehicle.cascoInsurer} ${s.vehicle.cascoPolicyNumber}`],
      ['Срок КАСКО', `${s.vehicle.cascoStartsAt} — ${s.vehicle.cascoEndsAt}`],
    ]),
  ];
}

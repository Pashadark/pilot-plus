import { Paragraph, TextRun } from 'docx';
import type { RentalSnapshot } from '../../../domain/build-snapshot';
import { displayList, table } from './helpers';

export function vehicle(s: RentalSnapshot) {
  return [
    new Paragraph({
      children: [new TextRun({ text: '2. ПРЕДМЕТ ДОГОВОРА И ТРАНСПОРТНОЕ СРЕДСТВО', bold: true })],
    }),
    table([
      ['Марка, модель', displayList([s.vehicle.make, s.vehicle.model], ' ')],
      ['Регистрационный знак', s.vehicle.registrationNumber],
      ['VIN', s.vehicle.vin],
      ['Год / цвет / кузов', displayList([s.vehicle.year, s.vehicle.color, s.vehicle.bodyType])],
      [
        'Трансмиссия / топливо / мест',
        displayList([s.vehicle.transmission, s.vehicle.fuelType, s.vehicle.seats]),
      ],
    ]),
    new Paragraph({ children: [new TextRun({ text: 'Документы и страхование', bold: true })] }),
    table([
      [
        'СТС / ПТС',
        displayList([s.vehicle.registrationCertificateNumber, s.vehicle.vehiclePassportNumber]),
      ],
      ['ОСАГО', displayList([s.vehicle.osagoInsurer, s.vehicle.osagoPolicyNumber], ' ')],
      ['Срок ОСАГО', displayList([s.vehicle.osagoStartsAt, s.vehicle.osagoEndsAt], ' — ')],
      ['КАСКО', displayList([s.vehicle.cascoInsurer, s.vehicle.cascoPolicyNumber], ' ')],
      ['Срок КАСКО', displayList([s.vehicle.cascoStartsAt, s.vehicle.cascoEndsAt], ' — ')],
    ]),
  ];
}

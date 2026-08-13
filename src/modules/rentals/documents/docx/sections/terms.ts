import { Paragraph, TextRun } from 'docx';
import { money, table } from './helpers';

function moscowDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

export function terms(s: any) {
  return [
    new Paragraph({ children: [new TextRun({ text: '3. СРОК АРЕНДЫ И РАСЧЁТЫ', bold: true })] }),
    table([
      ['Начало проката (Москва)', moscowDateTime(s.rental.startsAt)],
      ['Окончание проката (Москва)', moscowDateTime(s.rental.endsAt)],
      ['Место выдачи', s.rental.pickupAddress],
      ['Место возврата', s.rental.returnAddress],
      ['Допущенные водители', `${s.client.fullName}, ВУ ${s.client.licenseNumber}`],
    ]),
    table([
      ['Базовая стоимость', money(s.rental.calculatedTotalMinor)],
      ['Скидка', money(s.rental.discountMinor)],
      ['Дополнительные услуги', money(s.rental.servicesMinor)],
      ['Итоговая стоимость', money(s.rental.agreedTotalMinor)],
      ['Залог', money(s.rental.depositMinor)],
      [
        'Условия: пробег / топливо',
        `${s.rental.conditions}; ${s.vehicle.includedMileageKm} км, перерасход ${money(s.vehicle.overageMileagePriceMinor)}, топливо ${money(s.vehicle.missingFuelPriceMinor)}`,
      ],
    ]),
  ];
}

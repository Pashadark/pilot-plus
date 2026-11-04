import { Paragraph, TextRun } from 'docx';
import { resolveRentalMileagePolicy } from '../../../domain/mileage-policy';
import type { RentalSnapshot } from '../../../domain/build-snapshot';
import { display, displayList, money, table } from './helpers';

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

export function terms(s: RentalSnapshot) {
  const issuance = s.issuance ?? {};
  const rentalDays = s.rental.days;
  const mileagePolicy = resolveRentalMileagePolicy({
    agreementType:
      (s as RentalSnapshot & { agreementType?: string }).agreementType === 'LEASE_TO_OWN'
        ? 'LEASE_TO_OWN'
        : 'STANDARD',
    billableDays: typeof rentalDays === 'number' ? rentalDays : 1,
    includedMileageKm: s.vehicle.includedMileageKm,
  });
  const mileageTerms =
    mileagePolicy.dailyLimitKm !== null && mileagePolicy.totalLimitKm !== null
      ? `включённый пробег ${mileagePolicy.dailyLimitKm} км/сутки, всего ${mileagePolicy.totalLimitKm} км`
      : undefined;
  return [
    new Paragraph({ children: [new TextRun({ text: '3. СРОК АРЕНДЫ И РАСЧЁТЫ', bold: true })] }),
    table([
      ['Начало проката (Москва)', moscowDateTime(s.rental.startsAt)],
      ['Окончание проката (Москва)', moscowDateTime(s.rental.endsAt)],
      ['Место выдачи', issuance.pickupAddress ?? s.rental.pickupAddress],
      ['Место возврата', issuance.returnAddress ?? s.rental.returnAddress],
      ['Допущенные водители', display(issuance.allowedDrivers)],
    ]),
    table([
      ['Базовая стоимость', money(s.rental.calculatedTotalMinor)],
      ['Скидка', money(s.rental.discountMinor)],
      ['Дополнительные услуги', money(s.rental.servicesMinor)],
      ['Итоговая стоимость', money(s.rental.agreedTotalMinor)],
      ['Залог', money(s.rental.depositMinor)],
      [
        'Условия: пробег / топливо',
        displayList(
          [
            display(s.rental.conditions),
            mileageTerms,
            `перерасход ${money(s.vehicle.overageMileagePriceMinor)}`,
            `топливо ${money(s.vehicle.missingFuelPriceMinor)}`,
          ],
          '; ',
        ),
      ],
    ]),
    new Paragraph({
      children: [new TextRun({ text: 'СВЕДЕНИЯ О ВЫДАЧЕ И ВОЗВРАТЕ', bold: true })],
    }),
    table([
      ['Пробег при выдаче, км', display(issuance.startMileageKm)],
      ['Пробег при возврате, км', display(issuance.returnMileageKm)],
      ['Топливо при выдаче, %', display(issuance.startFuelPercent)],
      ['Топливо при возврате, %', display(issuance.returnFuelPercent)],
      ['Территория использования', display(issuance.territory)],
      ['Условия оплаты', display(issuance.paymentTerms)],
    ]),
  ];
}

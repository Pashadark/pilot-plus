import type { RentalCalculation, RentalCalculationInput } from './types';

const DAY_MS = 86_400_000;
function safeMoney(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${name} должен быть безопасным неотрицательным целым.`);
  return value;
}
function validDate(value: Date): number {
  const time = value.getTime();
  if (!Number.isSafeInteger(time)) throw new Error('Дата аренды некорректна.');
  return time;
}

export function moscowLocalToUtc(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Укажите московскую дату и время.');
  const date = new Date(`${value}:00+03:00`);
  validDate(date);
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((out, part) => ({ ...out, [part.type]: part.value }), {});
  if (`${local.year}-${local.month}-${local.day}T${local.hour}:${local.minute}` !== value)
    throw new Error('Московская календарная дата некорректна.');
  return date;
}

export function calculateRental(input: RentalCalculationInput): RentalCalculation {
  const startsAt = validDate(input.startsAt);
  const endsAt = validDate(input.endsAt);
  if (endsAt <= startsAt) throw new Error('Дата возврата должна быть позже даты выдачи.');
  const days = Math.ceil((endsAt - startsAt) / DAY_MS);
  const daily = safeMoney(input.dailyMinor, 'Суточный тариф');
  const discount = safeMoney(input.discountMinor ?? 0, 'Скидка');
  const services = safeMoney(input.serviceMinor ?? 0, 'Услуги');
  const totalBig = BigInt(days) * BigInt(daily) - BigInt(discount) + BigInt(services);
  if (totalBig < BigInt(0) || totalBig > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Итоговая сумма некорректна.');
  const total = Number(totalBig);
  const agreed =
    input.agreedTotalMinor === undefined
      ? total
      : safeMoney(input.agreedTotalMinor, 'Согласованная сумма');
  return {
    days,
    calculatedTotalMinor: total,
    agreedTotalMinor: agreed,
    discountMinor: discount,
    servicesMinor: services,
    warnings: agreed === total ? [] : ['AGREED_TOTAL_DIFFERS'],
  };
}

import type { Prisma } from '@/database/generated/prisma';

const dayMs = 24 * 60 * 60 * 1000;

function searchDay(value: string) {
  const ru = /^(\d{2})\.(\d{2})\.(\d{4})$/u.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  const year = Number(ru?.[3] ?? iso?.[1]);
  const month = Number(ru?.[2] ?? iso?.[2]);
  const day = Number(ru?.[1] ?? iso?.[3]);
  if (!year || !month || !day) return null;
  // Moscow does not use daylight saving time: local midnight is always UTC+3.
  const from = new Date(Date.UTC(year, month - 1, day) - 3 * 60 * 60 * 1000);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { from, to: new Date(from.getTime() + dayMs) };
}

export function buildFineSearchWhere(rawQuery: string | undefined): Prisma.FineWhereInput | undefined {
  const query = rawQuery?.trim();
  if (!query) return undefined;
  const day = searchDay(query);
  if (day) return { offenseAt: { gte: day.from, lt: day.to } };

  return {
    OR: [
      { decreeNumber: { contains: query, mode: 'insensitive' } },
      { uin: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { address: { contains: query, mode: 'insensitive' } },
      { vehicle: { registrationNumberNormalized: { contains: query.toLocaleUpperCase('ru') } } },
      { vehicle: { make: { contains: query, mode: 'insensitive' } } },
      { vehicle: { modelName: { contains: query, mode: 'insensitive' } } },
      { vehicle: { model: { contains: query, mode: 'insensitive' } } },
      { client: { lastName: { contains: query, mode: 'insensitive' } } },
      { client: { firstName: { contains: query, mode: 'insensitive' } } },
      { client: { middleName: { contains: query, mode: 'insensitive' } } },
      { rental: { contractNumber: { contains: query, mode: 'insensitive' } } },
    ],
  };
}

type TollSearchItem = {
  vehicleLabel?: string | null;
  clientLabel?: string | null;
  rentalLabel?: string | null;
  roadLabel?: string | null;
  description?: string | null;
  offenseAt: string;
  checkedAt?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Moscow',
});

export function matchesTollSearch(item: TollSearchItem, rawQuery: string | undefined) {
  const query = rawQuery?.trim().toLocaleLowerCase('ru');
  if (!query) return true;
  const searchable = [
    item.vehicleLabel,
    item.clientLabel,
    item.rentalLabel,
    item.roadLabel,
    item.description,
    dateFormatter.format(new Date(item.offenseAt)),
    item.offenseAt.slice(0, 10),
    item.checkedAt ? dateFormatter.format(new Date(item.checkedAt)) : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ru');
  return searchable.includes(query);
}

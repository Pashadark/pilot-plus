import type { RentalRequest } from './rental-request';

export type Candidate = {
  id: string;
  model: string;
  registrationNumber: string | null;
  isRentalReady: boolean;
  status: string;
  rentals: { status: string; startsAt: Date; endsAt: Date }[];
  maintenanceRecords: { status: string; scheduledAt: Date | null; scheduledEndsAt: Date | null }[];
};

export function matchRentalFleet(candidates: Candidate[], request: RentalRequest) {
  if (!request.model || !request.startsAt || !request.endsAt)
    return {
      available: [] as Candidate[],
      note: 'Для подбора нужно уточнить автомобиль, даты и время аренды.',
    };
  const start = Date.parse(request.startsAt),
    end = Date.parse(request.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return { available: [] as Candidate[], note: 'Период аренды требует уточнения.' };
  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\d]/gu, '');
  const wanted = normalize(request.model);
  const available = candidates.filter((car) => {
    if (
      !normalize(car.model).startsWith(wanted) ||
      !car.isRentalReady ||
      ['MAINTENANCE', 'DISABLED'].includes(car.status)
    )
      return false;
    if (
      car.rentals.some(
        (r) =>
          ['CONFIRMED', 'ACTIVE'].includes(r.status) &&
          r.startsAt.getTime() < end &&
          r.endsAt.getTime() > start,
      )
    )
      return false;
    return !car.maintenanceRecords.some(
      (m) =>
        !['COMPLETED', 'CANCELLED'].includes(m.status) &&
        (!m.scheduledAt || m.scheduledAt.getTime() < end) &&
        (!m.scheduledEndsAt || m.scheduledEndsAt.getTime() > start),
    );
  });
  return {
    available,
    note: available.length
      ? 'Доступность проверена по арендам и ТО; перед бронированием перепроверить.'
      : 'Свободные подходящие автомобили не найдены. Нужен подбор менеджера.',
  };
}

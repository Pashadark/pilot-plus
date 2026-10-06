import type { Candidate } from './fleet-match';
import { rentalQuestions, type RentalRequest } from './rental-request';

export function fleetAvailability(cars: Candidate[], request: RentalRequest, now: Date) {
  const free: Candidate[] = [];
  const expected: { car: Candidate; returnsAt: Date }[] = [];
  const day =
    request.startDay ??
    (request.startsAt
      ? new Date(Date.parse(request.startsAt) + 10800000).toISOString().slice(0, 10)
      : null);
  if (!day) return { free, expected, knownDay: false };
  const dayStart = Date.parse(`${day}T00:00:00+03:00`);
  const dayEnd = dayStart + 86400000;
  const start = request.startsAt ? Date.parse(request.startsAt) : Math.max(dayStart, now.getTime());
  const end = request.endsAt
    ? Date.parse(request.endsAt)
    : request.endDay
      ? Date.parse(`${request.endDay}T00:00:00+03:00`) + 86400000
      : request.days
        ? start + request.days * 86400000
        : dayEnd;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return { free, expected, knownDay: false };
  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\d]/gu, '');
  for (const car of cars) {
    if (
      !car.isRentalReady ||
      ['MAINTENANCE', 'DISABLED'].includes(car.status) ||
      (request.model && !normalize(car.model).startsWith(normalize(request.model)))
    )
      continue;
    const active = car.rentals.filter((r) => r.status === 'ACTIVE');
    // An ACTIVE record represents a car not yet handed back, even if its deadline passed.
    if (active.some((r) => r.endsAt.getTime() <= now.getTime()) || active.length > 1) continue;
    const candidateStart =
      !request.startsAt && active.length ? Math.max(start, active[0].endsAt.getTime()) : start;
    const candidateEnd =
      !request.endsAt && !request.endDay && request.days
        ? candidateStart + request.days * 86400000
        : end;
    if (
      car.rentals.some(
        (r) =>
          r.status === 'CONFIRMED' &&
          r.startsAt.getTime() < candidateEnd &&
          r.endsAt.getTime() > candidateStart,
      )
    )
      continue;
    if (
      car.maintenanceRecords.some(
        (m) =>
          !['COMPLETED', 'CANCELLED'].includes(m.status) &&
          (!m.scheduledAt || m.scheduledAt.getTime() < candidateEnd) &&
          (!m.scheduledEndsAt || m.scheduledEndsAt.getTime() > candidateStart),
      )
    )
      continue;
    if (active.length) {
      const returnsAt = active[0].endsAt;
      if (returnsAt.getTime() < dayEnd && (!request.startsAt || returnsAt.getTime() <= start))
        expected.push({ car, returnsAt });
    } else free.push(car);
  }
  expected.sort((a, b) => a.returnsAt.getTime() - b.returnsAt.getTime());
  return { free, expected, knownDay: true };
}

export function customerReply(cars: Candidate[], request: RentalRequest, now: Date) {
  const availability = fleetAvailability(cars, request, now);
  const questions = rentalQuestions(request);
  const lines: string[] = [];
  if (request.startDay && request.endDay) {
    const format = (day: string) => day.slice(8, 10) + '.' + day.slice(5, 7);
    lines.push(
      `Понял${request.model ? ': ' + request.model : ''}, с ${format(request.startDay)} по ${format(request.endDay)}.`,
    );
  }
  if (availability.knownDay) {
    const models = [...new Set(availability.free.map((car) => car.model))].slice(0, 5);
    if (models.length) lines.push('По расписанию свободны: ' + models.join(', ') + '.');
    for (const entry of availability.expected.slice(0, 3)) {
      const when = new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow',
      }).format(entry.returnsAt);
      lines.push(`Плановый возврат: ${entry.car.model} — ${when} (Москва).`);
    }
    if (availability.expected.length)
      lines.push(
        'Выдача возвращающихся машин — после приёмки и подготовки, время подтвердит менеджер.',
      );
    if (!models.length && !availability.expected.length)
      lines.push(
        'По этому запросу подходящих свободных машин в расписании не нашлось. Менеджер проверит альтернативы.',
      );
    if (!request.startsAt || !request.endsAt)
      lines.push(
        request.endDay
          ? 'Это предварительный подбор: точную доступность проверим после уточнения времени.'
          : 'Это предварительный подбор: точную доступность проверим после уточнения времени и срока.',
      );
    else lines.push('Бронирование подтвердит менеджер.');
  }
  if (questions) lines.push(questions.replace(/^Здравствуйте!\s*/, ''));
  else lines.push('Данные для заявки получены. Условия аренды подтвердит менеджер.');
  return 'Здравствуйте! ' + lines.join('\n\n');
}

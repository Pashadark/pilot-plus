import { expect, it } from 'vitest';
import { customerReply, fleetAvailability } from './customer-reply';
import { extractRentalRequest } from './rental-request';
import { extractRentalConversation } from './rental-request';
const now = new Date('2026-09-24T09:00:00Z');
it('acknowledges supplied calendar dates and checks those dates rather than an old duration', () => {
  const request = extractRentalConversation([
    { text: 'Нужна машина на 4 дня', at: now.toISOString() },
    { text: 'Skoda Octavia с 25.09 по 26.09', at: now.toISOString() },
  ]);
  const octavia = {
    ...car,
    model: 'Skoda Octavia',
    rentals: [
      {
        status: 'CONFIRMED',
        startsAt: new Date('2026-09-28T09:00:00Z'),
        endsAt: new Date('2026-09-29T09:00:00Z'),
      },
    ],
  };
  const text = customerReply([octavia], request, now);
  expect(text).toContain('25.09');
  expect(text).toContain('26.09');
  expect(text).toContain('По расписанию свободны: Skoda Octavia');
  expect(text).not.toContain('На какие даты');
});
const car = {
  id: 'c',
  model: 'Toyota Camry',
  registrationNumber: 'PRIVATE',
  isRentalReady: true,
  status: 'PARKED',
  rentals: [],
  maintenanceRecords: [],
};
it('lists currently free cars and expected returns separately for today', () => {
  const request = extractRentalRequest('Какие машины сегодня на 3 дня?', now);
  const coming = {
    ...car,
    id: 'r',
    model: 'Kia Rio',
    rentals: [
      {
        status: 'ACTIVE',
        startsAt: new Date('2026-09-20T09:00:00Z'),
        endsAt: new Date('2026-09-24T15:00:00Z'),
      },
    ],
  };
  const result = fleetAvailability([car, coming], request, now);
  expect(result.free.map((c) => c.id)).toEqual(['c']);
  expect(result.expected.map((c) => c.car.id)).toEqual(['r']);
  const text = customerReply([car, coming], request, now);
  expect(text).toContain('Toyota Camry');
  expect(text).toContain('Kia Rio');
  expect(text).toContain('18:00');
  expect(text).toContain('после приёмки и подготовки');
  expect(text).not.toContain('PRIVATE');
});
it('never makes an overdue active rental free by its scheduled end date', () => {
  const overdue = {
    ...car,
    rentals: [
      {
        status: 'ACTIVE',
        startsAt: new Date('2026-09-20T09:00:00Z'),
        endsAt: new Date('2026-09-23T09:00:00Z'),
      },
    ],
  };
  const result = fleetAvailability([overdue], extractRentalRequest('Завтра на 3 дня', now), now);
  expect(result.free).toEqual([]);
  expect(result.expected).toEqual([]);
});
it('does not offer a car whose next confirmed booking overlaps the requested rental', () => {
  const reserved = {
    ...car,
    rentals: [
      {
        status: 'CONFIRMED',
        startsAt: new Date('2026-09-26T09:00:00Z'),
        endsAt: new Date('2026-09-28T09:00:00Z'),
      },
    ],
  };
  expect(
    fleetAvailability([reserved], extractRentalRequest('Завтра в 14:00 на 4 дня', now), now).free,
  ).toEqual([]);
});
it('without dates asks rather than claiming a model is available', () => {
  const text = customerReply([car], extractRentalRequest('Камри на 4 дня', now), now);
  expect(text).toContain('На какие даты');
  expect(text).not.toContain('свободны');
});
it('uses a fresh future-return label rather than guaranteed availability tomorrow', () => {
  const request = extractRentalRequest('Камри завтра на 3 дня', now);
  const coming = {
    ...car,
    rentals: [
      {
        status: 'ACTIVE',
        startsAt: new Date('2026-09-20T09:00:00Z'),
        endsAt: new Date('2026-09-25T10:00:00Z'),
      },
    ],
  };
  const text = customerReply([coming], request, now);
  expect(text).toContain('Плановый возврат');
  expect(text).toContain('25.09');
  expect(text).not.toContain('По расписанию свободны:');
});
it('acknowledges a fully specified enquiry and still shows actual availability', () => {
  const request = extractRentalRequest(
    'Камри завтра в 14:00 на 3 дня, всего 500 км, 89991234567',
    now,
  );
  const text = customerReply([car], request, now);
  expect(text).toContain('Toyota Camry');
  expect(text).toContain('менеджер');
  expect(text).not.toContain('Оставьте');
});
it('checks the whole duration after a late expected return, not just from morning', () => {
  const coming = {
    ...car,
    rentals: [
      {
        status: 'ACTIVE',
        startsAt: new Date('2026-09-20T09:00:00Z'),
        endsAt: new Date('2026-09-24T18:00:00Z'),
      },
      {
        status: 'CONFIRMED',
        startsAt: new Date('2026-09-27T15:00:00Z'),
        endsAt: new Date('2026-09-28T18:00:00Z'),
      },
    ],
  };
  expect(
    fleetAvailability([coming], extractRentalRequest('Сегодня на 3 дня', now), now).expected,
  ).toEqual([]);
});
it('keeps a large fleet response within the send limit without cutting off questions', () => {
  const cars = Array.from({ length: 20 }, (_, i) => ({
    ...car,
    id: String(i),
    model: 'Mercedes-Benz E 220 d 4MATIC ' + i,
  }));
  const returning = cars.slice(0, 5).map((c) => ({
    ...c,
    rentals: [
      {
        status: 'ACTIVE',
        startsAt: new Date('2026-09-20T09:00:00Z'),
        endsAt: new Date('2026-09-24T18:00:00Z'),
      },
    ],
  }));
  const text = customerReply(
    [...cars, ...returning],
    extractRentalRequest('Сегодня на 3 дня', now),
    now,
  );
  expect(text.length).toBeLessThanOrEqual(1000);
  expect(text).toContain('контактный телефон');
});

import { describe, expect, it } from 'vitest';
import {
  eligibleRentalAd,
  extractRentalRequest,
  extractRentalConversation,
  rentalQuestions,
} from './rental-request';

const now = new Date('2026-09-24T09:00:00Z');
it.each(['3 дня', 'на 3 дня', 'на 3 суток', 'три дня'])(
  'understands duration %s without inventing dates',
  (text) => {
    expect(extractRentalRequest(text, now)).toMatchObject({ days: 3, startsAt: null });
  },
);
it.each([
  ['с 1 октября до 10 декабря', '2026-10-01', '2026-12-10'],
  ['с 1 октября до 10 деакабря', '2026-10-01', '2026-12-10'],
  ['с 26 по 29', '2026-09-26', '2026-09-29'],
  ['с 26 по 29 декабря', '2026-12-26', '2026-12-29'],
])('understands named and omitted months: %s', (text, startDay, endDay) => {
  expect(extractRentalRequest(text, now)).toMatchObject({ startDay, endDay, startsAt: null });
});
it('understands a single explicit month and duration', () => {
  expect(extractRentalRequest('с 26 декабря на 3 суток', now)).toMatchObject({
    startDay: '2026-12-26',
    days: 3,
    startsAt: null,
  });
});
it('keeps the month from the original day-only message after a midnight month boundary', () => {
  const request = extractRentalConversation([
    { text: 'Камри с 30 по 30', at: '2026-09-29T20:55:00Z' },
    { text: '8.916.717.65.56', at: '2026-09-30T21:05:00Z' },
  ]);
  expect(request.endDay).not.toBe('2026-10-30');
});
it.each(['с 20 по 23', 'с 31 сентября по 2 октября', 'с 29 по 26'])(
  'does not guess a different month for %s',
  (text) => {
    expect(extractRentalRequest(text, now).startDay).toBeFalsy();
  },
);
it('retains the exact short dates from the reported Octavia conversation', () => {
  const request = extractRentalConversation([
    { text: 'Доброе утро нужна машина на 4 дня', at: '2026-09-24T06:00:26Z' },
    { text: 'Skoda Octavia, с 25.09 по 26.09', at: '2026-09-24T06:54:00Z' },
  ]);
  expect(request).toMatchObject({
    model: 'Skoda Octavia',
    startDay: '2026-09-25',
    endDay: '2026-09-26',
    startsAt: null,
    endsAt: null,
  });
  expect(rentalQuestions(request)).toContain('время получения и возврата');
  expect(rentalQuestions(request)).not.toMatch(/На какие даты|Какой автомобиль|на сколько дней/);
});
it('combines short dates with pickup and return times in a later message', () => {
  const request = extractRentalConversation([
    { text: 'Skoda Octavia, с 25.09 по 26.09', at: '2026-09-24T06:54:00Z' },
    {
      text: 'Заберу в 14:00, верну в 18:00. Всего 500 км, 89991234567',
      at: '2026-09-24T06:56:00Z',
    },
  ]);
  expect(request.startsAt).toBe('2026-09-25T11:00:00.000Z');
  expect(request.endsAt).toBe('2026-09-26T15:00:00.000Z');
  expect(rentalQuestions(request)).toBe('');
});
it.each(['с 31.09 по 02.10', 'с 26.09 по 25.09', 'с 23.09 по 25.09'])(
  'does not accept invalid or past short range %s',
  (text) => {
    expect(extractRentalRequest(text, now).endDay).toBeFalsy();
  },
);
it('supports a year boundary without moving past dates to a different year silently', () => {
  expect(extractRentalRequest('с 31.12 по 02.01', new Date('2026-12-20T09:00:00Z'))).toMatchObject({
    startDay: '2026-12-31',
    endDay: '2027-01-02',
  });
});
it('understands tomorrow with duration without inventing pickup time', () => {
  const request = extractRentalRequest('Нужна Камри завтра на 4 дня', now);
  expect(request.startDay).toBe('2026-09-25');
  expect(request.startsAt).toBeNull();
  expect(rentalQuestions(request)).toContain('Во сколько');
  expect(rentalQuestions(request)).not.toContain('На какие даты');
});
it('builds interval from tomorrow, explicit time and stated duration', () => {
  const request = extractRentalRequest('Завтра в 14:00 на три дня', now);
  expect(request.startsAt).toBe('2026-09-25T11:00:00.000Z');
  expect(request.endsAt).toBe('2026-09-28T11:00:00.000Z');
});
it('anchors relative days to each message rather than the latest reply after midnight', () => {
  const request = extractRentalConversation([
    { text: 'Завтра нужна Камри на 4 дня', at: '2026-09-24T20:55:00Z' },
    { text: 'В 14:00, всего 800 км, 89991234567', at: '2026-09-24T21:05:00Z' },
  ]);
  expect(request.startDay).toBe('2026-09-25');
  expect(request.startsAt).toBe('2026-09-25T11:00:00.000Z');
  expect(request.endsAt).toBe('2026-09-29T11:00:00.000Z');
  expect(request.mileageKm).toBe(800);
});
describe('rental request questions', () => {
  it('uses the approved first message without an assistant introduction', () => {
    expect(rentalQuestions(extractRentalRequest('', now))).toBe(
      'Здравствуйте! Какой автомобиль вас интересует? На какие даты и время нужна аренда? Какой общий пробег планируете за весь срок? Оставьте, пожалуйста, контактный телефон.',
    );
  });
  it('asks only what is missing, not the car or phone already supplied', () => {
    const request = extractRentalRequest(
      'Хочу Камри на пять дней, телефон +7 (999) 123-45-67',
      now,
    );
    expect(request.model).toBe('Toyota Camry');
    expect(request.phone).toBe('79991234567');
    expect(request.days).toBe(5);
    expect(rentalQuestions(request)).toBe(
      'Здравствуйте! На какие даты и время нужна аренда? Какой общий пробег планируете за весь срок?',
    );
  });
  it('parses explicit rental date/times in Moscow and total mileage', () => {
    const request = extractRentalRequest(
      'Polo с 25.09.2026 14:00 до 28.09.2026 16:30. Общий пробег 1 200 км. 89991234567',
      now,
    );
    expect(request).toMatchObject({
      model: 'Volkswagen Polo',
      startsAt: '2026-09-25T11:00:00.000Z',
      endsAt: '2026-09-28T13:30:00.000Z',
      mileageKm: 1200,
      phone: '79991234567',
    });
    expect(rentalQuestions(request)).toBe('');
  });
  it('does not mistake daily mileage or odometer for total rental mileage', () => {
    expect(
      extractRentalRequest('Пробег машины 80000 км, буду ездить 200 км в день', now).mileageKm,
    ).toBeNull();
  });
  it('accepts explicit total mileage without a boilerplate prefix', () => {
    expect(extractRentalRequest('За весь срок 700 км', now).mileageKm).toBe(700);
  });
  it('leaves ambiguous model and phone for clarification', () => {
    const request = extractRentalRequest('Камри или Поло. 89991234567, 89997654321', now);
    expect(request.model).toBeNull();
    expect(request.phone).toBeNull();
  });
  it('does not silently assign dates when only duration was given', () => {
    const request = extractRentalRequest('Camry на 5 дней', now);
    expect(request.startsAt).toBeNull();
    expect(request.endsAt).toBeNull();
  });
  it.each([
    'с 31.09.2026 14:00 по 03.10.2026 14:00',
    'с 25.09.2026 25:00 по 26.09.2026 14:00',
    'с 28.09.2026 14:00 по 25.09.2026 14:00',
    'с 23.09.2026 14:00 по 26.09.2026 14:00',
    'с 25.09.2026 по 26.09.2026',
  ])('does not supply a bookable interval for invalid/partial dates: %s', (text) => {
    const request = extractRentalRequest(text, now);
    expect(request.startsAt).toBeNull();
    expect(request.endsAt).toBeNull();
  });
});

describe('rental-only ad gate', () => {
  const active = new Set(['8252873021']);
  const chat = {
    context: { type: 'item', value: { id: 8252873021, title: 'Аренда Toyota Camry', user_id: 11 } },
  };
  it('accepts only an owned, approved and currently active rental ad', () => {
    expect(eligibleRentalAd(chat, '11', active)).toBe(true);
  });
  it('rejects sales, changed title, unknown context and a different owner', () => {
    for (const value of [
      { id: 7837710475, title: 'Комплект колес r17', user_id: 11 },
      { id: 8252873021, title: 'Продажа Toyota Camry', user_id: 11 },
      { id: 8252873021, title: 'Аренда Toyota Camry', user_id: 22 },
      { id: 9999999999, title: 'Аренда Toyota Camry', user_id: 11 },
    ])
      expect(eligibleRentalAd({ context: { type: 'item', value } }, '11', active)).toBe(false);
    expect(eligibleRentalAd({}, '11', active)).toBe(false);
    expect(eligibleRentalAd(chat, '11', new Set())).toBe(false);
  });
});

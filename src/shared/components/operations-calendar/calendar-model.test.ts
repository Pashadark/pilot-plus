import { describe, expect, it } from 'vitest';

import { buildCalendarMonth, groupCalendarEvents, parseCalendarMonth } from './calendar-model';
import * as operationsCalendar from '.';

describe('parseCalendarMonth', () => {
  it('принимает только месяц в каноническом формате', () => {
    expect(parseCalendarMonth('2026-07', new Date('2026-07-22T09:00:00Z'))).toBe('2026-07');
  });

  it('возвращает текущий московский месяц для некорректного значения', () => {
    expect(parseCalendarMonth('2026-7', new Date('2026-07-31T21:30:00Z'))).toBe('2026-08');
  });

  it('отклоняет крайние месяцы, чья полная сетка выходит из четырёхзначного года', () => {
    const now = new Date('2026-07-22T09:00:00Z');

    expect(parseCalendarMonth('0000-01', now)).toBe('2026-07');
    expect(parseCalendarMonth('9999-12', now)).toBe('2026-07');
  });

  it('сохраняет ближайшие допустимые месяцы на границах диапазона', () => {
    const now = new Date('2026-07-22T09:00:00Z');

    expect(parseCalendarMonth('0000-02', now)).toBe('0000-02');
    expect(parseCalendarMonth('9999-11', now)).toBe('9999-11');
  });
});

describe('buildCalendarMonth', () => {
  it('строит полную сетку с понедельника по воскресенье', () => {
    const month = buildCalendarMonth('2026-07', new Date('2026-07-22T09:00:00Z'));

    expect(month.label).toBe('Июль 2026');
    expect(month.days).toHaveLength(35);
    expect(month.days[0]?.isoDate).toBe('2026-06-29');
    expect(month.days[34]?.isoDate).toBe('2026-08-02');
    expect(month.days[0]?.inCurrentMonth).toBe(false);
    expect(month.days[2]?.inCurrentMonth).toBe(true);
  });

  it('отмечает сегодня по московской дате', () => {
    const month = buildCalendarMonth('2026-07', new Date('2026-07-21T21:30:00Z'));

    expect(month.days.find((day) => day.isoDate === '2026-07-22')?.isToday).toBe(true);
  });

  it('сохраняет годы от 0000 до 0099 в ISO-дате', () => {
    for (const monthValue of ['0000-02', '0099-02']) {
      const month = buildCalendarMonth(monthValue, new Date('2026-02-01T09:00:00Z'));

      expect(month.days.some((day) => day.isoDate === `${monthValue}-01`)).toBe(true);
      expect(month.days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.isoDate))).toBe(true);
    }
  });

  it('строит шесть недель для месяца, не помещающегося в пять', () => {
    const month = buildCalendarMonth('2026-08', new Date('2026-08-12T09:00:00Z'));

    expect(month.days).toHaveLength(42);
    expect(month.days[0]?.isoDate).toBe('2026-07-27');
    expect(month.days[41]?.isoDate).toBe('2026-09-06');
  });

  it('сохраняет границы года в декабрьской и январской сетках', () => {
    const december = buildCalendarMonth('2026-12', new Date('2026-12-12T09:00:00Z'));
    const january = buildCalendarMonth('2027-01', new Date('2027-01-12T09:00:00Z'));

    expect(december.days[december.days.length - 1]?.isoDate).toBe('2027-01-03');
    expect(january.days[0]?.isoDate).toBe('2026-12-28');
  });

  it('нормализует крайние месяцы до построения невалидной ISO-сетки', () => {
    const now = new Date('2026-07-22T09:00:00Z');

    expect(buildCalendarMonth('0000-01', now).month).toBe('2026-07');
    expect(buildCalendarMonth('9999-12', now).month).toBe('2026-07');
  });

  it('строит ISO-сетки для ближайших допустимых граничных месяцев', () => {
    const now = new Date('2026-07-22T09:00:00Z');

    for (const monthValue of ['0000-02', '9999-11']) {
      const month = buildCalendarMonth(monthValue, now);

      expect(month.month).toBe(monthValue);
      expect(month.days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.isoDate))).toBe(true);
    }
  });
});

describe('groupCalendarEvents', () => {
  it('группирует московское событие в правильный день', () => {
    const groups = groupCalendarEvents([
      {
        id: '1',
        startsAt: '2026-07-21T21:30:00.000Z',
        title: 'ТО',
        vehicleLabel: 'PLT-1',
        statusLabel: 'Запланировано',
        tone: 'primary',
        icon: 'tool',
      },
    ]);

    expect(groups.get('2026-07-22')).toHaveLength(1);
  });

  it('сохраняет хронологический порядок событий внутри дня', () => {
    const groups = groupCalendarEvents([
      {
        id: 'later',
        startsAt: '2026-07-22T09:00:00.000Z',
        title: 'Позже',
        vehicleLabel: 'PLT-1',
        statusLabel: 'Запланировано',
        tone: 'primary',
        icon: 'tool',
      },
      {
        id: 'earlier',
        startsAt: '2026-07-22T06:00:00.000Z',
        title: 'Раньше',
        vehicleLabel: 'PLT-1',
        statusLabel: 'Запланировано',
        tone: 'primary',
        icon: 'tool',
      },
    ]);

    expect(groups.get('2026-07-22')?.map((event) => event.id)).toEqual(['earlier', 'later']);
  });

  it('исключает время без смещения часового пояса', () => {
    const groups = groupCalendarEvents([
      {
        id: 'timezone-less',
        startsAt: '2026-07-22T09:00:00',
        title: 'ТО',
        vehicleLabel: 'PLT-1',
        statusLabel: 'Запланировано',
        tone: 'primary',
        icon: 'tool',
      },
    ]);

    expect(groups.size).toBe(0);
  });

  it('исключает несуществующие календарные даты', () => {
    const groups = groupCalendarEvents([
      {
        id: 'invalid-date',
        startsAt: '2026-02-30T09:00:00Z',
        title: 'ТО',
        vehicleLabel: 'PLT-1',
        statusLabel: 'Запланировано',
        tone: 'primary',
        icon: 'tool',
      },
    ]);

    expect(groups.size).toBe(0);
  });

  it('сохраняет порядок исходных событий с одинаковым временем', () => {
    const groups = groupCalendarEvents([
      {
        id: 'first',
        startsAt: '2026-07-22T09:00:00Z',
        title: 'Первое',
        vehicleLabel: 'PLT-1',
        statusLabel: 'Запланировано',
        tone: 'primary',
        icon: 'tool',
      },
      {
        id: 'second',
        startsAt: '2026-07-22T09:00:00Z',
        title: 'Второе',
        vehicleLabel: 'PLT-2',
        statusLabel: 'Запланировано',
        tone: 'primary',
        icon: 'tool',
      },
    ]);

    expect(groups.get('2026-07-22')?.map((event) => event.id)).toEqual(['first', 'second']);
  });
});

describe('публичный API', () => {
  it('экспортирует контракты календарной модели через barrel', () => {
    expect(operationsCalendar.buildCalendarMonth).toBe(buildCalendarMonth);
    expect(operationsCalendar.groupCalendarEvents).toBe(groupCalendarEvents);
    expect(operationsCalendar.parseCalendarMonth).toBe(parseCalendarMonth);
  });
});

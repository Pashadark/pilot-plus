import { describe, expect, it } from 'vitest';

import { buildCalendarMonth, groupCalendarEvents, parseCalendarMonth } from './calendar-model';

describe('parseCalendarMonth', () => {
  it('принимает только месяц в каноническом формате', () => {
    expect(parseCalendarMonth('2026-07', new Date('2026-07-22T09:00:00Z'))).toBe('2026-07');
  });

  it('возвращает текущий московский месяц для некорректного значения', () => {
    expect(parseCalendarMonth('2026-7', new Date('2026-07-31T21:30:00Z'))).toBe('2026-08');
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
});

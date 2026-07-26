import { describe, expect, it } from 'vitest';

import { canonicalizeOperationsCalendarQuery } from './calendar-query';

const now = new Date('2026-07-31T21:30:00.000Z');

describe('canonicalizeOperationsCalendarQuery', () => {
  it('добавляет канонические view и московский month календаря, сохраняя сторонние параметры', () => {
    const result = canonicalizeOperationsCalendarQuery(
      new URLSearchParams('source=e2e&view=calendar&month=2026-7'),
      now,
    );

    expect(result).toEqual({
      changed: true,
      month: '2026-08',
      query: 'source=e2e&view=calendar&month=2026-08',
      view: 'calendar',
    });
  });

  it('добавляет текущий московский month, если в calendar-mode месяц отсутствует', () => {
    const result = canonicalizeOperationsCalendarQuery(
      new URLSearchParams('source=e2e&view=calendar'),
      now,
    );

    expect(result).toEqual({
      changed: true,
      month: '2026-08',
      query: 'source=e2e&view=calendar&month=2026-08',
      view: 'calendar',
    });
  });

  it('нормализует неизвестный view в list и удаляет неактуальный month', () => {
    const result = canonicalizeOperationsCalendarQuery(
      new URLSearchParams('source=e2e&view=unknown&month=2026-07'),
      now,
    );

    expect(result).toEqual({
      changed: true,
      month: '2026-08',
      query: 'source=e2e&view=list',
      view: 'list',
    });
  });

  it('не запрашивает replace для уже канонической строки', () => {
    const result = canonicalizeOperationsCalendarQuery(
      new URLSearchParams('source=e2e&view=calendar&month=2026-08'),
      now,
    );

    expect(result.changed).toBe(false);
    expect(result.query).toBe('source=e2e&view=calendar&month=2026-08');
  });
});

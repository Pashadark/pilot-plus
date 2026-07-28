import { describe, expect, it } from 'vitest';

import { createManualEventSchema, eventReadKeySchema, eventReadKeysSchema } from './validation';

const validManualEvent = {
  vehicleId: 'vehicle-1',
  kind: 'INCIDENT',
  severity: 'DANGER',
  title: '  ДТП на парковке  ',
  description: '  Нужна оценка повреждений  ',
  location: '  Москва  ',
  latitude: '55.7558',
  longitude: '37.6173',
  recordedAt: '2026-07-27T12:00:00.000+03:00',
};

describe('createManualEventSchema', () => {
  it('нормализует допустимую ручную запись', () => {
    expect(createManualEventSchema.parse(validManualEvent)).toMatchObject({
      title: 'ДТП на парковке',
      description: 'Нужна оценка повреждений',
      location: 'Москва',
      latitude: 55.7558,
      longitude: 37.6173,
    });
  });

  it('требует парные координаты в допустимых диапазонах', () => {
    expect(
      createManualEventSchema.safeParse({ ...validManualEvent, longitude: undefined }).success,
    ).toBe(false);
    expect(createManualEventSchema.safeParse({ ...validManualEvent, latitude: '91' }).success).toBe(
      false,
    );
    expect(
      createManualEventSchema.safeParse({ ...validManualEvent, longitude: '181' }).success,
    ).toBe(false);
  });

  it('отклоняет лишние поля, короткий текст и время без offset', () => {
    expect(
      createManualEventSchema.safeParse({ ...validManualEvent, unexpected: true }).success,
    ).toBe(false);
    expect(createManualEventSchema.safeParse({ ...validManualEvent, title: 'X' }).success).toBe(
      false,
    );
    expect(
      createManualEventSchema.safeParse({ ...validManualEvent, recordedAt: '2026-07-27T12:00:00' })
        .success,
    ).toBe(false);
  });
});

describe('схемы ключей прочтения', () => {
  it('принимает один стабильный ключ', () => {
    expect(eventReadKeySchema.safeParse('device-command:command-1').success).toBe(true);
    expect(eventReadKeySchema.safeParse('../bad').success).toBe(false);
  });

  it('ограничивает массовую отметку от 1 до 100 ключей', () => {
    expect(eventReadKeysSchema.safeParse(['vehicle-event:event-1']).success).toBe(true);
    expect(eventReadKeysSchema.safeParse([]).success).toBe(false);
    expect(
      eventReadKeysSchema.safeParse(Array.from({ length: 101 }, () => 'trip:trip-1')).success,
    ).toBe(false);
  });
});

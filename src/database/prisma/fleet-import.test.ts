import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseFleetSource } from './fleet-import';

const source = readFileSync(new URL('./data/fleet-source.txt', import.meta.url), 'utf8');

describe('импорт каталога автомобилей', () => {
  it('разбирает ровно 130 карточек со стабильными ключами', () => {
    const rows = parseFleetSource(source);

    expect(rows).toHaveLength(130);
    expect(new Set(rows.map((row) => row.sourceKey)).size).toBe(130);
    expect(rows[0]).toMatchObject({
      sourceKey: 'fleet-001',
      model: 'GWM WEY',
      city: 'Красноярск',
      transmission: 'АКПП',
      engineLiters: 1.5,
      fuelType: 'PETROL',
      seats: 7,
      dailyPriceMinor: 880000,
      currency: 'RUB',
      originalPrice: '8 800 ₽',
    });
  });

  it('не смешивает рубли и тайские баты', () => {
    const rows = parseFleetSource(source);
    const currencies = new Set(rows.map((row) => row.currency));

    expect(currencies).toEqual(new Set(['RUB', 'THB']));
    expect(rows.find((row) => row.currency === 'THB')).toMatchObject({
      city: 'Пхукет',
      dailyPriceMinor: 110000,
    });
  });

  it('сообщает номер неполной карточки', () => {
    expect(() => parseFleetSource('Автопарк\n1 авто\nНеполная карточка\nЗабронировать')).toThrow(
      'Карточка 1',
    );
  });
});

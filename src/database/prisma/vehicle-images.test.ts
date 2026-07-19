import { describe, expect, it } from 'vitest';

import type { FleetImportRow } from './fleet-import';
import {
  getVehicleSourcePage,
  matchVehicleImages,
  parseVehicleImageManifest,
  parseVehicleFleetPayload,
  parseVehicleImageCandidates,
} from './vehicle-images';

function fleetRow(sourceKey: string, model: string): FleetImportRow {
  return {
    sourceKey,
    model,
    city: 'Красноярск',
    office: null,
    transmission: 'АКПП',
    engineLiters: 1.5,
    fuelType: 'PETROL',
    seats: 5,
    dailyPriceMinor: 400_000,
    currency: 'RUB',
    originalPrice: '4 000 ₽',
    features: [],
  };
}

describe('фотографии исходного автопарка', () => {
  it('извлекает WebP-кандидатов и превращает относительные адреса в абсолютные', () => {
    const html = `
      <img alt="Haval Jolion" src="/photos/stock/first.webp">
      <img src="https://autopilotrent.ru/photos/stock/second.webp" alt="Haval Jolion">
      <img alt="Логотип" src="/images/logo.svg">
    `;

    expect(parseVehicleImageCandidates(html, 'Красноярск')).toEqual([
      {
        city: 'Красноярск',
        model: 'Haval Jolion',
        sourceUrl: 'https://autopilotrent.ru/photos/stock/first.webp',
      },
      {
        city: 'Красноярск',
        model: 'Haval Jolion',
        sourceUrl: 'https://autopilotrent.ru/photos/stock/second.webp',
      },
    ]);
  });

  it('сопоставляет одинаковые модели по порядку и не дублирует фотографии', () => {
    const rows = [fleetRow('fleet-001', 'Haval Jolion'), fleetRow('fleet-002', 'Haval Jolion')];
    const candidates = parseVehicleImageCandidates(
      `
        <img alt="Haval Jolion" src="/photos/stock/first.webp">
        <img alt="Haval Jolion" src="/photos/stock/second.webp">
      `,
      'Красноярск',
    );

    const result = matchVehicleImages(rows, candidates);

    expect(result.map((row) => row.sourceUrl)).toEqual([
      'https://autopilotrent.ru/photos/stock/first.webp',
      'https://autopilotrent.ru/photos/stock/second.webp',
    ]);
    expect(result.map((row) => row.sourceKey)).toEqual(['fleet-001', 'fleet-002']);
    expect(result[0]?.localPath).toBe('/vehicles/krasnoyarsk/fleet-001/primary.webp');
    expect(result[0]?.alt).toBe('Haval Jolion — Красноярск');
  });

  it('использует фактический маршрут страницы Санкт-Петербурга', () => {
    expect(getVehicleSourcePage('Санкт-Петербург')).toBe('https://autopilotrent.ru/spb');
  });

  it('извлекает полный список фотографий из официального API автопарка', () => {
    const payload = JSON.stringify({
      cars: [
        { name: 'BMW 420i Convertible', photos: ['/photos/stock/bmw.webp'] },
        { name: 'Toyota Camry NEW', photos: ['/images/stock/camry.jpg'] },
        { name: 'Без фотографии', photos: [] },
      ],
    });

    expect(parseVehicleFleetPayload(payload, 'Сочи')).toEqual([
      {
        city: 'Сочи',
        model: 'BMW 420i Convertible',
        sourceUrl: 'https://autopilotrent.ru/photos/stock/bmw.webp',
      },
      {
        city: 'Сочи',
        model: 'Toyota Camry NEW',
        sourceUrl: 'https://autopilotrent.ru/images/stock/camry.jpg',
      },
    ]);
  });

  it('сохраняет отдельные автомобили одной модели из одного офиса', () => {
    const payload = JSON.stringify({
      cars: [
        { name: 'Toyota Veloz', officeName: '', photos: ['/photos/veloz-1.webp'] },
        { name: 'Toyota Veloz', officeName: '', photos: ['/photos/veloz-2.webp'] },
      ],
    });

    expect(parseVehicleFleetPayload(payload, 'Пхукет')).toHaveLength(2);
  });

  it('сопоставляет официальный префикс GWM для модели WEY 80', () => {
    const row = { ...fleetRow('fleet-130', 'WEY 80'), city: 'Геленджик' };
    const result = matchVehicleImages(
      [row],
      [
        {
          city: 'Геленджик',
          model: 'GWM WEY 80',
          sourceUrl: 'https://autopilotrent.ru/photos/stock/wey-80.webp',
        },
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.sourceKey).toBe('fleet-130');
  });

  it('использует штатное фото точной модели из другого филиала, если у машины фото отсутствует', () => {
    const row = { ...fleetRow('fleet-130', 'WEY 80'), city: 'Геленджик' };
    const result = matchVehicleImages(
      [row],
      [
        {
          city: 'Сочи',
          model: 'GWM WEY 80',
          sourceUrl: 'https://autopilotrent.ru/images/stock/wey-80.webp',
        },
      ],
    );

    expect(result[0]?.sourceUrl).toBe('https://autopilotrent.ru/images/stock/wey-80.webp');
    expect(result[0]?.city).toBe('Геленджик');
  });

  it('отклоняет повреждённый локальный манифест', () => {
    expect(() => parseVehicleImageManifest('[{"sourceKey":"fleet-001"}]')).toThrow(
      'неверную запись',
    );
  });
});

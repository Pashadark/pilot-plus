import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { VehicleDetailDto } from '../types';
import { VehicleDetailPage } from './VehicleDetailPage';

const vehicle: VehicleDetailDto = {
  id: 'vehicle-1',
  internalNumber: 'PLT-001',
  model: 'GWM WEY',
  city: 'Красноярск',
  office: null,
  registrationNumber: null,
  transmission: 'АКПП',
  engineLiters: 1.5,
  fuelType: 'PETROL',
  seats: 7,
  dailyPriceMinor: 880000,
  currency: 'RUB',
  originalPrice: '8 800 ₽',
  features: [],
  status: 'UNKNOWN',
  primaryImage: null,
  telemetry: {
    odometerKm: null,
    fuelLevelPercent: null,
    lastSeenAt: null,
    lastTripAt: null,
    hasPosition: false,
  },
  vin: null,
  createdAt: '2026-07-19T12:00:00.000Z',
  trips: [],
  events: [],
  fuelRecords: [],
  maintenanceRecords: [
    {
      id: 'maintenance-1',
      title: 'Замена масла',
      kind: 'OIL',
      status: 'COMPLETED',
      scheduledAt: '2026-07-20T10:00:00.000Z',
      completedAt: '2026-07-20T12:00:00.000Z',
      targetOdometerKm: 15000.5,
      provider: 'Сервис Pilot',
      costMinor: 420000,
    },
  ],
  washRecords: [
    {
      id: 'wash-1',
      kind: 'COMPLEX',
      status: 'IN_PROGRESS',
      scheduledAt: '2026-07-21T10:00:00.000Z',
      startedAt: '2026-07-21T10:05:00.000Z',
      completedAt: null,
      provider: 'Мойка Pilot',
      costMinor: 190000,
    },
  ],
  documents: [],
};

describe('VehicleDetailPage', () => {
  it('показывает типизированные истории ТО и мойки с русскими статусами', () => {
    const markup = renderToStaticMarkup(
      createElement(VehicleDetailPage, { vehicle, activeTab: 'maintenance' }),
    );

    expect(markup).toContain('История технического обслуживания');
    expect(markup).toContain('Замена масла');
    expect(markup).toContain('Масло');
    expect(markup).toContain('Завершено');
    expect(markup).toContain('История моек');
    expect(markup).toContain('Комплексная');
    expect(markup).toContain('В работе');
  });

  it('показывает даты обслуживания в Europe/Moscow независимо от TZ сервера', () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = 'America/New_York';

    try {
      const markup = renderToStaticMarkup(
        createElement(VehicleDetailPage, { vehicle, activeTab: 'maintenance' }),
      );

      expect(markup).toContain('20 июл. 2026 г., 13:00');
      expect(markup).toContain('21 июл. 2026 г., 13:00');
    } finally {
      process.env.TZ = originalTimeZone;
    }
  });

  it('объясняет отсутствие мойки, не скрывая историю ТО', () => {
    const markup = renderToStaticMarkup(
      createElement(VehicleDetailPage, {
        vehicle: { ...vehicle, washRecords: [] },
        activeTab: 'maintenance',
      }),
    );

    expect(markup).toContain('История технического обслуживания');
    expect(markup).toContain('История моек');
    expect(markup).toContain('Записей о мойке пока нет');
  });

  it('объясняет отсутствие ТО, не скрывая историю мойки', () => {
    const markup = renderToStaticMarkup(
      createElement(VehicleDetailPage, {
        vehicle: { ...vehicle, maintenanceRecords: [] },
        activeTab: 'maintenance',
      }),
    );

    expect(markup).toContain('История технического обслуживания');
    expect(markup).toContain('Записей о ТО пока нет');
    expect(markup).toContain('История моек');
    expect(markup).toContain('Комплексная');
    expect(markup).not.toContain('Записей о мойке пока нет');
  });

  it('показывает общий empty state, когда обе истории отсутствуют', () => {
    const markup = renderToStaticMarkup(
      createElement(VehicleDetailPage, {
        vehicle: { ...vehicle, maintenanceRecords: [], washRecords: [] },
        activeTab: 'maintenance',
      }),
    );

    expect(markup).toContain('Обслуживание ещё не запланировано');
    expect(markup).toContain('Здесь будут регламенты, выполненные работы, даты и пробег.');
    expect(markup).not.toContain('История технического обслуживания');
    expect(markup).not.toContain('История моек');
  });
});

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
});

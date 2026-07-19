import { describe, expect, it } from 'vitest';

import { getVehicleEmptyState, normalizeVehicleTab, vehicleTabs } from './vehicle-tabs';

describe('вкладки карточки автомобиля', () => {
  it('содержит семь русских разделов с постоянными адресами', () => {
    expect(vehicleTabs).toEqual([
      { value: 'overview', label: 'Обзор' },
      { value: 'trips', label: 'Поездки' },
      { value: 'routes', label: 'Маршруты' },
      { value: 'events', label: 'События' },
      { value: 'fuel', label: 'Топливо' },
      { value: 'maintenance', label: 'Обслуживание' },
      { value: 'documents', label: 'Документы' },
    ]);
  });

  it('возвращает обзор для неизвестной вкладки', () => {
    expect(normalizeVehicleTab('trips')).toBe('trips');
    expect(normalizeVehicleTab('unknown')).toBe('overview');
    expect(normalizeVehicleTab(undefined)).toBe('overview');
  });

  it('даёт содержательные русские пустые состояния', () => {
    expect(getVehicleEmptyState('trips').title).toBe('Поездки ещё не поступали');
    expect(getVehicleEmptyState('routes').title).toBe('Маршрут появится после первой поездки');
    expect(getVehicleEmptyState('fuel').title).toBe('Записей о топливе пока нет');
  });
});

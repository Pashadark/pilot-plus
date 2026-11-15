import { describe, expect, it } from 'vitest';

import type { RentalConstructorState } from './types';
import { buildContractPreview } from './preview';

const state: RentalConstructorState = {
  agreementType: 'STANDARD',
  clientMode: 'existing',
  clientId: 'client-1',
  clientFullName: 'Щапова Анна Петровна',
  clientPhone: '+7 950 080-99-08',
  vehicleId: 'vehicle-1',
  startsAt: '2026-11-20T10:00',
  endsAt: '2026-11-22T10:00',
  dailyRateMinor: 300000,
  discountMinor: 0,
  servicesMinor: 0,
};

describe('buildContractPreview', () => {
  it('uses real state and explicit blanks in the preview', () => {
    const preview = buildContractPreview(state, {
      company: { name: 'СУПА ПРО Москва', contractCity: 'Москва' },
      client: { phone: '+7 950 080-99-08' },
      vehicle: {
        label: 'Toyota Camry',
        registrationNumber: 'А123ВС777',
        vin: null,
      },
    });

    expect(preview.client.fullName).toBe('Щапова Анна Петровна');
    expect(preview.vehicle.registrationNumber).toBe('А123ВС777');
    expect(preview.vehicle.vin).toBe('Не заполнено');
    expect(preview.rental.totalMinor).toBe(600000);
  });

  it('never renders undefined placeholders', () => {
    const preview = buildContractPreview(
      { agreementType: 'STANDARD', clientMode: 'new' },
      { company: { name: 'СУПА ПРО', contractCity: null }, client: null, vehicle: null },
    );

    expect(preview.city).toBe('Не заполнено');
    expect(preview.client.phone).toBe('Не заполнено');
    expect(preview.vehicle.label).toBe('Не заполнено');
  });
});

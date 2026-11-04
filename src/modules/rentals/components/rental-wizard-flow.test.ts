import { describe, expect, it } from 'vitest';

import { rentalWizardSteps, validateRentalWizardStep } from './rental-wizard-flow';

describe('rental wizard flow', () => {
  it('uses the approved three-step flow', () => {
    expect(rentalWizardSteps).toEqual(['Документы', 'Аренда', 'Проверка']);
  });

  it('does not block an existing documented client on the first step', () => {
    expect(validateRentalWizardStep(0, { documentsReady: true })).toBe('');
  });

  it('requires a vehicle and a valid calculation on the rental step', () => {
    expect(validateRentalWizardStep(1, { vehicleSelected: false, calculationReady: false })).toBe(
      'Выберите автомобиль.',
    );
    expect(validateRentalWizardStep(1, { vehicleSelected: true, calculationReady: false })).toBe(
      'Укажите корректные дату и время выдачи и возврата.',
    );
  });
});

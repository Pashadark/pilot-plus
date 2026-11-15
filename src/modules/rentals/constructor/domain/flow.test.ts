import { describe, expect, it } from 'vitest';

import { constructorSections, sectionStatus, validateSection } from './flow';
import type { RentalConstructorState } from './types';

const empty: RentalConstructorState = {
  agreementType: 'STANDARD',
  clientMode: 'existing',
};

describe('rental constructor flow', () => {
  it('uses the approved seven sections', () => {
    expect(constructorSections.map((section) => section.id)).toEqual([
      'general',
      'client',
      'documents',
      'vehicle',
      'terms',
      'handover',
      'review',
    ]);
  });

  it('requires a client before documents and rental data', () => {
    expect(validateSection(empty, 'client')).toContain('Выберите или создайте клиента.');
    expect(sectionStatus(empty, 'client')).toBe('error');
  });

  it('marks a valid client section complete', () => {
    const state: RentalConstructorState = {
      ...empty,
      clientId: 'client-1',
      clientFullName: 'Щапова Анна Петровна',
    };

    expect(validateSection(state, 'client')).toEqual([]);
    expect(sectionStatus(state, 'client')).toBe('complete');
  });

  it('reports all unfinished sections during review', () => {
    expect(validateSection(empty, 'review')).toEqual(
      expect.arrayContaining([
        'Не выбрана компания.',
        'Выберите или создайте клиента.',
        'Проверьте паспорт и водительское удостоверение.',
        'Выберите автомобиль.',
        'Укажите срок и стоимость аренды.',
        'Укажите одометр и топливо при выдаче.',
      ]),
    );
  });
});

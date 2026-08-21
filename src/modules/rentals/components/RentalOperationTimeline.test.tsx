// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RentalOperationTimeline } from './RentalOperationTimeline';

describe('RentalOperationTimeline', () => {
  it('shows immutable operational facts and a permanent missing-evidence warning', () => {
    render(
      <RentalOperationTimeline
        operations={[
          {
            id: 'operation-1',
            type: 'HANDOVER',
            occurredAt: '2026-08-21T09:00:00.000Z',
            actorName: 'Павел Седов',
            evidenceStatus: 'MISSING',
            evidenceMissingReason: 'Клиент торопился',
            mileageKm: 10000,
            fuelLevelPercent: 80,
            fulfillmentMethod: 'OFFICE',
            fulfillmentAddress: null,
            nextEndsAt: null,
            totalChargeMinor: null,
          },
        ]}
      />,
    );
    expect(screen.getByText('Выдача автомобиля')).toBeTruthy();
    expect(screen.getByText('10 000 км · топливо 80%')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Фиксация пропущена');
    expect(screen.getByText('Клиент торопился')).toBeTruthy();
  });
});

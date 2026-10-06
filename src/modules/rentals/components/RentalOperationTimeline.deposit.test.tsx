// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { RentalOperationTimeline } from './RentalOperationTimeline';

it('shows deposit amount, description, time and actor without photo warnings', () => {
  render(<RentalOperationTimeline rentalId="r" operations={[{
    id: 'o', type: 'DEPOSIT_RETURN', occurredAt: '2026-09-19T07:00:00Z', actorName: 'Павел',
    evidenceStatus: 'MISSING', evidenceMissingReason: 'Для возврата залога фото- и видеофиксация не требуется.',
    mileageKm: null, fuelLevelPercent: null, fulfillmentMethod: null, fulfillmentAddress: null,
    nextEndsAt: null, totalChargeMinor: null, depositAmountMinor: '2000000', depositWithheldMinor: '612000',
    depositStatus: 'PARTIALLY_WITHHELD', depositResolutionReason: 'Бензин, штраф', media: [],
  }]} />);
  expect(screen.getByText('Возврат залога')).toBeTruthy();
  expect(screen.getByText(/Бензин, штраф/)).toBeTruthy();
  expect(screen.getByText(/10:00 · Павел/)).toBeTruthy();
  expect(screen.getByText(/13\s880/)).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByText(/фото- и видеофиксация/)).toBeNull();
});

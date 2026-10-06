// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: () => [null, vi.fn(), true],
  };
});
vi.mock('@/modules/rentals/server/actions', () => ({
  handoverRentalAction: vi.fn(),
  extendRentalAction: vi.fn(),
  returnRentalAction: vi.fn(),
  weeklyInspectionRentalAction: vi.fn(),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { RentalOperationDialog } from './RentalOperationDialog';

describe('RentalOperationDialog pending state', () => {
  it('replaces return form with a blocking save indicator while submitting', () => {
    render(
      <RentalOperationDialog
        kind="RETURN"
        open
        operationIdempotencyKey="return-rental-1-key"
        onOpenChange={vi.fn()}
        rental={{
          id: 'rental-1',
          companyId: 'company-1',
          vehicleLabel: 'Kia Rio · Р604АО997',
        }}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('Сохраняем возврат…');
    expect(screen.queryByRole('button', { name: 'Принять автомобиль' })).toBeNull();
    expect(screen.queryByLabelText('Пробег, км')).toBeNull();
  });
});

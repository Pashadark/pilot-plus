// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RentalActionRail } from './RentalActionRail';

vi.mock('@/modules/rentals/server/actions', () => ({
  handoverRentalAction: vi.fn(),
  extendRentalAction: vi.fn(),
  returnRentalAction: vi.fn(),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe('RentalActionRail', () => {
  it('aligns the confirmed-rental action in a sticky right rail and mobile bar', () => {
    render(
      <RentalActionRail rental={{ id: 'rental-1', companyId: 'company-1', status: 'CONFIRMED' }} />,
    );
    const desktop = screen.getByTestId('rental-action-rail');
    expect(desktop.className).toContain('xl:sticky');
    expect(desktop.className).toContain('xl:w-72');
    expect(screen.getAllByRole('button', { name: 'Выдать / Подать' })).toHaveLength(2);
    for (const button of screen.getAllByRole('button', { name: 'Выдать / Подать' })) {
      expect(button.className).toContain('w-full');
      expect(button.className).toContain('min-h-12');
    }
    expect(screen.queryByRole('button', { name: 'Продлить' })).toBeNull();
  });

  it('shows extension and return only for an active rental and opens the selected dialog', () => {
    render(
      <RentalActionRail rental={{ id: 'rental-1', companyId: 'company-1', status: 'ACTIVE' }} />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Продлить' })[0]);
    expect(screen.getByRole('dialog', { name: 'Продлить аренду' })).toBeTruthy();
    expect(screen.getByLabelText('Новая дата возврата *')).toBeTruthy();
  });

  it('keeps one idempotency key while the dialog rerenders and cannot claim missing uploads exist', () => {
    const { rerender } = render(
      <RentalActionRail rental={{ id: 'rental-1', companyId: 'company-1', status: 'CONFIRMED' }} />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Выдать / Подать' })[0]);
    const keyBefore = document.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    )?.value;
    expect(keyBefore).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Видео и фото приборки загружены' })).toBeNull();
    const reason = screen.getByLabelText(/Причина отсутствия фиксации/);
    expect(reason).toHaveProperty('required', true);
    fireEvent.change(screen.getByLabelText(/Видео осмотра автомобиля/), {
      target: { files: [new File(['video'], 'car.mp4', { type: 'video/mp4' })] },
    });
    fireEvent.change(screen.getByLabelText(/Фото приборной панели/), {
      target: { files: [new File(['photo'], 'dash.jpg', { type: 'image/jpeg' })] },
    });
    expect(reason).toHaveProperty('required', false);

    rerender(
      <RentalActionRail rental={{ id: 'rental-1', companyId: 'company-1', status: 'CONFIRMED' }} />,
    );
    expect(document.querySelector<HTMLInputElement>('input[name="idempotencyKey"]')?.value).toBe(
      keyBefore,
    );
  });
});

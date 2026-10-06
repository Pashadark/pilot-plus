// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RentalActionRail } from './RentalActionRail';

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

describe('RentalActionRail', () => {
  afterEach(cleanup);

  it('показывает ссылку редактора только при полученном разрешении', () => {
    const { rerender } = render(
      <RentalActionRail
        canEdit
        rental={{ id: 'rental-1', companyId: 'company-1', status: 'COMPLETED' }}
      />,
    );
    expect(
      screen.getAllByRole('link', { name: 'Редактировать договор' })[0]?.getAttribute('href'),
    ).toBe('/rentals/rental-1/edit');
    rerender(
      <RentalActionRail
        canEdit={false}
        rental={{ id: 'rental-1', companyId: 'company-1', status: 'COMPLETED' }}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Редактировать договор' })).toBeNull();
  });

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
      <RentalActionRail
        rental={{
          id: 'rental-1',
          companyId: 'company-1',
          status: 'ACTIVE',
          endsAt: '2026-09-07T13:01:00.000Z',
        }}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Продлить' })[0]);
    expect(screen.getByRole('dialog', { name: 'Продлить аренду' })).toBeTruthy();
    expect(screen.getByLabelText('Новая дата возврата *')).toHaveProperty(
      'value',
      '2026-09-07T16:01',
    );
  });

  it('offers weekly inspection only for an active lease-to-own rental', () => {
    render(
      <RentalActionRail
        rental={{
          id: 'rental-1',
          companyId: 'company-1',
          status: 'ACTIVE',
          agreementType: 'LEASE_TO_OWN',
        }}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Добавить еженедельный осмотр' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Добавить еженедельный осмотр' })[0]);
    expect(screen.getByRole('dialog', { name: 'Еженедельный осмотр' })).toBeTruthy();
    expect(screen.getByLabelText(/Кузов справа/)).toHaveProperty('required', true);
  });

  it('opens the requested active-rental operation directly from a table action', () => {
    render(
      <RentalActionRail
        initialAction="RETURN"
        rental={{ id: 'rental-1', companyId: 'company-1', status: 'ACTIVE' }}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Приём автомобиля' })).toBeTruthy();
    expect(document.querySelector<HTMLInputElement>('input[name="idempotencyKey"]')?.value).toBeTruthy();
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

  it('generates a new idempotency key after the page is opened again', () => {
    const rental = {
      id: 'rental-1',
      companyId: 'company-1',
      status: 'ACTIVE',
      endsAt: '2026-09-07T13:01:00.000Z',
    };
    const firstPage = render(<RentalActionRail rental={rental} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Продлить' })[0]);
    const firstKey = document.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    )?.value;
    firstPage.unmount();

    render(<RentalActionRail rental={rental} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Продлить' })[0]);
    const secondKey = document.querySelector<HTMLInputElement>(
      'input[name="idempotencyKey"]',
    )?.value;

    expect(firstKey).toBeTruthy();
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });

  it('shows the approved return intake without deposit controls', () => {
    render(
      <RentalActionRail
        rental={{
          id: 'rental-1',
          companyId: 'company-1',
          status: 'ACTIVE',
          vehicleLabel: 'Skoda Octavia · М970АН997',
        }}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Принять возврат' })[0]);

    expect(screen.getByText('Skoda Octavia · М970АН997')).toBeTruthy();
    expect(screen.getByLabelText('Приборная панель')).toBeTruthy();
    expect(screen.getByLabelText('Перед')).toBeTruthy();
    expect(screen.getByLabelText('Правый бок')).toBeTruthy();
    expect(screen.getByLabelText('Зад')).toBeTruthy();
    expect(screen.getByLabelText('Левый бок')).toBeTruthy();
    expect(screen.getByLabelText('Видео кругового осмотра')).toBeTruthy();
    expect(screen.getByText('Залог будет возвращён отдельно — до 21 рабочего дня')).toBeTruthy();
    expect(screen.queryByLabelText('Статус залога')).toBeNull();
    expect(screen.queryByLabelText(/Сумма залога/)).toBeNull();
    expect(screen.queryByLabelText(/Удержано/)).toBeNull();
  });

  it('оставляет выдачу видимой, но блокирует её и показывает ссылки исправления', () => {
    render(
      <RentalActionRail
        rental={{ id: 'rental-1', companyId: 'company-1', status: 'CONFIRMED' }}
        handoverReadiness={{
          ready: false,
          blockers: [
            {
              code: 'PDF_MISSING',
              message: 'Перед выдачей сформируйте PDF договора.',
              href: '#rental-documents',
            },
            {
              code: 'CLIENT_SIGNATURE_MISSING',
              message: 'Перед выдачей отметьте подпись клиента.',
              href: '#rental-settlement',
            },
          ],
        }}
      />,
    );

    const buttons = screen.getAllByRole('button', { name: 'Выдать / Подать' });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toHaveProperty('disabled', true);
      expect(button.getAttribute('aria-describedby')).toBeTruthy();
    }
    expect(
      screen
        .getAllByRole('link', { name: 'Перед выдачей сформируйте PDF договора.' })[0]
        ?.getAttribute('href'),
    ).toBe('#rental-documents');
  });
});

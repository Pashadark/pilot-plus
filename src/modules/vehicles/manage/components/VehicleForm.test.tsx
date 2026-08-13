// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({ createVehicleAction: vi.fn() }));
vi.mock('@/shared/providers/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { VehicleForm } from './VehicleForm';

afterEach(cleanup);

describe('VehicleForm', () => {
  it('renders Russian labelled inputs and a 44px save action', () => {
    render(<VehicleForm companies={[{ id: 'company-1', label: 'Компания', canArchive: true }]} />);

    expect(document.querySelector('input[name="make"]')).toBeTruthy();
    expect(document.querySelector('input[name="registrationNumber"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить автомобиль' }).className).toContain(
      'min-h-11',
    );
  });

  it('shows a company selector rather than silently choosing among several companies', () => {
    render(
      <VehicleForm
        companies={[
          { id: 'company-1', label: 'Первая компания', canArchive: true },
          { id: 'company-2', label: 'Вторая компания', canArchive: false },
        ]}
      />,
    );

    expect(document.querySelector('select[name="companyId"]')).toBeTruthy();
  });
});

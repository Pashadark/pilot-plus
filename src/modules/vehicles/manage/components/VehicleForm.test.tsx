// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({ createVehicleAction: vi.fn() }));
vi.mock('@/shared/providers/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { VehicleForm } from './VehicleForm';

describe('VehicleForm', () => {
  it('renders Russian labelled inputs and a 44px save action', () => {
    render(<VehicleForm companyId="company-1" />);

    expect(document.querySelector('input[name="make"]')).toBeTruthy();
    expect(document.querySelector('input[name="registrationNumber"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить автомобиль' }).className).toContain(
      'min-h-11',
    );
  });
});

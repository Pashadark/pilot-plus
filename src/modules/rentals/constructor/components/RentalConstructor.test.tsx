// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RentalConstructor } from './RentalConstructor';

afterEach(cleanup);

const bootstrap = {
  companyId: 'company-a',
  companies: [{ id: 'company-a', name: 'СУПА ПРО Москва' }],
  templateVersionId: 'template-a',
  clients: [
    {
      id: 'client-a',
      companyId: 'company-a',
      fullName: 'Щапова Анна Петровна',
      phone: '+7 950 080-99-08',
      status: 'VERIFIED',
    },
  ],
  vehicles: [],
  preferredClient: {
    id: 'client-a',
    companyId: 'company-a',
    fullName: 'Щапова Анна Петровна',
    phone: '+7 950 080-99-08',
    status: 'VERIFIED',
  },
};

describe('RentalConstructor', () => {
  it('renders the approved page and all seven sections', () => {
    render(<RentalConstructor bootstrap={bootstrap} />);

    expect(screen.getByRole('heading', { name: 'Новый клиент и договор' })).toBeTruthy();
    expect(screen.getAllByTestId('constructor-section')).toHaveLength(7);
    expect(screen.getByText('Щапова Анна Петровна')).toBeTruthy();
  });

  it('moves between sections without leaving the page', () => {
    render(<RentalConstructor bootstrap={bootstrap} />);

    fireEvent.click(screen.getByRole('button', { name: /Клиент/ }));

    expect(screen.getByRole('button', { name: /Клиент/ }).getAttribute('aria-current')).toBe(
      'step',
    );
  });
});

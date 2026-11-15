// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/actions', () => ({ createConstructorClientAction: vi.fn() }));
vi.mock('@/modules/client-documents/actions', () => ({
  uploadClientDocumentAction: vi.fn(),
}));

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
  documentsByClientId: {
    'client-a': [
      {
        id: 'passport-a',
        category: 'PASSPORT' as const,
        title: 'Паспорт',
        status: 'CLEAN' as const,
        currentVersion: 1,
        originalName: null,
        verifiedMime: null,
        bytes: null,
        createdAt: '2026-11-15T09:00:00.000Z',
        updatedAt: '2026-11-15T09:00:00.000Z',
      },
    ],
  },
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
    expect(screen.getByRole('heading', { name: 'Клиент' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Документы/ }));
    expect(screen.getByRole('heading', { name: 'Документы клиента' })).toBeTruthy();
  });
});

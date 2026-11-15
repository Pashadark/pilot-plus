// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const actionMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  saveDraft: vi.fn(),
  finalize: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('../server/actions', () => ({
  createConstructorClientAction: actionMocks.createClient,
  saveConstructorDraftAction: actionMocks.saveDraft,
  finalizeRentalConstructorAction: actionMocks.finalize,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: actionMocks.push, refresh: actionMocks.refresh }),
}));
vi.mock('@/modules/client-documents/actions', () => ({
  uploadClientDocumentAction: vi.fn(),
}));

import { RentalConstructor } from './RentalConstructor';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
});

const bootstrap = {
  companyId: 'company-a',
  company: { id: 'company-a', name: 'СУПА ПРО Москва', contractCity: 'Москва' },
  userId: 'user-a',
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
  vehicles: [
    {
      id: 'vehicle-a',
      label: 'Toyota Camry Р957АН997',
      dailyMinor: 300000,
      depositMinor: 1500000,
      registrationNumber: 'Р957АН997',
      imageUrl: null,
      available: true,
      reasons: [],
      legalReady: true,
      rentalIntervals: [],
    },
  ],
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
      {
        id: 'license-a',
        category: 'DRIVER_LICENSE' as const,
        title: 'Водительское удостоверение',
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
    expect(screen.getAllByText('Щапова Анна Петровна').length).toBeGreaterThan(0);
    expect(screen.getByText('Москва')).toBeTruthy();
  });

  it('moves between sections without leaving the page and transfers focus', async () => {
    render(<RentalConstructor bootstrap={bootstrap} />);

    fireEvent.click(screen.getByRole('button', { name: /Клиент/ }));

    expect(screen.getByRole('button', { name: /Клиент/ }).getAttribute('aria-current')).toBe(
      'step',
    );
    const clientHeading = screen.getByRole('heading', { name: 'Клиент' });
    expect(clientHeading).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(clientHeading));

    fireEvent.click(screen.getByRole('button', { name: /Документы/ }));
    expect(screen.getByRole('heading', { name: 'Документы клиента' })).toBeTruthy();
  });

  it('supports arrow-key navigation across constructor sections', () => {
    render(<RentalConstructor bootstrap={bootstrap} />);
    const sections = screen.getAllByTestId('constructor-section');

    sections[0]?.focus();
    fireEvent.keyDown(sections[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(sections[1]);
    fireEvent.keyDown(sections[1]!, { key: 'End' });
    expect(document.activeElement).toBe(sections[6]);
  });

  it('autosaves the same constructor after core rental fields become valid', async () => {
    vi.useFakeTimers();
    actionMocks.saveDraft.mockResolvedValue({
      ok: true,
      rentalId: 'rental-a',
      updatedAt: '2026-11-15T10:00:00.000Z',
      calculation: { days: 2, totalMinor: 600000, discountMinor: 0, servicesMinor: 0 },
    });
    render(<RentalConstructor bootstrap={bootstrap} />);

    fireEvent.click(screen.getByRole('button', { name: /Автомобиль/ }));
    fireEvent.click(screen.getByRole('button', { name: /Toyota Camry/ }));
    fireEvent.click(screen.getByRole('button', { name: /Условия аренды/ }));
    fireEvent.change(screen.getByLabelText('Начало аренды *'), {
      target: { value: '2026-11-20T10:00' },
    });
    fireEvent.change(screen.getByLabelText('Возврат *'), {
      target: { value: '2026-11-22T10:00' },
    });

    await act(async () => vi.advanceTimersByTime(701));

    expect(actionMocks.saveDraft).toHaveBeenCalledTimes(1);
    const formData = actionMocks.saveDraft.mock.calls[0]?.[1] as FormData;
    expect(formData.get('vehicleId')).toBe('vehicle-a');
    expect(formData.get('clientId')).toBe('client-a');
    vi.useRealTimers();
  });

  it('opens the live contract preview in an accessible mobile dialog', () => {
    render(<RentalConstructor bootstrap={bootstrap} />);

    fireEvent.click(screen.getByRole('button', { name: 'Открыть предпросмотр' }));

    expect(screen.getByRole('dialog', { name: 'Предварительный просмотр договора' })).toBeTruthy();
    expect(screen.getAllByText('Щапова Анна Петровна').length).toBeGreaterThan(0);
  });

  it('preserves form values after closing the mobile preview', () => {
    render(<RentalConstructor bootstrap={bootstrap} />);
    fireEvent.click(screen.getByRole('button', { name: /Условия аренды/ }));
    const start = screen.getByLabelText('Начало аренды *') as HTMLInputElement;
    fireEvent.change(start, { target: { value: '2026-11-20T10:00' } });

    fireEvent.click(screen.getByRole('button', { name: 'Открыть предпросмотр' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(start.value).toBe('2026-11-20T10:00');
  });

  it('keeps only non-file constructor fields in local recovery', async () => {
    render(<RentalConstructor bootstrap={bootstrap} />);

    await waitFor(() => {
      expect(
        window.localStorage.getItem(
          'supa-pro:rental-constructor:v1:company-a:user-a',
        ),
      ).toBeTruthy();
    });

    const saved = window.localStorage.getItem(
      'supa-pro:rental-constructor:v1:company-a:user-a',
    );
    expect(saved).toContain('client-a');
    expect(saved).not.toContain('Щапова');
    expect(saved).not.toContain('+7 950');
    expect(saved).not.toContain('documentsReady');
  });

  it('finalizes the saved draft and navigates to the rental', async () => {
    vi.useFakeTimers();
    actionMocks.saveDraft.mockResolvedValue({
      ok: true,
      rentalId: 'rental-a',
      updatedAt: '2026-11-15T10:00:00.000Z',
      calculation: { days: 2, totalMinor: 600000, discountMinor: 0, servicesMinor: 0 },
    });
    actionMocks.finalize.mockResolvedValue({
      ok: true,
      rentalId: 'rental-a',
      documentVersion: 1,
    });
    render(<RentalConstructor bootstrap={bootstrap} />);

    fireEvent.click(screen.getByRole('button', { name: /Автомобиль/ }));
    fireEvent.click(screen.getByRole('button', { name: /Toyota Camry/ }));
    fireEvent.click(screen.getByRole('button', { name: /Условия аренды/ }));
    fireEvent.change(screen.getByLabelText('Начало аренды *'), {
      target: { value: '2026-11-20T10:00' },
    });
    fireEvent.change(screen.getByLabelText('Возврат *'), {
      target: { value: '2026-11-22T10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Выдача автомобиля/ }));
    fireEvent.change(screen.getByLabelText('Одометр при выдаче, км *'), {
      target: { value: '84639' },
    });
    fireEvent.change(screen.getByLabelText('Топливо при выдаче, % *'), {
      target: { value: '75' },
    });

    await act(async () => vi.advanceTimersByTime(701));
    fireEvent.click(screen.getByRole('button', { name: /Проверка/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Создать договор' }));
    await act(async () => Promise.resolve());

    expect(actionMocks.finalize).toHaveBeenCalledTimes(1);
    expect(actionMocks.push).toHaveBeenCalledWith('/rentals/rental-a');
  });
});

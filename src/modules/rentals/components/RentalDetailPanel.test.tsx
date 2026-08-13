// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  retry: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.toast }),
}));
vi.mock('@/modules/rentals/server/actions', () => ({
  cancelRentalAction: mocks.cancel,
  generateRentalDocumentsAction: mocks.retry,
}));

import { RentalDetailPanel } from './RentalDetailPanel';

describe('RentalDetailPanel', () => {
  it('shows sanitized history, contract formats and a confirmed missing-documents retry', () => {
    render(
      <RentalDetailPanel
        rental={{
          id: 'rental-1',
          companyId: 'company-1',
          status: 'CONFIRMED',
          contractNumber: 'ME-2026-0001-BK',
        }}
        documents={[{ version: 2, format: 'PDF' }]}
        generations={[{ version: 3, status: 'ERROR', updatedAt: '2026-08-13T09:00:00.000Z' }]}
        history={[
          {
            id: 'a1',
            action: 'DOWNLOAD',
            label: 'Документ договора аренды',
            createdAt: '2026-08-13T09:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'История действий' })).toBeTruthy();
    expect(screen.getByText(/Документ договора/u)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Скачать PDF v2' }).getAttribute('href')).toBe(
      '/rentals/rental-1/documents/2/PDF',
    );
    expect(screen.getByRole('button', { name: 'Повторить создание документов' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Отменить договор' })).toBeTruthy();
    expect(screen.getByText('Версия 3: ошибка подготовки')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить договор' }));
    expect(screen.getByText('Отменить подтверждённый договор?')).toBeTruthy();
  });
});

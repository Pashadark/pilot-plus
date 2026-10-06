// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  retry: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
  pending: false,
}));
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  useFormStatus: () => ({ pending: mocks.pending }),
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
  it('показывает защищённые документы и переводит безопасный аудит', () => {
    render(
      <RentalDetailPanel
        rental={{
          id: 'rental-1',
          companyId: 'company-1',
          status: 'CONFIRMED',
          contractNumber: 'ME-2026-0001-BK',
        }}
        documents={[{ version: 2, format: 'PDF' }]}
        generations={[
          {
            version: 3,
            status: 'ERROR',
            docxReady: false,
            pdfReady: false,
            updatedAt: '2026-08-13T09:00:00.000Z',
          },
        ]}
        source="Снимок подтверждённого договора"
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
    expect(screen.getByText('Документ скачан')).toBeTruthy();
    expect(screen.queryByText('DOWNLOAD')).toBeNull();
    expect(screen.getByRole('link', { name: 'Скачать PDF, версия 2' }).getAttribute('href')).toBe(
      '/rentals/rental-1/documents/2/PDF',
    );
    expect(screen.getByRole('button', { name: 'Повторить создание документов' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Отменить договор' })).toBeTruthy();
    expect(screen.getByText('Версия 3: Ошибка')).toBeTruthy();
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
    fireEvent.click(screen.getByRole('button', { name: 'Отменить договор' }));
    expect(screen.getByText('Отменить подтверждённый договор?')).toBeTruthy();
  });

  it('честно объясняет отсутствие файлов и аудита у импортированного договора', () => {
    render(
      <RentalDetailPanel
        rental={{
          id: 'rental-1',
          companyId: 'company-1',
          status: 'COMPLETED',
          contractNumber: 'ME-2026-0001-BK',
        }}
        documents={[]}
        generations={[]}
        history={[]}
        source="Импортированный договор"
      />,
    );

    expect(screen.getByText('Для импортированного договора файлы не формировались.')).toBeTruthy();
    expect(
      screen.getByText('Для этого договора действия пользователей не зафиксированы.'),
    ).toBeTruthy();
  });

  it('блокирует повторную отправку, пока документы формируются', () => {
    mocks.pending = true;
    render(
      <RentalDetailPanel
        rental={{
          id: 'rental-1',
          companyId: 'company-1',
          status: 'CONFIRMED',
          contractNumber: 'ME-2026-0001-BK',
        }}
        documents={[]}
        generations={[
          {
            version: 1,
            status: 'PENDING',
            docxReady: false,
            pdfReady: false,
            updatedAt: '2026-08-13T09:00:00.000Z',
          },
        ]}
        history={[]}
      />,
    );

    const button = screen.getByRole('button', { name: 'Документы формируются…' });
    expect(button).toHaveProperty('disabled', true);
    expect(screen.getByText('Версия 1: Подготовка')).toBeTruthy();
    mocks.pending = false;
  });
});

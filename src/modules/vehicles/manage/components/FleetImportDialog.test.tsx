// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../import/actions', () => ({
  previewFleetImportAction: vi.fn(),
  applyFleetImportAction: vi.fn(),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { FleetImportDialog } from './FleetImportDialog';

afterEach(cleanup);

describe('FleetImportDialog', () => {
  it('offers an accessible Excel import action', () => {
    render(
      <FleetImportDialog companies={[{ id: 'company-1', label: 'Компания', canArchive: true }]} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Импортировать Excel' }));
    expect(screen.getByLabelText('Файл Excel')).toBeTruthy();
    expect(screen.getByLabelText('Файл Excel').getAttribute('accept')).toBe('.xlsx');
  });

  it('requires a company choice when several authorized companies are available', () => {
    render(
      <FleetImportDialog
        companies={[
          { id: 'company-1', label: 'Первая компания', canArchive: true },
          { id: 'company-2', label: 'Вторая компания', canArchive: false },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Импортировать Excel' }));
    expect(screen.getByLabelText('Компания')).toBeTruthy();
  });
});

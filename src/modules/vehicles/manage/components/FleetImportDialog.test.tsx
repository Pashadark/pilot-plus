// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../import/actions', () => ({
  previewFleetImportAction: vi.fn(),
  applyFleetImportAction: vi.fn(),
}));

import { FleetImportDialog } from './FleetImportDialog';

describe('FleetImportDialog', () => {
  it('offers an accessible Excel import action', () => {
    render(<FleetImportDialog companyId="company-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Импортировать Excel' }));
    expect(screen.getByLabelText('Файл Excel')).toBeTruthy();
    expect(screen.getByLabelText('Файл Excel').getAttribute('accept')).toBe('.xlsx');
  });
});

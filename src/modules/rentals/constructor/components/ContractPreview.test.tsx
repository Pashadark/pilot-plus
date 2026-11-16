// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ContractPreview } from './ContractPreview';

afterEach(cleanup);

describe('ContractPreview', () => {
  it('shows the real generated PDF instead of a shortened HTML copy', () => {
    render(
      <ContractPreview
        rentalId="rental-1"
        version="2026-11-16T06:00:00.000Z"
        saveStatus="saved"
      />,
    );

    const frame = screen.getByTitle('Точный предпросмотр договора');
    expect(frame.getAttribute('src')).toBe(
      '/rentals/rental-1/preview?version=2026-11-16T06%3A00%3A00.000Z',
    );
    expect(document.querySelectorAll('[data-contract-page]')).toHaveLength(0);
  });

  it('waits for the saved draft before requesting a PDF', () => {
    render(<ContractPreview rentalId={undefined} version={undefined} saveStatus="saving" />);

    expect(screen.queryByTitle('Точный предпросмотр договора')).toBeNull();
    expect(screen.getByText('Сначала сохраните данные договора.')).toBeTruthy();
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ClientError from './error';
import ClientLoading from './loading';

vi.mock('@/shared/components/app-shell/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));

describe('client detail route states', () => {
  afterEach(cleanup);

  it('reserves the document workspace geometry in the route skeleton', () => {
    render(<ClientLoading />);

    expect(screen.getByLabelText('Загрузка клиента')).toBeTruthy();
    expect(screen.getByTestId('client-documents-skeleton')).toBeTruthy();
  });

  it('shows a Russian retryable detail error state', () => {
    const retry = vi.fn();
    render(<ClientError error={new Error('private path')} unstable_retry={retry} />);

    expect(
      screen.getByRole('heading', { name: 'Не удалось загрузить карточку клиента' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain('private path');
  });
});

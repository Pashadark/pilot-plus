// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('external=preserved'),
}));

import { ClientPage } from './ClientPage';

afterEach(cleanup);

describe('ClientPage', () => {
  it('renders the tenant-scoped page without exposing a create action to read-only users', () => {
    render(
      <ClientPage
        result={{ items: [], page: 1, pageSize: 24 }}
        filters={{ page: 1 }}
        canManage={false}
        companies={[]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Клиенты' })).toBeTruthy();
    expect(screen.getByText('Клиентская база')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Быстрые фильтры клиентов' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Добавить клиента' })).toBeNull();
  });

  it('keeps the add-client action readable at narrow widths', () => {
    render(
      <ClientPage
        result={{ items: [], page: 1, pageSize: 24 }}
        filters={{ page: 1 }}
        canManage
        companies={[]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Добавить клиента' }).className).toContain(
      'whitespace-nowrap',
    );
  });
});

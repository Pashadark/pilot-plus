// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireClientAccess: vi.fn(),
  getRentalConstructorBootstrap: vi.fn(),
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RentalConstructor: ({ bootstrap }: { bootstrap: { companyId: string } }) => (
    <div data-testid="constructor-company">{bootstrap.companyId}</div>
  ),
}));

vi.mock('@/modules/clients/access', () => ({ requireClientAccess: mocks.requireClientAccess }));
vi.mock('@/modules/rentals/constructor/server/bootstrap', () => ({
  getRentalConstructorBootstrap: mocks.getRentalConstructorBootstrap,
}));
vi.mock('@/modules/rentals/constructor/components/RentalConstructor', () => ({
  RentalConstructor: mocks.RentalConstructor,
}));
vi.mock('@/shared/components/app-shell/AppShell', () => ({ AppShell: mocks.AppShell }));

import NewRentalPage from './page';

afterEach(cleanup);

describe('new rental constructor route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireClientAccess.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.getRentalConstructorBootstrap.mockResolvedValue({ companyId: 'company-a' });
  });

  it('passes preferred company and client to one constructor bootstrap', async () => {
    render(
      await NewRentalPage({
        searchParams: Promise.resolve({ company: 'company-a', client: 'client-a' }),
      }),
    );

    expect(mocks.getRentalConstructorBootstrap).toHaveBeenCalledWith(
      { user: { id: 'user-1' } },
      { preferredCompanyId: 'company-a', preferredClientId: 'client-a' },
    );
    expect(screen.getByTestId('constructor-company').textContent).toBe('company-a');
  });
});

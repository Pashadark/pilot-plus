// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/components/app-shell/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/shared/ui', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  Skeleton: ({ className }: { className?: string }) => <span className={className} />,
}));

import AdminLoading from './loading';

afterEach(cleanup);

describe('AdminLoading', () => {
  it('резервирует место для реквизитов компании и команды', () => {
    render(<AdminLoading />);

    expect(screen.getByLabelText('Загрузка центра управления')).toBeTruthy();
    expect(screen.getAllByTestId('admin-company-team-skeleton')).toHaveLength(2);
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/actions', () => ({ createConstructorClientAction: vi.fn() }));

import { ClientSection } from './ClientSection';

afterEach(cleanup);

const client = {
  id: 'client-1',
  companyId: 'company-1',
  fullName: 'Щапова Анна Петровна',
  phone: '+7 (950) 080-99-08',
  status: 'VERIFIED',
};

describe('ClientSection', () => {
  it('selects an existing client without leaving the constructor', async () => {
    const selected = vi.fn();
    render(
      <ClientSection
        companyId="company-1"
        clients={[client]}
        selectedId={undefined}
        onSelected={selected}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Щапова Анна Петровна/ }));

    expect(selected).toHaveBeenCalledWith(expect.objectContaining({ id: client.id }));
  });

  it('shows duplicate candidates before creating a new client', async () => {
    render(
      <ClientSection
        companyId="company-1"
        clients={[client]}
        selectedId={undefined}
        onSelected={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Создать нового' }));
    await userEvent.type(screen.getByLabelText('Телефон'), '+7 950 080-99-08');

    expect(screen.getByText(/Возможный дубликат/)).toBeTruthy();
    expect(screen.getByText('Щапова Анна Петровна')).toBeTruthy();
  });
});

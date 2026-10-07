import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/clients/actions', () => ({ createClientAction: vi.fn() }));

import { BookingClientStep } from './BookingClientStep';

describe('BookingClientStep', () => {
  it('opens the embedded new-client form', async () => {
    render(
      <BookingClientStep companyId="company-1" clients={[]} selectedId="" onSelect={vi.fn()} />,
    );
    const action = screen.getByRole('button', { name: 'Новый клиент' });
    expect(action.className).toContain('whitespace-nowrap');
    expect(screen.getByRole('group', { name: 'Поиск и создание клиента' })).toBeTruthy();
    await userEvent.click(action);
    expect(screen.getByRole('heading', { name: 'Новый клиент' })).toBeTruthy();
  });
});
// @vitest-environment jsdom

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
    await userEvent.click(screen.getByRole('button', { name: 'Создать нового' }));
    expect(screen.getByRole('heading', { name: 'Новый клиент' })).toBeTruthy();
  });
});
// @vitest-environment jsdom

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ClientWorkspaceTabs } from './ClientWorkspaceTabs';

afterEach(cleanup);

describe('ClientWorkspaceTabs', () => {
  it('переключает доступные вкладки и показывает счётчики', () => {
    render(
      <ClientWorkspaceTabs
        rentalCount={3}
        commentCount={2}
        overview={<p>Обзор клиента</p>}
        rentals={<p>История аренд</p>}
        documents={<p>Документы клиента</p>}
        comments={<p>Комментарии клиента</p>}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Аренды 3' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Комментарии 2' }));
    expect(screen.getByText('Комментарии клиента')).toBeTruthy();
  });
});

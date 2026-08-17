// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({
  createClientCommentAction: vi.fn(),
  updateClientCommentAction: vi.fn(),
  toggleClientCommentPinAction: vi.fn(),
  hideClientCommentAction: vi.fn(),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { ClientCommentsPanel } from './ClientCommentsPanel';

afterEach(cleanup);

describe('ClientCommentsPanel', () => {
  it('показывает форму и существующий комментарий', () => {
    render(
      <ClientCommentsPanel
        clientId="client-1"
        canManage
        currentUserId="user-1"
        canHideAny={false}
        rentals={[]}
        comments={[
          {
            id: 'comment-1',
            rentalId: null,
            rentalLabel: null,
            authorUserId: 'user-1',
            authorName: 'Анна Смирнова',
            category: 'GENERAL',
            severity: 'INFO',
            text: 'Возврат без замечаний',
            isPinned: false,
            hiddenAt: null,
            createdAt: '2026-08-17T10:00:00.000Z',
            updatedAt: '2026-08-17T10:00:00.000Z',
          },
        ]}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Комментарий' })).toBeTruthy();
    expect(screen.getByText('Возврат без замечаний')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Скрыть комментарий' })).toBeTruthy();
  });
});

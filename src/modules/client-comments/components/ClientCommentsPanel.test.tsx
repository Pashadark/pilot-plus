// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({
  createClientCommentAction: vi.fn(),
  updateClientCommentAction: vi.fn(),
  toggleClientCommentPinAction: vi.fn(),
  hideClientCommentAction: vi.fn(),
  resolveClientCommentAction: vi.fn(),
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
        canManageRating
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
            problemStatus: null,
            affectsRating: false,
            ratingDelta: null,
            resolvedAt: null,
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
    expect(screen.getByLabelText('Учитывать в рейтинге')).toBeTruthy();
  });

  it('shows lifecycle controls and keeps manual score controls administrator-only', () => {
    render(
      <ClientCommentsPanel
        clientId="client-1"
        canManage
        canManageRating
        currentUserId="user-1"
        canHideAny
        rentals={[]}
        comments={[
          {
            id: 'comment-1',
            rentalId: null,
            rentalLabel: null,
            authorUserId: 'user-1',
            authorName: 'Анна',
            category: 'PAYMENT',
            severity: 'DANGER',
            text: 'Оплата просрочена',
            isPinned: false,
            problemStatus: 'OPEN',
            affectsRating: true,
            ratingDelta: -15,
            resolvedAt: null,
            hiddenAt: null,
            createdAt: '2026-08-17T10:00:00.000Z',
            updatedAt: '2026-08-17T10:00:00.000Z',
          },
        ]}
      />,
    );
    expect(screen.getByText('Открыта')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Решить проблему' })).toBeTruthy();
    expect(screen.getByLabelText('Влияние на рейтинг')).toBeTruthy();
  });
});

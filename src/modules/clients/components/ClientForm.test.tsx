// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({
  createClientAction: vi.fn(),
  updateClientAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/shared/providers/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { ClientForm } from './ClientForm';

afterEach(cleanup);

describe('ClientForm', () => {
  it('uses the submitter FormData intent for a draft, so an invalid native draft cannot leak into a later final submit', () => {
    render(<ClientForm companies={[{ id: 'company-1', name: 'Pilot+' }]} />);

    const draft = screen.getByRole('button', { name: 'Сохранить черновик' });
    expect(draft.getAttribute('name')).toBe('intent');
    expect(draft.getAttribute('value')).toBe('draft');
  });
});

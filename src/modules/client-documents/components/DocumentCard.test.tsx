// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ClientDocumentListItem } from '../types';

vi.mock('../actions', () => ({
  archiveClientDocumentAction: vi.fn(),
  uploadClientDocumentAction: vi.fn(),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import { DocumentCard } from './DocumentCard';

const cleanImage: ClientDocumentListItem = {
  id: 'document-1',
  category: 'PASSPORT',
  title: 'Паспорт',
  status: 'CLEAN',
  currentVersion: 2,
  originalName: 'passport.jpg',
  verifiedMime: 'image/jpeg',
  bytes: 2048,
  createdAt: '2026-08-09T10:00:00.000Z',
  updatedAt: '2026-08-09T10:00:00.000Z',
};

describe('DocumentCard', () => {
  afterEach(cleanup);

  it('shows image format text, revisioned CLEAN preview and all permitted actions', () => {
    const { rerender } = render(
      <DocumentCard clientId="client-1" document={cleanImage} canManage canArchive />,
    );

    expect(screen.getByText(/Изображение/u)).toBeTruthy();
    expect(screen.getByText('Проверен')).toBeTruthy();
    const firstPreview = screen.getByRole('img', {
      name: 'Предпросмотр документа «Паспорт»',
    });
    expect(firstPreview.getAttribute('src')).toContain('preview=1&v=2');
    expect(screen.getByRole('link', { name: 'Скачать' }).getAttribute('href')).toContain(
      '/clients/client-1/documents/document-1/download',
    );
    expect(screen.getByRole('button', { name: 'Заменить документ «Паспорт»' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Архивировать документ «Паспорт»' })).toBeTruthy();

    rerender(
      <DocumentCard
        clientId="client-1"
        document={{ ...cleanImage, currentVersion: 3 }}
        canManage
        canArchive
      />,
    );
    const replacedPreview = screen.getByRole('img', {
      name: 'Предпросмотр документа «Паспорт»',
    });
    expect(replacedPreview.getAttribute('src')).toContain('preview=1&v=3');
    expect(replacedPreview).not.toBe(firstPreview);
  });

  it('shows PDF text and an explicit preview link', () => {
    render(
      <DocumentCard
        clientId="client-1"
        document={{
          ...cleanImage,
          id: 'document-2',
          title: 'Договор',
          originalName: 'contract.pdf',
          verifiedMime: 'application/pdf',
        }}
        canManage={false}
        canArchive={false}
      />,
    );

    expect(screen.getByText(/PDF/u)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Предпросмотр' }).getAttribute('href')).toContain(
      'preview=1&v=2',
    );
    expect(screen.queryByRole('button', { name: /Заменить документ/u })).toBeNull();
    expect(screen.queryByRole('button', { name: /Архивировать документ/u })).toBeNull();
  });

  it('breaks a long filename instead of widening the document card', () => {
    const longName = `${'длинное-имя-без-пробелов'.repeat(20)}.pdf`;
    render(
      <DocumentCard
        clientId="client-1"
        document={{ ...cleanImage, originalName: longName }}
        canManage={false}
        canArchive={false}
      />,
    );

    const filename = screen.getByText(longName);
    expect(filename.className).toContain('min-w-0');
    expect(filename.className).toContain('break-all');
  });

  it('связывает replacement disclosure, объявляет статус и переводит фокус в форму', async () => {
    const user = userEvent.setup();
    render(<DocumentCard clientId="client-1" document={cleanImage} canManage canArchive />);

    const status = screen.getByRole('status', { name: 'Статус документа: Проверен' });
    expect(status).toBeTruthy();
    const trigger = screen.getByRole('button', { name: 'Заменить документ «Паспорт»' });
    await user.click(trigger);

    const region = screen.getByRole('region', { name: 'Замена документа «Паспорт»' });
    expect(trigger.getAttribute('aria-controls')).toBe(region.id);
    expect(region.contains(document.activeElement)).toBe(true);
  });

  it.each([
    ['PENDING', 'Проверяется'],
    ['BLOCKED', 'Заблокирован'],
    ['ERROR', 'Ошибка проверки'],
  ] as const)('does not expose preview or download while status is %s', (status, label) => {
    render(
      <DocumentCard
        clientId="client-1"
        document={{ ...cleanImage, status }}
        canManage
        canArchive
      />,
    );

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Скачать' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Предпросмотр' })).toBeNull();
    expect(screen.queryByRole('img', { name: /Предпросмотр документа/u })).toBeNull();
  });
});

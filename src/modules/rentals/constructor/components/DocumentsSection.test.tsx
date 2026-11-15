// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/client-documents/actions', () => ({
  uploadClientDocumentAction: vi.fn(),
}));
vi.mock('@/modules/clients/components/ClientDocumentAutofillDialog', () => ({
  ClientDocumentAutofillDialog: () => null,
}));

import type { ClientDocumentListItem } from '@/modules/client-documents/types';

import { DocumentsSection } from './DocumentsSection';

afterEach(cleanup);

function document(
  id: string,
  category: ClientDocumentListItem['category'],
  status: ClientDocumentListItem['status'],
): ClientDocumentListItem {
  return {
    id,
    category,
    title: category === 'PASSPORT' ? 'Паспорт' : 'Водительское удостоверение',
    status,
    currentVersion: 1,
    originalName: `${id}.jpg`,
    verifiedMime: 'image/jpeg',
    bytes: 1024,
    createdAt: '2026-11-15T09:00:00.000Z',
    updatedAt: '2026-11-15T09:00:00.000Z',
  };
}

describe('DocumentsSection', () => {
  it('keeps uploads disabled until a client is selected', () => {
    render(
      <DocumentsSection
        clientId={undefined}
        clientName={undefined}
        documents={[]}
        onReadinessChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Сначала выберите или создайте клиента.')).toBeTruthy();
    expect((screen.getByLabelText('Паспорт — основной разворот') as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it('marks documents ready only when passport and driver license are clean', async () => {
    const readiness = vi.fn();
    const { rerender } = render(
      <DocumentsSection
        clientId="client-1"
        clientName="Щапова Анна Петровна"
        documents={[document('passport', 'PASSPORT', 'CLEAN')]}
        onReadinessChange={readiness}
      />,
    );

    await waitFor(() => expect(readiness).toHaveBeenLastCalledWith(false));

    rerender(
      <DocumentsSection
        clientId="client-1"
        clientName="Щапова Анна Петровна"
        documents={[
          document('passport', 'PASSPORT', 'CLEAN'),
          document('license', 'DRIVER_LICENSE', 'CLEAN'),
        ]}
        onReadinessChange={readiness}
      />,
    );

    await waitFor(() => expect(readiness).toHaveBeenLastCalledWith(true));
    expect(screen.getByText('Документы готовы')).toBeTruthy();
  });
});

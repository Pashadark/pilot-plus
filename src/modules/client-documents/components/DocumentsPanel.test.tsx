// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  uploadDocument: vi.fn(),
  uploadPhoto: vi.fn(),
}));

vi.mock('../actions', () => ({
  archiveClientDocumentAction: vi.fn(),
  uploadClientDocumentAction: mocks.uploadDocument,
  uploadClientPhotoAction: mocks.uploadPhoto,
}));
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import { DocumentsPanel } from './DocumentsPanel';

describe('DocumentsPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders an honest empty state and both labelled upload controls for a manager', () => {
    render(
      <DocumentsPanel
        clientId="client-1"
        clientName="Анна Воронова"
        documents={[]}
        canManage
        canArchive={false}
      />,
    );

    expect(screen.getByText('Документы пока не загружены')).toBeTruthy();
    expect(screen.getByLabelText('Фотография клиента')).toBeTruthy();
    expect(screen.getByLabelText('Файл документа')).toBeTruthy();
    expect(screen.getByLabelText(/Категория документа/u)).toBeTruthy();
    expect(screen.getByLabelText(/Название документа/u)).toBeTruthy();
  });

  it('keeps the viewer panel read-only while preserving the empty state', () => {
    render(
      <DocumentsPanel
        clientId="client-1"
        clientName="Анна Воронова"
        documents={[]}
        canManage={false}
        canArchive={false}
      />,
    );

    expect(screen.getByText('Документы пока не загружены')).toBeTruthy();
    expect(screen.queryByLabelText('Фотография клиента')).toBeNull();
    expect(screen.queryByLabelText('Файл документа')).toBeNull();
  });
});

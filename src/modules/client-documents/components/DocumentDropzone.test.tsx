// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DocumentDropzone } from './DocumentDropzone';

describe('DocumentDropzone', () => {
  afterEach(cleanup);

  it('keeps the native picker labelled and keyboard reachable', async () => {
    const user = userEvent.setup();
    render(
      <DocumentDropzone
        id="document-file"
        label="Файл документа"
        accept=".jpg,.png,.webp,.pdf"
        onFileSelect={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Файл документа') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.jpg,.png,.webp,.pdf');
    await user.tab();
    expect(document.activeElement).toBe(input);
  });

  it('accepts a dropped file as an enhancement and announces its name', () => {
    const onFileSelect = vi.fn();
    const file = new File(['safe'], 'паспорт.jpg', { type: 'image/jpeg' });
    render(
      <DocumentDropzone
        id="document-file"
        label="Файл документа"
        accept=".jpg,.png,.webp,.pdf"
        onFileSelect={onFileSelect}
      />,
    );

    fireEvent.drop(screen.getByTestId('document-dropzone'), {
      dataTransfer: { files: [file] },
    });

    expect(onFileSelect).toHaveBeenCalledWith(file);
    expect(screen.getByText('паспорт.jpg')).toBeTruthy();
  });

  it('shows indeterminate upload progress and a Russian inline error', () => {
    render(
      <DocumentDropzone
        id="document-file"
        label="Файл документа"
        accept=".jpg"
        busy
        error="Тип файла не поддерживается."
        onFileSelect={vi.fn()}
      />,
    );

    const progress = screen.getByRole('progressbar', { name: 'Загрузка и проверка файла' });
    expect(progress.getAttribute('aria-valuenow')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Тип файла не поддерживается.');
  });
});

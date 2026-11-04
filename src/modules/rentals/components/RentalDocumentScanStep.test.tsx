// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const applyClientOcrReviewActionMock = vi.hoisted(() => vi.fn());
const uploadClientDocumentActionMock = vi.hoisted(() => vi.fn());
const uploadClientPhotoActionMock = vi.hoisted(() => vi.fn());

vi.mock('@/modules/clients/actions', () => ({
  applyClientOcrReviewAction: applyClientOcrReviewActionMock,
}));
vi.mock('@/modules/client-documents/actions', () => ({
  uploadClientDocumentAction: uploadClientDocumentActionMock,
  uploadClientPhotoAction: uploadClientPhotoActionMock,
}));

import { RentalDocumentScanStep } from './RentalDocumentScanStep';

describe('RentalDocumentScanStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            fields: {
              firstName: 'Анна',
              middleName: 'Сергеевна',
              lastName: 'Воронова',
              birthDate: '1990-04-12',
              passportSeries: '4510',
              passportNumber: '123456',
            },
            portrait: null,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            fields: {
              driverLicense: '9910 654321',
              driverLicenseIssuedAt: '2020-01-01',
              driverLicenseExpiresAt: '2030-01-01',
            },
          }),
        }),
    );
    applyClientOcrReviewActionMock.mockResolvedValue({
      status: 'success',
      message: 'Распознанные данные сохранены.',
      clientId: 'client-1',
    });
    uploadClientDocumentActionMock.mockResolvedValue({
      status: 'success',
      message: 'Документ загружен.',
    });
    uploadClientPhotoActionMock.mockResolvedValue({
      status: 'success',
      message: 'Фотография загружена.',
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the passport animation only while recognition is running', async () => {
    const pendingResponses: Array<(value: unknown) => void> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            pendingResponses.push(resolve);
          }),
      ),
    );

    const { container } = render(
      <RentalDocumentScanStep
        client={{
          id: 'client-1',
          companyId: 'company-1',
          fullName: 'Анна Воронова',
          phone: '+79991234567',
          passport: null,
          driverLicense: null,
          driverLicenseExpiresAt: null,
          updatedAt: '2026-08-04T12:00:00.000Z',
        }}
        onReady={vi.fn()}
      />,
    );

    expect(screen.queryByRole('img', { name: 'Обложка паспорта' })).toBeNull();

    const fileInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInputs[0]!, {
      target: { files: [new File(['passport'], 'passport.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(fileInputs[1]!, {
      target: { files: [new File(['license'], 'license.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Распознать документы' }));

    const cover = await screen.findByRole('img', { name: 'Обложка паспорта' });
    expect(decodeURIComponent(cover.getAttribute('src') ?? '')).toContain(
      '/documents/passport-cover.png',
    );
    expect(screen.getByTestId('passport-scan-beam')).toBeTruthy();
    expect(screen.getByText('Автоматически распознаём данные')).toBeTruthy();
    expect(screen.getAllByText('Подготавливаем изображения')).toHaveLength(2);

    await waitFor(() => expect(pendingResponses).toHaveLength(2));

    pendingResponses.forEach((resolve) =>
      resolve({ ok: true, json: async () => ({ fields: {}, portrait: null }) }),
    );

    await screen.findByRole('heading', { name: 'Проверьте распознанные данные' });
    expect(screen.queryByRole('img', { name: 'Обложка паспорта' })).toBeNull();
  });

  it('lets the operator review and edit OCR fields before any client data is persisted', async () => {
    const onReady = vi.fn();
    const { container } = render(
      <RentalDocumentScanStep
        client={{
          id: 'client-1',
          companyId: 'company-1',
          fullName: 'Анна Воронова',
          phone: '+79991234567',
          passport: null,
          driverLicense: null,
          driverLicenseExpiresAt: null,
          updatedAt: '2026-08-04T12:00:00.000Z',
        }}
        onReady={onReady}
      />,
    );

    const fileInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInputs[0]!, {
      target: { files: [new File(['passport'], 'passport.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(fileInputs[1]!, {
      target: { files: [new File(['license'], 'license.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Распознать документы' }));

    expect(
      await screen.findByRole('heading', { name: 'Проверьте распознанные данные' }),
    ).toBeTruthy();
    expect(applyClientOcrReviewActionMock).not.toHaveBeenCalled();
    expect(uploadClientDocumentActionMock).not.toHaveBeenCalled();

    const firstName = screen.getByRole('textbox', { name: 'Имя' });
    fireEvent.change(firstName, { target: { value: 'Анна-Мария' } });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить и сохранить' }));

    await waitFor(() => expect(applyClientOcrReviewActionMock).toHaveBeenCalledOnce());
    const reviewed = applyClientOcrReviewActionMock.mock.calls[0]?.[1] as FormData;
    expect(reviewed.get('firstName')).toBe('Анна-Мария');
    await waitFor(() => expect(uploadClientDocumentActionMock).toHaveBeenCalledTimes(2));
    expect(onReady).toHaveBeenCalledWith(true);
  });
});

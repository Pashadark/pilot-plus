// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({
  createClientAction: vi.fn(),
  updateClientAction: vi.fn(),
}));
vi.mock('@/modules/client-documents/actions', () => ({
  uploadClientDocumentAction: vi.fn().mockResolvedValue({
    status: 'success',
    message: 'Документ загружен.',
  }),
  uploadClientPhotoAction: vi.fn(),
}));
vi.mock('./ClientDocumentAutofillDialog', () => ({
  ClientDocumentAutofillDialog: ({
    open,
    onApply,
  }: {
    open: boolean;
    onApply: (fields: Record<string, string>, files: Record<string, File>) => void;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() =>
          onApply(
            {
              firstName: 'Дарья',
              lastName: 'Савина',
              passportSeries: '4518',
              registrationAddress: 'Москва, ул. Тверская, д. 1',
              driverLicense: '99 24 267195',
            },
            {
              passportMain: new File(['passport'], 'passport.jpg', { type: 'image/jpeg' }),
              passportRegistration: new File(['registration'], 'registration.jpg', {
                type: 'image/jpeg',
              }),
              driverLicense: new File(['licence'], 'licence.jpg', { type: 'image/jpeg' }),
            },
          )
        }
      >
        Применить распознанные данные
      </button>
    ) : null,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/shared/providers/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { ClientForm } from './ClientForm';
import { createClientAction, updateClientAction } from '../actions';
import { uploadClientDocumentAction } from '@/modules/client-documents/actions';
import type { ClientDetailDto } from '../types';

const existingClient: ClientDetailDto = {
  id: 'client-1',
  companyId: 'company-1',
  fullName: 'Иванов Иван Иванович',
  firstName: 'Иван',
  middleName: 'Иванович',
  lastName: 'Иванов',
  birthDate: '1990-01-02T00:00:00.000Z',
  phone: '+7 900 000-00-00',
  additionalPhone: '+7 916 111-22-33',
  phoneMasked: '+7 *** ***-00-00',
  email: 'ivan@example.com',
  passport: '12 34 567890',
  passportMasked: '12 34 ******',
  registrationAddress: 'Москва',
  actualAddress: 'Москва',
  driverLicense: '99 99 123456',
  driverLicenseMasked: '99 99 ******',
  driverLicenseIssuedAt: '2020-01-02T00:00:00.000Z',
  driverLicenseExpiresAt: '2030-01-02T00:00:00.000Z',
  status: 'VERIFIED',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  localPhotoUrl: null,
  telegramUrl: null,
  fineSummary: { total: 0, paidAmountMinor: '0' },
  rentalSummary: { total: 0, active: 0, current: null, last: null },
};

afterEach(cleanup);

describe('ClientForm', () => {
  async function reachFinalStep() {
    fireEvent.change(screen.getByLabelText(/^Имя/), { target: { value: 'Дарья' } });
    fireEvent.change(screen.getByLabelText(/^Фамилия/), { target: { value: 'Савина' } });
    fireEvent.change(screen.getByLabelText(/^Телефон/), { target: { value: '+79161234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Создать клиента' })).toBeTruthy(),
    );
  }

  it('uses the submitter FormData intent for a draft, so an invalid native draft cannot leak into a later final submit', () => {
    render(<ClientForm companies={[{ id: 'company-1', name: 'СУПА ПРО' }]} />);

    const draft = screen.getByRole('button', { name: 'Сохранить черновик' });
    expect(draft.getAttribute('name')).toBe('intent');
    expect(draft.getAttribute('value')).toBe('draft');
    expect(screen.getByRole('button', { name: 'Автозаполнение по документам' })).toBeTruthy();
  });

  it('принимает паспорт, права и фотографию до создания карточки', () => {
    render(<ClientForm companies={[{ id: 'company-1', name: 'СУПА ПРО' }]} />);

    expect(screen.getByLabelText('Скан паспорта').getAttribute('disabled')).toBeNull();
    expect(
      screen.getByLabelText('Скан водительского удостоверения').getAttribute('disabled'),
    ).toBeNull();
    expect(screen.getByLabelText('Фотография клиента').getAttribute('disabled')).toBeNull();
  });

  it('показывает редактирование существующего клиента целиком на одном экране', () => {
    const clientWithPassportFields = {
      ...existingClient,
      passportSeries: '45 18',
      passportNumber: '621431',
      passportIssuedBy: 'ГУ МВД России по г. Москве',
      passportIssuedAt: '2018-05-14',
      passportDivisionCode: '770-001',
    } as ClientDetailDto;
    render(
      <ClientForm
        companies={[{ id: 'company-1', name: 'СУПА ПРО' }]}
        client={clientWithPassportFields}
      />,
    );

    expect(screen.queryByLabelText('Шаги формы')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Далее' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Назад' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeTruthy();

    for (const label of [/^Телефон/, /^Дополнительный телефон/, 'Статус']) {
      const field = screen.getByLabelText(label);
      expect(field.closest('fieldset')?.hidden).toBe(false);
    }
    expect(screen.queryByLabelText('Паспорт (как в базе)')).toBeNull();
    expect((screen.getByLabelText('Серия паспорта') as HTMLInputElement).value).toBe('45 18');
    expect((screen.getByLabelText('Номер паспорта') as HTMLInputElement).value).toBe('621431');
    expect((screen.getByLabelText('Дата выдачи паспорта') as HTMLInputElement).value).toBe(
      '2018-05-14',
    );
    expect((screen.getByLabelText('Код подразделения') as HTMLInputElement).value).toBe('770-001');
    expect((screen.getByLabelText('Кем выдан паспорт') as HTMLInputElement).value).toBe(
      'ГУ МВД России по г. Москве',
    );
  });

  it('передаёт текущий телефон отдельно, если новый номер не вводили', async () => {
    vi.mocked(updateClientAction).mockResolvedValue({
      status: 'success',
      message: 'Карточка клиента обновлена.',
      clientId: existingClient.id,
    });
    render(
      <ClientForm companies={[{ id: 'company-1', name: 'СУПА ПРО' }]} client={existingClient} />,
    );

    const phone = screen.getByLabelText(/^Телефон/) as HTMLInputElement;
    expect(phone.value).toBe('');
    expect(
      screen.getByText(
        `Текущий номер: ${existingClient.phone}. Оставьте поле пустым, чтобы не менять.`,
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));

    await waitFor(() => expect(updateClientAction).toHaveBeenCalledOnce());
    const submitted = vi.mocked(updateClientAction).mock.calls[0]?.[1] as FormData;
    expect(submitted.get('phone')).toBe('');
    expect(submitted.get('existingPhone')).toBe(existingClient.phone);
  });

  it('обновляет подсказку текущего телефона при переходе между карточками клиентов', async () => {
    const { rerender } = render(
      <ClientForm
        companies={[{ id: 'company-1', name: 'СУПА ПРО' }]}
        client={{ ...existingClient, phone: '' }}
      />,
    );

    rerender(
      <ClientForm
        companies={[{ id: 'company-1', name: 'СУПА ПРО' }]}
        client={{ ...existingClient, phone: '+7 906 944-62-49' }}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText('Текущий номер: +7 906 944-62-49. Оставьте поле пустым, чтобы не менять.'),
      ).toBeTruthy(),
    );
  });

  it('автозаполняет существующие поля и сохраняет три исходных документа', async () => {
    vi.mocked(createClientAction).mockResolvedValue({
      status: 'success',
      message: 'Клиент создан.',
      clientId: 'client-new',
    });
    render(<ClientForm companies={[{ id: 'company-1', name: 'СУПА ПРО' }]} />);
    await reachFinalStep();

    fireEvent.click(screen.getByRole('button', { name: 'Автозаполнение по документам' }));
    fireEvent.click(screen.getByRole('button', { name: 'Применить распознанные данные' }));

    expect((screen.getByLabelText('Серия паспорта') as HTMLInputElement).value).toBe('4518');
    expect((screen.getByLabelText('Адрес регистрации') as HTMLInputElement).value).toBe(
      'Москва, ул. Тверская, д. 1',
    );
    expect((screen.getByLabelText('Водительское удостоверение') as HTMLInputElement).value).toBe(
      '99 24 267195',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
    fireEvent.click(screen.getByRole('button', { name: 'Создать клиента' }));

    await waitFor(() => expect(uploadClientDocumentAction).toHaveBeenCalledTimes(3));
    const uploads = vi.mocked(uploadClientDocumentAction).mock.calls.map((call) => {
      const formData = call[1] as FormData;
      return { category: formData.get('category'), title: formData.get('title') };
    });
    expect(uploads).toEqual([
      { category: 'PASSPORT', title: 'Паспорт — основной разворот' },
      { category: 'PASSPORT', title: 'Регистрация по паспорту' },
      { category: 'DRIVER_LICENSE', title: 'Водительское удостоверение' },
    ]);
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const showToast = vi.fn();

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast }),
}));

import { RentalListPage } from './RentalListPage';

afterEach(cleanup);

describe('RentalListPage', () => {
  it('показывает компактную панель фильтров первого варианта', () => {
    render(
      <RentalListPage
        rentals={[]}
        filters={{ query: 'Иванов', status: 'COMPLETED', from: '2026-08-01', to: '2026-08-31' }}
      />,
    );
    expect(screen.getByLabelText('Поиск по договору или клиенту').getAttribute('value')).toBe(
      'Иванов',
    );
    expect(screen.getByPlaceholderText('Поиск по договору или клиенту')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Статус' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Автомобиль' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Фильтры' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Сбросить фильтры' })).toBeTruthy();
  });

  it('повторяет крупную операционную таблицу второго варианта', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(
      <RentalListPage
        now="2026-08-23T12:00:00.000Z"
        rentals={[
          {
            id: 'active',
            clientId: 'client-active',
            vehicleId: 'vehicle-active',
            startsAt: '2026-08-20T09:00:00.000Z',
            endsAt: '2026-08-24T09:00:00.000Z',
            completedAt: null,
            status: 'ACTIVE',
            agreementType: 'LEASE_TO_OWN',
            contractNumber: 'ME-2026-0014',
            dailyRateMinor: BigInt(470_000),
            totalPriceMinor: BigInt(2_500_000),
            depositMinor: BigInt(10_000_000),
            currency: 'RUB',
            vehicleName: 'Kia Rio',
            registrationNumber: 'Р604АО997',
            vehicleInternalNumber: 'CAR-014',
            vehicleCity: 'Москва',
            vehicleImage: {
              localPath: '/vehicles/vehicle-active/images/image-1',
              alt: 'Kia Rio',
            },
            clientLabel: 'Филатов Илья',
            clientPhone: '+7 999 123-45-67',
            hasExtension: true,
            payments: [
              { kind: 'RENT', amountMinor: BigInt(2_500_000) },
              { kind: 'DEPOSIT', amountMinor: BigInt(10_000_000) },
            ],
            depositStatus: 'COLLECTED',
            depositWithheldMinor: null,
            documentFormats: ['DOCX', 'PDF'],
            documents: [
              { format: 'DOCX', version: 2 },
              { format: 'PDF', version: 2 },
            ],
          },
          {
            id: 'closed',
            clientId: 'client-closed',
            vehicleId: 'vehicle-closed',
            startsAt: '2026-08-17T09:00:00.000Z',
            endsAt: '2026-08-18T09:00:00.000Z',
            completedAt: '2026-08-18T12:00:00.000Z',
            status: 'COMPLETED',
            contractNumber: 'ME-2026-0011',
            dailyRateMinor: BigInt(470_000),
            totalPriceMinor: BigInt(940_000),
            depositMinor: BigInt(5_000_000),
            currency: 'RUB',
            vehicleName: 'Kia Rio',
            registrationNumber: 'Р604АО997',
            vehicleInternalNumber: 'CAR-011',
            vehicleCity: 'Москва',
            vehicleImage: null,
            clientLabel: 'Коломенцев Александр',
            clientPhone: null,
            hasExtension: false,
            payments: [],
            depositStatus: 'RETURNED',
            depositWithheldMinor: null,
            documentFormats: [],
            documents: [],
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Аренда' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Новый договор' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Новое бронирование' }).getAttribute('href'),
    ).toBe('/rentals?status=CONFIRMED&booking=new');
    for (const tab of ['Текущие', 'Бронирования', 'Архив'])
      expect(screen.getByRole('link', { name: tab })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Ожидают выдачи' })).toBeNull();
    for (const heading of [
      'Договор / Клиент',
      'Автомобиль / Гос. номер',
      'Выдача',
      'Возврат',
      'Осталось',
      'Сумма и статус',
      'Срок возврата',
      'Статус',
      'Действия',
    ])
      expect(screen.getByRole('columnheader', { name: heading })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Филатов Илья' })[0].getAttribute('href')).toBe(
      '/clients/client-active',
    );
    expect(screen.getAllByRole('link', { name: 'Kia Rio' })[0].getAttribute('href')).toBe(
      '/vehicles/vehicle-active',
    );
    expect(screen.getAllByRole('link', { name: 'Р604АО997' })[0].getAttribute('href')).toBe(
      '/vehicles/vehicle-active',
    );
    expect(screen.getByText('Нет телефона')).toBeTruthy();
    expect(screen.getByLabelText(/Действуют\s+\d/u)).toBeTruthy();
    expect(screen.getByLabelText(/Возврат сегодня\s+\d/u)).toBeTruthy();
    expect(screen.getByLabelText(/Бронирования\s+\d/u)).toBeTruthy();
    expect(screen.getByText('Показано 1–2 из 2')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Договоров на странице' })).toBeTruthy();
    expect(screen.getAllByText('Продлён').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Закрыт').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Оплачено/iu).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Оплачено 100%').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4\s*700\s*₽\/сутки/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Залог/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Вернуть до 22.09.2026').length).toBeGreaterThan(0);
    const rentalAmountCell = screen
      .getAllByText(/25\s*000\s*₽/u)
      .map((element) => element.closest('td'))
      .find(Boolean);
    const depositAmountCell = screen
      .getAllByText(/100\s*000\s*₽/u)
      .map((element) => element.closest('td'))
      .find(Boolean);
    expect(rentalAmountCell?.className).toContain('text-center');
    expect(depositAmountCell?.className).toContain('text-center');
    const activeRow = screen.getByTestId('rental-row-active');
    const actionStack = within(activeRow).getByTestId('rental-compact-actions');
    expect(actionStack.className).toContain('flex-col');
    expect(within(actionStack).getByRole('link', { name: 'Продлить' }).getAttribute('href')).toBe(
      '/rentals/active?action=extend#rental-actions',
    );
    expect(within(actionStack).getByRole('link', { name: 'Завершить' }).getAttribute('href')).toBe(
      '/rentals/active?action=return#rental-actions',
    );
    expect(screen.queryByRole('progressbar', { name: /Оплата/u })).toBeNull();
    expect(screen.getByRole('table').className).toContain('text-sm');
    expect(screen.getByRole('table').parentElement?.className).toContain('xl:block');
    expect(screen.getByTestId('rental-row-active').className).toContain('h-[94px]');
    expect(screen.queryByTestId('rental-status-strip-active')).toBeNull();
    expect(screen.getAllByText('С правом выкупа').length).toBeGreaterThan(0);
    const desktopCells = within(activeRow).getAllByRole('cell');
    expect(within(activeRow).getByTestId('rental-agreement-strip-active').className).toContain(
      'right-0',
    );
    expect(within(activeRow).getByTestId('rental-agreement-strip-active').className).not.toContain(
      'left-0',
    );
    expect(within(activeRow).getByText('С правом выкупа').closest('td')).toBe(desktopCells[8]);
    expect(
      screen
        .getAllByTestId('rental-agreement-strip-active')
        .every(
          (element) =>
            element.className.includes('bg-[#673AB7]') && element.className.includes('w-2'),
        ),
    ).toBe(true);
    expect(screen.getByTestId('rental-payment-column').className).toContain('w-[160px]');
    expect(screen.getByTestId('rental-deposit-column').className).toContain('w-[130px]');
    expect(screen.getByTestId('rental-list-page').className).toContain('lg:pl-0');
    expect(screen.getByTestId('rental-list-page').className).toContain('lg:pr-[52px]');
    const firstMobileCard = screen.getAllByRole('article')[0];
    expect(firstMobileCard.className).toContain('min-w-0');
    expect(firstMobileCard.parentElement?.className).toContain('xl:hidden');
    expect(screen.getByRole('navigation', { name: 'Статус договоров' }).className).toContain(
      '[scrollbar-width:none]',
    );

    const desktopActiveRow = screen.getByTestId('rental-row-active');
    await user.click(
      within(desktopActiveRow).getByRole('button', { name: 'Ещё действия ME-2026-0014' }),
    );
    const menu = screen.getByRole('menu', { name: 'Действия ME-2026-0014' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual([
      'Открыть договор',
      'Редактировать условия',
      'Внести или исправить оплату',
      'Управление залогом',
      'Открыть клиента',
      'Открыть автомобиль',
      'История действий',
      'Скачать PDF',
      'Скачать DOCX',
      'Скопировать номер договора',
      'Скопировать ссылку',
    ]);
    expect(
      within(menu)
        .getByRole('menuitem', { name: 'Внести или исправить оплату' })
        .getAttribute('href'),
    ).toBe('/rentals/active?settlement=rent#rental-settlement');
    expect(
      within(menu).getByRole('menuitem', { name: 'Управление залогом' }).getAttribute('href'),
    ).toBe('/rentals/active?settlement=deposit#rental-settlement');
    expect(within(menu).getByRole('menuitem', { name: 'Скачать PDF' }).getAttribute('href')).toBe(
      '/rentals/active/documents/2/PDF',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Скачать DOCX' }).getAttribute('href')).toBe(
      '/rentals/active/documents/2/DOCX',
    );
    await user.click(within(menu).getByRole('menuitem', { name: 'Скопировать номер договора' }));
    expect(writeText).toHaveBeenCalledWith('ME-2026-0014');
    expect(showToast).toHaveBeenCalledWith({
      tone: 'success',
      title: 'Номер договора скопирован.',
    });
  });
});

import { expect, test, type Locator, type Page } from '@playwright/test';

import { prisma } from '../src/database/prisma/client';
import { openAuthenticatedRoute } from './helpers/auth';

const E2E_DEVICE_PREFIX = `Pilot Connect E2E ${process.pid}`;
const E2E_SERIAL_PREFIX = 'PC-E2E-';

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000' });

async function closeToast(toast: Locator) {
  await expect(toast).toHaveCount(1);
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: 'Закрыть уведомление' }).click();
  await expect(toast).toHaveCount(0);
}

async function expectSuccessToast(page: Page, text: string) {
  const toast = page.locator('[data-toast-tone="success"]').filter({ hasText: text });
  await closeToast(toast);
}

async function cleanupE2EDevices() {
  await prisma.deviceCommand.deleteMany({
    where: { device: { serialNumber: { startsWith: E2E_SERIAL_PREFIX } } },
  });
  await prisma.device.deleteMany({ where: { serialNumber: { startsWith: E2E_SERIAL_PREFIX } } });
}

async function getFreeVehicleId() {
  const email = process.env.PILOT_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('Для E2E устройств нужен PILOT_ADMIN_EMAIL.');

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      company: { members: { some: { user: { email } } } },
      device: null,
    },
    select: { id: true },
    orderBy: { internalNumber: 'asc' },
  });
  if (!vehicle) throw new Error('Для E2E устройств не найден свободный автомобиль.');
  return vehicle.id;
}

async function submitAndCloseSuccessToast({
  page,
  dialog,
  button,
  successText,
}: {
  page: Page;
  dialog: Locator;
  button: string;
  successText: string;
}) {
  const submit = dialog.getByRole('button', { name: button });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog).toBeHidden();
  await expectSuccessToast(page, successText);
}

test.afterAll(async () => {
  await cleanupE2EDevices();
});

test('desktop: администратор управляет списком, привязкой и очередью Pilot Connect', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Сценарий списка и очереди выполняется в desktop-проекте.');
  test.setTimeout(90_000);
  await cleanupE2EDevices();
  await openAuthenticatedRoute(page, '/devices');

  await expect(page.getByTestId('devices-page')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Устройства Pilot Connect', level: 1 }),
  ).toBeVisible();
  await expect(page.getByTestId('devices-table')).toBeVisible();
  await expect(page.getByTestId('device-row')).toHaveCount(24);

  const search = page.getByRole('searchbox', { name: 'Поиск устройств' });
  await search.fill('PC-2026-0001');
  await expect(page.getByTestId('device-row')).toHaveCount(1);
  await expect(page.getByTestId('device-row')).toContainText('Pilot Connect 0001');

  await search.fill('PC-2026-0024');
  await expect(page.getByTestId('device-row')).toHaveCount(1);
  await expect(page.getByTestId('device-row')).toContainText('Не привязано');

  await page.getByLabel('Статус').selectOption('UNASSIGNED');
  await expect(page.getByTestId('device-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Сбросить' }).click();

  await page.getByLabel('Статус').selectOption('OFFLINE');
  await expect(page.getByTestId('device-row')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Сбросить' }).click();

  await page.getByLabel('Обновление').selectOption('available');
  await expect(page.getByTestId('device-row')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Сбросить' }).click();

  await page.getByLabel('Привязка').selectOption('free');
  await expect(page.getByTestId('device-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Сбросить' }).click();

  await search.fill('PC-2026-0024');
  await page.getByRole('link', { name: 'Pilot Connect 0024' }).click();
  await expect(page.getByTestId('device-detail-page')).toBeVisible();
  await expect(page.getByText('Координаты ещё не получены', { exact: true })).toBeVisible();
  await expect(page.getByTestId('device-command-history')).toContainText(
    'Команд для этого устройства пока нет.',
  );
  await page.getByRole('link', { name: 'К устройствам' }).click();

  const timestamp = Date.now();
  const name = `${E2E_DEVICE_PREFIX} ${timestamp}`;
  const serialNumber = `${E2E_SERIAL_PREFIX}${timestamp}`;
  const imei = `99${timestamp}`;
  const freeVehicleId = await getFreeVehicleId();

  await page.getByRole('button', { name: 'Добавить устройство' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Добавить устройство' });
  await createDialog.getByLabel('Название устройства').fill(name);
  await createDialog.getByLabel('Серийный номер').fill(serialNumber);
  await createDialog.getByLabel('IMEI').fill(imei);
  await createDialog.getByLabel('Версия оборудования').fill('2.1.0');
  await createDialog.getByLabel('Начальная прошивка').selectOption('2.3.8');
  await submitAndCloseSuccessToast({
    page,
    dialog: createDialog,
    button: 'Добавить устройство',
    successText: 'Устройство добавлено.',
  });

  await search.fill(serialNumber);
  await expect(page.getByTestId('device-row')).toHaveCount(1);
  await page.getByRole('link', { name }).click();
  await expect(page.getByTestId('device-detail-page')).toBeVisible();

  await page.getByRole('button', { name: 'Привязать автомобиль' }).click();
  const bindingDialog = page.getByRole('dialog', { name: 'Привязать автомобиль' });
  await bindingDialog.getByLabel('Автомобиль').selectOption(freeVehicleId);
  await submitAndCloseSuccessToast({
    page,
    dialog: bindingDialog,
    button: 'Сохранить привязку',
    successText: 'Автомобиль привязан к устройству.',
  });

  await page.getByRole('button', { name: 'Перезагрузить' }).click();
  await submitAndCloseSuccessToast({
    page,
    dialog: page.getByRole('dialog', { name: 'Перезагрузить устройство' }),
    button: 'Подтвердить перезагрузку',
    successText: 'Команда добавлена в очередь.',
  });
  await expect(page.getByTestId('device-command-history')).toContainText('Ожидает отправки');
  await expect(page.getByRole('button', { name: 'Перезагрузить' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Выключить' })).toBeDisabled();

  await page.getByRole('button', { name: 'Отменить команду' }).click();
  await expectSuccessToast(page, 'Команда отменена.');
  await expect(page.getByTestId('device-command-history')).toContainText('Отменена');
  await expect(page.getByRole('button', { name: 'Выключить' })).toBeEnabled();

  await page.getByRole('button', { name: 'Выключить' }).click();
  await submitAndCloseSuccessToast({
    page,
    dialog: page.getByRole('dialog', { name: 'Выключить устройство' }),
    button: 'Подтвердить выключение',
    successText: 'Команда добавлена в очередь.',
  });
  await page.getByRole('button', { name: 'Отменить команду' }).click();
  await expectSuccessToast(page, 'Команда отменена.');
  await expect(page.getByRole('button', { name: 'Обновить прошивку' })).toBeEnabled();

  await page.getByRole('button', { name: 'Обновить прошивку' }).click();
  const updateDialog = page.getByRole('dialog', { name: 'Обновить прошивку' });
  await expect(updateDialog.getByLabel('Версия прошивки')).toBeVisible();
  await submitAndCloseSuccessToast({
    page,
    dialog: updateDialog,
    button: 'Добавить в очередь',
    successText: 'Команда обновления прошивки добавлена в очередь.',
  });
  await page.getByRole('button', { name: 'Отменить команду' }).click();
  await expectSuccessToast(page, 'Команда отменена.');

  await page.goto('/devices/not-a-device-in-this-company');
  await expect(page.getByRole('heading', { name: /не найдена/i })).toBeVisible();
});

test('mobile: устройства не переполняют 390 px и действие открывается с клавиатуры', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Проверка адаптивности выполняется в mobile-проекте.');
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedRoute(page, '/devices');

  await expect(page.getByTestId('devices-mobile-list')).toBeVisible();
  await expect(page.getByTestId('devices-table')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const card = page.getByTestId('device-mobile-card').filter({ hasText: 'Pilot Connect 0001' });
  const actionMenu = card.getByRole('button', { name: 'Действия устройства Pilot Connect 0001' });
  const actionBox = await actionMenu.boundingBox();
  expect(actionBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(actionBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await actionMenu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.getByRole('menuitem', { name: 'Перезагрузить' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Перезагрузить устройство' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Перезагрузить устройство' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

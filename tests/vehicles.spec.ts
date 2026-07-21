import { expect, test } from '@playwright/test';

import { prisma } from '../src/database/prisma/client';
import { openAuthenticatedRoute } from './helpers/auth';

async function createVehicleHistory() {
  const email = process.env.PILOT_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('Для E2E истории автомобиля нужен PILOT_ADMIN_EMAIL.');

  const vehicle = await prisma.vehicle.findFirst({
    where: { company: { members: { some: { user: { email } } } } },
    select: { id: true, internalNumber: true, model: true },
    orderBy: { internalNumber: 'asc' },
  });
  if (!vehicle) throw new Error('Автомобиль администратора для E2E истории не найден.');

  const marker = `[Pilot+ E2E vehicle history:${process.pid}]`;
  const maintenanceTitle = `${marker} Замена масла`;
  const washProvider = `${marker} Мойка Pilot`;
  const scheduledAt = new Date();
  const [maintenance, wash] = await prisma.$transaction([
    prisma.maintenanceRecord.create({
      data: {
        vehicleId: vehicle.id,
        title: maintenanceTitle,
        kind: 'OIL',
        status: 'COMPLETED',
        scheduledAt,
        completedAt: scheduledAt,
        targetOdometerKm: 15000.5,
        provider: 'Сервис Pilot E2E',
        costMinor: 420000,
      },
      select: { id: true },
    }),
    prisma.washRecord.create({
      data: {
        vehicleId: vehicle.id,
        kind: 'COMPLEX',
        status: 'IN_PROGRESS',
        scheduledAt,
        startedAt: scheduledAt,
        provider: washProvider,
        costMinor: 190000,
      },
      select: { id: true },
    }),
  ]);
  return {
    vehicle,
    maintenanceId: maintenance.id,
    washId: wash.id,
    maintenanceTitle,
    washProvider,
  };
}

test.beforeEach(async ({ page }) => {
  await openAuthenticatedRoute(page, '/vehicles');
  await expect(page.getByTestId('vehicle-list-page')).toBeVisible();
});

test('автопарк показывает 130 записей и фильтрует карточки', async ({ page }) => {
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Автомобили', level: 1 })).toBeVisible();
  await expect(page.getByTestId('vehicle-count')).toContainText('Показано 130 из 130');

  await page.getByRole('searchbox', { name: 'Поиск автомобилей' }).fill('GWM WEY');
  await page.getByLabel('Город').selectOption({ label: 'Красноярск' });

  await expect(page.getByTestId('vehicle-count')).toContainText('Показано 1 из 130');
  await expect(page.getByTestId('vehicle-card')).toHaveCount(1);
  await expect(page.getByTestId('vehicle-card')).toContainText('Нет данных');
  await expect(page.getByTestId('vehicle-photo')).toBeVisible();
  await expect(page.getByRole('img', { name: 'GWM WEY — Красноярск' })).toBeVisible();
});

test('карточка открывает обзор и вкладку поездок', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Поиск автомобилей' }).fill('GWM WEY');
  await page.getByLabel('Город').selectOption({ label: 'Красноярск' });
  await page.getByRole('link', { name: 'Открыть', exact: true }).click();

  await expect(page.getByTestId('vehicle-detail-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'GWM WEY', level: 1 })).toBeVisible();
  await expect(page.getByTestId('vehicle-detail-photo')).toBeVisible();
  await page.getByRole('link', { name: 'Поездки' }).click();
  await expect(page).toHaveURL(/tab=trips/);
  await expect(page.getByText('Поездки ещё не поступали')).toBeVisible();
});

test('подробности автомобиля показывают реальные истории ТО и мойки', async ({ page }) => {
  const history = await createVehicleHistory();
  try {
    await page.goto(`/vehicles/${history.vehicle.id}?tab=maintenance`);
    await expect(page.getByTestId('vehicle-detail-page')).toBeVisible();

    const maintenance = page.getByTestId('vehicle-maintenance-history');
    await expect(maintenance).toContainText('История технического обслуживания');
    await expect(maintenance).toContainText(history.maintenanceTitle);
    await expect(maintenance).toContainText('Масло');
    await expect(maintenance).toContainText('Завершено');

    const wash = page.getByTestId('vehicle-wash-history');
    await expect(wash).toContainText('История моек');
    await expect(wash).toContainText('Комплексная');
    await expect(wash).toContainText('В работе');
    await expect(wash).toContainText(history.washProvider);
  } finally {
    await Promise.all([
      prisma.maintenanceRecord.deleteMany({ where: { id: history.maintenanceId } }),
      prisma.washRecord.deleteMany({ where: { id: history.washId } }),
    ]);
    await prisma.$disconnect();
  }
});

test('ошибка изображения заменяется фирменной заглушкой', async ({ page }) => {
  await page.route('**/_next/image**', (route) => route.abort());
  await page.reload();

  await expect(page.getByTestId('vehicle-photo-placeholder').first()).toBeVisible();
});

test('отсутствующая позиция объясняется информационным тостом', async ({ page }) => {
  await page
    .getByTestId('vehicle-card')
    .first()
    .getByRole('button', { name: 'Почему автомобиль не на карте' })
    .click();
  await expect(page.getByText('Координаты пока не получены')).toBeVisible();
  await expect(page.locator('[data-toast-tone="info"]')).toBeVisible();
});

test('мобильный автопарк не переполняет экран и сохраняет области касания', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/vehicles');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  const card = page.getByTestId('vehicle-card').first();
  await expect(card.getByTestId('vehicle-photo')).toBeVisible();
  for (const action of await card.getByRole('link').all()) {
    const box = await action.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  const mapButton = card.getByRole('button', { name: 'Почему автомобиль не на карте' });
  expect((await mapButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});

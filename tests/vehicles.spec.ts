import { expect, test } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await openAuthenticatedRoute(page, '/vehicles');
});

test('автопарк показывает 130 записей и фильтрует карточки', async ({ page }) => {
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

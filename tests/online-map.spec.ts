import { expect, test } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

test.describe('онлайн-карта', () => {
  test('перенаправляет анонимного пользователя на вход', async ({ page }) => {
    await page.goto('/map');

    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Вход в СУПА ПРО' })).toBeVisible();
  });

  test('показывает десять реальных автомобилей без демо-парка', async ({ page }) => {
    await openAuthenticatedRoute(page, '/map');

    await expect(page).toHaveTitle('Онлайн-карта | СУПА ПРО');
    await expect(page.getByRole('heading', { name: 'Онлайн-карта' })).toBeVisible();
    await expect(page.getByText('Демонстрационные данные')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Выбрать автомобиль/ })).toHaveCount(10);
    await expect(page.getByRole('button', { name: 'Выбрать автомобиль А429АУ997' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выбрать автомобиль Н726АХ550' })).toBeVisible();
  });

  test('выбирает реальную машину и показывает её данные', async ({ page }) => {
    await openAuthenticatedRoute(page, '/map');

    await page.getByRole('button', { name: 'Открыть карточку Kia Ceed' }).click();
    const panel = page.getByRole('complementary', { name: 'Выбранный автомобиль' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Kia Ceed');
    await expect(panel).toContainText('А429АУ997');
  });

  test('поиск и фильтры управляют реальным списком машин', async ({ page }) => {
    await openAuthenticatedRoute(page, '/map');

    const search = page.getByRole('searchbox', { name: 'Поиск транспорта' });
    await search.fill('В342НР797');
    await expect(page.getByRole('button', { name: 'Открыть карточку Kia K5' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Открыть карточку/ })).toHaveCount(1);

    await search.fill('');
    const offline = page.getByRole('button', { name: 'Нет связи' });
    await offline.click();
    await expect(offline).toHaveAttribute('aria-pressed', 'true');
  });

  test('карта показывает canvas, управление масштабом и атрибуцию', async ({ page }) => {
    await openAuthenticatedRoute(page, '/map');

    const map = page.getByRole('region', { name: 'Интерактивная карта автопарка' });
    await expect(map).toBeVisible();
    await expect(page.getByRole('button', { name: 'Увеличить масштаб' })).toBeVisible();
    await expect(page.getByRole('link', { name: /OpenStreetMap/ })).toBeVisible();
  });

  test('мобильная карта не создаёт горизонтальное переполнение', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAuthenticatedRoute(page, '/map');

    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await expect(page.getByRole('searchbox', { name: 'Поиск транспорта' })).toBeVisible();
  });
});
